import AsyncStorage from '@react-native-async-storage/async-storage';

const OBD_SNAPSHOT_KEY_PREFIX = 'obd:last_snapshot:';

export interface ObdLiveMetrics {
  rpm: number | null;
  coolantTempC: number | null;
  speedKph: number | null;
  engineLoadPct: number | null;
  batteryVoltage: number | null;
}

export interface ObdDiagnosticCode {
  code: string;
  description: string;
}

export interface ObdSnapshot {
  capturedAt: string;
  source: 'device' | 'simulated';
  metrics: ObdLiveMetrics;
  dtcs: ObdDiagnosticCode[];
}

export interface ObdTransport {
  isSupported(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  readPid(modeAndPid: string): Promise<string>;
  readStoredDtcs(): Promise<string>;
  readBatteryVoltage?(): Promise<string>;
}

class UnsupportedObdTransport implements ObdTransport {
  async isSupported(): Promise<boolean> {
    return false;
  }

  async connect(): Promise<void> {
    throw new Error('OBD transport is not configured in this build.');
  }

  async disconnect(): Promise<void> {}

  async readPid(): Promise<string> {
    throw new Error('OBD transport is not configured in this build.');
  }

  async readStoredDtcs(): Promise<string> {
    throw new Error('OBD transport is not configured in this build.');
  }
}

function normalizeHexFrame(frame: string): string[] {
  const tokens = frame
    .toUpperCase()
    .match(/[0-9A-F]+/g) ?? [];

  return tokens.flatMap((token) => {
    if (token.length === 2) return [token];
    if (token.length > 2 && token.length % 2 === 0) {
      const bytes: string[] = [];
      for (let i = 0; i < token.length; i += 2) {
        bytes.push(token.slice(i, i + 2));
      }
      return bytes;
    }
    return [];
  });
}

function decodeRpm(frame: string): number | null {
  const bytes = normalizeHexFrame(frame);
  const idx = bytes.findIndex((b, i) => b === '41' && bytes[i + 1] === '0C');
  if (idx < 0 || !bytes[idx + 2] || !bytes[idx + 3]) return null;
  const a = Number.parseInt(bytes[idx + 2], 16);
  const b = Number.parseInt(bytes[idx + 3], 16);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((((a * 256) + b) / 4) * 10) / 10;
}

function decodeCoolantTemp(frame: string): number | null {
  const bytes = normalizeHexFrame(frame);
  const idx = bytes.findIndex((b, i) => b === '41' && bytes[i + 1] === '05');
  if (idx < 0 || !bytes[idx + 2]) return null;
  const a = Number.parseInt(bytes[idx + 2], 16);
  if (!Number.isFinite(a)) return null;
  return a - 40;
}

function decodeSpeed(frame: string): number | null {
  const bytes = normalizeHexFrame(frame);
  const idx = bytes.findIndex((b, i) => b === '41' && bytes[i + 1] === '0D');
  if (idx < 0 || !bytes[idx + 2]) return null;
  const a = Number.parseInt(bytes[idx + 2], 16);
  if (!Number.isFinite(a)) return null;
  return a;
}

function decodeEngineLoad(frame: string): number | null {
  const bytes = normalizeHexFrame(frame);
  const idx = bytes.findIndex((b, i) => b === '41' && bytes[i + 1] === '04');
  if (idx < 0 || !bytes[idx + 2]) return null;
  const a = Number.parseInt(bytes[idx + 2], 16);
  if (!Number.isFinite(a)) return null;
  return Math.round(((a * 100) / 255) * 10) / 10;
}

function decodeVoltage(frame: string): number | null {
  const clean = frame.toUpperCase().trim();
  const direct = Number.parseFloat(clean.replace(/[^\d.]/g, ''));
  if (Number.isFinite(direct) && direct > 0) return Math.round(direct * 100) / 100;
  return null;
}

function decodeDtcPair(firstByteHex: string, secondByteHex: string): string | null {
  const a = Number.parseInt(firstByteHex, 16);
  const b = Number.parseInt(secondByteHex, 16);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === 0 && b === 0) return null;

  const sysMap = ['P', 'C', 'B', 'U'];
  const system = sysMap[(a & 0b11000000) >> 6];
  const d1 = ((a & 0b00110000) >> 4).toString(16).toUpperCase();
  const d2 = (a & 0b00001111).toString(16).toUpperCase();
  const d3 = ((b & 0b11110000) >> 4).toString(16).toUpperCase();
  const d4 = (b & 0b00001111).toString(16).toUpperCase();
  return `${system}${d1}${d2}${d3}${d4}`;
}

function decodeStoredDtcs(frame: string): string[] {
  const dtcs = new Set<string>();
  const lines = frame.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = lines.length ? lines : [frame];

  for (const line of candidates) {
    const bytes = normalizeHexFrame(line);
    const responseIndexes = bytes
      .map((byte, idx) => (byte === '43' ? idx : -1))
      .filter((idx) => idx >= 0);

    for (const idx of responseIndexes) {
      let availableBytes = bytes.length - idx - 1;
      const pciLength = idx > 0 ? Number.parseInt(bytes[idx - 1], 16) : NaN;
      if (Number.isFinite(pciLength) && pciLength > 1 && pciLength <= availableBytes + 1) {
        availableBytes = pciLength - 1;
      }

      const end = idx + 1 + availableBytes;
      for (let i = idx + 1; i + 1 < end; i += 2) {
        const code = decodeDtcPair(bytes[i], bytes[i + 1]);
        if (code) dtcs.add(code);
      }
    }
  }
  return [...dtcs];
}

const DTC_DESCRIPTIONS: Record<string, string> = {
  P0101: 'Mass or volume air flow circuit range/performance',
  P0113: 'Intake air temperature sensor high input',
  P0128: 'Coolant thermostat below regulating temperature',
  P0171: 'System too lean (Bank 1)',
  P0300: 'Random or multiple cylinder misfire detected',
  P0301: 'Cylinder 1 misfire detected',
  P0420: 'Catalyst system efficiency below threshold',
  P0442: 'Evaporative emission control small leak',
  P0500: 'Vehicle speed sensor malfunction',
  P0700: 'Transmission control system malfunction',
};

function describeDtc(code: string): string {
  return DTC_DESCRIPTIONS[code] ?? 'Unknown diagnostic trouble code';
}

class SimulatedObdTransport implements ObdTransport {
  async isSupported(): Promise<boolean> {
    return true;
  }

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async readPid(modeAndPid: string): Promise<string> {
    const cmd = modeAndPid.toUpperCase().replace(/\s+/g, '');
    if (cmd === '010C') return '41 0C 1A F8';
    if (cmd === '0105') return '41 05 64';
    if (cmd === '010D') return '41 0D 3C';
    if (cmd === '0104') return '41 04 7F';
    return 'NO DATA';
  }

  async readStoredDtcs(): Promise<string> {
    return '43 01 71 03 00 00 00';
  }

  async readBatteryVoltage(): Promise<string> {
    return '12.7V';
  }
}

class ObdService {
  private transport: ObdTransport = new UnsupportedObdTransport();
  private transportReady: Promise<void>;
  private resolveTransportReady!: () => void;
  private readonly simulator = new SimulatedObdTransport();

  constructor() {
    this.transportReady = new Promise<void>((resolve) => {
      this.resolveTransportReady = resolve;
    });
  }

  setTransport(transport: ObdTransport): void {
    this.transport = transport;
    this.resolveTransportReady();
  }

  useSimulator(): void {
    this.transport = this.simulator;
    this.resolveTransportReady();
  }

  async isSupported(): Promise<boolean> {
    // Wait up to 3s for native transport to register before falling back
    await Promise.race([
      this.transportReady,
      new Promise<void>((r) => setTimeout(r, 3000)),
    ]);
    return this.transport.isSupported();
  }

  async getLastSnapshot(carId: string): Promise<ObdSnapshot | null> {
    const raw = await AsyncStorage.getItem(`${OBD_SNAPSHOT_KEY_PREFIX}${carId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ObdSnapshot;
    } catch {
      return null;
    }
  }

  async scanCar(carId: string): Promise<ObdSnapshot> {
    return this.scanWithTransport(carId, this.transport);
  }

  async scanDemo(carId: string): Promise<ObdSnapshot> {
    return this.scanWithTransport(carId, this.simulator);
  }

  private async scanWithTransport(carId: string, transport: ObdTransport): Promise<ObdSnapshot> {
    try {
      await transport.connect();

      // ELM327 is serial — commands must be sent one at a time
      const rpmFrame = await transport.readPid('010C');
      const tempFrame = await transport.readPid('0105');
      const speedFrame = await transport.readPid('010D');
      const loadFrame = await transport.readPid('0104');
      const dtcFrame = await transport.readStoredDtcs();
      const voltageFrame = await (transport.readBatteryVoltage?.() ?? Promise.resolve(''));

      const dtcs = decodeStoredDtcs(dtcFrame).map((code) => ({
        code,
        description: describeDtc(code),
      }));

      const snapshot: ObdSnapshot = {
        capturedAt: new Date().toISOString(),
        source: transport instanceof SimulatedObdTransport ? 'simulated' : 'device',
        metrics: {
          rpm: decodeRpm(rpmFrame),
          coolantTempC: decodeCoolantTemp(tempFrame),
          speedKph: decodeSpeed(speedFrame),
          engineLoadPct: decodeEngineLoad(loadFrame),
          batteryVoltage: decodeVoltage(voltageFrame),
        },
        dtcs,
      };

      await AsyncStorage.setItem(`${OBD_SNAPSHOT_KEY_PREFIX}${carId}`, JSON.stringify(snapshot));
      return snapshot;
    } catch (err: any) {
      if (!(transport instanceof SimulatedObdTransport)) {
        console.log('[OBD] Native transport failed:', err?.message ?? err);
      }
      throw err;
    } finally {
      await transport.disconnect().catch(() => {});
    }
  }
}

export const obdService = new ObdService();

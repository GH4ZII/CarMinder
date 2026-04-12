import { decode as b64Decode, encode as b64Encode } from 'base-64';
import {
  BleError,
  BleManager,
  Characteristic,
  Device,
  Subscription,
} from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

import type { ObdTransport } from './obdService';

const ELM_SCAN_TIMEOUT_MS = 15000;
const ELM_COMMAND_TIMEOUT_MS = 6000;
const ELM_BOOT_TIMEOUT_MS = 10000;
const BLE_BUFFER_MAX_BYTES = 1024;
const ELM_NAME_HINTS = ['icar', 'v-link', 'vlink', 'v_link', 'elm', 'obd', 'obdii', 'obd2', 'vgate'];
/**
 * Known BLE UART service/characteristic mappings for ELM327 adapters.
 * Based on https://github.com/kkonteh97/SwiftOBD2
 *
 * Each entry maps a service UUID to its read (notify) and write characteristic UUIDs.
 * - FFE0: Generic BLE-serial adapters (Veepeak, cheap clones) — single FFE1 for both
 * - FFF0: Extended adapters — FFF1 (read) and FFF2 (write)
 * - 18F0: Vgate iCar Pro — 2AF0 (read) and 2AF1 (write)
 * - 6E400001: Nordic UART Service (NUS)
 */
type AdapterProfile = {
  serviceUuid: string;
  readCharUuid: string;
  writeCharUuid: string;
};

const ADAPTER_PROFILES: AdapterProfile[] = [
  { serviceUuid: '0000ffe0', readCharUuid: '0000ffe1', writeCharUuid: '0000ffe1' },
  { serviceUuid: '0000fff0', readCharUuid: '0000fff1', writeCharUuid: '0000fff2' },
  { serviceUuid: '000018f0', readCharUuid: '00002af0', writeCharUuid: '00002af1' },  // Vgate iCar Pro
  { serviceUuid: '6e400001', readCharUuid: '6e400003', writeCharUuid: '6e400002' },  // Nordic UART
];

const UART_SERVICE_HINTS = ADAPTER_PROFILES.map((p) => p.serviceUuid);

function normalizeUuid(value: string): string {
  return value.replace(/-/g, '').toLowerCase();
}

function deviceLooksLikeElm327(device: Device): boolean {
  const maybeName = `${device.name ?? ''} ${device.localName ?? ''}`.toLowerCase();
  if (ELM_NAME_HINTS.some((hint) => maybeName.includes(hint))) return true;

  // Also match by advertised service UUIDs (some adapters advertise no name)
  const advertised = device.serviceUUIDs ?? [];
  return advertised.some((uuid) => {
    const norm = normalizeUuid(uuid);
    return UART_SERVICE_HINTS.some((hint) => norm.includes(hint));
  });
}

function findAdapterProfile(serviceUuid: string): AdapterProfile | undefined {
  const norm = normalizeUuid(serviceUuid);
  return ADAPTER_PROFILES.find((p) => norm.includes(p.serviceUuid));
}

function serviceLooksPreferred(uuid: string): boolean {
  const normalized = normalizeUuid(uuid);
  return UART_SERVICE_HINTS.some((hint) => normalized.includes(hint));
}

type ResolvedGatt = {
  writeCharacteristic: Characteristic;
  notifyCharacteristic: Characteristic;
};

export class BleElm327ObdTransport implements ObdTransport {
  private manager = new BleManager();
  private device: Device | null = null;
  private gatt: ResolvedGatt | null = null;
  private monitorSub: Subscription | null = null;
  private lineBuffer = '';
  private connecting = false;
  private activeCommandTimer: ReturnType<typeof setInterval> | null = null;

  async isSupported(): Promise<boolean> {
    return Platform.OS === 'android' || Platform.OS === 'ios';
  }

  async connect(): Promise<void> {
    if (this.device && this.gatt) return;
    if (this.connecting) return;
    this.connecting = true;
    try {
      const supported = await this.isSupported();
      if (!supported) {
        throw new Error('Bluetooth OBD is supported only on iOS and Android.');
      }

      await this.ensurePermissions();
      await this.ensureBluetoothOn();
      const found = await this.scanForElmDevice();
      const connected = await found.connect({ timeout: ELM_SCAN_TIMEOUT_MS / 1000 });
      this.device = await connected.discoverAllServicesAndCharacteristics();
      this.gatt = await this.resolveGatt(this.device);
      this.startMonitor();
      await this.initializeElm327();
    } finally {
      this.connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.activeCommandTimer) {
        clearInterval(this.activeCommandTimer);
        this.activeCommandTimer = null;
      }
      this.monitorSub?.remove();
      this.monitorSub = null;
      if (this.device) {
        const stillConnected = await this.device.isConnected();
        if (stillConnected) {
          await this.manager.cancelDeviceConnection(this.device.id);
        }
      }
    } catch {
      // Best-effort disconnect.
    } finally {
      this.device = null;
      this.gatt = null;
      this.lineBuffer = '';
    }
  }

  async readPid(modeAndPid: string): Promise<string> {
    return this.sendElmCommand(modeAndPid, ELM_COMMAND_TIMEOUT_MS);
  }

  async readStoredDtcs(): Promise<string> {
    return this.sendElmCommand('03', ELM_COMMAND_TIMEOUT_MS);
  }

  async readBatteryVoltage(): Promise<string> {
    return this.sendElmCommand('ATRV', ELM_COMMAND_TIMEOUT_MS);
  }

  private async ensurePermissions(): Promise<void> {
    if (Platform.OS !== 'android') return;
    const sdk = Number(Platform.Version);
    if (!Number.isFinite(sdk)) return;

    if (sdk >= 31) {
      const scan = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
      const connect = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
      if (scan !== PermissionsAndroid.RESULTS.GRANTED || connect !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Bluetooth permissions were denied.');
      }
      return;
    }

    const location = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    if (location !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error('Location permission is required for Bluetooth scanning.');
    }
  }

  private async ensureBluetoothOn(): Promise<void> {
    const state = await this.manager.state();
    if (state === 'PoweredOn') return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscription.remove();
        reject(new Error('Bluetooth is off. Please enable Bluetooth and try again.'));
      }, ELM_SCAN_TIMEOUT_MS);

      const subscription = this.manager.onStateChange((nextState) => {
        if (nextState === 'PoweredOn') {
          clearTimeout(timeout);
          subscription.remove();
          resolve();
        }
      }, true);
    });
  }

  private async scanForElmDevice(): Promise<Device> {
    return new Promise<Device>((resolve, reject) => {
      let resolved = false;
      const seenDevices: string[] = [];
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        if (!resolved) {
          const debugInfo = seenDevices.length
            ? `\nDevices found nearby:\n${seenDevices.join('\n')}`
            : '\nNo BLE devices detected at all. Is Bluetooth on?';
          reject(new Error(`No OBD-II adapter found. Make sure it is plugged in and powered.${debugInfo}`));
        }
      }, ELM_SCAN_TIMEOUT_MS);

      this.manager.startDeviceScan(null, { allowDuplicates: false }, (error: BleError | null, scanned: Device | null) => {
        if (error) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          reject(new Error(error.message));
          return;
        }
        if (!scanned) return;

        // Log discovered devices for debugging
        const label = scanned.name ?? scanned.localName ?? '(unnamed)';
        const svcs = (scanned.serviceUUIDs ?? []).join(', ');
        const entry = `  • ${label} [${scanned.id}]${svcs ? ` services: ${svcs}` : ''}`;
        if (!seenDevices.includes(entry)) seenDevices.push(entry);

        if (!deviceLooksLikeElm327(scanned)) return;

        resolved = true;
        clearTimeout(timeout);
        this.manager.stopDeviceScan();
        console.log(`OBD adapter matched: ${label} [${scanned.id}]`);
        resolve(scanned);
      });
    });
  }

  private async resolveGatt(device: Device): Promise<ResolvedGatt> {
    const services = await device.services();
    if (!services.length) {
      throw new Error('No GATT services available from adapter.');
    }

    // First pass: try to match a known adapter profile with explicit char UUIDs
    for (const service of services) {
      const profile = findAdapterProfile(service.uuid);
      if (!profile) continue;

      const characteristics = await device.characteristicsForService(service.uuid);
      let writeCharacteristic: Characteristic | null = null;
      let notifyCharacteristic: Characteristic | null = null;

      for (const char of characteristics) {
        const charNorm = normalizeUuid(char.uuid);
        if (charNorm.includes(profile.writeCharUuid)) {
          writeCharacteristic = char;
        }
        if (charNorm.includes(profile.readCharUuid)) {
          notifyCharacteristic = char;
        }
        // Some profiles use same UUID for read and write (e.g. FFE1)
        if (profile.readCharUuid === profile.writeCharUuid && charNorm.includes(profile.readCharUuid)) {
          writeCharacteristic = char;
          notifyCharacteristic = char;
        }
      }

      if (writeCharacteristic && notifyCharacteristic) {
        console.log(`Matched adapter profile: service=${profile.serviceUuid}`);
        return { writeCharacteristic, notifyCharacteristic };
      }
    }

    // Fallback: pick first writable + first notifiable from any preferred service
    let writeCharacteristic: Characteristic | null = null;
    let notifyCharacteristic: Characteristic | null = null;

    const orderedServices = [...services].sort((a, b) => {
      const aScore = serviceLooksPreferred(a.uuid) ? 1 : 0;
      const bScore = serviceLooksPreferred(b.uuid) ? 1 : 0;
      return bScore - aScore;
    });

    for (const service of orderedServices) {
      const characteristics = await device.characteristicsForService(service.uuid);
      for (const char of characteristics) {
        if (!writeCharacteristic && (char.isWritableWithResponse || char.isWritableWithoutResponse)) {
          writeCharacteristic = char;
        }
        if (!notifyCharacteristic && (char.isNotifiable || char.isIndicatable || char.isReadable)) {
          notifyCharacteristic = char;
        }
      }
      if (writeCharacteristic && notifyCharacteristic) break;
    }

    if (!writeCharacteristic || !notifyCharacteristic) {
      throw new Error('Could not find adapter UART characteristics.');
    }

    console.log('Using fallback GATT resolution (no known profile matched).');
    return { writeCharacteristic, notifyCharacteristic };
  }

  private startMonitor(): void {
    if (!this.device || !this.gatt) return;
    if (this.monitorSub) {
      this.monitorSub.remove();
      this.monitorSub = null;
    }

    this.monitorSub = this.manager.monitorCharacteristicForDevice(
      this.device.id,
      this.gatt.notifyCharacteristic.serviceUUID,
      this.gatt.notifyCharacteristic.uuid,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        try {
          const chunk = b64Decode(characteristic.value);
          if (this.lineBuffer.length + chunk.length <= BLE_BUFFER_MAX_BYTES) {
            this.lineBuffer += chunk;
          }
        } catch {
          // Ignore malformed frames.
        }
      }
    );
  }

  private async initializeElm327(): Promise<void> {
    await this.sendElmCommand('ATZ', ELM_BOOT_TIMEOUT_MS);   // Reset adapter
    await this.sendElmCommand('ATE0', ELM_COMMAND_TIMEOUT_MS); // Echo off
    await this.sendElmCommand('ATL0', ELM_COMMAND_TIMEOUT_MS); // Linefeeds off
    await this.sendElmCommand('ATS1', ELM_COMMAND_TIMEOUT_MS); // Spaces on (parsers expect space-separated bytes)
    await this.sendElmCommand('ATH1', ELM_COMMAND_TIMEOUT_MS); // Headers on (needed for ECU identification)
    await this.sendElmCommand('ATAT1', ELM_COMMAND_TIMEOUT_MS); // Adaptive timing on
    await this.sendElmCommand('ATSP0', ELM_COMMAND_TIMEOUT_MS); // Auto-detect protocol
  }

  private async sendElmCommand(command: string, timeoutMs: number): Promise<string> {
    if (!this.device || !this.gatt) {
      throw new Error('OBD adapter is not connected.');
    }

    const payload = `${command.trim().toUpperCase()}\r`;
    const encodedPayload = b64Encode(payload);
    this.lineBuffer = '';

    if (this.gatt.writeCharacteristic.isWritableWithResponse) {
      await this.device.writeCharacteristicWithResponseForService(
        this.gatt.writeCharacteristic.serviceUUID,
        this.gatt.writeCharacteristic.uuid,
        encodedPayload
      );
    } else {
      await this.device.writeCharacteristicWithoutResponseForService(
        this.gatt.writeCharacteristic.serviceUUID,
        this.gatt.writeCharacteristic.uuid,
        encodedPayload
      );
    }

    return new Promise<string>((resolve, reject) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        const done = this.lineBuffer.includes('>');
        const timedOut = Date.now() - startedAt > timeoutMs;
        if (!done && !timedOut) return;

        clearInterval(timer);
        this.activeCommandTimer = null;
        if (timedOut) {
          reject(new Error(`Adapter timeout while running ${command}.`));
          return;
        }

        const raw = this.lineBuffer;
        this.lineBuffer = '';
        const cleaned = raw
          .replace(/>/g, ' ')
          .replace(/\r/g, ' ')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        resolve(cleaned || 'NO DATA');
      }, 35);
      this.activeCommandTimer = timer;
    });
  }
}

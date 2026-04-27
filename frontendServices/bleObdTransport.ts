import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BleError,
  BleManager,
  Characteristic,
  Device,
  Subscription,
} from 'react-native-ble-plx';

import type { ObdDevice, ObdTransport } from './obdService';

const LAST_OBD_DEVICE_KEY = 'obd:last_connected_device';
const ELM_SCAN_TIMEOUT_MS = 15000;
const ELM_COMMAND_TIMEOUT_MS = 6000;
const ELM_BOOT_TIMEOUT_MS = 10000;
const BLE_BUFFER_MAX_BYTES = 1024;
const RECONNECT_INITIAL_DELAY_MS = 5000;
const RECONNECT_MAX_DELAY_MS = 60000;
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const ELM_NAME_HINTS = [
  'bafx',
  'carista',
  'elm',
  'icar',
  'konnwei',
  'kw903',
  'lelink',
  'obd',
  'obdii',
  'obd2',
  'obdlink',
  'veepeak',
  'vgate',
  'v-link',
  'v_link',
  'vlink',
];
/**
 * Known BLE UART service/characteristic mappings for ELM327 adapters.

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

function encodeBase64Ascii(value: string): string {
  let output = '';
  for (let i = 0; i < value.length; i += 3) {
    const byte1 = value.charCodeAt(i) & 0xff;
    const hasByte2 = i + 1 < value.length;
    const byte2 = hasByte2 ? value.charCodeAt(i + 1) & 0xff : 0;
    const hasByte3 = i + 2 < value.length;
    const byte3 = hasByte3 ? value.charCodeAt(i + 2) & 0xff : 0;

    output += BASE64_ALPHABET.charAt(byte1 >> 2);
    output += BASE64_ALPHABET.charAt(((byte1 & 0x03) << 4) | (byte2 >> 4));
    output += hasByte2
      ? BASE64_ALPHABET.charAt(((byte2 & 0x0f) << 2) | (byte3 >> 6))
      : '=';
    output += hasByte3 ? BASE64_ALPHABET.charAt(byte3 & 0x3f) : '=';
  }
  return output;
}

function decodeBase64Ascii(value: string): string {
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, '');
  let output = '';

  for (let i = 0; i < clean.length; i += 4) {
    const enc1 = BASE64_ALPHABET.indexOf(clean.charAt(i));
    const enc2 = BASE64_ALPHABET.indexOf(clean.charAt(i + 1));
    const enc3 = BASE64_ALPHABET.indexOf(clean.charAt(i + 2));
    const enc4 = BASE64_ALPHABET.indexOf(clean.charAt(i + 3));

    if (enc1 < 0 || enc2 < 0) continue;

    output += String.fromCharCode((enc1 << 2) | (enc2 >> 4));
    if (enc3 >= 0 && enc3 !== 64) {
      output += String.fromCharCode(((enc2 & 0x0f) << 4) | (enc3 >> 2));
    }
    if (enc4 >= 0 && enc4 !== 64) {
      output += String.fromCharCode(((enc3 & 0x03) << 6) | enc4);
    }
  }

  return output;
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

function canWrite(char: Characteristic): boolean {
  return char.isWritableWithResponse || char.isWritableWithoutResponse;
}

function canReceiveNotifications(char: Characteristic): boolean {
  return char.isNotifiable || char.isIndicatable;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BleElm327ObdTransport implements ObdTransport {
  private manager = new BleManager();
  private device: Device | null = null;
  private gatt: ResolvedGatt | null = null;
  private monitorSub: Subscription | null = null;
  private disconnectSub: Subscription | null = null;
  private lineBuffer = '';
  private connectPromise: Promise<void> | null = null;
  private activeCommandTimer: ReturnType<typeof setInterval> | null = null;
  private discoveredDevices = new Map<string, Device>();
  private connectedDevice: ObdDevice | null = null;
  private lastKnownDevice: ObdDevice | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs = RECONNECT_INITIAL_DELAY_MS;
  private shouldReconnect = false;
  private reconnecting = false;
  private connectHandlers = new Set<(device: ObdDevice) => void>();
  private disconnectHandlers = new Set<() => void>();

  async isSupported(): Promise<boolean> {
    return Platform.OS === 'android' || Platform.OS === 'ios';
  }

  async connect(): Promise<void> {
    if (this.device && this.gatt) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      const supported = await this.isSupported();
      if (!supported) {
        throw new Error('Bluetooth OBD is supported only on iOS and Android.');
      }

      await this.ensurePermissions();
      await this.ensureBluetoothOn();
      const remembered = await this.getRememberedDevice();
      if (remembered) {
        try {
          await this.connectToRememberedDevice(remembered);
          return;
        } catch (error) {
          console.log('[OBD] Remembered adapter reconnect failed:', error);
        }
      }
      const found = await this.scanForElmDevice();
      await this.connectDevice(found);
    })();

    try {
      await this.connectPromise;
    } catch (error) {
      await this.disconnectInternal();
      throw error;
    } finally {
      this.connectPromise = null;
    }
  }

  async scanDevices(onDevice?: (device: ObdDevice) => void): Promise<ObdDevice[]> {
    const supported = await this.isSupported();
    if (!supported) {
      throw new Error('Bluetooth OBD is supported only on iOS and Android.');
    }

    await this.ensurePermissions();
    await this.ensureBluetoothOn();
    this.discoveredDevices.clear();

    return new Promise<ObdDevice[]>((resolve, reject) => {
      const found = new Map<string, ObdDevice>();
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        this.manager.stopDeviceScan();
        resolve(
          [...found.values()].sort((a, b) => {
            const obdScore = Number(Boolean(b.isLikelyObd)) - Number(Boolean(a.isLikelyObd));
            if (obdScore !== 0) return obdScore;
            return (b.rssi ?? -999) - (a.rssi ?? -999);
          })
        );
      };

      const timeout = setTimeout(finish, ELM_SCAN_TIMEOUT_MS);

      this.manager.startDeviceScan(null, { allowDuplicates: false }, (error: BleError | null, scanned: Device | null) => {
        if (settled) return;

        if (error) {
          settled = true;
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          reject(new Error(error.message));
          return;
        }
        if (!scanned) return;

        if (!deviceLooksLikeElm327(scanned)) return;

        this.discoveredDevices.set(scanned.id, scanned);
        const label = scanned.name ?? scanned.localName ?? 'Unnamed Bluetooth device';
        const item: ObdDevice = {
          id: scanned.id,
          name: label,
          rssi: scanned.rssi,
          isLikelyObd: deviceLooksLikeElm327(scanned),
        };
        found.set(scanned.id, item);
        onDevice?.(item);
      });
    });
  }

  async connectToDevice(device: ObdDevice): Promise<void> {
    if (this.device?.id === device.id && this.gatt) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = (async () => {
      const supported = await this.isSupported();
      if (!supported) {
        throw new Error('Bluetooth OBD is supported only on iOS and Android.');
      }

      await this.ensurePermissions();
      await this.ensureBluetoothOn();
      const discovered = this.discoveredDevices.get(device.id);
      if (discovered) {
        await this.connectDevice(discovered, device);
        return;
      }

      const connected = await this.manager.connectToDevice(device.id, { timeout: ELM_SCAN_TIMEOUT_MS });
      await this.connectDevice(connected, device, true);
    })();

    try {
      await this.connectPromise;
    } catch (error) {
      await this.disconnectInternal();
      throw error;
    } finally {
      this.connectPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    await this.disconnectInternal();
  }

  async restoreConnection(): Promise<void> {
    if (this.device && this.gatt) return;
    if (this.connectPromise || this.reconnecting) return;

    const supported = await this.isSupported();
    if (!supported) return;

    const remembered = await this.getRememberedDevice();
    if (!remembered) return;

    this.shouldReconnect = true;
    this.reconnecting = true;
    let retry = false;
    try {
      await this.ensurePermissions();
      await this.ensureBluetoothOn();
      await this.connectToRememberedDevice(remembered);
    } catch (error) {
      console.log('[OBD] Restore connection failed:', error);
      retry = true;
    } finally {
      this.reconnecting = false;
    }

    if (retry) {
      this.scheduleReconnect();
    }
  }

  private async disconnectInternal(): Promise<void> {
    try {
      if (this.activeCommandTimer) {
        clearInterval(this.activeCommandTimer);
        this.activeCommandTimer = null;
      }
      this.monitorSub?.remove();
      this.monitorSub = null;
      this.disconnectSub?.remove();
      this.disconnectSub = null;
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
      this.connectedDevice = null;
      this.lineBuffer = '';
    }
  }

  getConnectedDevice(): ObdDevice | null {
    return this.connectedDevice;
  }

  onDisconnect(handler: () => void): () => void {
    this.disconnectHandlers.add(handler);
    return () => {
      this.disconnectHandlers.delete(handler);
    };
  }

  onConnect(handler: (device: ObdDevice) => void): () => void {
    this.connectHandlers.add(handler);
    return () => {
      this.connectHandlers.delete(handler);
    };
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
          resolved = true;
          const debugInfo = seenDevices.length
            ? `\nDevices found nearby:\n${seenDevices.join('\n')}`
            : '\nNo BLE devices detected at all. Is Bluetooth on?';
          reject(new Error(`No OBD-II adapter found. Make sure it is plugged in and powered.${debugInfo}`));
        }
      }, ELM_SCAN_TIMEOUT_MS);

      this.manager.startDeviceScan(null, { allowDuplicates: false }, (error: BleError | null, scanned: Device | null) => {
        if (resolved) return;

        if (error) {
          resolved = true;
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

  private async connectDevice(device: Device, knownDevice?: ObdDevice, alreadyConnected = false): Promise<void> {
    await this.disconnectInternal();
    this.manager.stopDeviceScan();
    this.clearReconnectTimer();

    const connected = alreadyConnected ? device : await device.connect({ timeout: ELM_SCAN_TIMEOUT_MS });
    this.device = await connected.discoverAllServicesAndCharacteristics();
    const label = this.device.name ?? this.device.localName ?? knownDevice?.name ?? 'OBD-II adapter';
    this.connectedDevice = {
      id: this.device.id,
      name: label,
      rssi: knownDevice?.rssi ?? this.device.rssi,
      isLikelyObd: knownDevice?.isLikelyObd ?? deviceLooksLikeElm327(this.device),
    };
    this.gatt = await this.resolveGatt(this.device);
    this.startMonitor();
    this.startDisconnectMonitor();
    await delay(250);
    await this.initializeElm327();
    this.shouldReconnect = true;
    this.reconnectDelayMs = RECONNECT_INITIAL_DELAY_MS;
    await this.rememberDevice(this.connectedDevice);
    this.connectHandlers.forEach((handler) => handler(this.connectedDevice!));
  }

  private async connectToRememberedDevice(device: ObdDevice): Promise<void> {
    const connected = await this.manager.connectToDevice(device.id, { timeout: ELM_SCAN_TIMEOUT_MS });
    await this.connectDevice(connected, device, true);
  }

  private async getRememberedDevice(): Promise<ObdDevice | null> {
    if (this.lastKnownDevice) return this.lastKnownDevice;

    try {
      const raw = await AsyncStorage.getItem(LAST_OBD_DEVICE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ObdDevice;
      if (!parsed?.id || !parsed?.name) return null;
      this.lastKnownDevice = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  private async rememberDevice(device: ObdDevice | null): Promise<void> {
    if (!device) return;
    this.lastKnownDevice = device;
    try {
      await AsyncStorage.setItem(LAST_OBD_DEVICE_KEY, JSON.stringify(device));
    } catch {
      // Remembering the adapter is a convenience; connection should still work without storage.
    }
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer || this.reconnecting) return;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.shouldReconnect || this.device || this.gatt) return;

      const remembered = await this.getRememberedDevice();
      if (!remembered) return;

      this.reconnecting = true;
      try {
        await this.ensurePermissions();
        await this.ensureBluetoothOn();
        await this.connectToRememberedDevice(remembered);
      } catch (error) {
        console.log('[OBD] Auto-reconnect failed:', error);
        this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, RECONNECT_MAX_DELAY_MS);
      } finally {
        this.reconnecting = false;
      }

      if (this.shouldReconnect && !this.device && !this.gatt) {
        this.scheduleReconnect();
      }
    }, this.reconnectDelayMs);
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
        if (charNorm.includes(profile.writeCharUuid) && canWrite(char)) {
          writeCharacteristic = char;
        }
        if (charNorm.includes(profile.readCharUuid) && canReceiveNotifications(char)) {
          notifyCharacteristic = char;
        }
        // Some profiles use same UUID for read and write (e.g. FFE1)
        if (
          profile.readCharUuid === profile.writeCharUuid &&
          charNorm.includes(profile.readCharUuid) &&
          canWrite(char) &&
          canReceiveNotifications(char)
        ) {
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
    const orderedServices = [...services].sort((a, b) => {
      const aScore = serviceLooksPreferred(a.uuid) ? 1 : 0;
      const bScore = serviceLooksPreferred(b.uuid) ? 1 : 0;
      return bScore - aScore;
    });

    for (const service of orderedServices) {
      let writeCharacteristic: Characteristic | null = null;
      let notifyCharacteristic: Characteristic | null = null;
      const characteristics = await device.characteristicsForService(service.uuid);
      for (const char of characteristics) {
        if (!writeCharacteristic && canWrite(char)) {
          writeCharacteristic = char;
        }
        if (!notifyCharacteristic && canReceiveNotifications(char)) {
          notifyCharacteristic = char;
        }
      }
      if (writeCharacteristic && notifyCharacteristic) {
        console.log('Using fallback GATT resolution (no known profile matched).');
        return { writeCharacteristic, notifyCharacteristic };
      }
    }

    throw new Error('Could not find adapter UART characteristics.');
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
          const chunk = decodeBase64Ascii(characteristic.value);
          if (this.lineBuffer.length + chunk.length <= BLE_BUFFER_MAX_BYTES) {
            this.lineBuffer += chunk;
          }
        } catch {
          // Ignore malformed frames.
        }
      }
    );
  }

  private startDisconnectMonitor(): void {
    if (!this.device) return;
    this.disconnectSub?.remove();
    this.disconnectSub = this.manager.onDeviceDisconnected(this.device.id, () => {
      this.monitorSub?.remove();
      this.monitorSub = null;
      this.disconnectSub?.remove();
      this.disconnectSub = null;
      this.device = null;
      this.gatt = null;
      this.connectedDevice = null;
      this.lineBuffer = '';
      this.disconnectHandlers.forEach((handler) => handler());
      this.scheduleReconnect();
    });
  }

  private async initializeElm327(): Promise<void> {
    await this.sendElmCommand('ATZ', ELM_BOOT_TIMEOUT_MS);   // Reset adapter
    await this.sendElmCommand('ATE0', ELM_COMMAND_TIMEOUT_MS); // Echo off
    await this.sendElmCommand('ATL0', ELM_COMMAND_TIMEOUT_MS); // Linefeeds off
    await this.sendElmCommand('ATS1', ELM_COMMAND_TIMEOUT_MS); // Spaces on (parsers expect space-separated bytes)
    await this.sendElmCommand('ATH0', ELM_COMMAND_TIMEOUT_MS); // Headers off; current parsers only need payload bytes
    await this.sendElmCommand('ATCAF1', ELM_COMMAND_TIMEOUT_MS); // Let ELM format CAN frames into OBD payloads
    await this.sendElmCommand('ATAT1', ELM_COMMAND_TIMEOUT_MS); // Adaptive timing on
    await this.sendElmCommand('ATSP0', ELM_COMMAND_TIMEOUT_MS); // Auto-detect protocol
  }

  private async sendElmCommand(command: string, timeoutMs: number): Promise<string> {
    if (!this.device || !this.gatt) {
      throw new Error('OBD adapter is not connected.');
    }

    const payload = `${command.trim().toUpperCase()}\r`;
    const encodedPayload = encodeBase64Ascii(payload);
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
          .replace(/>/g, '\n')
          .split(/[\r\n]+/)
          .map((line) => line.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .join('\n');
        resolve(cleaned || 'NO DATA');
      }, 35);
      this.activeCommandTimer = timer;
    });
  }
}

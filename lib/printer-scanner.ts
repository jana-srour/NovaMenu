export type PrinterConnection =
  | 'bluetooth'
  | 'usb'
  | 'serial'
  | 'network'
  | 'system'
  | 'manual';

export type PaperSize = '58mm' | '80mm';
export type PrinterType = 'thermal' | 'receipt';

export type SavedPrinter = {
  id?: string;
  name: string;
  connection: PrinterConnection;
  address: string;
  port: string;
  paperSize: PaperSize;
  printerType: PrinterType;
  details?: string;
};

export type DiscoveredPrinter = SavedPrinter & {
  id: string;
  status?: 'online' | 'ready' | 'paired';
};

export const PRINTER_STORAGE_KEY = 'novamenu_printer_settings';

export const defaultPrinter: SavedPrinter = {
  name: 'System / Chrome Print Driver',
  connection: 'system',
  address: 'localhost',
  port: '9100',
  paperSize: '80mm',
  printerType: 'thermal',
  details: 'Prints directly using the Chrome / OS print engine',
};

// Known thermal printer Bluetooth service UUIDs (ESC/POS)
const BLUETOOTH_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standard thermal printer service
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
];

/**
 * Check if Web Bluetooth is supported in the current browser
 */
export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Check if WebUSB is supported
 */
export function isUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/**
 * Check if Web Serial is supported
 */
export function isSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Prompt the user with the Chrome/browser Bluetooth device picker
 */
export async function pairBluetoothPrinter(): Promise<DiscoveredPrinter | null> {
  if (!isBluetoothSupported()) {
    throw new Error('Web Bluetooth is not supported in this browser. Use Chrome, Edge, or Opera.');
  }

  try {
    const nav = navigator as Navigator & {
      bluetooth: {
        requestDevice: (options: {
          acceptAllDevices?: boolean;
          filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }>;
          optionalServices?: string[];
        }) => Promise<{ id: string; name?: string }>;
      };
    };

    const device = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BLUETOOTH_PRINTER_SERVICES,
    });

    return {
      id: `bluetooth-${device.id}`,
      name: device.name || 'Bluetooth Thermal Printer',
      connection: 'bluetooth',
      address: device.id,
      port: '0',
      paperSize: '80mm',
      printerType: 'thermal',
      status: 'paired',
      details: 'Connected via Web Bluetooth',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      // User cancelled picker
      return null;
    }
    throw error;
  }
}

/**
 * Prompt the user with the Chrome/browser WebUSB device picker
 */
export async function pairUsbPrinter(): Promise<DiscoveredPrinter | null> {
  if (!isUsbSupported()) {
    throw new Error('WebUSB is not supported in this browser. Use Chrome, Edge, or Opera.');
  }

  try {
    const nav = navigator as Navigator & {
      usb: {
        requestDevice: (options: {
          filters: Array<{ classCode?: number; vendorId?: number; productId?: number }>;
        }) => Promise<{
          productName?: string;
          manufacturerName?: string;
          serialNumber?: string;
          vendorId: number;
          productId: number;
        }>;
      };
    };

    const device = await nav.usb.requestDevice({
      filters: [
        { classCode: 7 }, // Printer class code
        { vendorId: 0x04b8 }, // Epson
        { vendorId: 0x0416 }, // Winbond / POS
        { vendorId: 0x1fc9 }, // NXP POS
        { vendorId: 0x0483 }, // STMicroelectronics
        { vendorId: 0x0525 }, // Netchip
        { vendorId: 0x1504 }, // Sunplus
        { vendorId: 0x0fe6 }, // ICS
        { vendorId: 0x2d37 }, // Xprinter
      ],
    });

    const vendorHex = `0x${device.vendorId.toString(16).padStart(4, '0')}`;
    const productHex = `0x${device.productId.toString(16).padStart(4, '0')}`;

    return {
      id: `usb-${device.serialNumber || `${vendorHex}-${productHex}`}`,
      name: device.productName || device.manufacturerName || 'USB Thermal Receipt Printer',
      connection: 'usb',
      address: `USB:${vendorHex}:${productHex}`,
      port: '0',
      paperSize: '80mm',
      printerType: 'thermal',
      status: 'paired',
      details: `USB Device (${vendorHex}:${productHex}) ${device.serialNumber ? `S/N: ${device.serialNumber}` : ''}`,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      return null;
    }
    throw error;
  }
}

/**
 * Prompt the user with the Chrome/browser Web Serial port picker (USB-Serial CDC/COM printers)
 */
export async function pairSerialPrinter(): Promise<DiscoveredPrinter | null> {
  if (!isSerialSupported()) {
    throw new Error('Web Serial is not supported in this browser. Use Chrome, Edge, or Opera.');
  }

  try {
    const nav = navigator as Navigator & {
      serial: {
        requestPort: () => Promise<{
          getInfo: () => { usbVendorId?: number; usbProductId?: number };
        }>;
      };
    };

    const port = await nav.serial.requestPort();
    const info = port.getInfo ? port.getInfo() : {};
    const vendorHex = info.usbVendorId ? `0x${info.usbVendorId.toString(16)}` : 'Serial';
    const productHex = info.usbProductId ? `0x${info.usbProductId.toString(16)}` : 'Port';

    return {
      id: `serial-${vendorHex}-${productHex}-${Date.now()}`,
      name: `Serial / COM Thermal Printer (${vendorHex})`,
      connection: 'serial',
      address: `COM:${vendorHex}:${productHex}`,
      port: '9600',
      paperSize: '80mm',
      printerType: 'thermal',
      status: 'paired',
      details: 'USB-Serial ESC/POS Port (9600 baud)',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'NotFoundError') {
      return null;
    }
    throw error;
  }
}

/**
 * Get previously paired devices without re-prompting
 */
export async function getPairedDevices(): Promise<DiscoveredPrinter[]> {
  const devices: DiscoveredPrinter[] = [];

  // 1. Always include the System Print Driver
  devices.push({
    id: 'system-default',
    name: 'System / Chrome Print Driver (Default)',
    connection: 'system',
    address: 'localhost',
    port: '0',
    paperSize: '80mm',
    printerType: 'thermal',
    status: 'online',
    details: 'Prints directly to any printer installed on this OS via Chrome dialog',
  });

  // 2. Previously paired Bluetooth devices
  if (isBluetoothSupported()) {
    try {
      const nav = navigator as Navigator & {
        bluetooth?: {
          getDevices?: () => Promise<Array<{ id: string; name?: string }>>;
        };
      };
      if (nav.bluetooth?.getDevices) {
        const btDevices = await nav.bluetooth.getDevices();
        btDevices.forEach((dev) => {
          devices.push({
            id: `bluetooth-${dev.id}`,
            name: dev.name || 'Paired Bluetooth Printer',
            connection: 'bluetooth',
            address: dev.id,
            port: '0',
            paperSize: '80mm',
            printerType: 'thermal',
            status: 'paired',
            details: 'Paired Bluetooth Device',
          });
        });
      }
    } catch {
      // Ignore
    }
  }

  // 3. Previously paired USB devices
  if (isUsbSupported()) {
    try {
      const nav = navigator as Navigator & {
        usb?: {
          getDevices?: () => Promise<
            Array<{
              productName?: string;
              manufacturerName?: string;
              serialNumber?: string;
              vendorId: number;
              productId: number;
            }>
          >;
        };
      };
      if (nav.usb?.getDevices) {
        const usbDevices = await nav.usb.getDevices();
        usbDevices.forEach((dev) => {
          const vendorHex = `0x${dev.vendorId.toString(16).padStart(4, '0')}`;
          const productHex = `0x${dev.productId.toString(16).padStart(4, '0')}`;
          devices.push({
            id: `usb-${dev.serialNumber || `${vendorHex}-${productHex}`}`,
            name: dev.productName || dev.manufacturerName || 'Paired USB Thermal Printer',
            connection: 'usb',
            address: `USB:${vendorHex}:${productHex}`,
            port: '0',
            paperSize: '80mm',
            printerType: 'thermal',
            status: 'paired',
            details: `Paired USB Device (${vendorHex}:${productHex})`,
          });
        });
      }
    } catch {
      // Ignore
    }
  }

  // 4. Previously paired Serial ports
  if (isSerialSupported()) {
    try {
      const nav = navigator as Navigator & {
        serial?: {
          getPorts?: () => Promise<
            Array<{
              getInfo: () => { usbVendorId?: number; usbProductId?: number };
            }>
          >;
        };
      };
      if (nav.serial?.getPorts) {
        const serialPorts = await nav.serial.getPorts();
        serialPorts.forEach((port, idx) => {
          const info = port.getInfo ? port.getInfo() : {};
          devices.push({
            id: `serial-paired-${idx}`,
            name: `Serial / COM Thermal Printer ${idx + 1}`,
            connection: 'serial',
            address: `COM:${info.usbVendorId ? `0x${info.usbVendorId.toString(16)}` : 'port'}`,
            port: '9600',
            paperSize: '80mm',
            printerType: 'thermal',
            status: 'paired',
            details: 'Paired Serial Port',
          });
        });
      }
    } catch {
      // Ignore
    }
  }

  return devices;
}

/**
 * Scan network printers via backend API endpoint and local gateway probes
 */
export async function scanNetworkPrinters(subnet?: string): Promise<DiscoveredPrinter[]> {
  try {
    const url = subnet
      ? `/api/printer/discover?subnet=${encodeURIComponent(subnet)}`
      : '/api/printer/discover';

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return [];

    const data = (await response.json()) as {
      printers?: Array<{
        id: string;
        name: string;
        address: string;
        port: string;
        details?: string;
      }>;
    };

    return (data.printers || []).map((printer) => ({
      id: printer.id || `network-${printer.address}-${printer.port}`,
      name: printer.name || `Network Printer (${printer.address})`,
      connection: 'network',
      address: printer.address,
      port: printer.port || '9100',
      paperSize: '80mm',
      printerType: 'thermal',
      status: 'online',
      details: printer.details || `TCP RAW Port ${printer.port || '9100'}`,
    }));
  } catch {
    return [];
  }
}

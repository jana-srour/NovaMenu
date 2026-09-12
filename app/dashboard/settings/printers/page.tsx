'use client';

import { useEffect, useState } from 'react';
import {
  Bluetooth,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  FileText,
  Info,
  Laptop,
  Layers,
  Link2,
  Loader2,
  Palette,
  Printer,
  QrCode,
  Radio,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Store,
  Tv2,
  Usb,
  Wifi,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DashboardLoader } from '@/app/dashboard/components/dashboard-loader';
import { PlanRequired } from '@/app/dashboard/components/plan-required';
import {
  defaultRestaurantTheme,
  loadRestaurantTheme,
  type RestaurantTheme,
} from '@/lib/restaurant-theme';
import {
  subscriptionAllows,
  type BillingPlan,
  type SubscriptionStatus,
} from '@/lib/billing/plans';
import {
  DiscoveredPrinter,
  PRINTER_STORAGE_KEY,
  PaperSize,
  PrinterConnection,
  SavedPrinter,
  defaultPrinter,
  getPairedDevices,
  isBluetoothSupported,
  isSerialSupported,
  isUsbSupported,
  pairBluetoothPrinter,
  pairSerialPrinter,
  pairUsbPrinter,
  scanNetworkPrinters,
} from '@/lib/printer-scanner';
import {
  DividerStyle,
  FontFamily,
  FontSize,
  LineSpacing,
  PaperWidth,
  ReceiptTemplateConfig,
  defaultReceiptTemplate,
  fontFamilyOptions,
  fontSizeOptions,
  loadReceiptTemplate,
  receiptPresets,
  saveReceiptTemplate,
  starEmblemPresets,
} from '@/lib/receipt-template';
import {
  ReceiptPreview,
  SampleOrderData,
  defaultSampleOrder,
  printOrderReceipt,
} from '@/app/dashboard/components/receipt-preview';

type ActiveTab = 'printers' | 'template';

const sampleDeliveryOrder: SampleOrderData = {
  orderNumber: 1043,
  customer: 'Michael Chang',
  customerPhone: '+1 (555) 749-1102',
  table: '',
  address: '882 Sunset Blvd, Penthouse 4A',
  channel: 'Delivery',
  createdAt: new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
  total: 62.0,
  currency: '$',
  items: [
    { name: 'Ribeye Steak 300g', qty: 1, price: 34.0 },
    { name: 'Garlic Butter Asparagus', qty: 1, price: 9.0 },
    { name: 'Sparkling Mineral Water', qty: 2, price: 4.5 },
    { name: 'Chocolate Lava Cake', qty: 1, price: 10.0 },
  ],
};

export default function PrintersSettingsPage() {
  const [theme, setTheme] = useState<RestaurantTheme>(defaultRestaurantTheme);
  const [activeTab, setActiveTab] = useState<ActiveTab>('printers');
  const [printer, setPrinter] = useState<SavedPrinter>(defaultPrinter);
  const [detectedPrinters, setDetectedPrinters] = useState<DiscoveredPrinter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'info' | 'success' | 'error'>('info');

  // Receipt Template State
  const [template, setTemplate] = useState<ReceiptTemplateConfig>(defaultReceiptTemplate);
  const [sampleType, setSampleType] = useState<'dinein' | 'delivery'>('dinein');
  const [activePreset, setActivePreset] = useState<string>('classic');
  const [savedTemplateAlert, setSavedTemplateAlert] = useState(false);

  // Custom subnet scanner input
  const [customSubnet, setCustomSubnet] = useState('');

  // Accordion section states for template designer
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    store: true,
    order: true,
    items: false,
    totals: false,
    footer: false,
    paper: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: membership } = await supabase
        .from('restaurant_members')
        .select('restaurant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.restaurant_id) {
        setTheme(await loadRestaurantTheme(supabase, membership.restaurant_id));

        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('name, address, phone_number, currency')
          .eq('id', membership.restaurant_id)
          .single();

        if (restaurant) {
          // Sync default store name into template if available
          setTemplate((prev) => ({
            ...prev,
            storeName: prev.storeName === defaultReceiptTemplate.storeName && restaurant.name ? restaurant.name : prev.storeName,
            address: prev.address === defaultReceiptTemplate.address && restaurant.address ? restaurant.address : prev.address,
            phone: prev.phone === defaultReceiptTemplate.phone && restaurant.phone_number ? restaurant.phone_number : prev.phone,
          }));
        }

        const { data: subscription } = await supabase
          .from('restaurant_subscriptions')
          .select('plan_code, status, trial_ends_at')
          .eq('restaurant_id', membership.restaurant_id)
          .maybeSingle();

        setAllowed(
          subscriptionAllows(
            subscription as {
              plan_code: BillingPlan;
              status: SubscriptionStatus;
              trial_ends_at: string;
            } | null,
            'orders'
          )
        );
      }

      // Load saved printer settings
      const savedPrinterJson = window.localStorage.getItem(PRINTER_STORAGE_KEY);
      if (savedPrinterJson) {
        try {
          const parsed = JSON.parse(savedPrinterJson);
          setPrinter({ ...defaultPrinter, ...parsed });
          if (parsed.id) setSelectedId(parsed.id);
        } catch {
          window.localStorage.removeItem(PRINTER_STORAGE_KEY);
        }
      }

      // Load saved receipt template
      const savedTemplate = loadReceiptTemplate();
      setTemplate(savedTemplate);

      // Automatically load pre-paired devices into detected list
      const paired = await getPairedDevices();
      setDetectedPrinters(paired);

      setLoading(false);
    };

    load();
  }, []);

  const updatePrinterField = <K extends keyof SavedPrinter>(
    field: K,
    value: SavedPrinter[K]
  ) => {
    setPrinter((current) => ({ ...current, [field]: value }));
    setMessage('');
  };

  const updateTemplateField = <K extends keyof ReceiptTemplateConfig>(
    field: K,
    value: ReceiptTemplateConfig[K]
  ) => {
    setTemplate((current) => {
      const updated = { ...current, [field]: value };
      saveReceiptTemplate(updated);
      return updated;
    });
    setActivePreset('');
  };

  const applyPreset = (presetKey: string) => {
    const preset = receiptPresets[presetKey];
    if (!preset) return;
    setTemplate((current) => {
      const updated = { ...current, ...preset.config };
      saveReceiptTemplate(updated);
      return updated;
    });
    setActivePreset(presetKey);
    setMessage(`Applied "${preset.name}" preset and saved.`);
    setMessageType('info');
  };

  const handleSaveTemplate = () => {
    saveReceiptTemplate(template);
    setSavedTemplateAlert(true);
    setTimeout(() => setSavedTemplateAlert(false), 3000);
    setMessage('Receipt design template saved successfully.');
    setMessageType('success');
  };

  const handleResetTemplate = () => {
    setTemplate(defaultReceiptTemplate);
    saveReceiptTemplate(defaultReceiptTemplate);
    setActivePreset('classic');
    setMessage('Receipt template reset to defaults and saved.');
    setMessageType('info');
  };

  // Perform multi-channel scan
  const scanForPrinters = async () => {
    setShowScanDialog(true);
    setScanning(true);
    setMessage('');
    setScanStep('Initializing multi-channel discovery...');

    const discovered: DiscoveredPrinter[] = [];

    try {
      // 1. System Print Driver
      setScanStep('1/4: Checking system and browser print drivers...');
      discovered.push({
        id: 'system-default',
        name: 'System / Chrome Print Driver (Default)',
        connection: 'system',
        address: 'localhost',
        port: '0',
        paperSize: template.paperSize,
        printerType: 'thermal',
        status: 'online',
        details: 'Prints directly to any printer installed on this OS via Chrome dialog',
      });

      // 2. Pre-paired USB / Bluetooth / Serial devices
      setScanStep('2/4: Checking paired USB & Bluetooth devices...');
      const paired = await getPairedDevices();
      paired.forEach((dev) => {
        if (!discovered.some((d) => d.id === dev.id)) {
          discovered.push(dev);
        }
      });

      // 3. Network Subnet Scan
      setScanStep('3/4: Probing local network subnet for thermal printers (Port 9100/631/80)...');
      const networkPrinters = await scanNetworkPrinters(customSubnet || undefined);
      networkPrinters.forEach((dev) => {
        if (!discovered.some((d) => d.id === dev.id)) {
          discovered.push(dev);
        }
      });

      setScanStep('4/4: Finalizing discovered devices...');
      setDetectedPrinters(discovered);

      const count = discovered.length;
      setMessage(
        count > 1
          ? `Discovered ${count} printer options (System, USB/Bluetooth & Network).`
          : `Discovered System Print Driver. You can also pair USB or Bluetooth printers directly below.`
      );
      setMessageType('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Printer scan encountered an issue.');
      setMessageType('error');
    } finally {
      setScanning(false);
    }
  };

  // Dedicated Browser Picker for Bluetooth
  const handlePairBluetooth = async () => {
    try {
      setMessage('Opening Bluetooth device picker...');
      setMessageType('info');
      const dev = await pairBluetoothPrinter();
      if (dev) {
        setDetectedPrinters((prev) => [dev, ...prev.filter((d) => d.id !== dev.id)]);
        connectPrinter(dev);
        setMessage(`Connected to Bluetooth printer: ${dev.name}`);
        setMessageType('success');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to pair Bluetooth device.');
      setMessageType('error');
    }
  };

  // Dedicated Browser Picker for USB
  const handlePairUsb = async () => {
    try {
      setMessage('Opening USB device picker...');
      setMessageType('info');
      const dev = await pairUsbPrinter();
      if (dev) {
        setDetectedPrinters((prev) => [dev, ...prev.filter((d) => d.id !== dev.id)]);
        connectPrinter(dev);
        setMessage(`Connected to USB printer: ${dev.name}`);
        setMessageType('success');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to pair USB printer.');
      setMessageType('error');
    }
  };

  // Dedicated Browser Picker for Serial / COM
  const handlePairSerial = async () => {
    try {
      setMessage('Opening Serial/COM port picker...');
      setMessageType('info');
      const dev = await pairSerialPrinter();
      if (dev) {
        setDetectedPrinters((prev) => [dev, ...prev.filter((d) => d.id !== dev.id)]);
        connectPrinter(dev);
        setMessage(`Connected to Serial printer: ${dev.name}`);
        setMessageType('success');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to pair Serial device.');
      setMessageType('error');
    }
  };

  const connectPrinter = (target: DiscoveredPrinter | SavedPrinter) => {
    const updated: SavedPrinter = {
      id: target.id || `custom-${Date.now()}`,
      name: target.name || 'Configured Printer',
      connection: target.connection,
      address: target.address,
      port: target.port || '9100',
      paperSize: target.paperSize || template.paperSize,
      printerType: target.printerType || 'thermal',
      details: target.details,
    };

    setPrinter(updated);
    setSelectedId(updated.id || null);
    window.localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(updated));
    setMessage(`"${updated.name}" is now set as your active printer.`);
    setMessageType('success');
  };

  const saveManualSetup = () => {
    if (!printer.name) {
      updatePrinterField('name', 'Kitchen Thermal Printer');
    }
    const updated = {
      ...printer,
      id: printer.id || `manual-${Date.now()}`,
    };
    setPrinter(updated);
    setSelectedId(updated.id);
    window.localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(updated));
    setMessage('Manual printer configuration saved successfully.');
    setMessageType('success');
  };

  const testPrinter = async (targetPrinter: SavedPrinter = printer) => {
    const activeSampleOrder = sampleType === 'dinein' ? defaultSampleOrder : sampleDeliveryOrder;

    if (targetPrinter.connection === 'system') {
      printOrderReceipt({
        template,
        order: activeSampleOrder,
        currency: '$',
      });
      setMessage(`Sent test print job to ${targetPrinter.name}.`);
      setMessageType('success');
      return;
    }

    if (!targetPrinter.address || !targetPrinter.port) {
      setMessage('Enter a printer IP address and port first.');
      setMessageType('error');
      return;
    }

    try {
      setMessage(`Sending test receipt to ${targetPrinter.name}...`);
      const response = await fetch('/api/printer/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          printer: targetPrinter,
          order: activeSampleOrder,
          template,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Printer test failed.');
      setMessage(`Test receipt successfully sent to ${targetPrinter.name}.`);
      setMessageType('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Printer test failed.');
      setMessageType('error');
    }
  };

  const getConnectionIcon = (connection: PrinterConnection) => {
    switch (connection) {
      case 'bluetooth':
        return Bluetooth;
      case 'usb':
        return Usb;
      case 'serial':
        return Laptop;
      case 'network':
        return Wifi;
      case 'system':
        return Tv2;
      default:
        return Link2;
    }
  };

  if (loading) return <DashboardLoader />;
  if (!allowed) return <PlanRequired featureName="Printer settings" requiredPlan="Pro" />;

  return (
    <main
      className="min-h-screen px-4 py-8 sm:px-8 lg:px-12 lg:py-12"
      style={{
        background: 'var(--portal-background)',
        color: 'var(--portal-text)',
      }}
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <header
          className="mb-8 rounded-[28px] border p-6 shadow-sm sm:p-8"
          style={{
            background: theme.portal_surface,
            borderColor: theme.portal_border,
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p
                className="text-[10px] font-black uppercase tracking-[0.2em]"
                style={{ color: theme.portal_accent }}
              >
                Hardware & POS
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                Printers & Receipt Designer
              </h1>
              <p className="mt-1 text-sm opacity-75">
                Scan and connect thermal printers (Wi-Fi, USB, Bluetooth, Serial) & customize your receipt design.
              </p>
            </div>

            {/* Navigation Tabs */}
            <div
              className="flex items-center gap-1 rounded-2xl border p-1.5 self-start sm:self-auto"
              style={{
                background: theme.portal_background,
                borderColor: theme.portal_border,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('printers')}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] transition-all"
                style={{
                  background:
                    activeTab === 'printers' ? theme.portal_accent : 'transparent',
                  color: activeTab === 'printers' ? '#ffffff' : theme.portal_text,
                }}
              >
                <Printer className="h-4 w-4" />
                Printer Setup
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('template')}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.1em] transition-all"
                style={{
                  background:
                    activeTab === 'template' ? theme.portal_accent : 'transparent',
                  color: activeTab === 'template' ? '#ffffff' : theme.portal_text,
                }}
              >
                <FileText className="h-4 w-4" />
                Receipt Designer
              </button>
            </div>
          </div>

          {/* Feedback Alert Message */}
          {message && (
            <div
              className="mt-6 flex items-start justify-between gap-3 rounded-2xl border p-4 text-sm animate-in fade-in"
              style={{
                borderColor:
                  messageType === 'error'
                    ? '#EF4444'
                    : messageType === 'success'
                    ? '#10B981'
                    : theme.portal_accent,
                background:
                  messageType === 'error'
                    ? '#EF444415'
                    : messageType === 'success'
                    ? '#10B98115'
                    : theme.portal_accent_soft,
              }}
            >
              <div className="flex items-center gap-2.5">
                {messageType === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : messageType === 'error' ? (
                  <CircleHelp className="h-5 w-5 shrink-0 text-red-500" />
                ) : (
                  <Info
                    className="h-5 w-5 shrink-0"
                    style={{ color: theme.portal_accent }}
                  />
                )}
                <span className="font-semibold">{message}</span>
              </div>
              <button
                type="button"
                onClick={() => setMessage('')}
                className="opacity-60 hover:opacity-100 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </header>

        {/* TAB 1: PRINTERS & CONNECTION SETUP */}
        {activeTab === 'printers' && (
          <div className="space-y-8">
            {/* Active Printer Banner */}
            <section
              className="rounded-[28px] border p-6 shadow-sm sm:p-8"
              style={{
                background: theme.portal_surface,
                borderColor: theme.portal_border,
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl shrink-0"
                    style={{
                      background: theme.portal_accent_soft,
                      color: theme.portal_accent,
                    }}
                  >
                    {(() => {
                      const Icon = getConnectionIcon(printer.connection);
                      return <Icon className="h-7 w-7" />;
                    })()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active Default Printer
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase"
                        style={{
                          background: theme.portal_accent_soft,
                          color: theme.portal_accent,
                        }}
                      >
                        {printer.connection}
                      </span>
                    </div>
                    <h2 className="mt-1 text-2xl font-black">{printer.name || 'System / Chrome Print Driver'}</h2>
                    <p className="text-xs opacity-70">
                      {printer.connection === 'system'
                        ? 'Uses browser native print dialog with auto receipt layout'
                        : `${printer.address}:${printer.port} · Paper: ${printer.paperSize}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => testPrinter(printer)}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-white shadow-sm transition-transform active:scale-95 cursor-pointer"
                    style={{ background: theme.portal_accent }}
                  >
                    <Printer className="h-4 w-4" />
                    Test Print Receipt
                  </button>
                </div>
              </div>
            </section>

            {/* Quick Channel Discovery Actions */}
            <section
              className="rounded-[28px] border p-6 shadow-sm sm:p-8"
              style={{
                background: theme.portal_surface,
                borderColor: theme.portal_border,
              }}
            >
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 pb-6 border-b" style={{ borderColor: theme.portal_border }}>
                <div>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      background: theme.portal_accent_soft,
                      color: theme.portal_accent,
                    }}
                  >
                    <Radio className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-xl font-black">Scan & Discover Devices</h2>
                  <p className="mt-1 text-sm opacity-75 max-w-xl">
                    Scan your Wi-Fi network, or trigger direct browser pairing for USB, Bluetooth, and Serial thermal printers.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={scanForPrinters}
                  disabled={scanning}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-md disabled:opacity-60 transition-transform active:scale-95 cursor-pointer self-start"
                  style={{ background: theme.portal_accent }}
                >
                  {scanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Radio className="h-4 w-4" />
                  )}
                  {scanning ? 'Scanning all channels...' : 'Scan All Printers'}
                </button>
              </div>

              {/* Direct Pairing Channel Grid */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Bluetooth */}
                <div
                  className="flex flex-col justify-between rounded-2xl border p-5 transition-all hover:border-blue-400/60"
                  style={{
                    background: theme.portal_background,
                    borderColor: theme.portal_border,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                      <Bluetooth className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black">Bluetooth</h3>
                      <p className="text-[11px] opacity-70">Wireless thermal POS</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePairBluetooth}
                    disabled={!isBluetoothSupported()}
                    className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-black uppercase tracking-[0.08em] transition-all hover:bg-black/5 disabled:opacity-40"
                    style={{ borderColor: theme.portal_border }}
                  >
                    <Bluetooth className="h-3.5 w-3.5" />
                    Pair Bluetooth
                  </button>
                </div>

                {/* USB */}
                <div
                  className="flex flex-col justify-between rounded-2xl border p-5 transition-all hover:border-emerald-400/60"
                  style={{
                    background: theme.portal_background,
                    borderColor: theme.portal_border,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                      <Usb className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black">USB Thermal</h3>
                      <p className="text-[11px] opacity-70">Direct USB POS cable</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePairUsb}
                    disabled={!isUsbSupported()}
                    className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-black uppercase tracking-[0.08em] transition-all hover:bg-black/5 disabled:opacity-40"
                    style={{ borderColor: theme.portal_border }}
                  >
                    <Usb className="h-3.5 w-3.5" />
                    Pair USB Printer
                  </button>
                </div>

                {/* Serial / COM */}
                <div
                  className="flex flex-col justify-between rounded-2xl border p-5 transition-all hover:border-purple-400/60"
                  style={{
                    background: theme.portal_background,
                    borderColor: theme.portal_border,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                      <Laptop className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black">Serial / COM</h3>
                      <p className="text-[11px] opacity-70">USB-Serial CDC ports</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handlePairSerial}
                    disabled={!isSerialSupported()}
                    className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-black uppercase tracking-[0.08em] transition-all hover:bg-black/5 disabled:opacity-40"
                    style={{ borderColor: theme.portal_border }}
                  >
                    <Laptop className="h-3.5 w-3.5" />
                    Pair Serial Port
                  </button>
                </div>

                {/* System / Chrome Print */}
                <div
                  className="flex flex-col justify-between rounded-2xl border p-5 transition-all hover:border-amber-400/60"
                  style={{
                    background: theme.portal_background,
                    borderColor: theme.portal_border,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                      <Tv2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black">System / Chrome</h3>
                      <p className="text-[11px] opacity-70">Installed OS printers</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const sysPrinter: DiscoveredPrinter = {
                        id: 'system-default',
                        name: 'System / Chrome Print Driver',
                        connection: 'system',
                        address: 'localhost',
                        port: '0',
                        paperSize: template.paperSize,
                        printerType: 'thermal',
                        status: 'online',
                      };
                      connectPrinter(sysPrinter);
                    }}
                    className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-black uppercase tracking-[0.08em] transition-all hover:bg-black/5"
                    style={{ borderColor: theme.portal_border }}
                  >
                    <Tv2 className="h-3.5 w-3.5" />
                    Use System Print
                  </button>
                </div>
              </div>
            </section>

            {/* Discovered / Paired Devices List */}
            {detectedPrinters.length > 0 && (
              <section
                className="rounded-[28px] border p-6 shadow-sm sm:p-8"
                style={{
                  background: theme.portal_surface,
                  borderColor: theme.portal_border,
                }}
              >
                <div className="flex items-center justify-between pb-4 border-b" style={{ borderColor: theme.portal_border }}>
                  <div>
                    <h2 className="text-xl font-black">Discovered & Paired Devices</h2>
                    <p className="text-xs opacity-75">Click Connect on any device to set it as your active order printer.</p>
                  </div>
                  <span className="rounded-full px-3 py-1 text-xs font-bold border" style={{ borderColor: theme.portal_border }}>
                    {detectedPrinters.length} available
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {detectedPrinters.map((detected) => {
                    const Icon = getConnectionIcon(detected.connection);
                    const isSelected = selectedId === detected.id;

                    return (
                      <div
                        key={detected.id}
                        className="flex flex-col justify-between gap-4 rounded-2xl border p-5 transition-all"
                        style={{
                          borderColor: isSelected
                            ? theme.portal_accent
                            : theme.portal_border,
                          background: isSelected
                            ? theme.portal_accent_soft
                            : theme.portal_background,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                              style={{
                                background: isSelected
                                  ? theme.portal_accent
                                  : 'rgba(0,0,0,0.06)',
                                color: isSelected ? '#ffffff' : theme.portal_accent,
                              }}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-black">
                                {detected.name}
                              </h3>
                              <p className="text-[11px] font-semibold opacity-70">
                                {detected.details ||
                                  (detected.address
                                    ? `${detected.address}:${detected.port}`
                                    : detected.connection)}
                              </p>
                              <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-black/5">
                                {detected.connection}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-lg">
                              <Check className="h-3 w-3" /> Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: theme.portal_border }}>
                          <button
                            type="button"
                            onClick={() => testPrinter(detected)}
                            className="rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] hover:bg-black/5"
                            style={{ borderColor: theme.portal_border }}
                          >
                            Test
                          </button>
                          <button
                            type="button"
                            onClick={() => connectPrinter(detected)}
                            className="rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-sm"
                            style={{
                              background: isSelected
                                ? '#10B981'
                                : theme.portal_accent,
                            }}
                          >
                            {isSelected ? 'Connected' : 'Connect'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Manual Network Setup Card */}
            <section
              className="rounded-[28px] border p-6 shadow-sm sm:p-8"
              style={{
                background: theme.portal_surface,
                borderColor: theme.portal_border,
              }}
            >
              <div className="flex items-center gap-3">
                <Link2 className="h-5 w-5" style={{ color: theme.portal_accent }} />
                <div>
                  <h2 className="text-xl font-black">Manual Setup (Fallback)</h2>
                  <p className="mt-0.5 text-xs opacity-75">
                    Configure a fixed IP address and port for a network thermal printer if not discovered automatically.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="block text-xs font-bold">
                  Printer Name
                  <input
                    value={printer.name ?? ''}
                    onChange={(e) => updatePrinterField('name', e.target.value)}
                    placeholder="Kitchen Thermal Printer"
                    className="mt-1.5 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{
                      background: theme.portal_background,
                      borderColor: theme.portal_border,
                      color: theme.portal_text,
                    }}
                  />
                </label>

                <label className="block text-xs font-bold">
                  IP Address / Hostname
                  <input
                    value={printer.address ?? ''}
                    onChange={(e) => updatePrinterField('address', e.target.value)}
                    placeholder="192.168.1.50"
                    className="mt-1.5 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{
                      background: theme.portal_background,
                      borderColor: theme.portal_border,
                      color: theme.portal_text,
                    }}
                  />
                </label>

                <label className="block text-xs font-bold">
                  Port (Default 9100)
                  <input
                    value={printer.port ?? '9100'}
                    onChange={(e) => updatePrinterField('port', e.target.value)}
                    placeholder="9100"
                    className="mt-1.5 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{
                      background: theme.portal_background,
                      borderColor: theme.portal_border,
                      color: theme.portal_text,
                    }}
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-xs font-bold">
                  Paper Roll Size
                  <select
                    value={printer.paperSize}
                    onChange={(e) =>
                      updatePrinterField('paperSize', e.target.value as PaperSize)
                    }
                    className="mt-1.5 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{
                      background: theme.portal_background,
                      borderColor: theme.portal_border,
                      color: theme.portal_text,
                    }}
                  >
                    <option value="80mm">80mm (Standard POS Roll)</option>
                    <option value="58mm">58mm (Compact Roll)</option>
                  </select>
                </label>

                <label className="block text-xs font-bold">
                  Connection Mode
                  <select
                    value={printer.connection}
                    onChange={(e) =>
                      updatePrinterField(
                        'connection',
                        e.target.value as PrinterConnection
                      )
                    }
                    className="mt-1.5 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{
                      background: theme.portal_background,
                      borderColor: theme.portal_border,
                      color: theme.portal_text,
                    }}
                  >
                    <option value="system">System / Chrome Print Driver</option>
                    <option value="network">Network TCP/IP (RAW Port 9100)</option>
                    <option value="usb">USB Thermal Device</option>
                    <option value="bluetooth">Bluetooth Device</option>
                    <option value="serial">Serial / COM Port</option>
                  </select>
                </label>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={saveManualSetup}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-xs font-black uppercase tracking-[0.1em]"
                  style={{ borderColor: theme.portal_border }}
                >
                  <Save className="h-4 w-4" /> Save Setup
                </button>
                <button
                  type="button"
                  onClick={() => testPrinter(printer)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-white shadow-sm"
                  style={{ background: theme.portal_accent }}
                >
                  <Printer className="h-4 w-4" /> Test Printer
                </button>
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: RECEIPT DESIGN TEMPLATE */}
        {activeTab === 'template' && (
          <div className="space-y-8">
            {/* Template Designer Header & Preset Bar */}
            <section
              className="rounded-[28px] border p-6 shadow-sm sm:p-8"
              style={{
                background: theme.portal_surface,
                borderColor: theme.portal_border,
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Receipt Design Template</h2>
                  <p className="mt-1 text-sm opacity-75">
                    Customize the layout, header, item presentation, taxes, QR codes, and footers for printed order receipts.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold opacity-80 hover:opacity-100"
                    style={{ borderColor: theme.portal_border }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset Defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md"
                    style={{ background: theme.portal_accent }}
                  >
                    {savedTemplateAlert ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {savedTemplateAlert ? 'Saved!' : 'Save Template'}
                  </button>
                </div>
              </div>

              {/* Preset Selector */}
              <div className="mt-6 pt-6 border-t" style={{ borderColor: theme.portal_border }}>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-3">
                  Quick Design Presets
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {Object.entries(receiptPresets).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPreset(key)}
                      className={`text-left rounded-2xl border p-4 transition-all cursor-pointer ${
                        activePreset === key ? 'ring-2' : 'hover:border-black/30'
                      }`}
                      style={{
                        borderColor:
                          activePreset === key
                            ? theme.portal_accent
                            : theme.portal_border,
                        background:
                          activePreset === key
                            ? theme.portal_accent_soft
                            : theme.portal_background,
                        boxShadow:
                          activePreset === key
                            ? `0 0 0 2px ${theme.portal_accent}`
                            : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black">{preset.name}</p>
                        {activePreset === key && (
                          <Check className="h-4 w-4" style={{ color: theme.portal_accent }} />
                        )}
                      </div>
                      <p className="mt-1 text-[11px] opacity-75">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Two-Column Editor & Real-time Live Preview */}
            <div className="grid gap-8 lg:grid-cols-12 items-start">
              {/* Left Column: Customization Controls Accordions (7 Cols) */}
              <div className="space-y-4 lg:col-span-7">
                {/* 1. Store & Header Branding */}
                <div
                  className="rounded-3xl border shadow-sm overflow-hidden"
                  style={{
                    background: theme.portal_surface,
                    borderColor: theme.portal_border,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection('store')}
                    className="w-full flex items-center justify-between p-5 text-left font-black text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Store className="h-4 w-4" style={{ color: theme.portal_accent }} />
                      <span>Store Header & Branding</span>
                    </div>
                    {openSections.store ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {openSections.store && (
                    <div className="p-5 pt-0 space-y-4 border-t" style={{ borderColor: theme.portal_border }}>
                      <div className="grid gap-3 sm:grid-cols-2 pt-4">
                        <label className="block text-xs font-bold">
                          Store / Restaurant Name
                          <input
                            value={template.storeName}
                            onChange={(e) =>
                              updateTemplateField('storeName', e.target.value)
                            }
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          />
                        </label>

                        <label className="block text-xs font-bold">
                          Tagline / Slogan
                          <input
                            value={template.tagline}
                            onChange={(e) =>
                              updateTemplateField('tagline', e.target.value)
                            }
                            placeholder="Artisan Food & Drinks"
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-bold">
                          Store Address
                          <input
                            value={template.address}
                            onChange={(e) =>
                              updateTemplateField('address', e.target.value)
                            }
                            placeholder="123 Gourmet Ave, Downtown"
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          />
                        </label>

                        <label className="block text-xs font-bold">
                          Phone Number
                          <input
                            value={template.phone}
                            onChange={(e) =>
                              updateTemplateField('phone', e.target.value)
                            }
                            placeholder="+1 (555) 019-2834"
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-bold">
                          Tax ID / VAT Registration
                          <input
                            value={template.taxNumber}
                            onChange={(e) =>
                              updateTemplateField('taxNumber', e.target.value)
                            }
                            placeholder="TAX ID: US-8829104"
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          />
                        </label>

                        <label className="block text-xs font-bold">
                          Website / URL
                          <input
                            value={template.website}
                            onChange={(e) =>
                              updateTemplateField('website', e.target.value)
                            }
                            placeholder="www.novamenu.com"
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={template.showHeaderLogo}
                            onChange={(e) =>
                              updateTemplateField(
                                'showHeaderLogo',
                                e.target.checked
                              )
                            }
                            className="rounded h-4 w-4 accent-blue-600"
                          />
                          Show Header Stars / Logo Emblem
                        </label>

                        <div className="flex items-center gap-2 text-xs font-bold">
                          <span>Header Alignment:</span>
                          <select
                            value={template.headerAlignment}
                            onChange={(e) =>
                              updateTemplateField(
                                'headerAlignment',
                                e.target.value as 'center' | 'left' | 'right'
                              )
                            }
                            className="rounded-lg border px-2 py-1 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          >
                            <option value="center">Center</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      </div>

                      {template.showHeaderLogo && (
                        <div className="p-3.5 rounded-2xl border space-y-2 bg-black/5" style={{ borderColor: theme.portal_border }}>
                          <label className="block text-xs font-bold">
                            Header Stars / Emblem Characters
                            <input
                              value={template.headerStarsText}
                              onChange={(e) =>
                                updateTemplateField('headerStarsText', e.target.value)
                              }
                              placeholder="★ ★ ★"
                              className="mt-1.5 w-full rounded-xl border px-3 py-2 text-xs outline-none font-bold"
                              style={{
                                background: theme.portal_background,
                                borderColor: theme.portal_border,
                              }}
                            />
                          </label>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] opacity-70 font-semibold mr-1">
                              Star Presets:
                            </span>
                            {starEmblemPresets.map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => updateTemplateField('headerStarsText', star)}
                                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition-all ${
                                  template.headerStarsText === star
                                    ? 'bg-black/15 border-black/50 shadow-xs'
                                    : 'hover:bg-black/5'
                                }`}
                                style={{ borderColor: theme.portal_border }}
                              >
                                {star}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Order Metadata & Customer Info */}
                <div
                  className="rounded-3xl border shadow-sm overflow-hidden"
                  style={{
                    background: theme.portal_surface,
                    borderColor: theme.portal_border,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection('order')}
                    className="w-full flex items-center justify-between p-5 text-left font-black text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Sliders className="h-4 w-4" style={{ color: theme.portal_accent }} />
                      <span>Order Details & Customer Info</span>
                    </div>
                    {openSections.order ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {openSections.order && (
                    <div className="p-5 pt-0 space-y-4 border-t" style={{ borderColor: theme.portal_border }}>
                      <div className="grid gap-3 sm:grid-cols-2 pt-4">
                        <label className="block text-xs font-bold">
                          Order Number Prefix
                          <input
                            value={template.orderNumberPrefix}
                            onChange={(e) =>
                              updateTemplateField(
                                'orderNumberPrefix',
                                e.target.value
                              )
                            }
                            placeholder="#"
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          />
                        </label>

                        <label className="block text-xs font-bold">
                          Order Number Size
                          <select
                            value={template.orderNumberSize}
                            onChange={(e) =>
                              updateTemplateField(
                                'orderNumberSize',
                                e.target.value as 'normal' | 'large' | 'huge'
                              )
                            }
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          >
                            <option value="normal">Normal</option>
                            <option value="large">Large (Bold)</option>
                            <option value="huge">Huge (High Visibility)</option>
                          </select>
                        </label>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 pt-2">
                        {(
                          [
                            ['showDate', 'Show Date & Time'],
                            ['showOrderType', 'Show Order Type (Dine-in / Delivery)'],
                            ['showTableNumber', 'Show Table Number'],
                            ['showCustomerName', 'Show Customer Name'],
                            ['showCustomerPhone', 'Show Customer Phone'],
                            ['showDeliveryAddress', 'Show Delivery Address'],
                            ['showServerName', 'Show Server / POS Register Name'],
                          ] as const
                        ).map(([field, label]) => (
                          <label
                            key={field}
                            className="flex items-center gap-2 text-xs font-medium cursor-pointer p-2 rounded-xl hover:bg-black/5"
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(template[field])}
                              onChange={(e) =>
                                updateTemplateField(field, e.target.checked)
                              }
                              className="rounded h-4 w-4 accent-blue-600"
                            />
                            {label}
                          </label>
                        ))}
                      </div>

                      {template.showServerName && (
                        <label className="block text-xs font-bold pt-2">
                          Default Server / Station Label
                          <input
                            value={template.serverName}
                            onChange={(e) =>
                              updateTemplateField('serverName', e.target.value)
                            }
                            placeholder="POS Station 1"
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Items & Dividers */}
                <div
                  className="rounded-3xl border shadow-sm overflow-hidden"
                  style={{
                    background: theme.portal_surface,
                    borderColor: theme.portal_border,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection('items')}
                    className="w-full flex items-center justify-between p-5 text-left font-black text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Layers className="h-4 w-4" style={{ color: theme.portal_accent }} />
                      <span>Items Presentation & Dividers</span>
                    </div>
                    {openSections.items ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {openSections.items && (
                    <div className="p-5 pt-0 space-y-4 border-t" style={{ borderColor: theme.portal_border }}>
                      <div className="grid gap-3 sm:grid-cols-2 pt-4">
                        <label className="block text-xs font-bold">
                          Receipt Divider Style
                          <select
                            value={template.dividerStyle}
                            onChange={(e) =>
                              updateTemplateField(
                                'dividerStyle',
                                e.target.value as DividerStyle
                              )
                            }
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none font-mono"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          >
                            <option value="dashes">Dashes (----------------)</option>
                            <option value="dots">Dots (................)</option>
                            <option value="double">Double Line (================)</option>
                            <option value="solid">Solid Line (━━━━━━━━━━━━━━━━)</option>
                            <option value="stars">Stars (****************)</option>
                          </select>
                        </label>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 pt-1">
                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer p-2 rounded-xl hover:bg-black/5">
                          <input
                            type="checkbox"
                            checked={template.showItemPrices}
                            onChange={(e) =>
                              updateTemplateField('showItemPrices', e.target.checked)
                            }
                            className="rounded h-4 w-4 accent-blue-600"
                          />
                          Show Item Total Prices
                        </label>

                        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer p-2 rounded-xl hover:bg-black/5">
                          <input
                            type="checkbox"
                            checked={template.showItemModifiers}
                            onChange={(e) =>
                              updateTemplateField(
                                'showItemModifiers',
                                e.target.checked
                              )
                            }
                            className="rounded h-4 w-4 accent-blue-600"
                          />
                          Show Unit Price Sub-labels (@ $X ea)
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Totals, Taxes & Financials */}
                <div
                  className="rounded-3xl border shadow-sm overflow-hidden"
                  style={{
                    background: theme.portal_surface,
                    borderColor: theme.portal_border,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection('totals')}
                    className="w-full flex items-center justify-between p-5 text-left font-black text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-4 w-4" style={{ color: theme.portal_accent }} />
                      <span>Taxes, Charges & Financial Totals</span>
                    </div>
                    {openSections.totals ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {openSections.totals && (
                    <div className="p-5 pt-0 space-y-4 border-t" style={{ borderColor: theme.portal_border }}>
                      <div className="grid gap-3 sm:grid-cols-2 pt-4">
                        <div className="p-3 rounded-2xl border" style={{ borderColor: theme.portal_border }}>
                          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={template.showTax}
                              onChange={(e) =>
                                updateTemplateField('showTax', e.target.checked)
                              }
                              className="rounded h-4 w-4 accent-blue-600"
                            />
                            Calculate & Show Tax / VAT
                          </label>
                          {template.showTax && (
                            <div className="mt-3 space-y-2">
                              <label className="block text-[11px] font-semibold">
                                Tax Rate (%)
                                <input
                                  type="number"
                                  step="0.1"
                                  value={template.taxRate}
                                  onChange={(e) =>
                                    updateTemplateField(
                                      'taxRate',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                                  style={{
                                    background: theme.portal_background,
                                    borderColor: theme.portal_border,
                                  }}
                                />
                              </label>
                              <label className="block text-[11px] font-semibold">
                                Tax Line Label
                                <input
                                  value={template.taxLabel}
                                  onChange={(e) =>
                                    updateTemplateField(
                                      'taxLabel',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Tax (8.5%)"
                                  className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                                  style={{
                                    background: theme.portal_background,
                                    borderColor: theme.portal_border,
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </div>

                        <div className="p-3 rounded-2xl border" style={{ borderColor: theme.portal_border }}>
                          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={template.showServiceCharge}
                              onChange={(e) =>
                                updateTemplateField(
                                  'showServiceCharge',
                                  e.target.checked
                                )
                              }
                              className="rounded h-4 w-4 accent-blue-600"
                            />
                            Show Service Charge / Gratuity
                          </label>
                          {template.showServiceCharge && (
                            <div className="mt-3 space-y-2">
                              <label className="block text-[11px] font-semibold">
                                Service Charge (%)
                                <input
                                  type="number"
                                  step="0.5"
                                  value={template.serviceChargeRate}
                                  onChange={(e) =>
                                    updateTemplateField(
                                      'serviceChargeRate',
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                                  style={{
                                    background: theme.portal_background,
                                    borderColor: theme.portal_border,
                                  }}
                                />
                              </label>
                              <label className="block text-[11px] font-semibold">
                                Service Line Label
                                <input
                                  value={template.serviceChargeLabel}
                                  onChange={(e) =>
                                    updateTemplateField(
                                      'serviceChargeLabel',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Service (10%)"
                                  className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none"
                                  style={{
                                    background: theme.portal_background,
                                    borderColor: theme.portal_border,
                                  }}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 pt-2">
                        <label className="block text-xs font-bold">
                          Payment Mode Text
                          <input
                            value={template.paymentMethod}
                            onChange={(e) =>
                              updateTemplateField(
                                'paymentMethod',
                                e.target.value
                              )
                            }
                            placeholder="Credit Card / Cash"
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          />
                        </label>

                        <div className="flex flex-col justify-end space-y-2 pt-1">
                          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={template.showSubtotal}
                              onChange={(e) =>
                                updateTemplateField(
                                  'showSubtotal',
                                  e.target.checked
                                )
                              }
                              className="rounded h-4 w-4 accent-blue-600"
                            />
                            Show Subtotal Line
                          </label>
                          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              checked={template.showItemCount}
                              onChange={(e) =>
                                updateTemplateField(
                                  'showItemCount',
                                  e.target.checked
                                )
                              }
                              className="rounded h-4 w-4 accent-blue-600"
                            />
                            Show Total Items Count
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Footer, Wi-Fi, Barcode & QR Code */}
                <div
                  className="rounded-3xl border shadow-sm overflow-hidden"
                  style={{
                    background: theme.portal_surface,
                    borderColor: theme.portal_border,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection('footer')}
                    className="w-full flex items-center justify-between p-5 text-left font-black text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <QrCode className="h-4 w-4" style={{ color: theme.portal_accent }} />
                      <span>Footer, Wi-Fi & QR / Barcode</span>
                    </div>
                    {openSections.footer ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {openSections.footer && (
                    <div className="p-5 pt-0 space-y-4 border-t" style={{ borderColor: theme.portal_border }}>
                      <label className="block text-xs font-bold pt-4">
                        Thank You / Footer Message
                        <textarea
                          rows={2}
                          value={template.footerMessage}
                          onChange={(e) =>
                            updateTemplateField('footerMessage', e.target.value)
                          }
                          placeholder="Thank you for choosing NovaMenu!"
                          className="mt-1.5 w-full rounded-xl border p-3 text-xs outline-none"
                          style={{
                            background: theme.portal_background,
                            borderColor: theme.portal_border,
                          }}
                        />
                      </label>

                      <label className="block text-xs font-bold">
                        Wi-Fi Information
                        <input
                          value={template.wifiInfo}
                          onChange={(e) =>
                            updateTemplateField('wifiInfo', e.target.value)
                          }
                          placeholder="Guest Wi-Fi: NovaGuest  Pass: welcome123"
                          className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                          style={{
                            background: theme.portal_background,
                            borderColor: theme.portal_border,
                          }}
                        />
                      </label>

                      <div className="grid gap-3 sm:grid-cols-2 pt-2">
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer p-2 rounded-xl hover:bg-black/5">
                          <input
                            type="checkbox"
                            checked={template.showBarcode}
                            onChange={(e) =>
                              updateTemplateField(
                                'showBarcode',
                                e.target.checked
                              )
                            }
                            className="rounded h-4 w-4 accent-blue-600"
                          />
                          Print Order Barcode
                        </label>

                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer p-2 rounded-xl hover:bg-black/5">
                          <input
                            type="checkbox"
                            checked={template.showQrCode}
                            onChange={(e) =>
                              updateTemplateField('showQrCode', e.target.checked)
                            }
                            className="rounded h-4 w-4 accent-blue-600"
                          />
                          Print Scannable QR Code
                        </label>
                      </div>

                      {template.showQrCode && (
                        <div className="grid gap-3 sm:grid-cols-2 pt-2">
                          <label className="block text-xs font-bold">
                            QR Code Target URL
                            <input
                              value={template.qrCodeData}
                              onChange={(e) =>
                                updateTemplateField('qrCodeData', e.target.value)
                              }
                              placeholder="https://novamenu.com"
                              className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                              style={{
                                background: theme.portal_background,
                                borderColor: theme.portal_border,
                              }}
                            />
                          </label>

                          <label className="block text-xs font-bold">
                            QR Caption Text
                            <input
                              value={template.qrCodeLabel}
                              onChange={(e) =>
                                updateTemplateField(
                                  'qrCodeLabel',
                                  e.target.value
                                )
                              }
                              placeholder="Scan to view digital menu"
                              className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                              style={{
                                background: theme.portal_background,
                                borderColor: theme.portal_border,
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 6. Paper Width & Typography */}
                <div
                  className="rounded-3xl border shadow-sm overflow-hidden"
                  style={{
                    background: theme.portal_surface,
                    borderColor: theme.portal_border,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleSection('paper')}
                    className="w-full flex items-center justify-between p-5 text-left font-black text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Palette className="h-4 w-4" style={{ color: theme.portal_accent }} />
                      <span>Paper Sizing & Typography</span>
                    </div>
                    {openSections.paper ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {openSections.paper && (
                    <div className="p-5 pt-0 space-y-4 border-t" style={{ borderColor: theme.portal_border }}>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 pt-4">
                        <label className="block text-xs font-bold">
                          Paper Roll Width
                          <select
                            value={template.paperSize}
                            onChange={(e) =>
                              updateTemplateField('paperSize', e.target.value as PaperWidth)
                            }
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          >
                            <option value="80mm">80mm (Standard POS Roll)</option>
                            <option value="58mm">58mm (Compact Roll)</option>
                          </select>
                        </label>

                        <label className="block text-xs font-bold">
                          Font Style & Typography
                          <select
                            value={template.fontFamily}
                            onChange={(e) =>
                              updateTemplateField('fontFamily', e.target.value as FontFamily)
                            }
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          >
                            {fontFamilyOptions.map((font) => (
                              <option key={font.id} value={font.id}>
                                {font.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-xs font-bold">
                          Font Size
                          <select
                            value={template.fontSize}
                            onChange={(e) =>
                              updateTemplateField('fontSize', e.target.value as FontSize)
                            }
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          >
                            {fontSizeOptions.map((size) => (
                              <option key={size.id} value={size.id}>
                                {size.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-xs font-bold">
                          Line Spacing
                          <select
                            value={template.lineSpacing}
                            onChange={(e) =>
                              updateTemplateField('lineSpacing', e.target.value as LineSpacing)
                            }
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          >
                            <option value="tight">Tight (1.2x Compact)</option>
                            <option value="normal">Normal (1.4x Balanced)</option>
                            <option value="relaxed">Relaxed (1.6x Spacious)</option>
                          </select>
                        </label>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 pt-2">
                        <label className="block text-xs font-bold">
                          Padding Density
                          <select
                            value={template.padding}
                            onChange={(e) =>
                              updateTemplateField(
                                'padding',
                                e.target.value as 'compact' | 'normal' | 'spacious'
                              )
                            }
                            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                            style={{
                              background: theme.portal_background,
                              borderColor: theme.portal_border,
                            }}
                          >
                            <option value="compact">Compact Margins</option>
                            <option value="normal">Standard Margins</option>
                            <option value="spacious">Spacious Margins</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Live Sticky Thermal Receipt Preview (5 Cols) */}
              <div className="lg:col-span-5 lg:sticky lg:top-8">
                <div
                  className="rounded-3xl border p-5 shadow-sm"
                  style={{
                    background: theme.portal_surface,
                    borderColor: theme.portal_border,
                  }}
                >
                  <div className="flex items-center justify-between pb-3 border-b mb-4" style={{ borderColor: theme.portal_border }}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <h3 className="text-sm font-black">Live Receipt Preview</h3>
                    </div>

                    {/* Sample Switcher */}
                    <div
                      className="flex items-center gap-1 rounded-lg border p-1"
                      style={{
                        background: theme.portal_background,
                        borderColor: theme.portal_border,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSampleType('dinein')}
                        className="rounded px-2 py-1 text-[10px] font-black uppercase"
                        style={{
                          background:
                            sampleType === 'dinein'
                              ? theme.portal_accent
                              : 'transparent',
                          color:
                            sampleType === 'dinein'
                              ? '#ffffff'
                              : theme.portal_text,
                        }}
                      >
                        Dine-In
                      </button>
                      <button
                        type="button"
                        onClick={() => setSampleType('delivery')}
                        className="rounded px-2 py-1 text-[10px] font-black uppercase"
                        style={{
                          background:
                            sampleType === 'delivery'
                              ? theme.portal_accent
                              : 'transparent',
                          color:
                            sampleType === 'delivery'
                              ? '#ffffff'
                              : theme.portal_text,
                        }}
                      >
                        Delivery
                      </button>
                    </div>
                  </div>

                  {/* Render Live Thermal Receipt */}
                  <ReceiptPreview
                    template={template}
                    order={
                      sampleType === 'dinein'
                        ? defaultSampleOrder
                        : sampleDeliveryOrder
                    }
                    currency="$"
                    showPrintButton={true}
                    onPrint={() => testPrinter(printer)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Discovery / Scan Progress Dialog Modal */}
      {showScanDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#171613]/70 px-4 py-6 backdrop-blur-sm animate-in fade-in">
          <section
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xl rounded-[28px] border p-6 shadow-2xl sm:p-8"
            style={{
              background: theme.portal_surface,
              borderColor: theme.portal_border,
              color: theme.portal_text,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ color: theme.portal_accent }}
                >
                  Hardware Discovery
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {scanning ? 'Scanning for Printers' : 'Scan Complete'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowScanDialog(false)}
                className="rounded-xl border p-2 hover:bg-black/5"
                style={{ borderColor: theme.portal_border }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {scanning ? (
              <div className="my-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2
                    className="h-5 w-5 animate-spin"
                    style={{ color: theme.portal_accent }}
                  />
                  <span className="text-sm font-semibold">{scanStep}</span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ background: theme.portal_background }}
                >
                  <div
                    className="h-full w-2/3 animate-pulse rounded-full"
                    style={{ background: theme.portal_accent }}
                  />
                </div>
              </div>
            ) : (
              <div className="my-6 space-y-4">
                <div
                  className="rounded-2xl border p-4 text-sm font-medium"
                  style={{
                    background: theme.portal_background,
                    borderColor: theme.portal_border,
                  }}
                >
                  {message || `${detectedPrinters.length} printer devices detected.`}
                </div>

                {/* Optional Subnet Input */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    value={customSubnet}
                    onChange={(e) => setCustomSubnet(e.target.value)}
                    placeholder="Custom Subnet IP (e.g. 192.168.1)"
                    className="flex-1 rounded-xl border px-3 py-2 text-xs outline-none"
                    style={{
                      background: theme.portal_background,
                      borderColor: theme.portal_border,
                      color: theme.portal_text,
                    }}
                  />
                  <button
                    type="button"
                    onClick={scanForPrinters}
                    disabled={scanning}
                    className="rounded-xl px-3 py-2 text-[10px] font-black uppercase text-white shrink-0"
                    style={{ background: theme.portal_accent }}
                  >
                    Scan Subnet
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {detectedPrinters.map((p) => {
                    const Icon = getConnectionIcon(p.connection);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-xl border p-3"
                        style={{
                          borderColor: theme.portal_border,
                          background: theme.portal_surface,
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className="h-4 w-4 shrink-0" style={{ color: theme.portal_accent }} />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold">{p.name}</p>
                            <p className="text-[10px] opacity-70">{p.details || p.connection}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            connectPrinter(p);
                            setShowScanDialog(false);
                          }}
                          className="rounded-lg px-3 py-1.5 text-[10px] font-black uppercase text-white shrink-0"
                          style={{ background: theme.portal_accent }}
                        >
                          Select
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: theme.portal_border }}>
              <button
                type="button"
                onClick={() => setShowScanDialog(false)}
                className="rounded-xl border px-5 py-2.5 text-xs font-black uppercase tracking-wider"
                style={{ borderColor: theme.portal_border }}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

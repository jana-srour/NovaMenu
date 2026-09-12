export type PaperWidth = '58mm' | '80mm';
export type FontSize = 'xxs' | 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl' | 'xxl';
export type FontFamily =
  | 'monospace'
  | 'consolas'
  | 'dotmatrix'
  | 'spacegrotesk'
  | 'sans'
  | 'helvetica'
  | 'outfit'
  | 'trebuchet'
  | 'roboto'
  | 'serif'
  | 'georgia'
  | 'garamond'
  | 'cinzel';

export type LineSpacing = 'tight' | 'normal' | 'relaxed';
export type Alignment = 'center' | 'left' | 'right';
export type DividerStyle = 'dashes' | 'dots' | 'double' | 'solid' | 'stars';
export type OrderNumberSize = 'normal' | 'large' | 'huge';

export type ReceiptTemplateConfig = {
  // Store & Header
  storeName: string;
  tagline: string;
  address: string;
  phone: string;
  taxNumber: string;
  website: string;
  logoUrl?: string;
  showHeaderLogo: boolean;
  headerStarsText: string; // User controllable stars / emblem: e.g. "★ ★ ★", "✦ ✦ ✦", "★★★★★"
  headerAlignment: Alignment;

  // Order Details
  showOrderNumber: boolean;
  orderNumberPrefix: string;
  orderNumberSize: OrderNumberSize;
  showDate: boolean;
  showTime: boolean;
  showCustomerName: boolean;
  showCustomerPhone: boolean;
  showDeliveryAddress: boolean;
  showTableNumber: boolean;
  showOrderType: boolean;
  showServerName: boolean;
  serverName: string;

  // Items & Pricing
  showItemPrices: boolean;
  showItemQuantities: boolean;
  showItemModifiers: boolean;
  showItemSubtotal: boolean;
  dividerStyle: DividerStyle;

  // Totals & Financials
  showSubtotal: boolean;
  taxRate: number; // percentage e.g. 5, 10
  showTax: boolean;
  taxLabel: string;
  serviceChargeRate: number; // percentage e.g. 0, 10
  showServiceCharge: boolean;
  serviceChargeLabel: string;
  showTotal: boolean;
  showPaymentMethod: boolean;
  paymentMethod: string;
  showItemCount: boolean;

  // Footer & Extras
  footerMessage: string;
  showFooterMessage: boolean;
  wifiInfo: string;
  showWifiInfo: boolean;
  showBarcode: boolean;
  showQrCode: boolean;
  qrCodeData: string;
  qrCodeLabel: string;
  footerAlignment: Alignment;

  // Paper & Typography
  paperSize: PaperWidth;
  fontSize: FontSize;
  fontFamily: FontFamily;
  lineSpacing: LineSpacing;
  padding: 'compact' | 'normal' | 'spacious';
};

export const defaultReceiptTemplate: ReceiptTemplateConfig = {
  storeName: 'Nova Restaurant & Bar',
  tagline: 'Artisan Food & Drinks',
  address: '100 Gourmet Plaza, Downtown',
  phone: '+1 (555) 019-2834',
  taxNumber: 'TAX ID: US-8829104',
  website: 'www.novamenu.com',
  showHeaderLogo: true,
  headerStarsText: '★ ★ ★',
  headerAlignment: 'center',

  showOrderNumber: true,
  orderNumberPrefix: '#',
  orderNumberSize: 'large',
  showDate: true,
  showTime: true,
  showCustomerName: true,
  showCustomerPhone: true,
  showDeliveryAddress: true,
  showTableNumber: true,
  showOrderType: true,
  showServerName: true,
  serverName: 'POS Station 1',

  showItemPrices: true,
  showItemQuantities: true,
  showItemModifiers: true,
  showItemSubtotal: true,
  dividerStyle: 'dashes',

  showSubtotal: true,
  taxRate: 8.5,
  showTax: true,
  taxLabel: 'Tax (8.5%)',
  serviceChargeRate: 0,
  showServiceCharge: false,
  serviceChargeLabel: 'Service Charge',
  showTotal: true,
  showPaymentMethod: true,
  paymentMethod: 'Credit Card / Cash',
  showItemCount: true,

  footerMessage: 'Thank you for choosing NovaMenu!\nPlease visit us again soon.',
  showFooterMessage: true,
  wifiInfo: 'Guest Wi-Fi: NovaGuest  Pass: welcome123',
  showWifiInfo: true,
  showBarcode: true,
  showQrCode: true,
  qrCodeData: 'https://novamenu.com',
  qrCodeLabel: 'Scan to View Digital Menu & Reorder',
  footerAlignment: 'center',

  paperSize: '80mm',
  fontSize: 'base',
  fontFamily: 'monospace',
  lineSpacing: 'normal',
  padding: 'normal',
};

export const fontFamilyOptions: Array<{
  id: FontFamily;
  name: string;
  cssFont: string;
  category: 'Monospace' | 'Sans-Serif' | 'Serif';
}> = [
  {
    id: 'monospace',
    name: 'Thermal Courier (Standard POS)',
    cssFont: "'Courier New', Courier, monospace",
    category: 'Monospace',
  },
  {
    id: 'consolas',
    name: 'Consolas (Retro Thermal)',
    cssFont: "Consolas, 'Lucida Console', Monaco, monospace",
    category: 'Monospace',
  },
  {
    id: 'dotmatrix',
    name: 'Dot-Matrix (Receipt Pin)',
    cssFont: "'Lucida Console', Monaco, 'Courier New', monospace",
    category: 'Monospace',
  },
  {
    id: 'spacegrotesk',
    name: 'Space Grotesk (Tech Minimal)',
    cssFont: "'Space Grotesk', 'Courier New', monospace",
    category: 'Monospace',
  },
  {
    id: 'sans',
    name: 'Modern Sans (Inter / Apple)',
    cssFont: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    category: 'Sans-Serif',
  },
  {
    id: 'helvetica',
    name: 'Helvetica / Arial (Clean POS)',
    cssFont: "'Helvetica Neue', Arial, sans-serif",
    category: 'Sans-Serif',
  },
  {
    id: 'outfit',
    name: 'Outfit (Geometric Clean)',
    cssFont: "Outfit, system-ui, -apple-system, sans-serif",
    category: 'Sans-Serif',
  },
  {
    id: 'roboto',
    name: 'Roboto (Crisp Interface)',
    cssFont: "Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    category: 'Sans-Serif',
  },
  {
    id: 'trebuchet',
    name: 'Trebuchet MS (High Legibility)',
    cssFont: "'Trebuchet MS', 'Lucida Sans', sans-serif",
    category: 'Sans-Serif',
  },
  {
    id: 'serif',
    name: 'Classic Serif (Times New Roman)',
    cssFont: "'Times New Roman', Times, serif",
    category: 'Serif',
  },
  {
    id: 'georgia',
    name: 'Georgia (Bistro Elegant)',
    cssFont: "Georgia, 'Times New Roman', serif",
    category: 'Serif',
  },
  {
    id: 'garamond',
    name: 'Garamond (Fine Dining Heritage)',
    cssFont: "Garamond, 'Baskerville', 'Times New Roman', serif",
    category: 'Serif',
  },
  {
    id: 'cinzel',
    name: 'Cinzel (Luxury Gourmet)',
    cssFont: "Cinzel, 'Times New Roman', serif",
    category: 'Serif',
  },
];

export const fontSizeOptions: Array<{
  id: FontSize;
  name: string;
  px: string;
  printPt: string;
  description: string;
}> = [
  { id: 'xxs', name: 'Ultra Compact (9px)', px: '9px', printPt: '7pt', description: 'Maximum density for very long receipts' },
  { id: 'xs', name: 'Extra Compact (10px)', px: '10px', printPt: '8pt', description: 'Dense receipt fit for high item counts' },
  { id: 'sm', name: 'Compact (11px)', px: '11px', printPt: '9pt', description: 'Standard compact thermal fit' },
  { id: 'base', name: 'Standard Normal (12px)', px: '12px', printPt: '10pt', description: 'Recommended default for all receipts' },
  { id: 'md', name: 'Medium (13px)', px: '13px', printPt: '11pt', description: 'Crisp legibility' },
  { id: 'lg', name: 'Large (14px)', px: '14px', printPt: '12pt', description: 'High visibility typography' },
  { id: 'xl', name: 'Extra Large (16px)', px: '16px', printPt: '14pt', description: 'Maximum legibility for kitchen & staff' },
  { id: 'xxl', name: 'Huge Header (18px)', px: '18px', printPt: '16pt', description: 'Ultra bold display for kitchen tickets' },
];

export const starEmblemPresets = [
  '★ ★ ★',
  '✦ ✦ ✦',
  '★★★★★',
  '★★★ NOVAMENU ★★★',
  '☕ ☕ ☕',
  '🍴 🍴 🍴',
  '✨ ✨ ✨',
  '❤️ ❤️ ❤️',
  '━ ★ ━',
];

export const receiptPresets: Record<
  string,
  { name: string; description: string; config: Partial<ReceiptTemplateConfig> }
> = {
  classic: {
    name: 'Classic Bistro',
    description: 'Traditional restaurant receipt with clean dashed dividers, tax breakdown, and header.',
    config: {
      ...defaultReceiptTemplate,
      dividerStyle: 'dashes',
      fontFamily: 'monospace',
      fontSize: 'base',
      headerStarsText: '★ ★ ★',
      orderNumberSize: 'large',
      headerAlignment: 'center',
      footerAlignment: 'center',
    },
  },
  modern: {
    name: 'Modern Minimal',
    description: 'Sleek, streamlined layout with large order number, clean Sans typography, QR code, and Wi-Fi note.',
    config: {
      ...defaultReceiptTemplate,
      dividerStyle: 'solid',
      fontFamily: 'sans',
      fontSize: 'base',
      headerStarsText: '✦ ✦ ✦',
      orderNumberSize: 'huge',
      headerAlignment: 'center',
      footerAlignment: 'center',
      showWifiInfo: true,
      showQrCode: true,
      showBarcode: false,
    },
  },
  fastfood: {
    name: 'Fast Food & Takeaway',
    description: 'High visibility order numbers, barcode for scanning, bold font, and customer delivery info.',
    config: {
      ...defaultReceiptTemplate,
      dividerStyle: 'double',
      fontFamily: 'consolas',
      fontSize: 'md',
      headerStarsText: '★★★ ORDER ★★★',
      orderNumberSize: 'huge',
      orderNumberPrefix: 'ORDER #',
      showBarcode: true,
      showCustomerPhone: true,
      showDeliveryAddress: true,
      showItemModifiers: true,
      footerMessage: 'Fast & Fresh! Enjoy your meal.',
    },
  },
  finedining: {
    name: 'Fine Dining Detailed',
    description: 'Comprehensive itemization with service charge, tax ID, elegant Georgia serif, and star dividers.',
    config: {
      ...defaultReceiptTemplate,
      dividerStyle: 'dots',
      fontFamily: 'georgia',
      fontSize: 'base',
      headerStarsText: '✨ ✨ ✨',
      orderNumberSize: 'normal',
      showServiceCharge: true,
      serviceChargeRate: 10,
      serviceChargeLabel: 'Gratuity / Service (10%)',
      showTax: true,
      taxLabel: 'VAT (8.5%)',
      footerMessage: 'It was our absolute pleasure serving you.\nHave a wonderful day!',
    },
  },
};

export const RECEIPT_STORAGE_KEY = 'novamenu_receipt_template';

export function loadReceiptTemplate(): ReceiptTemplateConfig {
  if (typeof window === 'undefined') return defaultReceiptTemplate;
  try {
    const stored = window.localStorage.getItem(RECEIPT_STORAGE_KEY);
    if (!stored) return defaultReceiptTemplate;
    const parsed = JSON.parse(stored);
    return {
      ...defaultReceiptTemplate,
      ...parsed,
      headerStarsText: parsed.headerStarsText ?? defaultReceiptTemplate.headerStarsText,
    };
  } catch {
    return defaultReceiptTemplate;
  }
}

export function saveReceiptTemplate(config: ReceiptTemplateConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RECEIPT_STORAGE_KEY, JSON.stringify(config));
}

export function getDividerString(style: DividerStyle, width: number = 32): string {
  switch (style) {
    case 'dashes':
      return '-'.repeat(width);
    case 'dots':
      return '.'.repeat(width);
    case 'double':
      return '='.repeat(width);
    case 'solid':
      return '━'.repeat(width);
    case 'stars':
      return '*'.repeat(width);
    default:
      return '-'.repeat(width);
  }
}

export function getCssFontFamily(font: FontFamily): string {
  const match = fontFamilyOptions.find((f) => f.id === font);
  return match ? match.cssFont : "'Courier New', Courier, monospace";
}

export function getCssFontSize(size: FontSize): string {
  const match = fontSizeOptions.find((s) => s.id === size);
  return match ? match.px : '12px';
}

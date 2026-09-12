import { NextResponse } from 'next/server';
import type { ReceiptTemplateConfig } from '@/lib/receipt-template';

export const runtime = 'nodejs';

type PrintRequest = {
  printer: {
    connection: 'network' | 'manual' | 'usb' | 'bluetooth' | 'serial' | 'system';
    address?: string;
    port?: string;
  };
  order: {
    orderNumber: number;
    customer: string;
    customerPhone?: string;
    table?: string;
    address?: string;
    channel?: string;
    createdAt: string;
    total: number;
    currency: string;
    items: Array<{ name: string; qty: number; price: number }>;
  };
  template?: ReceiptTemplateConfig;
};

const line = (value: string = '') => `${value}\n`;

export async function POST(request: Request) {
  const body = (await request.json()) as PrintRequest;
  const { printer, order, template } = body;

  if (printer.connection === 'system') {
    return NextResponse.json({ printed: true, mode: 'system' });
  }

  if (!printer?.address || !printer.port) {
    return NextResponse.json(
      { error: 'The configured printer needs an IP address and port.' },
      { status: 400 }
    );
  }

  const dividerChar =
    template?.dividerStyle === 'double'
      ? '='
      : template?.dividerStyle === 'dots'
      ? '.'
      : template?.dividerStyle === 'solid'
      ? '_'
      : '-';

  const width = template?.paperSize === '58mm' ? 32 : 42;
  const divider = dividerChar.repeat(width);

  const receiptLines: string[] = [
    '\x1b@', // Initialize printer
  ];

  // Alignment: 0: left, 1: center, 2: right
  const alignCenter = '\x1ba\x01';
  const alignLeft = '\x1ba\x00';
  const boldOn = '\x1bE\x01';
  const boldOff = '\x1bE\x00';
  const doubleSize = '\x1d!\x11';
  const normalSize = '\x1d!\x00';

  // Store Header
  if (template?.headerAlignment === 'center') {
    receiptLines.push(alignCenter);
  } else {
    receiptLines.push(alignLeft);
  }

  if (template?.showHeaderLogo !== false && template?.headerStarsText) {
    receiptLines.push(line(template.headerStarsText));
  }

  receiptLines.push(boldOn, doubleSize);
  receiptLines.push(line(template?.storeName || 'NOVAMENU'));
  receiptLines.push(boldOff, normalSize);

  if (template?.tagline) {
    receiptLines.push(line(template.tagline));
  }
  if (template?.address) {
    receiptLines.push(line(template.address));
  }
  if (template?.phone) {
    receiptLines.push(line(`Tel: ${template.phone}`));
  }
  if (template?.taxNumber) {
    receiptLines.push(line(template.taxNumber));
  }
  if (template?.website) {
    receiptLines.push(line(template.website));
  }

  receiptLines.push(line(divider));

  // Order Details
  receiptLines.push(alignLeft);

  if (template?.showOrderNumber !== false) {
    receiptLines.push(boldOn);
    if (template?.orderNumberSize === 'huge' || template?.orderNumberSize === 'large') {
      receiptLines.push(doubleSize);
    }
    const prefix = template?.orderNumberPrefix || 'ORDER #';
    receiptLines.push(line(`${prefix}${order.orderNumber}`));
    receiptLines.push(boldOff, normalSize);
  }

  if (template?.showDate !== false) {
    receiptLines.push(line(`Date: ${order.createdAt}`));
  }
  if (template?.showCustomerName !== false && order.customer) {
    receiptLines.push(line(`Customer: ${order.customer}`));
  }
  if (template?.showCustomerPhone !== false && order.customerPhone) {
    receiptLines.push(line(`Phone: ${order.customerPhone}`));
  }
  if (template?.showTableNumber !== false && order.table) {
    receiptLines.push(line(`Table: ${order.table}`));
  }
  if (template?.showDeliveryAddress !== false && order.address) {
    receiptLines.push(line(`Delivery: ${order.address}`));
  }
  if (template?.showServerName !== false && template?.serverName) {
    receiptLines.push(line(`Server: ${template.serverName}`));
  }

  receiptLines.push(line(divider));

  // Item List
  order.items.forEach((item) => {
    const itemTotal = `${order.currency}${(item.qty * item.price).toFixed(2)}`;
    const itemName = `${item.qty}x ${item.name}`;
    const spaces = Math.max(1, width - itemName.length - itemTotal.length);
    receiptLines.push(line(`${itemName}${' '.repeat(spaces)}${itemTotal}`));
  });

  receiptLines.push(line(divider));

  // Totals & Financials
  const subtotal = order.items.reduce((sum, item) => sum + item.qty * item.price, 0);

  if (template?.showSubtotal !== false) {
    const subtotalText = `${order.currency}${subtotal.toFixed(2)}`;
    const spaces = Math.max(1, width - 9 - subtotalText.length);
    receiptLines.push(line(`Subtotal:${' '.repeat(spaces)}${subtotalText}`));
  }

  if (template?.showTax && template.taxRate > 0) {
    const taxAmount = (subtotal * (template.taxRate / 100)).toFixed(2);
    const label = template.taxLabel || `Tax (${template.taxRate}%)`;
    const spaces = Math.max(1, width - label.length - order.currency.length - taxAmount.length);
    receiptLines.push(line(`${label}:${' '.repeat(spaces)}${order.currency}${taxAmount}`));
  }

  if (template?.showServiceCharge && template.serviceChargeRate > 0) {
    const scAmount = (subtotal * (template.serviceChargeRate / 100)).toFixed(2);
    const label = template.serviceChargeLabel || `Service (${template.serviceChargeRate}%)`;
    const spaces = Math.max(1, width - label.length - order.currency.length - scAmount.length);
    receiptLines.push(line(`${label}:${' '.repeat(spaces)}${order.currency}${scAmount}`));
  }

  receiptLines.push(boldOn, doubleSize);
  const totalText = `${order.currency}${order.total.toFixed(2)}`;
  const totalLabel = 'TOTAL:';
  const totalSpaces = Math.max(1, Math.floor(width / 2) - totalLabel.length - totalText.length);
  receiptLines.push(line(`${totalLabel}${' '.repeat(totalSpaces)}${totalText}`));
  receiptLines.push(boldOff, normalSize);

  if (template?.showPaymentMethod && template.paymentMethod) {
    receiptLines.push(line(`Payment: ${template.paymentMethod}`));
  }

  receiptLines.push(line(divider));

  // Footer
  if (template?.footerAlignment === 'center') {
    receiptLines.push(alignCenter);
  } else {
    receiptLines.push(alignLeft);
  }

  if (template?.showFooterMessage !== false && template?.footerMessage) {
    template.footerMessage.split('\n').forEach((msgLine) => {
      receiptLines.push(line(msgLine));
    });
  }

  if (template?.showWifiInfo && template.wifiInfo) {
    receiptLines.push(line(template.wifiInfo));
  }

  // Paper cut
  receiptLines.push(line(''));
  receiptLines.push(line(''));
  receiptLines.push('\x1dV\x00'); // Full cut

  const receipt = receiptLines.join('');

  try {
    const response = await fetch(`http://${printer.address}:${printer.port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: receipt,
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Printer returned HTTP ${response.status}.` },
        { status: 502 }
      );
    }

    return NextResponse.json({ printed: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to reach the configured printer.',
      },
      { status: 502 }
    );
  }
}

'use client';

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ReceiptTemplateConfig,
  getCssFontFamily,
  getCssFontSize,
  getDividerString,
} from '@/lib/receipt-template';
import { Printer } from 'lucide-react';

export type SampleOrderData = {
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

export const defaultSampleOrder: SampleOrderData = {
  orderNumber: 1042,
  customer: 'Sarah Jenkins',
  customerPhone: '+1 (555) 382-9912',
  table: 'Table 7',
  address: '458 Maple Ave, Apt 3B',
  channel: 'Dine-in',
  createdAt: new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
  total: 48.5,
  currency: '$',
  items: [
    { name: 'Truffle Wagyu Burger', qty: 2, price: 18.0 },
    { name: 'Parmesan Truffle Fries', qty: 1, price: 7.5 },
    { name: 'Classic Lemon Iced Tea', qty: 2, price: 2.5 },
  ],
};

/**
 * Universal print handler that generates the exact same visual receipt for browser printing
 */
export function printOrderReceipt({
  template,
  order,
  currency = '$',
}: {
  template: ReceiptTemplateConfig;
  order: SampleOrderData;
  currency?: string;
}) {
  const is58mm = template.paperSize === '58mm';
  const dividerWidth = is58mm ? 28 : 38;
  const divider = getDividerString(template.dividerStyle, dividerWidth);

  const subtotal = order.items.reduce(
    (sum, item) => sum + item.qty * item.price,
    0
  );
  const taxAmount =
    template.showTax && template.taxRate > 0
      ? subtotal * (template.taxRate / 100)
      : 0;
  const serviceAmount =
    template.showServiceCharge && template.serviceChargeRate > 0
      ? subtotal * (template.serviceChargeRate / 100)
      : 0;
  const calculatedTotal = subtotal + taxAmount + serviceAmount;

  const fontCss = getCssFontFamily(template.fontFamily);
  const fontSizeCss = getCssFontSize(template.fontSize);
  const lineHeightCss =
    template.lineSpacing === 'tight'
      ? '1.2'
      : template.lineSpacing === 'relaxed'
      ? '1.6'
      : '1.4';

  const printPadding =
    template.padding === 'compact'
      ? is58mm ? '4px 6px' : '6px 8px'
      : template.padding === 'spacious'
      ? is58mm ? '12px 12px' : '18px 20px'
      : is58mm ? '6px 8px' : '10px 14px';

  const printWindow = window.open('', '_blank', 'width=460,height=750');
  if (!printWindow) {
    alert('Please allow pop-ups in your browser to print receipts.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt #${order.orderNumber}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;600;700;900&family=Outfit:wght@400;600;700;900&family=Roboto:wght@400;500;700;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
        <style>
          @page {
            margin: 0;
            size: ${is58mm ? '58mm' : '80mm'} auto;
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: ${printPadding};
            font-family: ${fontCss};
            font-size: ${fontSizeCss};
            line-height: ${lineHeightCss};
            color: #000000;
            background: #ffffff;
            width: ${is58mm ? '58mm' : '80mm'};
            max-width: ${is58mm ? '58mm' : '80mm'};
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .center { text-align: center; }
          .left { text-align: left; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .store-title {
            font-size: 1.35em;
            font-weight: 900;
            letter-spacing: -0.5px;
            margin-bottom: 2px;
          }
          .stars-emblem {
            font-size: 1.15em;
            font-weight: bold;
            letter-spacing: 3px;
            margin-bottom: 4px;
          }
          .divider {
            white-space: pre;
            letter-spacing: -1px;
            margin: 6px 0;
            overflow: hidden;
            text-align: center;
            opacity: 0.75;
          }
          .row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin: 2px 0;
          }
          .order-number-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 900;
            margin: 4px 0;
          }
          .order-huge { font-size: 1.5em; }
          .order-large { font-size: 1.25em; }
          .order-normal { font-size: 1em; }
          .order-badge {
            font-size: 0.8em;
            border: 1px solid #000;
            padding: 1px 6px;
            border-radius: 4px;
            text-transform: uppercase;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            font-size: 1.3em;
            font-weight: 900;
            border-top: 1px solid #000;
            padding-top: 4px;
            margin-top: 4px;
          }
          .barcode-container {
            text-align: center;
            margin: 8px auto 4px auto;
          }
          .barcode-bars {
            display: flex;
            justify-content: center;
            align-items: flex-end;
            height: 34px;
            gap: 2px;
          }
          .barcode-bar {
            background: #000;
            height: 100%;
          }
          .barcode-label {
            font-size: 0.75em;
            letter-spacing: 2px;
            margin-top: 2px;
          }
          .qr-box {
            text-align: center;
            margin: 8px auto;
          }
          .wifi-box {
            background: #f0f0f0;
            border: 1px dashed #999;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            font-weight: bold;
            margin: 6px 0;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="${template.headerAlignment}">
          ${
            template.showHeaderLogo
              ? `<div class="stars-emblem">${template.headerStarsText || '★ ★ ★'}</div>`
              : ''
          }
          <div class="store-title">${template.storeName || 'NOVAMENU'}</div>
          ${template.tagline ? `<div><i>${template.tagline}</i></div>` : ''}
          ${template.address ? `<div>${template.address}</div>` : ''}
          ${template.phone ? `<div>Tel: ${template.phone}</div>` : ''}
          ${template.taxNumber ? `<div>${template.taxNumber}</div>` : ''}
          ${template.website ? `<div>${template.website}</div>` : ''}
        </div>

        <div class="divider">${divider}</div>

        <!-- Order Metadata -->
        <div>
          ${
            template.showOrderNumber
              ? `
            <div class="order-number-row ${
              template.orderNumberSize === 'huge'
                ? 'order-huge'
                : template.orderNumberSize === 'large'
                ? 'order-large'
                : 'order-normal'
            }">
              <span>${template.orderNumberPrefix}${order.orderNumber}</span>
              ${template.showOrderType ? `<span class="order-badge">${order.channel || 'Dine-In'}</span>` : ''}
            </div>
          `
              : ''
          }

          ${template.showDate ? `<div class="row"><span>Date & Time:</span><span class="bold">${order.createdAt}</span></div>` : ''}
          ${template.showTableNumber && order.table ? `<div class="row"><span>Table:</span><span class="bold">${order.table}</span></div>` : ''}
          ${template.showCustomerName && order.customer ? `<div class="row"><span>Customer:</span><span class="bold">${order.customer}</span></div>` : ''}
          ${template.showCustomerPhone && order.customerPhone ? `<div class="row"><span>Phone:</span><span>${order.customerPhone}</span></div>` : ''}
          ${template.showDeliveryAddress && order.address ? `<div><b>Delivery:</b> ${order.address}</div>` : ''}
          ${template.showServerName && template.serverName ? `<div class="row"><span>Server:</span><span>${template.serverName}</span></div>` : ''}
        </div>

        <div class="divider">${divider}</div>

        <!-- Items -->
        <div>
          <div class="row bold" style="font-size: 0.85em; text-transform: uppercase; margin-bottom: 4px;">
            <span>Item / Qty</span>
            ${template.showItemPrices ? `<span>Total</span>` : ''}
          </div>
          ${order.items
            .map(
              (item) => `
            <div class="row">
              <div>
                ${template.showItemQuantities !== false ? `<b>${item.qty}x</b> ` : ''}${item.name}
                ${
                  template.showItemModifiers
                    ? `<div style="font-size: 0.85em; opacity: 0.8; padding-left: 14px;">@ ${currency}${item.price.toFixed(2)} ea</div>`
                    : ''
                }
              </div>
              ${
                template.showItemPrices
                  ? `<div class="bold">${currency}${(item.qty * item.price).toFixed(2)}</div>`
                  : ''
              }
            </div>
          `
            )
            .join('')}
        </div>

        <div class="divider">${divider}</div>

        <!-- Totals -->
        <div>
          ${template.showSubtotal ? `<div class="row"><span>Subtotal</span><span>${currency}${subtotal.toFixed(2)}</span></div>` : ''}
          ${template.showTax && template.taxRate > 0 ? `<div class="row"><span>${template.taxLabel || `Tax (${template.taxRate}%)`}</span><span>${currency}${taxAmount.toFixed(2)}</span></div>` : ''}
          ${template.showServiceCharge && template.serviceChargeRate > 0 ? `<div class="row"><span>${template.serviceChargeLabel || `Service (${template.serviceChargeRate}%)`}</span><span>${currency}${serviceAmount.toFixed(2)}</span></div>` : ''}
          ${template.showItemCount ? `<div class="row" style="font-size: 0.85em; opacity: 0.8;"><span>Total items</span><span>${order.items.reduce((s, i) => s + i.qty, 0)} items</span></div>` : ''}
          ${
            template.showTotal
              ? `<div class="total-row"><span>GRAND TOTAL</span><span>${currency}${calculatedTotal.toFixed(2)}</span></div>`
              : ''
          }
          ${template.showPaymentMethod ? `<div class="row" style="font-size: 0.85em; margin-top: 4px;"><span>Payment:</span><b>${template.paymentMethod}</b></div>` : ''}
        </div>

        <div class="divider">${divider}</div>

        <!-- Footer -->
        <div class="${template.footerAlignment}">
          ${
            template.showFooterMessage && template.footerMessage
              ? `<div style="white-space: pre-line; margin: 4px 0;">${template.footerMessage}</div>`
              : ''
          }
          ${
            template.showWifiInfo && template.wifiInfo
              ? `<div class="wifi-box">📶 ${template.wifiInfo}</div>`
              : ''
          }
          ${
            template.showBarcode
              ? `
            <div class="barcode-container">
              <div class="barcode-bars">
                ${[4, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 3, 2, 1]
                  .map(
                    (h, i) =>
                      `<div class="barcode-bar" style="width: ${
                        i % 3 === 0 ? '3px' : '1.5px'
                      }; height: ${h * 7}px;"></div>`
                  )
                  .join('')}
              </div>
              <div class="barcode-label">*ORD-${order.orderNumber}*</div>
            </div>
          `
              : ''
          }
          ${
            template.showQrCode && template.qrCodeData
              ? `
            <div class="qr-box">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                template.qrCodeData
              )}" alt="QR Code" style="width: ${is58mm ? '74px' : '90px'}; height: ${
                  is58mm ? '74px' : '90px'
                };" />
              ${template.qrCodeLabel ? `<div style="font-size: 0.75em; font-weight: bold; margin-top: 2px;">${template.qrCodeLabel}</div>` : ''}
            </div>
          `
              : ''
          }
        </div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 600);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

type ReceiptPreviewProps = {
  template: ReceiptTemplateConfig;
  order?: SampleOrderData;
  currency?: string;
  showPrintButton?: boolean;
  onPrint?: () => void;
  className?: string;
};

export function ReceiptPreview({
  template,
  order = defaultSampleOrder,
  currency = '$',
  showPrintButton = true,
  onPrint,
  className = '',
}: ReceiptPreviewProps) {
  const is58mm = template.paperSize === '58mm';
  const dividerWidth = is58mm ? 28 : 38;
  const divider = getDividerString(template.dividerStyle, dividerWidth);

  const subtotal = order.items.reduce(
    (sum, item) => sum + item.qty * item.price,
    0
  );
  const taxAmount =
    template.showTax && template.taxRate > 0
      ? subtotal * (template.taxRate / 100)
      : 0;
  const serviceAmount =
    template.showServiceCharge && template.serviceChargeRate > 0
      ? subtotal * (template.serviceChargeRate / 100)
      : 0;
  const calculatedTotal = subtotal + taxAmount + serviceAmount;

  const fontCss = getCssFontFamily(template.fontFamily);
  const fontSizeCss = getCssFontSize(template.fontSize);
  const lineHeightCss =
    template.lineSpacing === 'tight'
      ? '1.2'
      : template.lineSpacing === 'relaxed'
      ? '1.6'
      : '1.4';

  const paddingStyle =
    template.padding === 'compact'
      ? '16px 14px'
      : template.padding === 'spacious'
      ? '28px 24px'
      : '22px 18px';

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    printOrderReceipt({ template, order, currency });
  };

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Visual Serrated Top Edge */}
      <div
        className="h-3 w-full max-w-[340px] opacity-90"
        style={{
          backgroundImage: `radial-gradient(circle at 6px -3px, transparent 6px, #FCFAF6 7px)`,
          backgroundSize: '12px 12px',
        }}
      />

      {/* Main Thermal Receipt Paper */}
      <div
        id="receipt-printable-content"
        className="w-full max-w-[340px] bg-[#FCFAF6] text-[#191919] shadow-2xl transition-all duration-200 border-x border-[#E9E4DC]"
        style={{
          width: is58mm ? '280px' : '340px',
          fontFamily: fontCss,
          fontSize: fontSizeCss,
          lineHeight: lineHeightCss,
          padding: paddingStyle,
        }}
      >
        {/* Header Section */}
        <div
          className={`space-y-1 ${
            template.headerAlignment === 'center'
              ? 'text-center'
              : template.headerAlignment === 'right'
              ? 'text-right'
              : 'text-left'
          }`}
        >
          {template.showHeaderLogo && (
            <div className="mx-auto mb-1 flex items-center justify-center font-black tracking-widest text-[16px] text-black">
              {template.headerStarsText || '★ ★ ★'}
            </div>
          )}
          <h2 className="text-[17px] font-black uppercase tracking-tight">
            {template.storeName || 'NOVAMENU'}
          </h2>
          {template.tagline && (
            <p className="text-[11px] italic opacity-80">{template.tagline}</p>
          )}
          {template.address && (
            <p className="text-[11px] opacity-90">{template.address}</p>
          )}
          {template.phone && (
            <p className="text-[11px] opacity-90">Tel: {template.phone}</p>
          )}
          {template.taxNumber && (
            <p className="text-[10px] font-bold tracking-wider opacity-80">
              {template.taxNumber}
            </p>
          )}
          {template.website && (
            <p className="text-[10px] opacity-75">{template.website}</p>
          )}
        </div>

        {/* Divider */}
        <div className="my-2.5 overflow-hidden text-center opacity-60 select-none tracking-tighter">
          {divider}
        </div>

        {/* Order Meta Section */}
        <div className="space-y-1">
          {template.showOrderNumber && (
            <div
              className={`flex items-center justify-between font-black ${
                template.orderNumberSize === 'huge'
                  ? 'text-[20px] py-0.5'
                  : template.orderNumberSize === 'large'
                  ? 'text-[16px]'
                  : 'text-[13px]'
              }`}
            >
              <span>
                {template.orderNumberPrefix}
                {order.orderNumber}
              </span>
              {template.showOrderType && (
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-black/10 rounded">
                  {order.channel || 'Dine-In'}
                </span>
              )}
            </div>
          )}

          <div className="space-y-0.5 text-[11px] opacity-90 pt-0.5">
            {template.showDate && (
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span className="font-semibold">{order.createdAt}</span>
              </div>
            )}
            {template.showTableNumber && order.table && (
              <div className="flex justify-between">
                <span>Table:</span>
                <span className="font-bold">{order.table}</span>
              </div>
            )}
            {template.showCustomerName && order.customer && (
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="font-semibold">{order.customer}</span>
              </div>
            )}
            {template.showCustomerPhone && order.customerPhone && (
              <div className="flex justify-between">
                <span>Phone:</span>
                <span>{order.customerPhone}</span>
              </div>
            )}
            {template.showDeliveryAddress && order.address && (
              <div className="flex flex-col pt-0.5">
                <span className="font-bold">Delivery Address:</span>
                <span className="text-[10px]">{order.address}</span>
              </div>
            )}
            {template.showServerName && template.serverName && (
              <div className="flex justify-between">
                <span>Server:</span>
                <span>{template.serverName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="my-2.5 overflow-hidden text-center opacity-60 select-none tracking-tighter">
          {divider}
        </div>

        {/* Items Section */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-wider opacity-60">
            <span>Item / Qty</span>
            {template.showItemPrices && <span>Total</span>}
          </div>

          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  {template.showItemQuantities !== false && (
                    <span className="font-black">{item.qty}x</span>
                  )}
                  <span className="font-medium truncate">{item.name}</span>
                </div>
                {template.showItemModifiers && (
                  <span className="text-[10px] opacity-70 pl-5 block">
                    @ {currency}{item.price.toFixed(2)} ea
                  </span>
                )}
              </div>
              {template.showItemPrices && (
                <span className="font-bold shrink-0">
                  {currency}{(item.qty * item.price).toFixed(2)}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-2.5 overflow-hidden text-center opacity-60 select-none tracking-tighter">
          {divider}
        </div>

        {/* Totals Section */}
        <div className="space-y-1 text-[11px]">
          {template.showSubtotal && (
            <div className="flex justify-between opacity-80">
              <span>Subtotal</span>
              <span>{currency}{subtotal.toFixed(2)}</span>
            </div>
          )}

          {template.showTax && template.taxRate > 0 && (
            <div className="flex justify-between opacity-80">
              <span>{template.taxLabel || `Tax (${template.taxRate}%)`}</span>
              <span>{currency}{taxAmount.toFixed(2)}</span>
            </div>
          )}

          {template.showServiceCharge && template.serviceChargeRate > 0 && (
            <div className="flex justify-between opacity-80">
              <span>
                {template.serviceChargeLabel ||
                  `Service (${template.serviceChargeRate}%)`}
              </span>
              <span>{currency}{serviceAmount.toFixed(2)}</span>
            </div>
          )}

          {template.showItemCount && (
            <div className="flex justify-between text-[10px] opacity-60 pt-0.5">
              <span>Total items</span>
              <span>{order.items.reduce((s, i) => s + i.qty, 0)} items</span>
            </div>
          )}

          {template.showTotal && (
            <div className="flex justify-between items-baseline pt-2 border-t border-black/15 text-[16px] font-black tracking-tight">
              <span>GRAND TOTAL</span>
              <span>{currency}{calculatedTotal.toFixed(2)}</span>
            </div>
          )}

          {template.showPaymentMethod && (
            <div className="flex justify-between text-[10px] opacity-75 pt-1">
              <span>Payment Mode:</span>
              <span className="font-semibold">{template.paymentMethod}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="my-2.5 overflow-hidden text-center opacity-60 select-none tracking-tighter">
          {divider}
        </div>

        {/* Footer Section */}
        <div
          className={`space-y-2 ${
            template.footerAlignment === 'center'
              ? 'text-center'
              : template.footerAlignment === 'right'
              ? 'text-right'
              : 'text-left'
          }`}
        >
          {template.showFooterMessage && template.footerMessage && (
            <div className="text-[11px] whitespace-pre-line font-medium opacity-90">
              {template.footerMessage}
            </div>
          )}

          {template.showWifiInfo && template.wifiInfo && (
            <div className="p-1.5 rounded bg-black/5 text-[10px] font-bold">
              📶 {template.wifiInfo}
            </div>
          )}

          {/* Barcode Simulation */}
          {template.showBarcode && (
            <div className="pt-2 text-center">
              <div className="flex justify-center items-end h-8 gap-0.5 mx-auto max-w-[180px]">
                {[4, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 3, 2, 1].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="bg-black"
                      style={{
                        width: i % 3 === 0 ? '3px' : '1.5px',
                        height: `${h * 7}px`,
                      }}
                    />
                  )
                )}
              </div>
              <p className="text-[9px] font-mono tracking-widest mt-1 opacity-70">
                *ORD-{order.orderNumber}*
              </p>
            </div>
          )}

          {/* Scannable QR Code */}
          {template.showQrCode && template.qrCodeData && (
            <div className="pt-2 text-center flex flex-col items-center">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-black/10 inline-block">
                <QRCodeSVG
                  value={template.qrCodeData}
                  size={is58mm ? 76 : 92}
                  level="M"
                />
              </div>
              {template.qrCodeLabel && (
                <p className="text-[9px] font-bold mt-1.5 opacity-80 max-w-[200px]">
                  {template.qrCodeLabel}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Visual Serrated Bottom Edge */}
      <div
        className="h-3 w-full max-w-[340px] opacity-90"
        style={{
          backgroundImage: `radial-gradient(circle at 6px 15px, transparent 6px, #FCFAF6 7px)`,
          backgroundSize: '12px 12px',
        }}
      />

      {/* Direct Print Button */}
      {showPrintButton && (
        <button
          type="button"
          onClick={handlePrint}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-black uppercase tracking-[0.1em] text-white shadow-md transition-transform hover:scale-105 active:scale-95 cursor-pointer"
          style={{ background: 'var(--portal-accent, #536DFE)' }}
        >
          <Printer className="h-4 w-4" />
          Print Sample Receipt
        </button>
      )}
    </div>
  );
}

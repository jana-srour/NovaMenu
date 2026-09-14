'use client';

import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Package,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import * as XLSX from 'xlsx-js-style';

import {
  getReportsData,
  getReportPeriodRange,
  type ReportsData,
} from '@/lib/reports/data';

import {
  downloadCsv,
  printReportAsPdf,
} from '@/lib/reports/export';

type ReportType =
  | 'sales'
  | 'orders'
  | 'menu'
  | 'promotions'
  | 'pricing'
  | 'customers'
  | 'operations';

type Period = '7d' | '30d' | '90d' | '12m' | 'custom';

const reportTypes: {
  key: ReportType;
  label: string;
  description: string;
  icon: typeof BarChart3;
}[] = [
  {
    key: 'sales',
    label: 'Sales & Revenue',
    description: 'Revenue, orders, averages, and growth',
    icon: BarChart3,
  },
  {
    key: 'orders',
    label: 'Orders',
    description: 'Order volume, statuses, and performance',
    icon: ShoppingBag,
  },
  {
    key: 'menu',
    label: 'Menu Performance',
    description: 'Items, categories, and menu revenue',
    icon: Package,
  },
  {
    key: 'promotions',
    label: 'Promotions',
    description: 'Promotion usage and financial impact',
    icon: ReceiptText,
  },
  {
    key: 'pricing',
    label: 'Pricing',
    description: 'Price changes and pricing activity',
    icon: FileText,
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'Customer activity and repeat behavior',
    icon: Users,
  },
  {
    key: 'operations',
    label: 'Operations',
    description: 'Order workload and operational metrics',
    icon: RefreshCw,
  },
];

type ExportHistoryRow = {
  name: string;
  format: string;
  period: string;
  date: string;
  status: string;
};

/* -------------------------------------------------------------------------- */
/*                              REPORT HELPERS                                */
/* -------------------------------------------------------------------------- */

function getPeriodLabel(period: Period) {
  switch (period) {
    case '7d':
      return 'Last 7 days';
    case '30d':
      return 'Last 30 days';
    case '90d':
      return 'Last 90 days';
    case '12m':
      return 'Last 12 months';
    default:
      return 'Custom range';
  }
}

function money(value: unknown) {
  return Number(value || 0);
}

function formatOrderNumber(orderNumber: number | null | undefined) {
  return orderNumber === null || orderNumber === undefined
    ? ''
    : `#${orderNumber}`;
}

function getOrderServiceLabel(order: ReportsData['orders'][number]) {
  const channel = String(order.channel || '').trim().toLowerCase();

  if (
    channel === 'delivery' ||
    Boolean(order.customer_address?.trim())
  ) {
    return 'Delivery';
  }

  const tableNumber = order.table_number?.trim();

  return tableNumber
    ? `Dine-in · Table ${tableNumber}`
    : 'Dine-in';
}

function safeString(value: unknown) {
  return String(value ?? '');
}

function formatDate(value: unknown) {
  if (!value) return '';

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return safeString(value);
  }

  return date.toLocaleString();
}

function formatDateOnly(value: unknown) {
  if (!value) return '';

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return safeString(value);
  }

  return date.toLocaleDateString();
}

function reportLabel(report: ReportType) {
  return (
    reportTypes.find((item) => item.key === report)?.label ||
    report
  );
}

/* -------------------------------------------------------------------------- */
/*                         EXPORT DATA BUILDERS                               */
/* -------------------------------------------------------------------------- */

function buildExportSheets(
  report: ReportType,
  data: ReportsData,
  periodLabel: string,
) {
  const orderMap = new Map(
    data.orders.map((order) => [order.id, order]),
  );

  const categoryMap = new Map(
    data.categories.map((category) => [
      category.id,
      category.name,
    ]),
  );

  const totalRevenue = data.orders.reduce(
    (sum, order) => sum + money(order.total),
    0,
  );

  const totalOrders = data.orders.length;

  const averageOrder =
    totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const totalOrderItems = data.orderItems.reduce(
    (sum, item) => sum + money(item.quantity),
    0,
  );

  const completedOrders = data.orders.filter((order) =>
    ['completed', 'delivered', 'paid'].includes(
      safeString(order.status).toLowerCase(),
    ),
  ).length;

  const cancelledOrders = data.orders.filter((order) =>
    ['cancelled', 'canceled'].includes(
      safeString(order.status).toLowerCase(),
    ),
  ).length;

  const completionRate =
    totalOrders > 0
      ? completedOrders / totalOrders
      : 0;

  const sheets: Record<string, unknown[][]> = {};

  /* ------------------------------------------------------------------------ */
  /* EXECUTIVE SUMMARY                                                        */
  /* ------------------------------------------------------------------------ */

  sheets['Executive Summary'] = [
    ['NOVAMENU'],
    [`${reportLabel(report)} Report`],
    [],
    ['REPORT INFORMATION'],
    ['Restaurant', data.restaurant.name],
    ['Report', reportLabel(report)],
    ['Period', periodLabel],
    ['Generated', new Date().toLocaleString()],
    [],
    ['KEY PERFORMANCE INDICATORS'],
    [],
    ['Total Revenue', totalRevenue],
    ['Total Orders', totalOrders],
    ['Average Order Value', averageOrder],
    ['Order Items', totalOrderItems],
    ['Completed Orders', completedOrders],
    ['Cancelled Orders', cancelledOrders],
    ['Completion Rate', completionRate],
    ['Menu Items', data.menuItems.length],
    ['Active Promotions', data.discounts.filter((item) => item.is_active).length],
    [],
    ['REPORT NOTES'],
    [
      'This workbook was generated from the selected restaurant data in NOVAMENU.',
    ],
    [
      'Values reflect the selected reporting period and the data available at export time.',
    ],
  ];

  /* ------------------------------------------------------------------------ */
  /* ORDERS                                                                   */
  /* ------------------------------------------------------------------------ */

  if (
    report === 'orders' ||
    report === 'sales' ||
    report === 'operations'
  ) {
    sheets['Orders'] = [
      [
        'Order ID',
        'Customer',
        'Status',
        'Channel',
        'Service / Table',
        'Total',
        'Created At',
      ],

      ...data.orders.map((order) => [
        formatOrderNumber(order.order_number),
        order.customer_name || 'Guest',
        order.status || '',
        order.channel || '',
        getOrderServiceLabel(order),
        money(order.total),
        formatDate(order.created_at),
      ]),
    ];
  }

  /* ------------------------------------------------------------------------ */
  /* ORDER ITEMS                                                               */
  /* ------------------------------------------------------------------------ */

  if (
    report === 'orders' ||
    report === 'menu' ||
    report === 'sales'
  ) {
    sheets['Order Items'] = [
      [
        'Order ID',
        'Item',
        'Menu Item ID',
        'Quantity',
        'Unit Price',
        'Line Total',
      ],

      ...data.orderItems.map((item) => [
        formatOrderNumber(
          orderMap.get(item.order_id)?.order_number,
        ),
        item.item_name,
        item.menu_item_id || '',
        money(item.quantity),
        money(item.unit_price),
        money(item.quantity) * money(item.unit_price),
      ]),
    ];
  }

  /* ------------------------------------------------------------------------ */
  /* MENU PERFORMANCE                                                          */
  /* ------------------------------------------------------------------------ */

  if (report === 'menu') {
    const menuRows = data.menuItems.map((item) => {
      const relatedItems = data.orderItems.filter(
        (orderItem) =>
          orderItem.menu_item_id === item.id,
      );

      const sold = relatedItems.reduce(
        (sum, orderItem) =>
          sum + money(orderItem.quantity),
        0,
      );

      const revenue = relatedItems.reduce(
        (sum, orderItem) =>
          sum +
          money(orderItem.quantity) *
            money(orderItem.unit_price),
        0,
      );

      return [
        item.name,
        categoryMap.get(item.category_id || '') ||
          'Uncategorized',
        money(item.price),
        item.is_available ? 'Yes' : 'No',
        sold,
        revenue,
      ];
    });

    menuRows.sort(
      (a, b) => money(b[5]) - money(a[5]),
    );

    sheets['Menu Performance'] = [
      [
        'Menu Item',
        'Category',
        'Current Price',
        'Available',
        'Quantity Sold',
        'Revenue',
      ],
      ...menuRows,
    ];
  }

  /* ------------------------------------------------------------------------ */
  /* CUSTOMERS                                                                 */
  /* ------------------------------------------------------------------------ */

  if (report === 'customers') {
    const customers = new Map<
      string,
      {
        name: string;
        phone: string;
        address: string;
        orders: number;
        spend: number;
        first: string;
        last: string;
      }
    >();

    for (const order of data.orders) {
      const name =
        order.customer_name?.trim() || 'Guest';

      if (name.toLowerCase() === 'guest') continue;

      const phone = order.customer_phone?.trim() || '';
      const address = order.customer_address?.trim() || '';
      const normalizedPhone = phone.replace(/\D/g, '');
      const key = normalizedPhone
        ? `phone:${normalizedPhone}`
        : `name:${name.toLowerCase()}`;

      const current = customers.get(key);

      if (current) {
        current.orders += 1;
        current.spend += money(order.total);

        if (phone) current.phone = phone;
        if (address) current.address = address;

        if (order.created_at < current.first) {
          current.first = order.created_at;
        }

        if (order.created_at > current.last) {
          current.last = order.created_at;
        }
      } else {
        customers.set(key, {
          name,
          phone,
          address,
          orders: 1,
          spend: money(order.total),
          first: order.created_at,
          last: order.created_at,
        });
      }
    }

    sheets['Customers'] = [
      [
        'Customer',
        'Phone',
        'Address',
        'Orders',
        'Total Spend',
        'Average Order',
        'First Order',
        'Last Order',
      ],

      ...Array.from(customers.values())
        .sort((a, b) => b.spend - a.spend)
        .map((customer) => [
          customer.name,
          customer.phone,
          customer.address,
          customer.orders,
          customer.spend,
          customer.spend / customer.orders,
          formatDate(customer.first),
          formatDate(customer.last),
        ]),
    ];
  }

  /* ------------------------------------------------------------------------ */
  /* PROMOTIONS                                                                */
  /* ------------------------------------------------------------------------ */

  if (report === 'promotions') {
    sheets['Promotions'] = [
      [
        'Promotion',
        'Type',
        'Value',
        'Active',
        'Start',
        'End',
        'Menu Item ID',
        'Category ID',
      ],

      ...data.discounts.map((discount) => [
        discount.name,
        discount.discount_type,
        money(discount.discount_value),
        discount.is_active ? 'Yes' : 'No',
        discount.start_at
          ? formatDate(discount.start_at)
          : '',
        discount.end_at
          ? formatDate(discount.end_at)
          : '',
        discount.menu_item_id || '',
        discount.category_id || '',
      ]),
    ];
  }

  /* ------------------------------------------------------------------------ */
  /* PRICING HISTORY                                                           */
  /* ------------------------------------------------------------------------ */

  if (report === 'pricing') {
    sheets['Pricing History'] = [
      [
        'Item',
        'Change Type',
        'Direction',
        'Old Price',
        'New Price',
        'Change',
        'Summary',
        'Created At',
      ],

      ...data.menuPricingHistory.map((entry) => {
        const oldPrice = money(entry.old_price);
        const newPrice = money(entry.new_price);

        return [
          entry.item_name || '',
          entry.change_type || '',
          entry.direction || '',
          entry.old_price ?? '',
          entry.new_price ?? '',
          newPrice - oldPrice,
          entry.summary || '',
          formatDate(entry.created_at),
        ];
      }),
    ];
  }

  /* ------------------------------------------------------------------------ */
  /* SALES SNAPSHOT                                                            */
  /* ------------------------------------------------------------------------ */

  if (report === 'sales') {
    const channelMap = new Map<
      string,
      {
        orders: number;
        revenue: number;
      }
    >();

    for (const order of data.orders) {
      const channel =
        order.channel?.trim() || 'Unknown';

      const existing = channelMap.get(channel);

      if (existing) {
        existing.orders += 1;
        existing.revenue += money(order.total);
      } else {
        channelMap.set(channel, {
          orders: 1,
          revenue: money(order.total),
        });
      }
    }

    sheets['Sales by Channel'] = [
      [
        'Channel',
        'Orders',
        'Revenue',
        'Average Order',
        'Revenue Share',
      ],

      ...Array.from(channelMap.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .map(([channel, value]) => [
          channel,
          value.orders,
          value.revenue,
          value.orders > 0
            ? value.revenue / value.orders
            : 0,
          totalRevenue > 0
            ? value.revenue / totalRevenue
            : 0,
        ]),
    ];
  }

  /* ------------------------------------------------------------------------ */
  /* OPERATIONS SNAPSHOT                                                       */
  /* ------------------------------------------------------------------------ */

  if (report === 'operations') {
    const statusMap = new Map<
      string,
      {
        orders: number;
        revenue: number;
      }
    >();

    for (const order of data.orders) {
      const status =
        order.status?.trim() || 'Unknown';

      const existing = statusMap.get(status);

      if (existing) {
        existing.orders += 1;
        existing.revenue += money(order.total);
      } else {
        statusMap.set(status, {
          orders: 1,
          revenue: money(order.total),
        });
      }
    }

    sheets['Order Status'] = [
      [
        'Status',
        'Orders',
        'Revenue',
        'Order Share',
      ],

      ...Array.from(statusMap.entries())
        .sort((a, b) => b[1].orders - a[1].orders)
        .map(([status, value]) => [
          status,
          value.orders,
          value.revenue,
          totalOrders > 0
            ? value.orders / totalOrders
            : 0,
        ]),
    ];
  }

  return sheets;
}

/* -------------------------------------------------------------------------- */
/*                             EXCEL STYLING                                  */
/* -------------------------------------------------------------------------- */

const EXCEL_COLORS = {
  navy: '202534',
  accent: '536DFE',
  purple: '765BD5',
  white: 'FFFFFF',
  black: '111827',
  muted: '64748B',
  border: 'D9DEE8',
  soft: 'EEF2FF',
  light: 'F8FAFC',
  green: '16A34A',
  greenSoft: 'DCFCE7',
  red: 'DC2626',
  redSoft: 'FEE2E2',
  amber: 'D97706',
  amberSoft: 'FEF3C7',
};

const thinBorder = {
  top: {
    style: 'thin',
    color: { rgb: EXCEL_COLORS.border },
  },
  bottom: {
    style: 'thin',
    color: { rgb: EXCEL_COLORS.border },
  },
  left: {
    style: 'thin',
    color: { rgb: EXCEL_COLORS.border },
  },
  right: {
    style: 'thin',
    color: { rgb: EXCEL_COLORS.border },
  },
};

function setCellStyle(
  sheet: XLSX.WorkSheet,
  address: string,
  style: Record<string, unknown>,
) {
  if (!sheet[address]) {
    sheet[address] = {
      t: 's',
      v: '',
    };
  }

  sheet[address].s = style;
}

function styleTitle(
  sheet: XLSX.WorkSheet,
  title: string,
  subtitle: string,
  lastColumn: number,
) {
  const titleEnd = XLSX.utils.encode_cell({
    r: 0,
    c: lastColumn,
  });

  const subtitleEnd = XLSX.utils.encode_cell({
    r: 1,
    c: lastColumn,
  });

  sheet['A1'] = {
    t: 's',
    v: title,
    s: {
      font: {
        bold: true,
        color: {
          rgb: EXCEL_COLORS.white,
        },
        sz: 20,
      },
      fill: {
        fgColor: {
          rgb: EXCEL_COLORS.navy,
        },
      },
      alignment: {
        vertical: 'center',
        horizontal: 'left',
      },
    },
  };

  sheet['A2'] = {
    t: 's',
    v: subtitle,
    s: {
      font: {
        bold: true,
        color: {
          rgb: EXCEL_COLORS.white,
        },
        sz: 10,
      },
      fill: {
        fgColor: {
          rgb: EXCEL_COLORS.accent,
        },
      },
      alignment: {
        vertical: 'center',
      },
    },
  };

  for (let column = 0; column <= lastColumn; column += 1) {
    const titleAddress = XLSX.utils.encode_cell({
      r: 0,
      c: column,
    });

    const subtitleAddress = XLSX.utils.encode_cell({
      r: 1,
      c: column,
    });

    if (column > 0) {
      setCellStyle(sheet, titleAddress, {
        fill: {
          fgColor: {
            rgb: EXCEL_COLORS.navy,
          },
        },
      });

      setCellStyle(sheet, subtitleAddress, {
        fill: {
          fgColor: {
            rgb: EXCEL_COLORS.accent,
          },
        },
      });
    }
  }

  sheet['!merges'] = [
    {
      s: { r: 0, c: 0 },
      e: { r: 0, c: lastColumn },
    },
    {
      s: { r: 1, c: 0 },
      e: { r: 1, c: lastColumn },
    },
  ];

  sheet['!rows'] = [
    { hpt: 30 },
    { hpt: 20 },
  ];

  void titleEnd;
  void subtitleEnd;
}

function styleDataSheet(
  sheet: XLSX.WorkSheet,
  rows: unknown[][],
  headerRow = 3,
) {
  const header = rows[headerRow];

  if (!header) return;

  const columnCount = header.length;

  /* Header */
  for (let column = 0; column < columnCount; column += 1) {
    const address = XLSX.utils.encode_cell({
      r: headerRow,
      c: column,
    });

    setCellStyle(sheet, address, {
      font: {
        bold: true,
        color: {
          rgb: EXCEL_COLORS.white,
        },
        sz: 10,
      },
      fill: {
        fgColor: {
          rgb: EXCEL_COLORS.navy,
      },
      },
      alignment: {
        vertical: 'center',
        horizontal: 'left',
        wrapText: true,
      },
      border: thinBorder,
    });
  }

  /* Data rows */
  for (
    let row = headerRow + 1;
    row < rows.length;
    row += 1
  ) {
    for (
      let column = 0;
      column < columnCount;
      column += 1
    ) {
      const address = XLSX.utils.encode_cell({
        r: row,
        c: column,
      });

      const cell = sheet[address];

      if (!cell) continue;

      setCellStyle(sheet, address, {
        font: {
          color: {
            rgb: EXCEL_COLORS.black,
          },
          sz: 10,
        },
        fill: {
          fgColor: {
            rgb:
              (row - headerRow) % 2 === 0
                ? EXCEL_COLORS.white
                : EXCEL_COLORS.light,
          },
        },
        border: thinBorder,
        alignment: {
          vertical: 'center',
        },
      });
    }
  }

  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: {
        r: headerRow,
        c: 0,
      },
      e: {
        r: Math.max(rows.length - 1, headerRow),
        c: columnCount - 1,
      },
    }),
  };

  sheet['!freeze'] = {
    xSplit: 0,
    ySplit: headerRow + 1,
  };
}

function setNumberFormats(
  sheet: XLSX.WorkSheet,
  rows: unknown[][],
  headerRow: number,
) {
  const headers = rows[headerRow];

  if (!headers) return;

  headers.forEach((header, column) => {
    const normalized = safeString(header)
      .toLowerCase()
      .trim();

    for (
      let row = headerRow + 1;
      row < rows.length;
      row += 1
    ) {
      const address = XLSX.utils.encode_cell({
        r: row,
        c: column,
      });

      if (!sheet[address]) continue;

      if (
        normalized.includes('price') ||
        normalized.includes('revenue') ||
        normalized.includes('spend') ||
        normalized.includes('total') ||
        normalized.includes('value') ||
        normalized.includes('change')
      ) {
        sheet[address].z = '#,##0.00';
      }

      if (
        normalized.includes('rate') ||
        normalized.includes('share')
      ) {
        sheet[address].z = '0.0%';
      }

      if (
        normalized.includes('quantity') ||
        normalized === 'orders' ||
        normalized.includes('items sold')
      ) {
        sheet[address].z = '#,##0';
      }
    }
  });
}

function autoSizeSheet(
  sheet: XLSX.WorkSheet,
  rows: unknown[][],
  minWidth = 12,
  maxWidth = 42,
) {
  if (!rows.length) return;

  const columnCount = Math.max(
    ...rows.map((row) => row.length),
  );

  sheet['!cols'] = Array.from(
    { length: columnCount },
    (_, column) => {
      let width = minWidth;

      for (const row of rows.slice(0, 500)) {
        const value = safeString(row[column]);

        width = Math.max(
          width,
          Math.min(value.length + 2, maxWidth),
        );
      }

      return {
        wch: Math.min(width, maxWidth),
      };
    },
  );
}

function configurePrint(
  sheet: XLSX.WorkSheet,
  landscape = true,
) {
  sheet['!printOptions'] = {
    gridLines: false,
    headings: false,
  };

  sheet['!pageSetup'] = {
    orientation: landscape ? 'landscape' : 'portrait',
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
  };

  sheet['!margins'] = {
    left: 0.25,
    right: 0.25,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  };
}

/* -------------------------------------------------------------------------- */
/*                        PROFESSIONAL EXCEL BUILDER                          */
/* -------------------------------------------------------------------------- */

function buildProfessionalWorkbook(
  report: ReportType,
  data: ReportsData,
  periodLabel: string,
) {
  const workbook = XLSX.utils.book_new();

  const sheets = buildExportSheets(
    report,
    data,
    periodLabel,
  );

  /* ------------------------------------------------------------------------ */
  /* EXECUTIVE SUMMARY                                                        */
  /* ------------------------------------------------------------------------ */

  const summaryRows = sheets['Executive Summary'] || [];

  const summarySheet = XLSX.utils.aoa_to_sheet(
    summaryRows,
  );

  const summaryLastColumn = 5;

  styleTitle(
    summarySheet,
    'NOVAMENU',
    `${reportLabel(report)} · ${periodLabel}`,
    summaryLastColumn,
  );

  /* Report information section */
  setCellStyle(summarySheet, 'A4', {
    font: {
      bold: true,
      color: {
        rgb: EXCEL_COLORS.white,
      },
      sz: 10,
    },
    fill: {
      fgColor: {
        rgb: EXCEL_COLORS.purple,
      },
    },
  });

  summarySheet['!merges'] = [
    ...(summarySheet['!merges'] || []),
    {
      s: { r: 3, c: 0 },
      e: { r: 3, c: summaryLastColumn },
    },
  ];

  for (let row = 4; row <= 7; row += 1) {
    for (let column = 0; column <= 1; column += 1) {
      const address = XLSX.utils.encode_cell({
        r: row,
        c: column,
      });

      if (!summarySheet[address]) continue;

      setCellStyle(summarySheet, address, {
        font: {
          bold: column === 0,
          color: {
            rgb:
              column === 0
                ? EXCEL_COLORS.muted
                : EXCEL_COLORS.black,
          },
          sz: 10,
        },
        fill: {
          fgColor: {
            rgb: EXCEL_COLORS.light,
          },
        },
        border: thinBorder,
        alignment: {
          vertical: 'center',
        },
      });
    }
  }

  /* KPI section */
  const kpiTitleRow = 9;

  setCellStyle(summarySheet, 'A10', {
    font: {
      bold: true,
      color: {
        rgb: EXCEL_COLORS.white,
      },
      sz: 10,
    },
    fill: {
      fgColor: {
        rgb: EXCEL_COLORS.accent,
      },
    },
  });

  summarySheet['!merges'] = [
    ...(summarySheet['!merges'] || []),
    {
      s: { r: kpiTitleRow, c: 0 },
      e: { r: kpiTitleRow, c: summaryLastColumn },
    },
  ];

  const kpiRows = [
    {
      label: 'Total Revenue',
      value: summaryRows[11]?.[1] ?? 0,
      format: '#,##0.00',
    },
    {
      label: 'Total Orders',
      value: summaryRows[12]?.[1] ?? 0,
      format: '#,##0',
    },
    {
      label: 'Average Order Value',
      value: summaryRows[13]?.[1] ?? 0,
      format: '#,##0.00',
    },
    {
      label: 'Order Items',
      value: summaryRows[14]?.[1] ?? 0,
      format: '#,##0',
    },
    {
      label: 'Completed Orders',
      value: summaryRows[15]?.[1] ?? 0,
      format: '#,##0',
    },
    {
      label: 'Cancelled Orders',
      value: summaryRows[16]?.[1] ?? 0,
      format: '#,##0',
    },
    {
      label: 'Completion Rate',
      value: summaryRows[17]?.[1] ?? 0,
      format: '0.0%',
    },
    {
      label: 'Menu Items',
      value: summaryRows[18]?.[1] ?? 0,
      format: '#,##0',
    },
    {
      label: 'Active Promotions',
      value: summaryRows[19]?.[1] ?? 0,
      format: '#,##0',
    },
  ];

  const kpiStartRow = 11;
  const kpiColumns = 3;

  for (
    let index = 0;
    index < kpiRows.length;
    index += 1
  ) {
    const row = Math.floor(index / kpiColumns);
    const column = (index % kpiColumns) * 2;

    const labelCell = XLSX.utils.encode_cell({
      r: kpiStartRow + row * 3,
      c: column,
    });

    const valueCell = XLSX.utils.encode_cell({
      r: kpiStartRow + row * 3 + 1,
      c: column,
    });

    summarySheet[labelCell] = {
      t: 's',
      v: kpiRows[index].label,
    };

    summarySheet[valueCell] = {
      t: 'n',
      v: Number(kpiRows[index].value || 0),
    };

    setCellStyle(summarySheet, labelCell, {
      font: {
        bold: true,
        color: {
          rgb: EXCEL_COLORS.muted,
        },
        sz: 9,
      },
      fill: {
        fgColor: {
          rgb: EXCEL_COLORS.light,
        },
      },
      border: thinBorder,
      alignment: {
        horizontal: 'center',
        vertical: 'center',
      },
    });

    setCellStyle(summarySheet, valueCell, {
      font: {
        bold: true,
        color: {
          rgb: EXCEL_COLORS.navy,
        },
        sz: 18,
      },
      fill: {
        fgColor: {
          rgb: EXCEL_COLORS.soft,
        },
      },
      border: thinBorder,
      alignment: {
        horizontal: 'center',
        vertical: 'center',
      },
    });

    summarySheet[valueCell].z =
      kpiRows[index].format;

    summarySheet['!merges'] = [
      ...(summarySheet['!merges'] || []),
      {
        s: {
          r: kpiStartRow + row * 3,
          c: column,
        },
        e: {
          r: kpiStartRow + row * 3,
          c: column + 1,
        },
      },
      {
        s: {
          r: kpiStartRow + row * 3 + 1,
          c: column,
        },
        e: {
          r: kpiStartRow + row * 3 + 1,
          c: column + 1,
        },
      },
    ];
  }

  /* Notes */
  const notesRow = kpiStartRow + 10;

  const notesAddress = XLSX.utils.encode_cell({
    r: notesRow,
    c: 0,
  });

  summarySheet[notesAddress] = {
    t: 's',
    v: 'REPORT NOTES',
  };

  setCellStyle(summarySheet, notesAddress, {
    font: {
      bold: true,
      color: {
        rgb: EXCEL_COLORS.white,
      },
      sz: 10,
    },
    fill: {
      fgColor: {
        rgb: EXCEL_COLORS.navy,
      },
    },
  });

  summarySheet['!merges'] = [
    ...(summarySheet['!merges'] || []),
    {
      s: {
        r: notesRow,
        c: 0,
      },
      e: {
        r: notesRow,
        c: summaryLastColumn,
      },
    },
  ];

  for (let row = notesRow + 1; row < summaryRows.length; row += 1) {
    const address = XLSX.utils.encode_cell({
      r: row,
      c: 0,
    });

    setCellStyle(summarySheet, address, {
      font: {
        color: {
          rgb: EXCEL_COLORS.muted,
        },
        sz: 9,
      },
      fill: {
        fgColor: {
          rgb: EXCEL_COLORS.light,
        },
      },
      alignment: {
        wrapText: true,
        vertical: 'center',
      },
    });

    summarySheet['!merges'] = [
      ...(summarySheet['!merges'] || []),
      {
        s: {
          r: row,
          c: 0,
        },
        e: {
          r: row,
          c: summaryLastColumn,
        },
      },
    ];
  }

  summarySheet['!cols'] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 4 },
    { wch: 24 },
    { wch: 18 },
    { wch: 4 },
  ];

  summarySheet['!rows'] = [
    { hpt: 32 },
    { hpt: 22 },
    { hpt: 8 },
    { hpt: 20 },
    { hpt: 20 },
    { hpt: 20 },
    { hpt: 20 },
    { hpt: 20 },
    { hpt: 8 },
    { hpt: 20 },
    { hpt: 8 },
    { hpt: 24 },
    { hpt: 32 },
    { hpt: 8 },
    { hpt: 24 },
    { hpt: 32 },
  ];

  configurePrint(summarySheet, true);

  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet,
    'Executive Summary',
  );

  /* ------------------------------------------------------------------------ */
  /* DATA SHEETS                                                              */
  /* ------------------------------------------------------------------------ */

  for (const [name, originalRows] of Object.entries(
    sheets,
  )) {
    if (name === 'Executive Summary') continue;

    const rows = originalRows as unknown[][];

    if (!rows.length) continue;

    const headerRow = 0;

    const dataSheet = XLSX.utils.aoa_to_sheet(rows);

    const columnCount = rows[0]?.length || 1;

    /* Professional sheet title */
    const title = `${reportLabel(report)} · ${name}`;

    dataSheet['A1'] = {
      t: 's',
      v: title,
    };

    setCellStyle(dataSheet, 'A1', {
      font: {
        bold: true,
        color: {
          rgb: EXCEL_COLORS.white,
        },
        sz: 16,
      },
      fill: {
        fgColor: {
          rgb: EXCEL_COLORS.navy,
        },
      },
      alignment: {
        vertical: 'center',
      },
    });

    for (let column = 1; column < columnCount; column += 1) {
      const address = XLSX.utils.encode_cell({
        r: 0,
        c: column,
      });

      setCellStyle(dataSheet, address, {
        fill: {
          fgColor: {
            rgb: EXCEL_COLORS.navy,
          },
        },
      });
    }

    dataSheet['!merges'] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: columnCount - 1 },
      },
    ];

    /* Insert blank/title area by shifting existing table down */
    XLSX.utils.sheet_add_aoa(
      dataSheet,
      [
        [],
        [
          'Report',
          reportLabel(report),
          'Period',
          periodLabel,
          'Generated',
          new Date().toLocaleString(),
        ],
        [],
      ],
      {
        origin: 'A2',
      },
    );

    const shiftedRows = [
      [title],
      [],
      [
        'Report',
        reportLabel(report),
        'Period',
        periodLabel,
        'Generated',
        new Date().toLocaleString(),
      ],
      [],
      ...rows,
    ];

    const rebuiltSheet = XLSX.utils.aoa_to_sheet(
      shiftedRows,
    );

    const rebuiltColumnCount =
      Math.max(
        ...shiftedRows.map((row) => row.length),
        columnCount,
      );

    rebuiltSheet['!merges'] = [
      {
        s: { r: 0, c: 0 },
        e: {
          r: 0,
          c: rebuiltColumnCount - 1,
        },
      },
    ];

    setCellStyle(rebuiltSheet, 'A1', {
      font: {
        bold: true,
        color: {
          rgb: EXCEL_COLORS.white,
        },
        sz: 16,
      },
      fill: {
        fgColor: {
          rgb: EXCEL_COLORS.navy,
        },
      },
      alignment: {
        vertical: 'center',
      },
    });

    for (
      let column = 1;
      column < rebuiltColumnCount;
      column += 1
    ) {
      setCellStyle(
        rebuiltSheet,
        XLSX.utils.encode_cell({
          r: 0,
          c: column,
        }),
        {
          fill: {
            fgColor: {
              rgb: EXCEL_COLORS.navy,
            },
          },
        },
      );
    }

    /* Metadata row */
    for (let column = 0; column < 6; column += 1) {
      const address = XLSX.utils.encode_cell({
        r: 2,
        c: column,
      });

      if (!rebuiltSheet[address]) continue;

      setCellStyle(rebuiltSheet, address, {
        font: {
          bold: column % 2 === 0,
          color: {
            rgb:
              column % 2 === 0
                ? EXCEL_COLORS.muted
                : EXCEL_COLORS.black,
          },
          sz: 9,
        },
        fill: {
          fgColor: {
            rgb:
              column % 2 === 0
                ? EXCEL_COLORS.soft
                : EXCEL_COLORS.light,
          },
        },
        border: thinBorder,
      });
    }

    const actualHeaderRow = 4;

    styleDataSheet(
      rebuiltSheet,
      shiftedRows,
      actualHeaderRow,
    );

    setNumberFormats(
      rebuiltSheet,
      shiftedRows,
      actualHeaderRow,
    );

    autoSizeSheet(
      rebuiltSheet,
      shiftedRows,
      12,
      44,
    );

    rebuiltSheet['!rows'] = [
      { hpt: 26 },
      { hpt: 8 },
      { hpt: 20 },
      { hpt: 8 },
      { hpt: 24 },
    ];

    configurePrint(rebuiltSheet, true);

    const safeSheetName =
      name.slice(0, 31);

    XLSX.utils.book_append_sheet(
      workbook,
      rebuiltSheet,
      safeSheetName,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* WORKBOOK PROPERTIES                                                      */
  /* ------------------------------------------------------------------------ */

  workbook.Props = {
    Title: `${reportLabel(report)} Report`,
    Subject: `NOVAMENU ${reportLabel(report)} export`,
    Author: 'NOVAMENU',
    Company: 'Novera Labs',
    CreatedDate: new Date(),
    Keywords:
      'NOVAMENU, restaurant, analytics, reports, export',
    Comments:
      'Generated by NOVAMENU Export Center.',
  };

  return workbook;
}

/* -------------------------------------------------------------------------- */
/*                              CSV BUILDER                                   */
/* -------------------------------------------------------------------------- */

function escapeCsvCell(value: unknown) {
  const stringValue = safeString(value);

  if (
    stringValue.includes(',') ||
    stringValue.includes('"') ||
    stringValue.includes('\n') ||
    stringValue.includes('\r')
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function downloadProfessionalCsv(
  filename: string,
  headers: string[],
  rows: unknown[][],
) {
  /*
   * CSV cannot contain visual formatting.
   *
   * Instead, this creates a clean, database-friendly,
   * UTF-8 CSV with:
   * - UTF-8 BOM for Excel/Arabic compatibility
   * - normalized headers
   * - properly escaped values
   * - consistent line endings
   */

  const csvRows = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) =>
      row.map(escapeCsvCell).join(','),
    ),
  ];

  const csvContent =
    '\uFEFF' +
    csvRows.join('\r\n');

  const blob = new Blob(
    [csvContent],
    {
      type: 'text/csv;charset=utf-8;',
    },
  );

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/*                             FLAT CSV DATA                                  */
/* -------------------------------------------------------------------------- */

function getFlatExportRows(
  report: ReportType,
  data: ReportsData,
  periodLabel: string,
) {
  const sheets = buildExportSheets(
    report,
    data,
    periodLabel,
  );

  const preferred =
    report === 'customers'
      ? 'Customers'
      : report === 'menu'
        ? 'Menu Performance'
        : report === 'pricing'
          ? 'Pricing History'
          : report === 'promotions'
            ? 'Promotions'
            : report === 'sales'
              ? 'Orders'
              : report === 'orders' ||
                  report === 'operations'
                ? 'Orders'
                : 'Executive Summary';

  const selected =
    sheets[preferred] ||
    sheets['Executive Summary'] ||
    [];

  return {
    headers: (selected[0] || []) as string[],
    rows: (selected.slice(1) || []) as unknown[][],
  };
}

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function ReportsExportsPage() {
  const [selectedReport, setSelectedReport] =
    useState<ReportType>('sales');

  const [period, setPeriod] =
    useState<Period>('30d');

  const [format, setFormat] =
    useState<'csv' | 'xlsx' | 'pdf'>('xlsx');

  const [customFrom, setCustomFrom] =
    useState('');

  const [customTo, setCustomTo] =
    useState('');

  const [generating, setGenerating] =
    useState(false);

  const [error, setError] =
    useState('');

  const [exportHistory, setExportHistory] =
    useState<ExportHistoryRow[]>([]);

  const generateExport = useCallback(
    async (nextReport = selectedReport) => {
      const pdfWindow =
        format === 'pdf'
          ? window.open('', '_blank')
          : null;

      if (format === 'pdf' && !pdfWindow) {
        setError(
          'Your browser blocked the PDF window. Allow pop-ups for NOVAMENU and try again.',
        );
        return;
      }

      try {
        setGenerating(true);
        setError('');

        let range = getReportPeriodRange(
          period === 'custom'
            ? '30d'
            : period,
        );

        if (period === 'custom') {
          if (!customFrom || !customTo) {
            throw new Error(
              'Choose both custom export dates.',
            );
          }

          const from = new Date(
            `${customFrom}T00:00:00`,
          );

          const to = new Date(
            `${customTo}T00:00:00`,
          );

          to.setDate(to.getDate() + 1);

          if (from >= to) {
            throw new Error(
              'The end date must be after the start date.',
            );
          }

          range = {
            from: from.toISOString(),
            to: to.toISOString(),
          };
        }

        const data =
          await getReportsData(range);

        if (!data) {
          throw new Error(
            'No restaurant data is available for export.',
          );
        }

        const label =
          period === 'custom'
            ? `${customFrom} to ${customTo}`
            : getPeriodLabel(period);

        const flat =
          getFlatExportRows(
            nextReport,
            data,
            label,
          );

        const today =
          new Date()
            .toISOString()
            .slice(0, 10);

        const filename =
          `novamenu-${nextReport}-${today}`;

        if (format === 'csv') {
          downloadProfessionalCsv(
            `${filename}.csv`,
            flat.headers,
            flat.rows,
          );
        } else if (format === 'pdf') {
          printReportAsPdf(
            `${reportLabel(nextReport)} - ${label}`,
            flat.headers,
            flat.rows,
            pdfWindow,
          );
        } else {
          const workbook =
            buildProfessionalWorkbook(
              nextReport,
              data,
              label,
            );

          XLSX.writeFile(
            workbook,
            `${filename}.xlsx`,
            {
              bookType: 'xlsx',
              cellStyles: true,
              compression: true,
            },
          );
        }

        setExportHistory(
          (current) => [
            {
              name:
                reportLabel(nextReport),
              format:
                format.toUpperCase(),
              period: label,
              date:
                new Date().toLocaleString(),
              status: 'Ready',
            },
            ...current,
          ],
        );
      } catch (err) {
        pdfWindow?.close();

        setError(
          err instanceof Error
            ? err.message
            : 'Could not generate export.',
        );
      } finally {
        setGenerating(false);
      }
    },
    [
      customFrom,
      customTo,
      format,
      period,
      selectedReport,
    ],
  );

  return (
    <div
      className="min-h-full px-4 pb-8 sm:px-6 sm:pb-10 lg:px-8 lg:pb-12"
      style={{
        color: 'var(--portal-text)',
        background:
          'var(--portal-background)',
      }}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div>
          <div
            className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"
            style={{
              color:
                'var(--portal-accent)',
            }}
          >
            <Download size={13} />
            Reports / Export Center
          </div>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Export Center
          </h1>

          <p
            className="mt-2 max-w-2xl text-sm leading-6"
            style={{
              color:
                'var(--portal-text-muted)',
            }}
          >
            Generate professional restaurant
            reports in Excel, CSV, or PDF
            format from your NOVAMENU analytics.
          </p>
        </div>

        {/* Export Builder */}
        <section
          className="overflow-hidden rounded-2xl border"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div
            className="border-b px-5 py-5"
            style={{
              borderColor:
                'var(--portal-border)',
            }}
          >
            <div className="flex items-center gap-2">
              <FileArchive
                size={17}
                style={{
                  color:
                    'var(--portal-accent)',
                }}
              />

              <h2 className="text-sm font-black">
                Create New Export
              </h2>
            </div>

            <p
              className="mt-1 text-xs"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              Build a polished report using
              your restaurant data.
            </p>
          </div>

          <div className="grid gap-6 p-5 lg:grid-cols-3">
            {/* Report */}
            <div className="lg:col-span-2">
              <label
                className="mb-3 block text-[10px] font-black uppercase tracking-[0.15em]"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Report Type
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                {reportTypes.map(
                  (report) => {
                    const selected =
                      selectedReport ===
                      report.key;

                    return (
                      <button
                        key={report.key}
                        type="button"
                        onClick={() =>
                          setSelectedReport(
                            report.key,
                          )
                        }
                        className="flex items-center gap-3 rounded-xl border p-3 text-left transition"
                        style={{
                          borderColor:
                            selected
                              ? 'var(--portal-accent)'
                              : 'var(--portal-border)',
                          background:
                            selected
                              ? 'var(--portal-accent-soft)'
                              : 'var(--portal-background)',
                        }}
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            color:
                              'var(--portal-accent)',
                            background:
                              selected
                                ? 'var(--portal-background)'
                                : 'var(--portal-surface)',
                          }}
                        >
                          <report.icon
                            size={16}
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-black">
                            {report.label}
                          </p>

                          <p
                            className="mt-0.5 truncate text-[10px]"
                            style={{
                              color:
                                'var(--portal-text-muted)',
                            }}
                          >
                            {
                              report.description
                            }
                          </p>
                        </div>

                        {selected && (
                          <CheckCircle2
                            size={15}
                            className="ml-auto shrink-0"
                            style={{
                              color:
                                'var(--portal-accent)',
                            }}
                          />
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* Period */}
            <div>
              <label
                className="mb-3 block text-[10px] font-black uppercase tracking-[0.15em]"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Date Range
              </label>

              <div className="space-y-2">
                {[
                  {
                    key: '7d',
                    label: 'Last 7 days',
                  },
                  {
                    key: '30d',
                    label: 'Last 30 days',
                  },
                  {
                    key: '90d',
                    label: 'Last 90 days',
                  },
                  {
                    key: '12m',
                    label: 'Last 12 months',
                  },
                  {
                    key: 'custom',
                    label: 'Custom range',
                  },
                ].map((item) => {
                  const selected =
                    period === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setPeriod(
                          item.key as Period,
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition"
                      style={{
                        borderColor:
                          selected
                            ? 'var(--portal-accent)'
                            : 'var(--portal-border)',
                        background:
                          selected
                            ? 'var(--portal-accent-soft)'
                            : 'var(--portal-background)',
                      }}
                    >
                      <CalendarDays
                        size={14}
                        style={{
                          color:
                            selected
                              ? 'var(--portal-accent)'
                              : 'var(--portal-text-muted)',
                        }}
                      />

                      <span className="text-xs font-bold">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Custom dates */}
          {period === 'custom' && (
            <div
              className="border-t px-5 py-5"
              style={{
                borderColor:
                  'var(--portal-border)',
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField
                  label="Start Date"
                  value={customFrom}
                  onChange={
                    setCustomFrom
                  }
                />

                <DateField
                  label="End Date"
                  value={customTo}
                  onChange={setCustomTo}
                />
              </div>
            </div>
          )}

          {/* Format */}
          <div
            className="border-t px-5 py-5"
            style={{
              borderColor:
                'var(--portal-border)',
            }}
          >
            <label
              className="mb-3 block text-[10px] font-black uppercase tracking-[0.15em]"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              File Format
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormatButton
                selected={
                  format === 'csv'
                }
                onClick={() =>
                  setFormat('csv')
                }
                icon={FileText}
                label="CSV"
                description="Clean data for analysis"
              />

              <FormatButton
                selected={
                  format === 'xlsx'
                }
                onClick={() =>
                  setFormat('xlsx')
                }
                icon={FileSpreadsheet}
                label="Excel"
                description="Professional business report"
              />

              <FormatButton
                selected={
                  format === 'pdf'
                }
                onClick={() =>
                  setFormat('pdf')
                }
                icon={FileArchive}
                label="PDF"
                description="Presentation-ready document"
              />
            </div>
          </div>

          {/* Export action */}
          <div
            className="flex flex-col gap-4 border-t px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor:
                'var(--portal-border)',
            }}
          >
            <div className="flex items-start gap-3">
              <Filter
                size={15}
                className="mt-0.5 shrink-0"
                style={{
                  color:
                    'var(--portal-accent)',
                }}
              />

              <div>
                <p className="text-xs font-black">
                  Ready to export
                </p>

                <p
                  className="mt-1 text-[10px]"
                  style={{
                    color:
                      'var(--portal-text-muted)',
                  }}
                >
                  {reportLabel(
                    selectedReport,
                  )}{' '}
                  ·{' '}
                  {getPeriodLabel(
                    period,
                  )}{' '}
                  ·{' '}
                  {format.toUpperCase()}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void generateExport()
              }
              disabled={generating}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                color:
                  'var(--portal-text)',
                background:
                  'var(--portal-accent)',
              }}
            >
              {generating ? (
                <RefreshCw
                  className="animate-spin"
                  size={14}
                />
              ) : (
                <Download size={14} />
              )}

              {generating
                ? 'Generating…'
                : `Generate ${format.toUpperCase()} Export`}
            </button>
          </div>

          {error && (
            <p className="border-t px-5 py-3 text-xs font-bold text-red-500">
              {error}
            </p>
          )}
        </section>

        {/* Quick exports */}
        <section>
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <ZapIcon />

              <h2 className="text-sm font-black">
                Quick Exports
              </h2>
            </div>

            <p
              className="mt-1 text-xs"
              style={{
                color:
                  'var(--portal-text-muted)',
              }}
            >
              Download commonly used reports
              instantly.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QuickExport
              icon={BarChart3}
              title="Sales"
              description="Revenue & order summary"
              onClick={() =>
                void generateExport(
                  'sales',
                )
              }
            />

            <QuickExport
              icon={ShoppingBag}
              title="Orders"
              description="Complete order dataset"
              onClick={() =>
                void generateExport(
                  'orders',
                )
              }
            />

            <QuickExport
              icon={Package}
              title="Menu"
              description="Items & category performance"
              onClick={() =>
                void generateExport(
                  'menu',
                )
              }
            />

            <QuickExport
              icon={Users}
              title="Customers"
              description="Customer activity data"
              onClick={() =>
                void generateExport(
                  'customers',
                )
              }
            />
          </div>
        </section>

        {/* Export history */}
        <section
          className="overflow-hidden rounded-2xl border"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
          }}
        >
          <div
            className="flex flex-col gap-3 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
            style={{
              borderColor:
                'var(--portal-border)',
            }}
          >
            <div>
              <div className="flex items-center gap-2">
                <History
                  size={17}
                  style={{
                    color:
                      'var(--portal-accent)',
                  }}
                />

                <h2 className="text-sm font-black">
                  Export History
                </h2>
              </div>

              <p
                className="mt-1 text-xs"
                style={{
                  color:
                    'var(--portal-text-muted)',
                }}
              >
                Reports generated during this
                session.
              </p>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-[11px] font-black transition sm:self-auto"
              style={{
                borderColor:
                  'var(--portal-border)',
                color:
                  'var(--portal-text-muted)',
              }}
            >
              <History size={13} />
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr
                  className="border-b text-[10px] font-black uppercase tracking-[0.15em]"
                  style={{
                    borderColor:
                      'var(--portal-border)',
                    color:
                      'var(--portal-text-muted)',
                  }}
                >
                  <th className="px-5 py-4">
                    Report
                  </th>
                  <th className="px-5 py-4">
                    Format
                  </th>
                  <th className="px-5 py-4">
                    Period
                  </th>
                  <th className="px-5 py-4">
                    Created
                  </th>
                  <th className="px-5 py-4">
                    Status
                  </th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>

              <tbody>
                {exportHistory.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center text-xs"
                      style={{
                        color:
                          'var(--portal-text-muted)',
                      }}
                    >
                      No exports generated in
                      this session.
                    </td>
                  </tr>
                ) : (
                  exportHistory.map(
                    (item) => (
                      <tr
                        key={`${item.name}-${item.date}`}
                        className="border-b last:border-b-0"
                        style={{
                          borderColor:
                            'var(--portal-border)',
                        }}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-9 w-9 items-center justify-center rounded-lg"
                              style={{
                                color:
                                  'var(--portal-accent)',
                                background:
                                  'var(--portal-accent-soft)',
                              }}
                            >
                              <FileArchive
                                size={15}
                              />
                            </div>

                            <span className="text-xs font-black">
                              {
                                item.name
                              }
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className="rounded-md border px-2 py-1 text-[9px] font-black"
                            style={{
                              borderColor:
                                'var(--portal-border)',
                              color:
                                'var(--portal-text-muted)',
                            }}
                          >
                            {
                              item.format
                            }
                          </span>
                        </td>

                        <td
                          className="px-5 py-4 text-xs"
                          style={{
                            color:
                              'var(--portal-text-muted)',
                          }}
                        >
                          {
                            item.period
                          }
                        </td>

                        <td
                          className="px-5 py-4 text-xs"
                          style={{
                            color:
                              'var(--portal-text-muted)',
                          }}
                        >
                          {item.date}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black"
                            style={{
                              color:
                                'var(--portal-accent)',
                              background:
                                'var(--portal-accent-soft)',
                            }}
                          >
                            <CheckCircle2
                              size={11}
                            />
                            {
                              item.status
                            }
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition"
                            style={{
                              borderColor:
                                'var(--portal-border)',
                              color:
                                'var(--portal-text-muted)',
                            }}
                            title="Download export"
                          >
                            <Download
                              size={14}
                            />
                          </button>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Format information */}
        <div className="grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={FileText}
            title="CSV"
            description="Clean UTF-8 data with proper escaping and Excel-compatible Arabic and Unicode support."
          />

          <InfoCard
            icon={FileSpreadsheet}
            title="Excel"
            description="Professional multi-sheet workbook with an executive summary, KPIs, filters, frozen headers, formatting, and print-ready layouts."
          />

          <InfoCard
            icon={FileArchive}
            title="PDF"
            description="Presentation-ready report for sharing with restaurant owners, managers, and teams."
          />
        </div>

        {/* Status */}
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-[11px] leading-5"
          style={{
            borderColor:
              'var(--portal-border)',
            background:
              'var(--portal-surface)',
            color:
              'var(--portal-text-muted)',
          }}
        >
          <TrendingUp
            size={14}
            className="mt-0.5 shrink-0"
            style={{
              color:
                'var(--portal-accent)',
            }}
          />

          <div>
            <span
              className="font-black"
              style={{
                color:
                  'var(--portal-text)',
              }}
            >
              Professional exports:
            </span>{' '}
            Excel exports now contain a dedicated
            executive summary, KPI section,
            report metadata, polished data
            tables, filters, frozen headers,
            intelligent column sizing, number
            formatting, and print-friendly
            settings. CSV exports remain clean
            and machine-readable for analysis.
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               UI COMPONENTS                                */
/* -------------------------------------------------------------------------- */

function FormatButton({
  selected,
  onClick,
  icon: Icon,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: typeof FileText;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border p-4 text-left transition"
      style={{
        borderColor:
          selected
            ? 'var(--portal-accent)'
            : 'var(--portal-border)',
        background:
          selected
            ? 'var(--portal-accent-soft)'
            : 'var(--portal-background)',
      }}
    >
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={{
          color:
            'var(--portal-accent)',
          background:
            'var(--portal-surface)',
        }}
      >
        <Icon size={18} />
      </div>

      <div>
        <p className="text-xs font-black">
          {label}
        </p>

        <p
          className="mt-1 text-[10px]"
          style={{
            color:
              'var(--portal-text-muted)',
          }}
        >
          {description}
        </p>
      </div>

      {selected && (
        <CheckCircle2
          size={15}
          className="ml-auto"
          style={{
            color:
              'var(--portal-accent)',
          }}
        />
      )}
    </button>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <div>
      <label
        className="mb-2 block text-[10px] font-black uppercase tracking-[0.14em]"
        style={{
          color:
            'var(--portal-text-muted)',
        }}
      >
        {label}
      </label>

      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-3"
        style={{
          borderColor:
            'var(--portal-border)',
          background:
            'var(--portal-background)',
        }}
      >
        <CalendarDays
          size={14}
          style={{
            color:
              'var(--portal-text-muted)',
          }}
        />

        <input
          type="date"
          value={value}
          onChange={(event) =>
            onChange(
              event.target.value,
            )
          }
          className="w-full bg-transparent text-xs outline-none"
          aria-label={label}
        />
      </div>
    </div>
  );
}

function QuickExport({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof BarChart3;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border p-5 text-left transition"
      style={{
        borderColor:
          'var(--portal-border)',
        background:
          'var(--portal-surface)',
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{
            color:
              'var(--portal-accent)',
            background:
              'var(--portal-accent-soft)',
          }}
        >
          <Icon size={18} />
        </div>

        <Download
          size={14}
          style={{
            color:
              'var(--portal-text-muted)',
          }}
        />
      </div>

      <p className="mt-5 text-xs font-black">
        {title}
      </p>

      <p
        className="mt-1 text-[10px] leading-5"
        style={{
          color:
            'var(--portal-text-muted)',
        }}
      >
        {description}
      </p>
    </button>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{
        borderColor:
          'var(--portal-border)',
        background:
          'var(--portal-surface)',
      }}
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          color:
            'var(--portal-accent)',
          background:
            'var(--portal-accent-soft)',
        }}
      >
        <Icon size={16} />
      </div>

      <p className="mt-4 text-xs font-black">
        {title}
      </p>

      <p
        className="mt-1 text-[10px] leading-5"
        style={{
          color:
            'var(--portal-text-muted)',
        }}
      >
        {description}
      </p>
    </div>
  );
}

function ZapIcon() {
  return (
    <div
      className="flex h-7 w-7 items-center justify-center rounded-lg"
      style={{
        color:
          'var(--portal-accent)',
        background:
          'var(--portal-accent-soft)',
      }}
    >
      <TrendingUp size={14} />
    </div>
  );
}
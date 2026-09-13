export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export function escapeCsvValue(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: unknown[][],
) {
  const content = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\r\n');
  const blob = new Blob([`\uFEFF${content}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function printReportAsPdf(
  title: string,
  headers: string[],
  rows: unknown[][],
  targetWindow?: Window | null,
) {
  const popup =
    targetWindow ||
    window.open('', '_blank', 'noopener,noreferrer');

  if (!popup) {
    throw new Error('Allow pop-ups to export a PDF report.');
  }

  const cell = (value: unknown, header: boolean) =>
    `<${header ? 'th' : 'td'}>${String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</${header ? 'th' : 'td'}>`;

  popup.document.write(`<!doctype html><html><head><title>${title}</title>
    <style>
      @page { size: A4 landscape; margin: 14mm; }
      body { font-family: Arial, sans-serif; color: #172033; }
      h1 { color: #1f4e78; margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th { background: #1f4e78; color: white; text-align: left; }
      th, td { border: 1px solid #cbd5e1; padding: 7px; }
      tr:nth-child(even) { background: #f1f5f9; }
    </style></head><body><h1>${title}</h1>
    <table><thead><tr>${headers.map((header) => cell(header, true)).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((value) => cell(value, false)).join('')}</tr>`).join('')}</tbody>
    </table></body></html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

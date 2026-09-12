import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PRINTER_PORTS = [9100, 631, 80, 8080];
const REQUEST_TIMEOUT_MS = 800;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedSubnet = searchParams.get('subnet')?.trim();

  // Build target hosts to probe
  const configuredHosts = (process.env.PRINTER_DISCOVERY_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

  const defaultCandidateHosts = [
    '127.0.0.1',
    'localhost',
    '192.168.1.50',
    '192.168.1.100',
    '192.168.1.200',
    '192.168.0.50',
    '192.168.0.100',
    '192.168.0.200',
    '10.0.0.100',
    '10.0.0.50',
  ];

  let hostsToScan = configuredHosts.length ? configuredHosts : defaultCandidateHosts;

  if (requestedSubnet) {
    const baseSubnet = requestedSubnet.replace(/\.\d*$/, '');
    const subnetHosts = [
      `${baseSubnet}.10`,
      `${baseSubnet}.50`,
      `${baseSubnet}.100`,
      `${baseSubnet}.101`,
      `${baseSubnet}.102`,
      `${baseSubnet}.150`,
      `${baseSubnet}.200`,
      `${baseSubnet}.250`,
    ];
    hostsToScan = Array.from(new Set([...subnetHosts, ...hostsToScan]));
  }

  const printers = (
    await Promise.all(
      hostsToScan.flatMap((host) =>
        PRINTER_PORTS.map(async (port) => {
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(),
            REQUEST_TIMEOUT_MS
          );

          try {
            await fetch(`http://${host}:${port}`, {
              method: 'HEAD',
              signal: controller.signal,
              cache: 'no-store',
            });

            return {
              id: `network-${host}-${port}`,
              name: `Network Thermal Printer (${host})`,
              connection: 'network' as const,
              address: host,
              port: String(port),
              details: `Active at ${host}:${port}`,
            };
          } catch {
            return null;
          } finally {
            clearTimeout(timeout);
          }
        })
      )
    )
  ).filter(
    (
      printer
    ): printer is {
      id: string;
      name: string;
      connection: 'network';
      address: string;
      port: string;
      details: string;
    } => Boolean(printer)
  );

  return NextResponse.json({
    printers,
    available: true,
    scannedHostsCount: hostsToScan.length,
  });
}

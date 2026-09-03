import { lookup } from 'dns/promises';
import { isIP } from 'net';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google.com',
  'metadata.aws.internal',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3];
}

export function isPrivateIPv4(ip) {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  if (n <= 0x00ffffff) return true; // 0.0.0.0/8
  if (n >= 0x0a000000 && n <= 0x0affffff) return true; // 10.0.0.0/8
  if (n >= 0x64400000 && n <= 0x647fffff) return true; // 100.64.0.0/10 CGNAT
  if (n >= 0x7f000000 && n <= 0x7fffffff) return true; // 127.0.0.0/8
  if (n >= 0xa9fe0000 && n <= 0xa9feffff) return true; // 169.254.0.0/16
  if (n >= 0xac100000 && n <= 0xac1fffff) return true; // 172.16.0.0/12
  if (n >= 0xc0000000 && n <= 0xc00000ff) return true; // 192.0.0.0/24
  if (n >= 0xc0a80000 && n <= 0xc0a8ffff) return true; // 192.168.0.0/16
  if (n >= 0xe0000000) return true; // 224.0.0.0/4 multicast and reserved
  return false;
}

export function isPrivateIPv6(ip) {
  const host = String(ip || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  if (!host) return true;
  if (host === '::' || host === '::1' || host === '0:0:0:0:0:0:0:0' || host === '0:0:0:0:0:0:0:1') {
    return true;
  }
  if (host.startsWith('fe80:') || host.startsWith('feb0:') || host.startsWith('febf:')) return true;
  if (host.startsWith('fc') || host.startsWith('fd')) return true;
  if (host.startsWith('ff')) return true;
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  const mappedHex = host.match(/^::ffff:([0-9a-f:.]+)$/);
  if (mappedHex && mappedHex[1].includes('.')) return isPrivateIPv4(mappedHex[1]);
  return false;
}

export function isPrivateIp(ip) {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true;
}

function hostnameLooksLocal(hostname) {
  const host = String(hostname || '')
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  if (host.endsWith('.nip.io') || host.endsWith('.sslip.io')) return true;
  return false;
}

export function parsePublicHttpUrl(value) {
  if (typeof value !== 'string') return { error: 'invalid_url' };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2000) return { error: 'invalid_url' };
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return { error: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { error: 'invalid_url' };
  if (url.username || url.password) return { error: 'invalid_url' };
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || hostnameLooksLocal(hostname)) return { error: 'blocked' };
  const version = isIP(hostname);
  if (version && isPrivateIp(hostname)) return { error: 'blocked' };
  return { url };
}

export async function assertPublicHttpUrl(value) {
  const parsed = parsePublicHttpUrl(value);
  if (parsed.error) return parsed;
  const hostname = parsed.url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) {
    return isPrivateIp(hostname) ? { error: 'blocked' } : parsed;
  }
  let records;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return { error: 'blocked' };
  }
  if (!records?.length) return { error: 'blocked' };
  if (records.some((row) => isPrivateIp(row.address))) return { error: 'blocked' };
  return parsed;
}

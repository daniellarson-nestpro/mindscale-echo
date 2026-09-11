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

/** Format the two 16-bit words that carry an embedded IPv4 address. */
function ipv4FromWords(hi, lo) {
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

/**
 * Expand an IPv6 literal into eight 16-bit groups, resolving `::` and any
 * trailing dotted quad. Returns null when the literal cannot be parsed — every
 * caller treats that as private, so unparseable input fails closed.
 */
function ipv6Groups(value) {
  let text = String(value || '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  const pct = text.indexOf('%'); // strip the zone id: fe80::1%eth0
  if (pct !== -1) text = text.slice(0, pct);
  if (!text) return null;

  // A trailing dotted quad occupies the final two groups (::ffff:127.0.0.1).
  let tail = [];
  const dot = text.indexOf('.');
  if (dot !== -1) {
    const cut = text.lastIndexOf(':');
    if (cut === -1 || cut > dot) return null;
    const n = ipv4ToInt(text.slice(cut + 1));
    if (n === null) return null;
    tail = [(n >>> 16) & 0xffff, n & 0xffff];
    text = text.slice(0, cut + 1);
    if (!text.endsWith('::')) text = text.slice(0, -1);
  }

  const halves = text.split('::');
  if (halves.length > 2) return null;
  const want = 8 - tail.length;
  const parse = (chunk) => {
    if (!chunk) return [];
    const out = [];
    for (const piece of chunk.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(piece)) return null;
      out.push(parseInt(piece, 16));
    }
    return out;
  };

  const head = parse(halves[0]);
  if (head === null) return null;
  if (halves.length === 1) return head.length === want ? [...head, ...tail] : null;
  const rear = parse(halves[1]);
  if (rear === null) return null;
  const fill = want - head.length - rear.length;
  if (fill < 0) return null;
  return [...head, ...new Array(fill).fill(0), ...rear, ...tail];
}

export function isPrivateIPv6(ip) {
  const g = ipv6Groups(ip);
  if (!g) return true;

  const zeros = (n) => g.slice(0, n).every((x) => x === 0);
  const embedded = () => isPrivateIPv4(ipv4FromWords(g[6], g[7]));

  if (zeros(8)) return true; // :: unspecified
  if (zeros(7) && g[7] === 1) return true; // ::1 loopback
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast

  // Anything carrying an IPv4 address inherits that address's disposition,
  // whichever of the several embedding formats was used to smuggle it.
  if (zeros(5) && g[5] === 0xffff) return embedded(); // ::ffff:0:0/96 IPv4-mapped
  if (zeros(4) && g[4] === 0xffff && g[5] === 0) return embedded(); // ::ffff:0:0:0/96 IPv4-translated
  if (g[0] === 0x0064 && g[1] === 0xff9b) {
    if (g[2] === 1) return true; // 64:ff9b:1::/48 local-use NAT64
    if (g.slice(2, 6).every((x) => x === 0)) return embedded(); // 64:ff9b::/96 NAT64
  }
  if (g[0] === 0x2002) return isPrivateIPv4(ipv4FromWords(g[1], g[2])); // 2002::/16 6to4
  if (zeros(6)) return embedded(); // ::/96 IPv4-compatible (deprecated)

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

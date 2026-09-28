/**
 * Trustworthy client IP for rate limiting.
 *
 * Behind our nginx, `X-Real-IP` is set to `$remote_addr` (the real TCP peer) and
 * OVERWRITES any client-supplied value, so it's authoritative. `X-Forwarded-For`
 * is `$proxy_add_x_forwarded_for` — nginx appends the real IP on the RIGHT, so the
 * rightmost entry is trusted and the client-controlled left entries are ignored.
 *
 * Never trust the LEFTMOST XFF value: a client can spoof it to rotate IPs and
 * bypass the limiter entirely.
 *
 * These headers are only meaningful when SOMETHING in front overwrites them.
 * Set TRUSTED_PROXY=0 when the app is exposed directly (no nginx / no platform
 * edge): the headers then become fully attacker-controlled, which would let one
 * client mint a fresh rate-limit bucket per request.
 */
interface HeadersLike {
  get(name: string): string | null;
}

const trustProxyHeaders = (): boolean => process.env.TRUSTED_PROXY !== '0';

export function clientIp(headers: HeadersLike): string {
  if (!trustProxyHeaders()) return 'anon';

  const real = headers.get('x-real-ip');
  if (real) return real.trim();

  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1]!;
  }
  return 'anon';
}

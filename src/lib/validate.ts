import { z } from 'zod';
import { PLATFORMS, type PlatformKey } from './platforms';

/**
 * Security boundary for the extract endpoint.
 * Defends against SSRF: only known public platform hosts are allowed, and any URL
 * resolving to a private / loopback / link-local target is rejected outright.
 */

export const extractRequestSchema = z.object({
  url: z.string().trim().url().max(2048),
  platform: z.enum([
    'tiktok',
    'instagram',
    'youtube',
    'facebook',
    'linkedin',
    'twitter',
    'pinterest',
    'reddit',
    'vimeo',
    'twitch',
    'tumblr',
  ]),
});

export type ExtractRequest = z.infer<typeof extractRequestSchema>;

/** Blocks private, loopback, link-local and internal hostnames (SSRF). */
const PRIVATE_HOST = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1|\[::1\]|metadata\.google\.internal)/i;
const PRIVATE_IP_RANGE =
  /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.)/;

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Validate that (a) the platform is real, (b) the URL host matches that platform's
 * whitelist, and (c) the host is not an internal address. Call before touching the engine.
 */
export function validateExtractTarget(url: string, platform: PlatformKey): ValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'Malformed URL.' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'Only http(s) links are supported.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (PRIVATE_HOST.test(host) || PRIVATE_IP_RANGE.test(host)) {
    return { ok: false, reason: 'Internal addresses are not allowed.' };
  }

  const def = PLATFORMS[platform];
  if (!def.hostPattern.test(url)) {
    return { ok: false, reason: `That does not look like a valid ${def.name} link.` };
  }

  return { ok: true };
}

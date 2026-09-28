import { describe, it, expect } from 'vitest';
import { detectSaveMode } from '@/lib/deviceDetect';

const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const MAC_FIREFOX = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0';
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const WINDOWS_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0';
const UBUNTU_FIREFOX = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';
const UBUNTU_CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const ANDROID_FIREFOX = 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/20100101 Firefox/130.0';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1';
// iPadOS 13+ reports as desktop Safari on "Macintosh" — only distinguishable by touch points.
const IPAD_AS_MAC_SAFARI = MAC_SAFARI;

describe('detectSaveMode', () => {
  it('prefers install whenever the browser offered a beforeinstallprompt, regardless of platform', () => {
    expect(detectSaveMode(true, WINDOWS_CHROME, 'Win32', 0)).toBe('install');
    expect(detectSaveMode(true, ANDROID_CHROME, 'Linux armv8l', 5)).toBe('install');
    expect(detectSaveMode(true, MAC_CHROME, 'MacIntel', 0)).toBe('install');
  });

  it('falls back to the Cmd+D shortcut on Mac desktop browsers that never fire beforeinstallprompt', () => {
    expect(detectSaveMode(false, MAC_SAFARI, 'MacIntel', 0)).toBe('shortcut-mac');
    expect(detectSaveMode(false, MAC_FIREFOX, 'MacIntel', 0)).toBe('shortcut-mac');
  });

  it('falls back to the Ctrl+D shortcut on Windows and Ubuntu/Linux desktop browsers', () => {
    expect(detectSaveMode(false, WINDOWS_FIREFOX, 'Win32', 0)).toBe('shortcut-other');
    expect(detectSaveMode(false, UBUNTU_FIREFOX, 'Linux x86_64', 0)).toBe('shortcut-other');
    expect(detectSaveMode(false, UBUNTU_CHROME, 'Linux x86_64', 0)).toBe('shortcut-other');
  });

  it('detects iOS (iPhone) regardless of which browser shell is used, since all iOS browsers share WebKit and never fire beforeinstallprompt', () => {
    expect(detectSaveMode(false, IPHONE_SAFARI, 'iPhone', 5)).toBe('ios');
    expect(detectSaveMode(false, IPHONE_CHROME, 'iPhone', 5)).toBe('ios');
  });

  it('detects iPadOS 13+ even though it reports "MacIntel", via its touch points', () => {
    expect(detectSaveMode(false, IPAD_AS_MAC_SAFARI, 'MacIntel', 5)).toBe('ios');
  });

  it('does not misclassify a real Mac (0-1 touch points) as an iPad', () => {
    expect(detectSaveMode(false, MAC_SAFARI, 'MacIntel', 0)).not.toBe('ios');
  });

  it('gives Android Chrome the install path when available, and a generic mobile fallback otherwise (e.g. Firefox Android)', () => {
    expect(detectSaveMode(true, ANDROID_CHROME, 'Linux armv8l', 5)).toBe('install');
    expect(detectSaveMode(false, ANDROID_FIREFOX, 'Linux armv8l', 5)).toBe('mobile-generic');
  });
});

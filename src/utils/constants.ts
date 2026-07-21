export const APP_VERSION = '1.0.0';

export const DEFAULT_URL =
  `https://mobile.dshub.com.ng/login?v=${APP_VERSION}`;

export const ALTERNATIVE_URL =
  `https://lifegate.dshub.com.ng/login?v=${APP_VERSION}`;

export const APP_ENTRY_URLS = [DEFAULT_URL, ALTERNATIVE_URL] as const;

export function getAlternativeAppUrl(url: string): string | null {
  if (url === DEFAULT_URL) return ALTERNATIVE_URL;
  return null;
}

export const APP_VERSION = '1.0.0';

export const DEFAULT_URL =
  `https://mobile.dshub.com.ng/login?v=${APP_VERSION}`;

export const ALTERNATIVE_URL =
  `https://lifegate.dshub.com.ng/login?v=${APP_VERSION}`;

export const APP_ENTRY_URLS = [DEFAULT_URL, ALTERNATIVE_URL] as const;

const DEFAULT_HOST = 'mobile.dshub.com.ng';

export function getAlternativeAppUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== DEFAULT_HOST) return null;

    const alternativeUrl = new URL(ALTERNATIVE_URL);
    alternativeUrl.pathname = parsedUrl.pathname;
    alternativeUrl.search = parsedUrl.search || alternativeUrl.search;
    alternativeUrl.hash = parsedUrl.hash;
    return alternativeUrl.toString();
  } catch (_) {
    return url === DEFAULT_URL ? ALTERNATIVE_URL : null;
  }
}

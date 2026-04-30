const SAFE_PROTOCOLS = ['https:', 'http:', 'ftp:'];

/**
 * Takes raw user input and returns a fully-qualified URL string.
 * - If the input already looks like a valid URL with a safe scheme, return it normalised.
 * - If the input contains a dot and no spaces, assume it's a hostname and prepend https://.
 * - Otherwise, treat it as a search query.
 */
export function sanitizeUrl(input: string, searchEngine = 'https://duckduckgo.com/?q='): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Already a URL with explicit scheme
  try {
    const parsed = new URL(trimmed);
    if (SAFE_PROTOCOLS.includes(parsed.protocol)) {
      return parsed.href;
    }
  } catch {
    // Not a valid URL yet — continue processing
  }

  // Looks like a hostname (contains dot, no spaces)
  if (!trimmed.includes(' ') && trimmed.includes('.')) {
    try {
      const withScheme = `https://${trimmed}`;
      const parsed = new URL(withScheme);
      if (SAFE_PROTOCOLS.includes(parsed.protocol)) {
        return parsed.href;
      }
    } catch {
      // fall through to search
    }
  }

  // Treat as a search query
  return `${searchEngine}${encodeURIComponent(trimmed)}`;
}

/**
 * Returns a display-friendly version of a URL (strips scheme and trailing slash).
 */
export function displayUrl(url: string): string {
  try {
    const parsed = new URL(url);
    let display = parsed.host + parsed.pathname + parsed.search + parsed.hash;
    // strip trailing slash from bare host
    if (display.endsWith('/') && !parsed.search && !parsed.hash) {
      display = display.slice(0, -1);
    }
    return display;
  } catch {
    return url;
  }
}

/**
 * Returns a Google favicon URL for the given page URL.
 */
export function faviconUrl(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
  } catch {
    return '';
  }
}

/**
 * Returns the search query URL for a given engine key.
 */
export function searchEngineUrl(engine: string, query: string): string {
  const engines: Record<string, string> = {
    duckduckgo: 'https://duckduckgo.com/?q=',
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q=',
  };
  const base = engines[engine] ?? engines.duckduckgo;
  return `${base}${encodeURIComponent(query)}`;
}

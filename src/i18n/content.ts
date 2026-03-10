export type Locale = 'ja' | 'en';

/**
 * Returns true if the content entry belongs to the given locale.
 * Convention: "slug.en.md" → English, "slug.md" → Japanese (default)
 */
export function isLocale(id: string, locale: Locale): boolean {
  if (locale === 'en') return id.endsWith('.en.md');
  return !id.endsWith('.en.md');
}

/**
 * Strips locale suffix and .md extension to produce a clean slug.
 * "this-site.en.md" → "this-site"
 * "this-site.md"    → "this-site"
 */
export function toSlug(id: string): string {
  return id.replace(/\.en\.md$/, '').replace(/\.md$/, '');
}

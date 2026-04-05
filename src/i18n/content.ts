export type Locale = 'ja' | 'en';

const ENGLISH_SUFFIX = /(?:-en|\.en)(?:\.md)?$/;
const MARKDOWN_SUFFIX = /\.md$/;

function stripLocaleAndExtension(id: string): string {
  return id.replace(ENGLISH_SUFFIX, '').replace(MARKDOWN_SUFFIX, '');
}

/**
 * Returns true if the content entry belongs to the given locale.
 * Convention: "slug-en.md" → English, "slug.md" → Japanese (default)
 */
export function isLocale(id: string, locale: Locale): boolean {
  const isEnglish = ENGLISH_SUFFIX.test(id);
  if (locale === 'en') return isEnglish;
  return !isEnglish;
}

/**
 * Strips locale suffix and .md extension to produce a clean slug.
 * "this-site-en.md" → "this-site"
 * "this-site.md"    → "this-site"
 */
export function toSlug(id: string): string {
  return stripLocaleAndExtension(id);
}

export function toAssetSlug(id: string): string {
  const slug = toSlug(id);
  return ENGLISH_SUFFIX.test(id) ? `${slug}-en` : slug;
}

export function toBookSlug(id: string): string {
  const slug = stripLocaleAndExtension(id);
  return slug.endsWith('/index') ? slug.slice(0, -'/index'.length) : slug;
}

export function toChapterSlug(id: string, bookSlug: string): string {
  const slug = stripLocaleAndExtension(id);
  const prefix = `${bookSlug}/`;
  return slug.startsWith(prefix) ? slug.slice(prefix.length) : slug;
}

export function isBookIndex(id: string): boolean {
  return stripLocaleAndExtension(id).endsWith('/index');
}

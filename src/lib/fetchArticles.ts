import { ARTICLE_SOURCE_HOSTS, normalizeAllowedHttpsUrl } from './urlSafety';

export interface ExternalArticle {
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  source: 'zenn' | 'qiita' | 'prtimes' | 'sizu';
  tags?: string[];
  thumbnail?: string;
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function sanitizePlainText(value: unknown, maxLength: number): string {
  return compactWhitespace(String(value ?? ''))
    .slice(0, maxLength);
}

function sanitizeHtmlExcerpt(value: unknown, maxLength: number): string {
  return compactWhitespace(
    String(value ?? '')
      .replace(/<[^>]+>/g, ''),
  ).slice(0, maxLength);
}

function toIsoDate(value: unknown): string | null {
  const date = new Date(String(value ?? ''));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function sanitizeTags(tags: unknown): string[] | undefined {
  if (!Array.isArray(tags)) {
    return undefined;
  }

  const cleaned = tags
    .map((tag) => sanitizePlainText(tag, 40))
    .filter(Boolean)
    .slice(0, 5);

  return cleaned.length > 0 ? cleaned : undefined;
}

function buildArticle(input: {
  title: unknown;
  url: unknown;
  description: string;
  publishedAt: unknown;
  source: ExternalArticle['source'];
  tags?: unknown;
  thumbnail?: unknown;
}): ExternalArticle | null {
  const title = sanitizePlainText(input.title, 160);
  const url = normalizeAllowedHttpsUrl(String(input.url ?? ''), ARTICLE_SOURCE_HOSTS[input.source]);
  const publishedAt = toIsoDate(input.publishedAt);
  const thumbnail = normalizeAllowedHttpsUrl(String(input.thumbnail ?? ''));

  if (!title || !url || !publishedAt) {
    return null;
  }

  return {
    title,
    url,
    description: sanitizePlainText(input.description, 100),
    publishedAt,
    source: input.source,
    tags: sanitizeTags(input.tags),
    thumbnail: thumbnail ?? undefined,
  };
}

export async function fetchZennArticles(username: string): Promise<ExternalArticle[]> {
  try {
    const res = await fetch(`https://zenn.dev/${username}/feed`);
    if (!res.ok) return [];
    const xml = await res.text();

    const { XMLParser } = await import('fast-xml-parser');
    const parser = new XMLParser({ isArray: (name) => name === 'item' });
    const feed = parser.parse(xml);
    const items: any[] = feed?.rss?.channel?.item ?? [];

    return items.flatMap((item) => {
      const article = buildArticle({
        title: item.title,
        url: item.link,
        description: sanitizeHtmlExcerpt(item.description, 100),
        publishedAt: item.pubDate,
        source: 'zenn',
        thumbnail: item.enclosure?.['@_url'],
      });
      return article ? [article] : [];
    });
  } catch {
    return [];
  }
}

export async function fetchQiitaArticles(username: string): Promise<ExternalArticle[]> {
  try {
    const res = await fetch(
      `https://qiita.com/api/v2/users/${username}/items?per_page=20`,
    );
    if (!res.ok) return [];
    const data: any[] = await res.json();
    return data.flatMap((a) => {
      const article = buildArticle({
        title: a.title,
        url: a.url,
        description: String(a.body ?? '').slice(0, 80).replace(/[#\n]/g, ' '),
        publishedAt: a.created_at,
        source: 'qiita',
        tags: (a.tags ?? []).map((t: any) => t.name),
      });
      return article ? [article] : [];
    });
  } catch {
    return [];
  }
}

export async function fetchPRTimesArticles(): Promise<ExternalArticle[]> {
  try {
    const res = await fetch('https://developers.prtimes.jp/author/raigasasayama/feed/');
    if (!res.ok) return [];
    const xml = await res.text();

    const { XMLParser } = await import('fast-xml-parser');
    const parser = new XMLParser({ isArray: (name) => name === 'item' || name === 'category' });
    const feed = parser.parse(xml);
    const items: any[] = feed?.rss?.channel?.item ?? [];

    return items.flatMap((item) => {
      const categories = Array.isArray(item.category)
        ? item.category
        : item.category ? [item.category] : [];

      const article = buildArticle({
        title: item.title,
        url: item.link,
        description: sanitizeHtmlExcerpt(
          String(item.description ?? '').replace(/\[…\]|\[&#8230;\]/g, '…'),
          100,
        ),
        publishedAt: item.pubDate,
        source: 'prtimes',
        tags: categories,
      });
      return article ? [article] : [];
    });
  } catch {
    return [];
  }
}

export async function fetchSizuArticles(): Promise<ExternalArticle[]> {
  try {
    const res = await fetch('https://sizu.me/ahoxa/rss');
    if (!res.ok) return [];
    const xml = await res.text();

    const { XMLParser } = await import('fast-xml-parser');
    const parser = new XMLParser({ isArray: (name) => name === 'item' });
    const feed = parser.parse(xml);
    const items: any[] = feed?.rss?.channel?.item ?? [];

    return items.flatMap((item) => {
      const article = buildArticle({
        title: item.title,
        url: item.link,
        description: sanitizeHtmlExcerpt(item.description, 100),
        publishedAt: item.pubDate,
        source: 'sizu',
        thumbnail: item.enclosure?.['@_url'],
      });
      return article ? [article] : [];
    });
  } catch {
    return [];
  }
}

const ZENN_USERNAME = import.meta.env.ZENN_USERNAME ?? 'ahoxa1rx';
const QIITA_USERNAME = import.meta.env.QIITA_USERNAME ?? 'raiga0310';

export async function fetchAllExternalArticles(): Promise<ExternalArticle[]> {
  const [zenn, qiita, prtimes, sizu] = await Promise.all([
    fetchZennArticles(ZENN_USERNAME),
    fetchQiitaArticles(QIITA_USERNAME),
    fetchPRTimesArticles(),
    fetchSizuArticles(),
  ]);
  return [...zenn, ...qiita, ...prtimes, ...sizu].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

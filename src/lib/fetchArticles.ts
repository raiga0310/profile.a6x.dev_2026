export interface ExternalArticle {
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  source: 'zenn' | 'qiita' | 'prtimes';
  tags?: string[];
  thumbnail?: string;
}

export async function fetchZennArticles(username: string): Promise<ExternalArticle[]> {
  try {
    const res = await fetch(
      `https://zenn.dev/api/articles?username=${username}&order=latest`,
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.articles ?? []).map((a: any): ExternalArticle => ({
      title: a.title,
      url: `https://zenn.dev${a.path}`,
      description: a.body_letters_count ? `${a.body_letters_count.toLocaleString()} 字` : '',
      publishedAt: a.published_at,
      source: 'zenn',
      tags: (a.topics ?? []).map((t: any) => t.name ?? t),
      thumbnail: a.cover_image_url ?? undefined,
    }));
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
    return data.map((a): ExternalArticle => ({
      title: a.title,
      url: a.url,
      description: a.body?.slice(0, 80).replace(/[#\n]/g, ' ') ?? '',
      publishedAt: a.created_at,
      source: 'qiita',
      tags: (a.tags ?? []).map((t: any) => t.name),
    }));
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

    return items.map((item): ExternalArticle => {
      const desc = (item.description ?? '')
        .replace(/<[^>]+>/g, '')
        .replace(/\[…\]|\[&#8230;\]/g, '…')
        .trim()
        .slice(0, 100);

      const categories: string[] = Array.isArray(item.category)
        ? item.category.map((c: any) => String(c))
        : item.category ? [String(item.category)] : [];

      return {
        title: item.title ?? '',
        url: item.link ?? '',
        description: desc,
        publishedAt: new Date(item.pubDate).toISOString(),
        source: 'prtimes',
        tags: categories,
      };
    });
  } catch {
    return [];
  }
}

const ZENN_USERNAME = import.meta.env.ZENN_USERNAME ?? 'ahoxa1rx';
const QIITA_USERNAME = import.meta.env.QIITA_USERNAME ?? 'raiga0310';

export async function fetchAllExternalArticles(): Promise<ExternalArticle[]> {
  const [zenn, qiita, prtimes] = await Promise.all([
    fetchZennArticles(ZENN_USERNAME),
    fetchQiitaArticles(QIITA_USERNAME),
    fetchPRTimesArticles(),
  ]);
  return [...zenn, ...qiita, ...prtimes].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

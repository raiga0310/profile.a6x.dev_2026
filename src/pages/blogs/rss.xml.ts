import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', p => !p.data.draft);
  posts.sort(
    (a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime(),
  );

  return rss({
    title: 'Blog | a6x.dev',
    description: 'raigaのブログ記事',
    site: context.site!,
    items: posts.map(p => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: new Date(p.data.publishedAt),
      link: `/blogs/posts/${p.id.replace(/\.md$/, '')}`,
      categories: p.data.tags,
    })),
  });
}

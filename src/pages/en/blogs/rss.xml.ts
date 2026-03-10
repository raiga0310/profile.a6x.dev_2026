import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { isLocale, toSlug } from '../../../i18n';

export async function GET(context: APIContext) {
  const posts = await getCollection('posts', p => !p.data.draft && isLocale(p.id, 'en'));
  posts.sort(
    (a, b) => new Date(b.data.publishedAt).getTime() - new Date(a.data.publishedAt).getTime(),
  );

  return rss({
    title: 'Blog | a6x.dev',
    description: 'Blog posts by raiga',
    site: context.site!,
    items: posts.map(p => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: new Date(p.data.publishedAt),
      link: `/en/blogs/posts/${toSlug(p.id)}`,
      categories: p.data.tags,
    })),
  });
}

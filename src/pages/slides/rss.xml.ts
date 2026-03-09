import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const slides = await getCollection('slides');
  slides.sort(
    (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime(),
  );

  return rss({
    title: 'Slides | a6x.dev',
    description: 'raigaの登壇スライド',
    site: context.site!,
    items: slides.map(s => ({
      title: s.data.title,
      description: s.data.description ?? s.data.event,
      pubDate: new Date(s.data.date),
      link: `/slides/${s.id.replace(/\.md$/, '')}`,
      categories: s.data.tags,
    })),
  });
}

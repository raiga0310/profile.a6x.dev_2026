import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { isLocale, toSlug } from '../../../i18n';

export async function GET(context: APIContext) {
  const slides = await getCollection('slides', s => isLocale(s.id, 'en'));
  slides.sort(
    (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime(),
  );

  return rss({
    title: 'Slides | a6x.dev',
    description: 'Slides by raiga',
    site: context.site!,
    items: slides.map(s => ({
      title: s.data.title,
      description: s.data.description ?? s.data.event,
      pubDate: new Date(s.data.date),
      link: `/en/slides/${toSlug(s.id)}`,
      categories: s.data.tags,
    })),
  });
}

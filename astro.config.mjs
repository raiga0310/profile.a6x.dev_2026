// @ts-check
import { defineConfig } from 'astro/config';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeTypstDiagrams from './scripts/rehype-typst-diagrams.mjs';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://profile.a6x.dev',
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
  markdown: {
    rehypePlugins: [
      rehypeTypstDiagrams,
      rehypeSlug,
      [rehypeAutolinkHeadings, {
        behavior: 'append',
        properties: {
          className: ['heading-anchor'],
          ariaHidden: 'true',
          tabIndex: -1,
        },
        content: { type: 'text', value: '#' },
      }],
    ],
  },
  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});

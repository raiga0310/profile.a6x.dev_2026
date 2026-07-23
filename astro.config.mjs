// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
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
    // Astro 7 defaults to the Satteri processor, which doesn't support
    // remark/rehype plugins. Opt back into the unified/remark pipeline
    // since rehypeTypstDiagrams and the heading-anchor plugins below depend on it.
    processor: unified({
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
    }),
  },
  i18n: {
    defaultLocale: 'ja',
    locales: ['ja', 'en'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});

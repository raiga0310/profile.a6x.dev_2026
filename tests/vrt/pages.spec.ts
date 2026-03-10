import { test } from '@playwright/test';
import { argosScreenshot } from '@argos-ci/playwright';

const pages = [
  { name: 'home-ja',           path: '/' },
  { name: 'home-en',           path: '/en/' },
  { name: 'blogs-ja',          path: '/blogs/' },
  { name: 'blogs-en',          path: '/en/blogs/' },
  { name: 'slides-ja',         path: '/slides/' },
  { name: 'slides-en',         path: '/en/slides/' },
  { name: 'products-ja',       path: '/products/' },
  { name: 'products-en',       path: '/en/products/' },
  { name: 'post-this-site',    path: '/blogs/posts/this-site' },
  { name: 'slide-yoyakugo',    path: '/slides/yoyakugo' },
  { name: 'product-gc',        path: '/products/garbage-collector' },
  { name: '404',               path: '/this-page-does-not-exist' },
];

const themes = ['light', 'dark'] as const;

for (const { name, path } of pages) {
  for (const theme of themes) {
    test(`${name} (${theme})`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await argosScreenshot(page, `${name}-${theme}`);
    });
  }
}

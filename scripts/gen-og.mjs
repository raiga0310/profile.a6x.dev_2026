#!/usr/bin/env node
/**
 * Generate per-page OG images using Typst.
 * Reads all content from src/content/{slides,posts,products}/
 * and outputs PNG files to public/og/{collection}/{slug}.png
 *
 * Usage: node scripts/gen-og.mjs
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// cwd を ROOT に設定しているため、すべてのパスは ROOT からの相対パスで統一
const TYPST_TEMPLATE = 'typst/og_images/og-page.typ';
const TYPST_LANDING = 'typst/og_images/og.typ';
const FONT_PATH = 'typst/fonts';

/** Parse YAML-ish frontmatter (simple key: value only, no nested/arrays) */
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split('\n')) {
    // key: "quoted value"
    const quoted = line.match(/^(\w+):\s*"((?:[^"\\]|\\.)*)"$/);
    if (quoted) {
      result[quoted[1]] = quoted[2].replace(/\\"/g, '"');
      continue;
    }
    // key: unquoted value
    const plain = line.match(/^(\w+):\s*(.+)$/);
    if (plain) {
      result[plain[1]] = plain[2].trim();
    }
  }
  return result;
}

function compileOg({ title, description, kind, outputPath }) {
  mkdirSync(dirname(outputPath), { recursive: true });

  const result = spawnSync(
    'typst',
    [
      'compile',
      '--format', 'png',
      '--ppi', '72',
      '--font-path', FONT_PATH,
      '--input', `title=${title}`,
      '--input', `description=${description}`,
      '--input', `kind=${kind}`,
      TYPST_TEMPLATE,
      outputPath,
    ],
    { stdio: 'inherit', cwd: ROOT },
  );

  if (result.status !== 0) {
    console.error(`  ✗ Failed: ${outputPath}`);
    process.exit(1);
  }
}

const collections = [
  {
    name: 'slides',
    kind: 'Slide',
    dir: join(ROOT, 'src/content/slides'),
    getDescription: fm => fm.event || fm.description || '',
  },
  {
    name: 'posts',
    kind: 'Blog',
    dir: join(ROOT, 'src/content/posts'),
    getDescription: fm => fm.description || '',
  },
  {
    name: 'products',
    kind: 'Product',
    dir: join(ROOT, 'src/content/products'),
    getDescription: fm => fm.description || '',
  },
];

// Landing ページ用 OG 画像（og.typ はパラメータなしで raiga0310 固定デザイン）
console.log('  landing/index');
mkdirSync(join(ROOT, 'public/og'), { recursive: true });
const landingResult = spawnSync(
  'typst',
  ['compile', '--format', 'png', '--ppi', '72', '--font-path', FONT_PATH,
   TYPST_LANDING, join(ROOT, 'public/og/index.png')],
  { stdio: 'inherit', cwd: ROOT },
);
if (landingResult.status !== 0) {
  console.error('  ✗ Failed: public/og/index.png');
  process.exit(1);
}

let total = 1;
for (const col of collections) {
  if (!existsSync(col.dir)) continue;

  const files = readdirSync(col.dir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const content = readFileSync(join(col.dir, file), 'utf-8');
    const fm = parseFrontmatter(content);

    if (fm.draft === 'true') continue;

    const slug = file.replace(/\.md$/, '');
    const title = fm.title || slug;
    const description = col.getDescription(fm);
    const outputPath = join(ROOT, `public/og/${col.name}/${slug}.png`);

    console.log(`  ${col.name}/${slug}`);
    compileOg({ title, description, kind: col.kind, outputPath });
    total++;
  }
}

console.log(`\nGenerated ${total} OG image(s).`);

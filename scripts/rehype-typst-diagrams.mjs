import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = process.cwd();
const TYPST_BIN = process.platform === 'win32' ? 'typst.exe' : 'typst';
const FONT_PATH = path.join(PROJECT_ROOT, 'typst', 'fonts');
const PUBLIC_OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'generated', 'typst-diagrams');
const HASH_VERSION = 'typst-diagram-v1';
const compileCache = new Map();

function hasTypstClass(node) {
  const className = node?.properties?.className;
  if (Array.isArray(className)) {
    return className.includes('language-typst');
  }
  if (typeof className === 'string') {
    return className.split(/\s+/).includes('language-typst');
  }
  return false;
}

function isTypstPre(node) {
  const language = node?.properties?.dataLanguage ?? node?.properties?.['data-language'];
  return language === 'typst';
}

function textContent(node) {
  if (!node) {
    return '';
  }
  if (node.type === 'text') {
    return node.value ?? '';
  }
  if (!Array.isArray(node.children)) {
    return '';
  }
  return node.children.map(textContent).join('');
}

function getSourceFilePath(file) {
  const candidate = file?.path ?? file?.history?.[0];
  if (typeof candidate !== 'string' || candidate.length === 0) {
    return path.join(PROJECT_ROOT, 'src', 'content', 'unknown.md');
  }
  return path.isAbsolute(candidate) ? candidate : path.resolve(PROJECT_ROOT, candidate);
}

function getHash(source, sourceFilePath) {
  const relativeSourceDir = path.relative(PROJECT_ROOT, path.dirname(sourceFilePath));
  return createHash('sha256')
    .update(HASH_VERSION)
    .update('\0')
    .update(relativeSourceDir)
    .update('\0')
    .update(source.trim())
    .digest('hex')
    .slice(0, 16);
}

function buildTypstSource(source) {
  return [
    '#set page(width: auto, height: auto, margin: 12pt, fill: rgb("#ffffff"))',
    '#set text(font: "HackGen Console", size: 10pt, fill: rgb("#1a1a1a"))',
    '#set par(justify: false)',
    '',
    source.trim(),
    '',
  ].join('\n');
}

async function exists(filepath) {
  try {
    await stat(filepath);
    return true;
  } catch {
    return false;
  }
}

function extractViewBoxDimensions(svgSource) {
  const match = svgSource.match(/viewBox="[^"]*?(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)"/i);
  if (!match) {
    return null;
  }

  const width = Math.round(Number(match[3]));
  const height = Math.round(Number(match[4]));
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

function convertLengthToPx(value) {
  const match = value.match(/^(\d+(?:\.\d+)?)(px|pt|cm|mm|in)?$/i);
  if (!match) {
    return null;
  }

  const size = Number(match[1]);
  const unit = (match[2] ?? 'px').toLowerCase();
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }

  const multiplier = {
    px: 1,
    pt: 96 / 72,
    cm: 96 / 2.54,
    mm: 96 / 25.4,
    in: 96,
  }[unit];

  if (!multiplier) {
    return null;
  }

  return Math.round(size * multiplier);
}

function extractSvgDimensions(svgSource) {
  return extractViewBoxDimensions(svgSource)
    ?? (() => {
      const widthMatch = svgSource.match(/\bwidth="([^"]+)"/i);
      const heightMatch = svgSource.match(/\bheight="([^"]+)"/i);
      if (!widthMatch || !heightMatch) {
        return null;
      }

      const width = convertLengthToPx(widthMatch[1]);
      const height = convertLengthToPx(heightMatch[1]);
      if (!width || !height) {
        return null;
      }

      return { width, height };
    })();
}

function createFigureNode({ publicPath, dimensions }) {
  const imageProperties = {
    className: ['typst-diagram__image'],
    src: publicPath,
    alt: 'Typst diagram',
    loading: 'lazy',
    decoding: 'async',
  };

  if (dimensions) {
    imageProperties.width = dimensions.width;
    imageProperties.height = dimensions.height;
  }

  return {
    type: 'element',
    tagName: 'figure',
    properties: {
      className: ['typst-diagram'],
      'data-diagram-type': 'typst',
    },
    children: [
      {
        type: 'element',
        tagName: 'img',
        properties: imageProperties,
        children: [],
      },
    ],
  };
}

async function compileTypstDiagram(source, file) {
  const sourceFilePath = getSourceFilePath(file);
  const relativeSourcePath = path.relative(PROJECT_ROOT, sourceFilePath);
  const hash = getHash(source, sourceFilePath);
  const outputPath = path.join(PUBLIC_OUTPUT_DIR, `${hash}.svg`);
  const publicPath = `/generated/typst-diagrams/${hash}.svg`;

  if (!compileCache.has(hash)) {
    compileCache.set(hash, (async () => {
      await mkdir(PUBLIC_OUTPUT_DIR, { recursive: true });

      if (!(await exists(outputPath))) {
        const tempSourcePath = path.join(
          path.dirname(sourceFilePath),
          `__typst-diagram-${hash}.typ`,
        );
        const compiledSource = buildTypstSource(source);

        try {
          await writeFile(tempSourcePath, compiledSource, 'utf8');
          await execFileAsync(
            TYPST_BIN,
            ['compile', '--format', 'svg', '--font-path', FONT_PATH, tempSourcePath, outputPath],
            {
              cwd: PROJECT_ROOT,
              maxBuffer: 10 * 1024 * 1024,
            },
          );
        } catch (error) {
          const detail = [error?.stderr, error?.stdout, error?.message]
            .filter(Boolean)
            .join('\n')
            .trim();
          throw new Error(
            `Typst diagram compilation failed for ${relativeSourcePath}${detail ? `\n${detail}` : ''}`,
          );
        } finally {
          await unlink(tempSourcePath).catch(() => {});
        }
      }

      const svgSource = await readFile(outputPath, 'utf8');
      return {
        publicPath,
        dimensions: extractSvgDimensions(svgSource),
      };
    })());
  }

  return compileCache.get(hash);
}

async function transform(node, file) {
  if (!Array.isArray(node.children)) {
    return;
  }

  const transformedChildren = [];

  for (const child of node.children) {
    if (child?.type === 'element' && child.tagName === 'pre') {
      let source = null;

      if (isTypstPre(child)) {
        source = textContent(child);
      } else if (Array.isArray(child.children) && child.children.length === 1) {
        const code = child.children[0];
        if (code?.type === 'element' && code.tagName === 'code' && hasTypstClass(code)) {
          source = textContent(code);
        }
      }

      if (source != null) {
        const compiled = await compileTypstDiagram(source, file);
        transformedChildren.push(createFigureNode(compiled));
        continue;
      }
    }

    await transform(child, file);
    transformedChildren.push(child);
  }

  node.children = transformedChildren;
}

export default function rehypeTypstDiagrams() {
  return async function transformer(tree, file) {
    await transform(tree, file);
  };
}

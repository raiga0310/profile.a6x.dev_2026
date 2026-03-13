import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const products = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/products' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string().optional(),
    tags: z.array(z.string()).default([]),
    url: z.string().optional(),
    github: z.string().optional(),
    thumbnail: z.string().optional(),
    featured: z.boolean().default(false),
  }),
});

const slides = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/slides' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    event: z.string().optional(),
    description: z.string().optional(),
    pdf: z.string(),
    tags: z.array(z.string()).default([]),
    speakerdeck: z.string().optional(),
  }),
});

const aiLevel = z.enum(['none', 'human', 'ai']).default('none');

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    publishedAt: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    aiInvolvement: z.object({
      planning: aiLevel,
      writing: aiLevel,
      review: aiLevel,
      proofreading: aiLevel,
    }).optional(),
  }),
});

export const collections = { products, slides, posts };

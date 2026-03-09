import { defineCollection, z } from 'astro:content';

const products = defineCollection({
  type: 'content',
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
  type: 'content',
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

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    publishedAt: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { products, slides, posts };

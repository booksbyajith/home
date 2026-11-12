import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const l10n = z.object({ si: z.string(), en: z.string() });
const lang = z.enum(['si', 'en']);

const bookFacts = defineCollection({
  loader: glob({
    pattern: 'books/*/book.yaml',
    base: './src/content',
    generateId: ({ data }) => String(data.slug),
  }),
  schema: z.object({
    slug: z.string(),
    order: z.number(),
    featured: z.boolean().default(false),
    title: l10n,
    subtitle: l10n.optional(),
    originalLanguage: lang,
    publisher: z.string().optional(),
    isbn: z.string().optional(),
    pages: z.number().optional(),
    binding: l10n.optional(),
    firstPublished: z.string().optional(),
    publishedPlace: l10n.optional(),
    launch: z.object({ date: z.coerce.date(), venue: l10n }).optional(),
    awards: z.array(l10n).default([]),
    covers: z.array(z.object({ file: z.string(), kind: z.enum(['front', 'back', 'inner']), alt: l10n })),
    samples: z.array(z.object({ file: z.string(), alt: l10n })).default([]),
    defaults: z.object({
      priceLKR: z.number().int().min(0),
      saleMode: z.enum(['direct', 'external', 'unavailable']),
      externalUrl: z.url().optional(),
      stock: z.number().int().min(0),
      inStock: z.boolean(),
      preorder: z.boolean().default(false),
      signedCopyAvailable: z.boolean().default(false),
    }),
  }),
});

const bookText = defineCollection({
  loader: glob({ pattern: 'books/*/{si,en}.md', base: './src/content' }),
  schema: z.object({ summary: z.string().max(200) }),
});

const postSchema = z.object({
  title: z.string(),
  description: z.string().max(200),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  cover: z.string().optional(),
  coverAlt: z.string().optional(),
  translationKey: z.string().optional(),
  draft: z.boolean().default(false),
});

const blog = defineCollection({
  loader: glob({ pattern: '{si,en}/*.{md,mdx}', base: './src/content/blog' }),
  schema: postSchema,
});
const news = defineCollection({
  loader: glob({ pattern: '{si,en}/*.{md,mdx}', base: './src/content/news' }),
  schema: postSchema,
});

const press = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/press' }),
  schema: z.object({
    outlet: z.string(),
    title: z.string(),
    url: z.url(),
    date: z.coerce.date(),
    language: z.enum(['si', 'en', 'ta']),
    bookSlug: z.string().optional(),
    excerpt: l10n.optional(),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/events' }),
  schema: z.object({
    title: l10n,
    type: z.enum(['launch', 'talk', 'other']),
    start: z.coerce.date(),
    end: z.coerce.date().optional(),
    venue: l10n,
    city: l10n,
    description: l10n.optional(),
    url: z.url().optional(),
    bookSlug: z.string().optional(),
  }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/testimonials' }),
  schema: z.object({
    bookSlug: z.string().optional(),
    quote: l10n,
    author: z.string(),
    role: l10n.optional(),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: '{si,en}/*.md', base: './src/content/faq' }),
  schema: z.object({
    question: z.string(),
    order: z.number(),
    category: z.enum(['payment', 'delivery', 'returns', 'bulk', 'general']),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '{si,en}/*.md', base: './src/content/pages' }),
  schema: z.object({ title: z.string(), description: z.string(), updated: z.coerce.date() }),
});

export const collections = { bookFacts, bookText, blog, news, press, events, testimonials, faq, pages };

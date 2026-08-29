import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
// Not `z` from 'astro:content', which is deprecated — and not 'astro:schema'
// either, which is deprecated as well and slated for removal in a future major.
// `astro/zod` is what both of those re-export.
import { z } from 'astro/zod';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    group: z.string(),
    order: z.number().default(0),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { docs };

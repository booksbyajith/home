import { z } from 'zod';

/** Email address check, kept apart from schemas.ts so light forms don't load the phone rules. */
export const emailSchema = z.string().trim().toLowerCase().max(120).pipe(z.email());

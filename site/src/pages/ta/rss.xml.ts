import type { APIRoute } from 'astro';
import { feed } from '../../lib/rss';

export const GET: APIRoute = () => feed('ta');

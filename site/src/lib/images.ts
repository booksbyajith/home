import manifest from '../generated/images.json';
import { asset } from './paths';

type Entry = { width: number; height: number; variants: number[] };
const m = manifest as Record<string, Entry>;

/** Responsive sources for an image under site/public (e.g. "/covers/x-front.jpg"). */
export function img(publicPath: string) {
  const e = m[publicPath];
  const src = asset(publicPath);
  if (!e) return { src, width: 1200, height: 1800, srcset: undefined as string | undefined };
  const webp = e.variants.map((w) => `${asset(publicPath.replace(/\.[a-z]+$/i, `-${w}.webp`).replace(/^\//, '/_gen/'))} ${w}w`);
  return { src, width: e.width, height: e.height, srcset: webp.length ? webp.join(', ') : undefined };
}

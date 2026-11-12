import manifest from '../generated/images.json';
import { asset } from './paths';

type Entry = { width: number; height: number; variants: number[] };
const m = manifest as Record<string, Entry>;

/** Responsive sources for an image under site/public (e.g. "/covers/x-front.jpg"). */
export function img(publicPath: string) {
  const e = m[publicPath];
  const src = asset(publicPath);
  if (!e)
    return {
      src,
      width: 1200,
      height: 1800,
      srcset: undefined as string | undefined,
      avifSrcset: undefined as string | undefined,
    };
  const set = (ext: string) =>
    e.variants
      .map((w) => `${asset(publicPath.replace(/\.[a-z]+$/i, `-${w}.${ext}`).replace(/^\//, '/_gen/'))} ${w}w`)
      .join(', ') || undefined;
  return { src, width: e.width, height: e.height, srcset: set('webp'), avifSrcset: set('avif') };
}

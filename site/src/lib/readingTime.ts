/** Minutes to read: whitespace-separated words / 180, minimum 1. */
export function readingTime(text: string): number {
  const words = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>[\]()-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

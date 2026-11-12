export function buildSearchTokens(
  orderId: string,
  customer: { name: string; mobile: string; whatsapp: string },
): string[] {
  const tokens = new Set<string>([orderId, orderId.toLowerCase()]);
  for (const p of [customer.mobile, customer.whatsapp]) {
    if (!p) continue;
    tokens.add(p);
    tokens.add(p.slice(-4));
    if (p.startsWith('94')) tokens.add('0' + p.slice(2));
  }
  for (const w of customer.name.toLowerCase().split(/\s+/)) if (w.length >= 2) tokens.add(w);
  return [...tokens].slice(0, 30);
}

export function normaliseSearchQuery(q: string): string {
  const t = q.trim();
  if (/^aj-/i.test(t)) return t.toUpperCase();
  const digits = t.replace(/[\s\-+]/g, '');
  if (/^\d{4,}$/.test(digits)) return digits.startsWith('0') && digits.length === 10 ? '94' + digits.slice(1) : digits;
  return t.toLowerCase();
}

export function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Single-column, mobile-friendly email shell with inline CSS and system fonts. */
export function layout(lang: 'si' | 'en' | 'ta', title: string, body: string, footer: string): string {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f8f3e7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f3e7;"><tr><td align="center" style="padding:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dccfb4;border-radius:8px;">
<tr><td style="padding:20px 24px;font-family:'Noto Sans Sinhala','Iskoola Pota',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:16px;line-height:1.7;color:#1f1b16;">
<h1 style="margin:0 0 12px;font-size:20px;color:#7a1f1f;">${esc(title)}</h1>
${body}
<p style="margin:24px 0 0;font-size:13px;color:#5c5246;">${footer}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function table(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0;font-size:15px;">${rows
    .map(
      ([k, v]) =>
        `<tr><td style="border-bottom:1px solid #eee;color:#5c5246;vertical-align:top;width:40%;">${esc(k)}</td><td style="border-bottom:1px solid #eee;vertical-align:top;">${v}</td></tr>`,
    )
    .join('')}</table>`;
}

export function button(href: string, label: string): string {
  return `<p style="margin:16px 0;"><a href="${esc(href)}" style="display:inline-block;background:#7a1f1f;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;">${esc(label)}</a></p>`;
}

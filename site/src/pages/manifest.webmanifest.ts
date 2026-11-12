import type { APIRoute } from 'astro';
import { asset } from '../lib/paths';

export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        name: 'වෛද්‍ය අජිත් අමරසිංහ — පොත්',
        short_name: 'අජිත් අමරසිංහ',
        description: 'Books on the history of Sri Lanka by Dr. Ajith Amarasinghe',
        lang: 'si',
        start_url: asset('/'),
        scope: asset('/'),
        display: 'standalone',
        background_color: '#fbf7ef',
        theme_color: '#6f4626',
        icons: [
          { src: asset('/icons/icon-192.png'), sizes: '192x192', type: 'image/png' },
          { src: asset('/icons/icon-512.png'), sizes: '512x512', type: 'image/png' },
          {
            src: asset('/icons/icon-maskable-512.png'),
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      null,
      2,
    ),
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );

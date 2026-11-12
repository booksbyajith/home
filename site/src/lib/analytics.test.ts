import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = { analytics: { provider: 'goatcounter', src: '', endpoint: 'https://stats.example.com' } };
vi.stubGlobal('__PUBLIC_ENV__', env);
const fetchMock = vi.fn(async () => new Response(''));
vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('navigator', { doNotTrack: null });
vi.stubGlobal('document', { title: 'Order' });
vi.stubGlobal('location', { pathname: '/booksbyajith/track/', search: '?phone=0770000001', hash: '#AJ-2611-7K3Q', origin: 'https://x.example.com' });
const { trackPageView } = await import('./analytics');

describe('analytics beacon', () => {
  beforeEach(() => fetchMock.mockClear());
  it('GoatCounter: sends only the pathname to the configured endpoint', () => {
    trackPageView();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url.startsWith('https://stats.example.com/count?p=%2Fbooksbyajith%2Ftrack%2F&')).toBe(true);
    expect(url).not.toContain('AJ-2611');
    expect(url).not.toContain('0770000001');
  });
  it('Plausible: posts the pathname only', () => {
    env.analytics = { provider: 'plausible', src: 'https://plausible.example.com/js/script.js', endpoint: 'books.example.com' };
    trackPageView();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://plausible.example.com/api/event');
    expect(JSON.parse(String(init.body))).toEqual({ n: 'pageview', u: 'https://x.example.com/booksbyajith/track/', d: 'books.example.com', r: null });
  });
  it('does nothing when off', () => {
    env.analytics = { provider: 'none', src: '', endpoint: '' };
    trackPageView();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

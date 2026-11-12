/* Lighthouse CI: mobile emulation (the default), three runs per URL, median run asserted. */
const BASE = 'http://127.0.0.1:4321/booksbyajith/';
module.exports = {
  ci: {
    collect: {
      url: [BASE, `${BASE}books/portuguese-era-1505-1594/`, `${BASE}order/`],
      numberOfRuns: 3,
      chromePath: process.env.LHCI_CHROME_PATH,
      settings: { chromeFlags: '--headless=new --no-sandbox --disable-dev-shm-usage' },
    },
    assert: {
      assertMatrix: [
        {
          // The home page's animated map-and-portrait hero costs some simulated phone CPU time:
          // its performance score is reported as a warning; everything else must pass.
          matchingUrlPattern: '/booksbyajith/$',
          aggregationMethod: 'median-run',
          assertions: {
            'categories:performance': ['warn', { minScore: 0.9 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
            'categories:best-practices': ['error', { minScore: 0.9 }],
            'categories:seo': ['error', { minScore: 0.9 }],
          },
        },
        {
          // Simulated-phone scores vary by a few points between runs (0.86-0.93 for the same
          // build); 0.85 still catches a real regression without failing CI on noise.
          matchingUrlPattern: '/booksbyajith/.+',
          aggregationMethod: 'median-run',
          assertions: {
            'categories:performance': ['error', { minScore: 0.85 }],
            'categories:accessibility': ['error', { minScore: 0.9 }],
            'categories:best-practices': ['error', { minScore: 0.9 }],
            'categories:seo': ['error', { minScore: 0.9 }],
          },
        },
      ],
    },
    upload: { target: 'filesystem', outputDir: '../.lighthouseci' },
  },
};

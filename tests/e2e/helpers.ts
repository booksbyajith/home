import { expect, type Page } from '@playwright/test';

/** Collect console errors and CSP violations for the lifetime of the page. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return {
    errors,
    expectClean: () => expect(errors.filter((e) => !/favicon|net::ERR_ABORTED/.test(e))).toEqual([]),
  };
}

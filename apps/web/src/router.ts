import { useEffect, useState } from 'react';

export const PAGES = ['home', 'compremedic', 'prescriptive', 'medictionary', 'signin', 'reset'] as const;
export type Page = (typeof PAGES)[number];

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function parse(): { page: Page; anchor?: string } {
  // Query params ride inside the hash, e.g. #reset?token=… from a password-reset email.
  const id = (location.hash || '#home').slice(1).split('?')[0];
  // "#features" is an in-page anchor on the home page, not its own route.
  if (id === 'features') return { page: 'home', anchor: 'features' };
  return { page: (PAGES as readonly string[]).includes(id) ? (id as Page) : 'home' };
}

/** Reads a query param from inside the hash, e.g. hashParam('token') for #reset?token=abc. */
export function hashParam(name: string): string | null {
  return new URLSearchParams(location.hash.split('?')[1] ?? '').get(name);
}

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

/** Minimal hash router, so deep links like /#prescriptive work without a server rewrite. */
export function useHashRoute(): Page {
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    addEventListener('hashchange', onChange);
    return () => removeEventListener('hashchange', onChange);
  }, []);

  useEffect(() => {
    if (route.anchor) requestAnimationFrame(() => scrollToId(route.anchor!));
    else scrollTo({ top: 0, behavior: 'auto' });
  }, [route]);

  return route.page;
}

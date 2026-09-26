import { useEffect, useState } from 'react';

export const PAGES = ['home', 'compremedic', 'prescriptive', 'medictionary', 'signin'] as const;
export type Page = (typeof PAGES)[number];

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function parse(): { page: Page; anchor?: string } {
  const id = (location.hash || '#home').slice(1);
  // "#features" is an in-page anchor on the home page, not its own route.
  if (id === 'features') return { page: 'home', anchor: 'features' };
  return { page: (PAGES as readonly string[]).includes(id) ? (id as Page) : 'home' };
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

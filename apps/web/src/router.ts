import { useEffect, useState } from 'react';

export const PAGES = ['home', 'compremedic', 'prescriptive', 'medictionary', 'signin'] as const;
export type Page = (typeof PAGES)[number];
type Route = { page: Page; anchor?: 'features' };

export const SITE_URL = import.meta.env.BASE_URL;
const ROUTE_EVENT = 'medify:navigate';
const STATE_KEY = 'medifyRoute';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isPage = (value: unknown): value is Page => (PAGES as readonly unknown[]).includes(value);

function readRoute(): Route {
  // Accept existing bookmarks once, then remove their fragment from the address.
  if (location.hash) {
    const id = location.hash.slice(1);
    if (id === 'features') return { page: 'home', anchor: 'features' };
    return { page: isPage(id) ? id : 'home' };
  }
  const saved = history.state?.[STATE_KEY];
  if (isPage(saved?.page)) {
    return { page: saved.page, ...(saved.page === 'home' && saved.anchor === 'features' ? { anchor: 'features' } : {}) };
  }
  return { page: 'home' };
}

function routeState(route: Route) {
  return { ...history.state, [STATE_KEY]: route };
}

/** Keep the visible URL fixed; browser history carries the selected page. */
export function navigate(page: Page) {
  const current = readRoute();
  const next = { page };
  if (current.page === page && !current.anchor) history.replaceState(routeState(next), '', SITE_URL);
  else history.pushState(routeState(next), '', SITE_URL);
  dispatchEvent(new Event(ROUTE_EVENT));
}

export function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

export function useRoute(): Page {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const onChange = () => {
      const next = readRoute();
      history.replaceState(routeState(next), '', SITE_URL);
      setRoute(next);
    };
    onChange();
    addEventListener('popstate', onChange);
    addEventListener('hashchange', onChange);
    addEventListener(ROUTE_EVENT, onChange);
    return () => {
      removeEventListener('popstate', onChange);
      removeEventListener('hashchange', onChange);
      removeEventListener(ROUTE_EVENT, onChange);
    };
  }, []);

  useEffect(() => {
    if (route.anchor) {
      const frame = requestAnimationFrame(() => scrollToId(route.anchor!));
      return () => cancelAnimationFrame(frame);
    }
    scrollTo({ top: 0, behavior: 'auto' });
  }, [route]);

  return route.page;
}

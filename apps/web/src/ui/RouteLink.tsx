import type { ComponentProps } from 'react';
import { navigate, SITE_URL, type Page } from '../router';

type Props = Omit<ComponentProps<'a'>, 'href'> & { to: Page };

/** Internal navigation without exposing a page name in the address bar. */
export function RouteLink({ to, onClick, children, ...props }: Props) {
  return (
    <a
      {...props}
      href={SITE_URL}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (props.target && props.target !== '_self') || props.download) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

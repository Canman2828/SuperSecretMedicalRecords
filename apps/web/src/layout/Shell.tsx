import { RouteLink } from '../ui/RouteLink';
import { useEffect, useState, type ReactNode } from 'react';
import type { Page } from '../router';
import { Brand, Icon } from '../ui/Icon';

const TOOLS = [
  { id: 'compremedic', label: 'Compremedic' },
  { id: 'prescriptive', label: 'Prescriptive' },
  { id: 'medictionary', label: 'Medictionary' },
] as const;

interface NavProps {
  page: Page;
  loggedIn: boolean;
  onSignOut: () => void;
}

export function Nav({ page, loggedIn, onSignOut }: NavProps) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [page]);

  return (
    <div className="nav-wrap wrap">
      <nav className="nav card" aria-label="Main">
        <Brand />
        <div className={`nav-links${open ? ' open' : ''}`} id="navLinks">
          {TOOLS.map((t) => (
            <RouteLink key={t.id} to={t.id} aria-current={page === t.id ? 'page' : undefined}>
              {t.label}
            </RouteLink>
          ))}
          {/* On narrow screens the sign-in button is hidden, so offer it inside the menu. */}
          {loggedIn ? (
            <button className="nav-account" onClick={onSignOut}>Sign out</button>
          ) : (
            <RouteLink className="nav-account" to="signin">Sign in</RouteLink>
          )}
        </div>
        {loggedIn ? (
          <button className="btn btn-neu btn-signin" onClick={onSignOut}>Sign out</button>
        ) : (
          <RouteLink className="btn btn-neu btn-signin" to="signin">Sign in</RouteLink>
        )}
        <button
          className="icon-btn menu-btn"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="navLinks"
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name="menu" />
        </button>
      </nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="wrap">
      <div className="foot card">
        <Brand />
        <div className="foot-bottom">
          <span>© 2026 medify.Rx. Hackathon prototype using synthetic data only.</span>
          <nav aria-label="Footer">
            {TOOLS.map((t) => (
              <RouteLink key={t.id} to={t.id}>{t.label}</RouteLink>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

/** Back link + orb + title block shared by the three tool pages. */
export function PageHead({ icon, goal, title, children }: { icon: 'scan' | 'tree' | 'book'; goal: string; title: string; children: ReactNode }) {
  return (
    <>
      <RouteLink className="crumb" to="home"><Icon name="arrow-left" size={18} />All features</RouteLink>
      <div className="page-head">
        <span className="orb"><Icon name={icon} /></span>
        <div>
          <span className="eyebrow">Goal · {goal}</span>
          <h1>{title}</h1>
        </div>
        <p>{children}</p>
      </div>
    </>
  );
}

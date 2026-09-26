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
            <a key={t.id} href={`#${t.id}`} aria-current={page === t.id ? 'page' : undefined}>
              {t.label}
            </a>
          ))}
          {/* On narrow screens the sign-in button is hidden, so offer it inside the menu. */}
          <a className="nav-account" href={loggedIn ? undefined : '#signin'} onClick={loggedIn ? onSignOut : undefined} role={loggedIn ? 'button' : undefined}>
            {loggedIn ? 'Sign out' : 'Sign in'}
          </a>
        </div>
        {loggedIn ? (
          <button className="btn btn-neu btn-signin" onClick={onSignOut}>Sign out</button>
        ) : (
          <a className="btn btn-neu btn-signin" href="#signin">Sign in</a>
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
        <div className="alert">
          <span className="icon-btn"><Icon name="siren" /></span>
          <div>
            <h4>In an emergency, call 911</h4>
            <p>
              If you think you are having a medical emergency, call 911 or your local emergency number right away.
              medify.Rx is a learning and discovery tool. It does not give professional medical advice, diagnosis or
              treatment. Always ask your doctor, pharmacist or another qualified health professional about your health
              and your medicines.
            </p>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 medify.Rx. Hackathon prototype using synthetic data only.</span>
          <nav aria-label="Footer">
            {TOOLS.map((t) => (
              <a key={t.id} href={`#${t.id}`}>{t.label}</a>
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
      <a className="crumb" href="#home"><Icon name="arrow-left" size={18} />All features</a>
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

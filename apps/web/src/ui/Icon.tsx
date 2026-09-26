import type { CSSProperties } from 'react';

// Icons and the logo are <symbol>s in the sprite inside index.html.

export type IconName =
  | 'arrow-down' | 'arrow-right' | 'arrow-left' | 'arrow-ne' | 'scan' | 'tree' | 'book' | 'camera'
  | 'upload' | 'lock' | 'play' | 'pause' | 'shield' | 'plus' | 'x' | 'check' | 'menu' | 'cube' | 'vr'
  | 'pace' | 'siren' | 'search' | 'volume' | 'key' | 'mail' | 'pill' | 'leaf'
  | 'chevron-down' | 'pointer' | 'file' | 'sparkle' | 'food' | 'star' | 'highfive';

export function Icon({ name, size, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return (
    <svg className="i" width={size} height={size} style={style} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}

export function Brand() {
  return (
    <a className="brand" href="#home" aria-label="medify.Rx home">
      <span className="brand-badge">
        <svg aria-hidden="true"><use href="#logo" /></svg>
      </span>
      <span className="brand-name">medify<b>.Rx</b></span>
    </a>
  );
}

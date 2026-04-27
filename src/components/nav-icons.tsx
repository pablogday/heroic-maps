/**
 * Shared icon set for site navigation. Same visual language across the
 * desktop user dropdown and the mobile merged menu — solid fill, 18×18
 * viewBox, currentColor for theming.
 */

const wrap = (children: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
    {children}
  </svg>
);

export function IconBrowse() {
  return wrap(
    <>
      <rect x="2" y="2" width="6" height="6" rx="1" />
      <rect x="10" y="2" width="6" height="6" rx="1" />
      <rect x="2" y="10" width="6" height="6" rx="1" />
      <rect x="10" y="10" width="6" height="6" rx="1" />
    </>
  );
}

export function IconFeed() {
  return wrap(
    <>
      <circle cx="3.5" cy="14.5" r="1.5" />
      <path d="M2 8 a8 8 0 0 1 8 8 h-2 a6 6 0 0 0 -6 -6 z" />
      <path d="M2 3 a13 13 0 0 1 13 13 h-2 a11 11 0 0 0 -11 -11 z" />
    </>
  );
}

export function IconStats() {
  return wrap(
    <>
      <rect x="2" y="10" width="3" height="6" rx="0.5" />
      <rect x="7.5" y="6" width="3" height="10" rx="0.5" />
      <rect x="13" y="2" width="3" height="14" rx="0.5" />
    </>
  );
}

export function IconLibrary() {
  return wrap(
    <path d="M9 16 C 4 12.5, 1.5 10, 1.5 6.5 C 1.5 4, 3.5 2, 6 2 C 7.5 2, 8.5 2.7, 9 3.5 C 9.5 2.7, 10.5 2, 12 2 C 14.5 2, 16.5 4, 16.5 6.5 C 16.5 10, 14 12.5, 9 16 Z" />
  );
}

export function IconUpload() {
  return wrap(
    <>
      <path d="M9 2 L4 7 L7.5 7 L7.5 11.5 L10.5 11.5 L10.5 7 L14 7 Z" />
      <rect x="3" y="13.5" width="12" height="2" rx="0.6" />
    </>
  );
}

export function IconSignOut() {
  return wrap(
    <>
      <path d="M3 2 L9 2 L9 4 L5 4 L5 14 L9 14 L9 16 L3 16 Z" />
      <path d="M11 5 L15 9 L11 13 L11 10.8 L7 10.8 L7 7.2 L11 7.2 Z" />
    </>
  );
}

export function IconHamburger() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M2 2 L16 2" />
        <path d="M2 7 L16 7" />
        <path d="M2 12 L16 12" />
      </g>
    </svg>
  );
}

export function HeroicMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="brass" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#e0b656" />
          <stop offset="1" stopColor="#8a6526" />
        </linearGradient>
      </defs>
      {/* shield */}
      <path
        d="M32 4 L58 12 V32 C58 46 46 56 32 60 C18 56 6 46 6 32 V12 Z"
        fill="url(#brass)"
        stroke="#3a2a14"
        strokeWidth="2"
      />
      {/* inner field */}
      <path
        d="M32 10 L52 16 V32 C52 43 42 51 32 54 C22 51 12 43 12 32 V16 Z"
        fill="#1a2342"
        stroke="#3a2a14"
        strokeWidth="1.5"
      />
      {/* sword */}
      <path
        d="M32 18 L32 44 M28 22 L36 22 M30 44 L34 44"
        stroke="#e0b656"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* star */}
      <circle cx="32" cy="38" r="2.4" fill="#e0b656" />
    </svg>
  );
}

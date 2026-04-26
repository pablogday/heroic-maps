type IconName =
  | "downloads"
  | "rating"
  | "size"
  | "difficulty"
  | "players"
  | "human"
  | "ai"
  | "teams"
  | "underground"
  | "calendar"
  | "link";

const PATHS: Record<IconName, React.ReactNode> = {
  downloads: (
    <>
      <path d="M8 1a.75.75 0 0 1 .75.75v6.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06l2.22 2.22V1.75A.75.75 0 0 1 8 1Z" />
      <path d="M2.75 12a.75.75 0 0 1 .75.75v.75a.75.75 0 0 0 .75.75h7.5a.75.75 0 0 0 .75-.75v-.75a.75.75 0 0 1 1.5 0v.75A2.25 2.25 0 0 1 11.75 15.75h-7.5A2.25 2.25 0 0 1 2 13.5v-.75A.75.75 0 0 1 2.75 12Z" />
    </>
  ),
  rating: (
    <path d="M8 1.5l1.93 4.05 4.45.5-3.3 3.04.92 4.41L8 11.27 4 13.5l.92-4.4-3.3-3.05 4.45-.5L8 1.5z" />
  ),
  size: (
    <>
      <path d="M2 2h5v1.5H3.5V7H2V2zm12 0v5h-1.5V3.5H9V2h5zM2 14V9h1.5v3.5H7V14H2zm12 0H9v-1.5h3.5V9H14v5z" />
    </>
  ),
  difficulty: (
    <>
      <path d="M8 1.5l6 3v3c0 3.5-2.5 6.5-6 7-3.5-.5-6-3.5-6-7v-3l6-3z" />
    </>
  ),
  players: (
    <>
      <path d="M5.5 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm5 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM1 13c0-2.21 2.015-4 4.5-4S10 10.79 10 13v1H1v-1zm9.5-4c-.46 0-.9.06-1.31.17C10.36 10.07 11 11.46 11 13v1h4v-1c0-2.21-2.015-4-4.5-4z" />
    </>
  ),
  human: (
    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 1.5c-2.76 0-5 1.79-5 4V14h10v-.5c0-2.21-2.24-4-5-4z" />
  ),
  ai: (
    <>
      <path d="M5 2h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9.5l-1.5 2-1.5-2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm.5 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    </>
  ),
  teams: (
    <path d="M3 4.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0zm6 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0zM1 11.5C1 9.567 2.567 8 4.5 8h1C7.433 8 9 9.567 9 11.5V13H1v-1.5zm6 0c0-.55.099-1.077.28-1.564.353-.279.79-.436 1.22-.436h1c1.933 0 3.5 1.567 3.5 3.5V13H7v-1.5z" />
  ),
  underground: (
    <>
      <path d="M2 4h12v2H2V4zm0 3h12v2H2V7zm0 3h12v2H2v-2z" />
    </>
  ),
  calendar: (
    <>
      <path d="M4 1.5a.5.5 0 0 1 .5.5v1h7V2a.5.5 0 0 1 1 0v1H14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h1.5V2a.5.5 0 0 1 .5-.5zM2 6v7h12V6H2z" />
    </>
  ),
  link: (
    <path d="M6.5 2.5a.5.5 0 0 1 0 1H4a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 4 12.5h6a1.5 1.5 0 0 0 1.5-1.5V8.5a.5.5 0 0 1 1 0V11a2.5 2.5 0 0 1-2.5 2.5H4A2.5 2.5 0 0 1 1.5 11V5A2.5 2.5 0 0 1 4 2.5h2.5zm3 0h4a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V4.207L8.354 9.354a.5.5 0 1 1-.708-.708L12.793 3.5H9.5a.5.5 0 0 1 0-1z" />
  ),
};

export function StatIcon({
  name,
  size = 14,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

export type { IconName };

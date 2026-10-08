import type { SVGProps } from "react";

const PATHS: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10",
  house: "M4 21V10.5L12 4l8 6.5V21H4ZM9.5 21v-6h5v6",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
  key: "M14.5 9.5a4.5 4.5 0 1 1-3.3-4.34M14.5 9.5 21 3M18 6l2 2M15.5 8.5 17.5 10.5",
  wrench: "M14.7 6.3a4 4 0 0 0 5 5L9 22l-3-3L16.7 8.3a4 4 0 0 0-2-2ZM3 21l1-1",
  inbox: "M3 13v6h18v-6M3 13l3-8h12l3 8M3 13h5l2 3h4l2-3h5",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 21h4",
  camera: "M4 8h3l2-3h6l2 3h3v12H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  check: "M5 12.5 10 17.5 19 7",
  x: "M6 6l12 12M18 6 6 18",
  alert: "M12 3 2 21h20L12 3ZM12 10v5M12 18.5v.5",
  user: "M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM4 21a8 8 0 0 1 16 0",
  users: "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 4.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-5-6.7",
  logout: "M10 4H5v16h5M14 8l5 4-5 4M19 12H9",
  plus: "M12 5v14M5 12h14",
  chevron: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  pin: "M12 21s-6-5.7-6-11a6 6 0 1 1 12 0c0 5.3-6 11-6 11ZM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  history: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2",
  photo: "M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M16 9h.01",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.5 10.6A3 3 0 0 0 13.4 13.5M9 5.3A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.8M6.2 6.5A17 17 0 0 0 2 12s4 7 10 7a9.5 9.5 0 0 0 4-.9",
  download: "M12 3v12M7 10l5 5 5-5M4 21h16",
  upload: "M12 21V9M7 14l5-5 5 5M4 3h16",
  edit: "M4 20h4l11-11-4-4L4 16v4ZM13 7l4 4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  grid: "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 1 1 8 0v4",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  thermo: "M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z",
  play: "M7 4l13 8-13 8V4Z",
  flag: "M5 21V4h12l-2 4 2 4H5",
  sparkle: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8v.5",
  briefcase: "M3 8h18v12H3zM9 8V5h6v3M3 13h18",
  euro: "M18 6a7 7 0 1 0 0 12M4 10h10M4 14h10",
  search: "M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM21 21l-5-5",
  send: "M22 2 11 13M22 2 15 22l-4-9-9-4 20-7Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  external: "M14 4h6v6M20 4l-9 9M19 14v6H5V6h6",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  leaf: "M4 20c0-9 5-14 16-16-1 11-6 16-16 16ZM4 20 14 10",
  truck: "M2 7h11v9H2zM13 11h5l3 3v2h-8zM6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  bed: "M3 18V8M3 12h18v6M21 18v-3M7 12V9h5v3",
  check2: "M20 6 9 17l-5-5",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.8,
  className,
  ...rest
}: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

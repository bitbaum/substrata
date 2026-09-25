import type { NavIcon as NavIconName } from '@/config/site-nav';

/**
 * Line icons for the shell, drawn here rather than pulled from an icon
 * package: nine glyphs do not justify a dependency, and a stroke that matches
 * the mark's weight keeps the chrome one drawing.
 */
const PATHS: Record<NavIconName | 'close' | 'collapse' | 'expand' | 'chevron', string> = {
  home: 'M4 11 12 4l8 7M6 9.5V20h12V9.5',
  explore: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z',
  markets: 'M4 20h16M6 16l4-5 3 3 5-7',
  science: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-9V3',
  careers: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  news: 'M5 4h11v16H6a1 1 0 0 1-1-1V4Zm11 5h3v10a1 1 0 0 1-1 1h-2M8 8h5M8 12h5M8 16h3',
  bottlenecks: 'M4 5h16M7 10h10M10 15h4M11 20h2',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6Zm6-2v14m6-12v14',
  more: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  collapse: 'M4 4h16v16H4zM9 4v16M15 9l-2.5 3 2.5 3',
  expand: 'M4 4h16v16H4zM9 4v16M13 9l2.5 3-2.5 3',
  chevron: 'M6 9l6 6 6-6',
};

export function NavIcon({
  name,
  className = 'h-5 w-5',
}: {
  name: keyof typeof PATHS;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

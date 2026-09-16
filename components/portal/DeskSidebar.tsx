import Link from 'next/link';

const ITEMS = [
  { href: '/account', label: 'Desk' },
  { href: '/chat', label: 'Ask' },
  { href: '/world', label: 'World' },
  { href: '/atlas', label: 'Atlas' },
  { href: '/events', label: 'News' },
  { href: '/changelog', label: 'Log' },
  { href: '/roadmap', label: 'Roadmap' },
] as const;

export function DeskSidebar({ currentPath }: { currentPath: string }) {
  const current = currentPath === '' ? '/' : `/${currentPath}`;
  return (
    <nav className="desk-sidebar" aria-label="Desk">
      <ul>
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={current === item.href ? 'page' : undefined}
              className="desk-sidebar-link"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

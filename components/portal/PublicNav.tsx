import Link from 'next/link';
import { PUBLIC_NAV, type NavLink } from '@/config/site-nav';

export function PublicNav({
  currentPath,
  extra = [],
}: {
  currentPath: string;
  extra?: readonly NavLink[];
}) {
  const current = currentPath === '' ? '/' : `/${currentPath}`;
  const items = [...extra, ...PUBLIC_NAV];
  return (
    <>
      <nav aria-label="Primary" className="public-nav">
        {PUBLIC_NAV.map((item) => {
          const active = current === item.href || current.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className="public-nav-link"
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <details className="public-nav-more">
        <summary>Menu</summary>
        <div className="public-nav-more-panel">
          <form action="/search" className="public-nav-search">
            <label className="sr-only" htmlFor="mobile-search">
              Search
            </label>
            <input id="mobile-search" name="q" type="search" placeholder="Search" maxLength={200} />
            <button type="submit">Go</button>
          </form>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={current === item.href ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </details>
    </>
  );
}

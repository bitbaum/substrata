import Link from 'next/link';
import { PUBLIC_NAV } from '@/config/site-nav';

export function PublicNav({ currentPath }: { currentPath: string }) {
  const current = currentPath === '' ? '/' : `/${currentPath}`;
  return (
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
  );
}

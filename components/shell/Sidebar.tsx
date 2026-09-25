'use client';

/**
 * The left panel, in two shapes from one list (config/site-nav.ts).
 *
 * Full (≥1024px, unless the reader collapsed it): five section headings, and
 * only the section holding the current page opens by itself. A reader who
 * opens or closes one is remembered (shell-state.ts). This is Loki's sidebar —
 * grouped, collapsible, collapse persisted — with its rule that the section
 * you are in is never hidden behind its own chevron.
 *
 * Rail (768–1023px always, and ≥1024px when collapsed): one button per
 * section, icon with its label underneath — a label, because a tablet has no
 * hover to reveal a tooltip. Each opens a flyout with the section's pages.
 * That is what replaced the tablet's old lone "MENU" in an empty header.
 */
import Link from 'next/link';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { HOME_LINK, NAV_SECTIONS, RESEARCH_NAV, currentHref, sectionFor } from '@/config/site-nav';
import { DetailsMenu } from '@/components/portal/DetailsMenu';
import { Mark } from '@/components/portal/Mark';
import { NavIcon } from './NavIcon';
import { railCollapsed, readSections, setRailCollapsed, writeSections } from './shell-state';

const RAIL_EVENT = 'substrata-rail';

function useRail(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(
    (notify) => {
      window.addEventListener(RAIL_EVENT, notify);
      return () => window.removeEventListener(RAIL_EVENT, notify);
    },
    railCollapsed,
    () => false,
  );
  const toggle = useCallback(() => {
    setRailCollapsed(!railCollapsed());
    window.dispatchEvent(new Event(RAIL_EVENT));
  }, []);
  return [collapsed, toggle];
}

export function Sidebar({ pathname, name }: { pathname: string; name: string }) {
  const [collapsed, toggleRail] = useRail();
  const here = currentHref(pathname, [HOME_LINK, ...RESEARCH_NAV]);
  const hereSection = sectionFor(pathname)?.id;
  // Server render and first paint: only the current section open. The stored
  // choice (null = never chosen) is merged after mount.
  const [open, setOpen] = useState<string[]>(hereSection ? [hereSection] : []);
  useEffect(() => {
    const stored = readSections();
    const base = stored === null ? [] : stored;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time read of a per-browser preference
    setOpen(hereSection && !base.includes(hereSection) ? [...base, hereSection] : base);
  }, [hereSection]);

  const toggle = (id: string) => {
    const next = open.includes(id) ? open.filter((s) => s !== id) : [...open, id];
    setOpen(next);
    writeSections(next);
  };

  const railLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <aside className="shell-sidebar" data-shell>
      <div className="shell-brand">
        <Link href={HOME_LINK.href} className="shell-brand-link" aria-label={`${name} home`}>
          <Mark className="h-7 w-7 shrink-0" />
          <span className="shell-brand-name">{name}</span>
        </Link>
      </div>

      <nav aria-label="Research" className="shell-nav-full">
        <Link
          href={HOME_LINK.href}
          className="shell-link shell-link-top"
          aria-current={here === HOME_LINK.href ? 'page' : undefined}
        >
          <NavIcon name="home" />
          {HOME_LINK.label}
        </Link>
        {NAV_SECTIONS.map((section) => {
          const isOpen = open.includes(section.id);
          return (
            <div key={section.id} className="shell-section">
              <button
                type="button"
                className="shell-section-toggle"
                aria-expanded={isOpen}
                aria-controls={`shell-section-${section.id}`}
                data-here={section.id === hereSection || undefined}
                title={section.question}
                onClick={() => toggle(section.id)}
              >
                <NavIcon name={section.icon} />
                <span className="flex-1">{section.label}</span>
                <NavIcon name="chevron" className="shell-chevron" />
              </button>
              <ul id={`shell-section-${section.id}`} hidden={!isOpen}>
                {section.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="shell-link shell-link-sub"
                      aria-current={here === item.href ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <nav aria-label="Research" className="shell-nav-rail">
        <Link
          href={HOME_LINK.href}
          className="shell-rail-item"
          aria-current={here === HOME_LINK.href ? 'page' : undefined}
        >
          <NavIcon name="home" />
          <span>{HOME_LINK.label}</span>
        </Link>
        {NAV_SECTIONS.map((section) => (
          <DetailsMenu key={section.id} className="shell-flyout">
            <summary
              className="shell-rail-item"
              data-here={section.id === hereSection || undefined}
            >
              <NavIcon name={section.icon} />
              <span>{section.label}</span>
            </summary>
            <div className="shell-flyout-panel">
              <p className="shell-flyout-title">{section.label}</p>
              <p className="shell-flyout-question">{section.question}</p>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="shell-row"
                  aria-current={here === item.href ? 'page' : undefined}
                >
                  <span className="shell-row-label">{item.label}</span>
                  <span className="shell-row-hint">{item.hint}</span>
                </Link>
              ))}
            </div>
          </DetailsMenu>
        ))}
      </nav>

      {/* At the foot of the panel, where it stays put in both shapes. */}
      <button
        type="button"
        className="shell-rail-toggle"
        onClick={toggleRail}
        aria-expanded={!collapsed}
        aria-label={railLabel}
        title={railLabel}
      >
        <NavIcon name={collapsed ? 'expand' : 'collapse'} />
      </button>
    </aside>
  );
}

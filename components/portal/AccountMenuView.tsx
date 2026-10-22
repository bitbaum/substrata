import Link from 'next/link';

import { continueWithOrangeCat, signOutOfSubstrata } from '@/lib/account-actions';
import { ACCOUNT_NAV } from '@/config/site-nav';
import { DetailsMenu } from './DetailsMenu';
import { ThemeToggle } from './ThemeToggle';

/** Who is reading, as far as the menu needs to know. */
export interface Reader {
  signedIn: boolean;
  name: string | null;
  image: string | null;
  reviewer: boolean;
  /** False when sign-in is not configured on this deployment. */
  authEnabled: boolean;
}

export const ANONYMOUS: Reader = {
  signedIn: false,
  name: null,
  image: null,
  reviewer: false,
  authEnabled: false,
};

/**
 * Everything personal, in one place: the desk, its settings, the reviewer
 * inbox, appearance, and signing in or out. These used to be rows in the
 * research sidebar (Desk, Inbox) or nowhere at all (Settings); they are about
 * the reader, not the research, so they live behind the reader's own avatar.
 *
 * Pure markup from a `Reader`: the server menu (AccountMenu) fills it from
 * the session, the browser menu (ClientAccountMenu) from /api/me.
 */
export function AccountMenuView({ reader }: { reader: Reader }) {
  if (!reader.signedIn) {
    return (
      <DetailsMenu className="account-menu">
        <summary className="account-menu-summary account-menu-signin">Sign in</summary>
        <div className="account-menu-panel">
          <p className="account-menu-label">Research desk</p>
          {reader.authEnabled ? (
            <form action={continueWithOrangeCat}>
              <button type="submit" className="account-menu-action">
                Continue with OrangeCat
              </button>
            </form>
          ) : (
            <p className="px-3 py-2 text-sm text-fg-tertiary">Sign-in is being configured.</p>
          )}
          <Link href={ACCOUNT_NAV.desk.href} className="account-menu-link">
            What the desk is
          </Link>
          <ThemeToggle />
        </div>
      </DetailsMenu>
    );
  }

  const name = reader.name ?? 'Account';
  const links = [
    ACCOUNT_NAV.desk,
    ACCOUNT_NAV.settings,
    ...(reader.reviewer ? [ACCOUNT_NAV.inbox] : []),
  ];

  return (
    <DetailsMenu className="account-menu">
      <summary className="account-menu-summary" aria-label={`Account menu for ${name}`}>
        {reader.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reader.image} alt="" className="account-avatar-image" width={36} height={36} />
        ) : (
          <span className="account-avatar" aria-hidden>
            {name.trim().slice(0, 1).toUpperCase()}
          </span>
        )}
      </summary>
      <div className="account-menu-panel">
        <p className="account-menu-label">{name}</p>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="account-menu-link">
            {link.label}
          </Link>
        ))}
        <ThemeToggle />
        <form action={signOutOfSubstrata}>
          <button type="submit" className="account-menu-action">
            Sign out
          </button>
        </form>
      </div>
    </DetailsMenu>
  );
}

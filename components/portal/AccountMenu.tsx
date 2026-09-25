import Link from 'next/link';
import { ACCOUNT_NAV } from '@/config/site-nav';
import { authEnabled, currentSession, isReviewer, signIn, signOut } from '@/lib/auth';
import { ThemeToggle } from './ThemeToggle';
import { DetailsMenu } from './DetailsMenu';

/**
 * Everything personal, in one place: the desk, its settings, the reviewer
 * inbox, appearance, and signing in or out. These used to be rows in the
 * research sidebar (Desk, Inbox) or nowhere at all (Settings); they are about
 * the reader, not the research, so they live behind the reader's own avatar.
 */
export async function AccountMenu() {
  const session = await currentSession();
  const name = session?.user?.name ?? session?.user?.email ?? 'Account';
  const image = session?.user?.image;
  const initial = name.trim().slice(0, 1).toUpperCase();

  if (!session?.actorId) {
    return (
      <DetailsMenu className="account-menu">
        <summary className="account-menu-summary account-menu-signin">Sign in</summary>
        <div className="account-menu-panel">
          <p className="account-menu-label">Research desk</p>
          {authEnabled ? (
            <form
              action={async () => {
                'use server';
                await signIn('orangecat', { redirectTo: '/account' });
              }}
            >
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

  const links = [
    ACCOUNT_NAV.desk,
    ACCOUNT_NAV.settings,
    ...(isReviewer(session.actorId) ? [ACCOUNT_NAV.inbox] : []),
  ];

  return (
    <DetailsMenu className="account-menu">
      <summary className="account-menu-summary" aria-label={`Account menu for ${name}`}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="account-avatar-image" width={36} height={36} />
        ) : (
          <span className="account-avatar" aria-hidden>
            {initial}
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
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button type="submit" className="account-menu-action">
            Sign out
          </button>
        </form>
      </div>
    </DetailsMenu>
  );
}

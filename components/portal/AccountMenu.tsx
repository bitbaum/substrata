import Link from 'next/link';
import { authEnabled, currentSession, signIn, signOut } from '@/lib/auth';
import { ThemeToggle } from './ThemeToggle';
import { DetailsMenu } from './DetailsMenu';

export async function AccountMenu() {
  const session = await currentSession();
  const name = session?.user?.name ?? session?.user?.email ?? 'Account';
  const image = session?.user?.image;
  const initial = name.trim().slice(0, 1).toUpperCase();

  if (!session?.actorId) {
    return (
      <DetailsMenu className="account-menu">
        <summary className="account-menu-summary" aria-label="Account">
          <span className="account-avatar" aria-hidden>
            ●
          </span>
        </summary>
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
          <Link href="/account" className="account-menu-link">
            What the desk is
          </Link>
          <ThemeToggle />
        </div>
      </DetailsMenu>
    );
  }

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
        <Link href="/account" className="account-menu-link">
          Desk
        </Link>
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

import './desk.css';
import './settings.css';

/** Loads the desk's stylesheet for /account and /account/settings; renders nothing of its own. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}

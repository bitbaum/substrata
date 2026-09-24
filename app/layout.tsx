import { DEFAULT_LOCALE, dirFor } from '@/lib/i18n/locales';
import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
// Feature stylesheets, split out of globals.css (which keeps tokens, base and
// site chrome). The order is the order they had inside globals.css, so the
// cascade is unchanged; keep it when adding one.
import './styles/world.css';
import './styles/search.css';
import './styles/research.css';
import './styles/atlas.css';
import './styles/ask.css';
import './styles/discussion.css';
import './styles/chat.css';
import './styles/notes.css';
import './styles/follow.css';
import './styles/figure.css';
import './styles/ticker.css';
import './styles/screen.css';
import { SITE } from '@/lib/site';
import { AskDock } from '@/components/portal/AskDock';

export const metadata: Metadata = {
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description:
    'Open-source research on the bottlenecks on the path to transformative technology: compute, energy, materials, actuation, talent, capital and permission.',
  metadataBase: new URL(`https://${SITE.host}`),
  // siteName and type alone render no og:title and no og:description, so a
  // shared link previewed with whatever the scraper could infer. Naming them
  // explicitly is the difference between a card and a bare URL.
  openGraph: {
    siteName: SITE.name,
    type: 'website',
    title: SITE.name,
    description:
      'Open-source research on the bottlenecks on the path to transformative technology: compute, energy, materials, actuation, talent, capital and permission.',
  },
  twitter: { card: 'summary_large_image', title: SITE.name },
};

/**
 * Substrata's root layout.
 *
 * Deliberately bare: no analytics, no third-party script, no widget, no
 * structured data belonging to anyone else. Everything that renders here is
 * Substrata's. That is not minimalism for its own sake — the previous version
 * of this site inherited another product's header, tracking and Organization
 * schema, and told crawlers it was a different company.
 */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem('substrata-theme')||'auto';var d=t==='dark'||(t==='auto'&&matchMedia('(prefers-color-scheme: dark)').matches);var mode=d?'dark':'light';document.documentElement.dataset.theme=mode;document.documentElement.style.colorScheme=mode;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The locale is fixed to the default until translations exist, but it is
    // read from one place and carries `dir`, so Arabic flips the layout rather
    // than only the text when it arrives.
    <html lang={DEFAULT_LOCALE} dir={dirFor(DEFAULT_LOCALE)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        {children}
        <AskDock />

        {/* The Loki feedback widget: point at what is wrong on the page,
            and an agent changes it. Env-gated, so a local run and a fork carry
            no widget — and if this site is ever handed to someone else, they
            unset one variable rather than editing code. */}
        {process.env.NEXT_PUBLIC_FC_WIDGET_TOKEN && (
          <Script
            src="https://loki.orangecat.ch/widget.js"
            strategy="afterInteractive"
            data-fc-project={process.env.NEXT_PUBLIC_FC_WIDGET_TOKEN}
          />
        )}
      </body>
    </html>
  );
}

import Link from 'next/link';
import { developmentProfile } from '@/lib/development';
import { Figure } from './Figure';
import { Page, Shell, SectionHeader } from './Shell';
export async function Development({
  view = 'development',
}: {
  view?: 'development' | 'roadmap' | 'changelog';
}) {
  const { profile: p, checkedAt, unavailable } = await developmentProfile();
  const title =
    view === 'roadmap'
      ? 'Roadmap'
      : view === 'changelog'
        ? 'Changelog'
        : 'Building Substrata in public';
  return (
    <Shell currentPath={view}>
      <Page>
        <SectionHeader
          title={title}
          lede="Purpose, plans and progress from Substrata’s development profile. The project is in beta and the work is ongoing."
        />
        <nav className="flex flex-wrap gap-5 text-sm text-accent" aria-label="Development">
          <Link href="/development">Vision & context</Link>
          <Link href="/roadmap">Roadmap</Link>
          <Link href="/changelog">Changelog</Link>
          <Link href="/notes">Development articles</Link>
        </nav>
        {unavailable ? (
          <p className="my-8">
            The development record is temporarily unavailable. Please retry shortly.
          </p>
        ) : !p ? (
          <p className="my-8">The development profile has not been linked yet.</p>
        ) : (
          <>
            {view === 'development' && (
              <div className="research-prose">
                <p>{p.what}</p>
                {Object.entries(p.identity).map(([key, value]) => (
                  <section key={key}>
                    <h2 className="capitalize">{key}</h2>
                    <p>{value || 'Not recorded yet.'}</p>
                  </section>
                ))}
                <h2>Technical context</h2>
                <p>{p.stack || 'Stack not recorded yet.'}</p>
                <p>
                  <a href="https://loki.orangecat.ch/fleet/substrata">Explore the Loki profile</a>
                  {p.urls.orangecat && (
                    <>
                      {' '}
                      · <a href={p.urls.orangecat}>OrangeCat profile</a>
                    </>
                  )}{' '}
                  ·{' '}
                  <a href="https://loki.orangecat.ch/loki?project=substrata">
                    Investigate with Loki
                  </a>
                </p>
              </div>
            )}
            {view === 'roadmap' && (
              <div className="research-prose">
                {p.roadmap.length === 0 ? (
                  <p>No roadmap items have been recorded yet.</p>
                ) : (
                  p.roadmap.map((r, i) => (
                    <section key={`${r.title}-${i}`}>
                      <h2>{r.title}</h2>
                      <p>
                        {r.status ?? 'Status not recorded'}
                        {r.targetDate && ` · target ${r.targetDate}`}
                        {r.progress !== null && (
                          <>
                            {' · '}
                            <Figure
                              source="https://loki.orangecat.ch/fleet/substrata"
                              sourceLabel="the Loki development profile"
                              {...(checkedAt ? { asOf: checkedAt.slice(0, 10) } : {})}
                            >
                              {r.progress}%
                            </Figure>{' '}
                            recorded progress
                          </>
                        )}
                      </p>
                      {r.milestones.length > 0 && (
                        <ul>
                          {r.milestones.map((m) => (
                            <li key={m}>{m}</li>
                          ))}
                        </ul>
                      )}
                    </section>
                  ))
                )}
              </div>
            )}
            {view === 'changelog' && (
              <div className="changelog-list">
                {p.changelog.length === 0 ? (
                  <p>No changes have been recorded yet.</p>
                ) : (
                  p.changelog.map((entry, i) => (
                    <article key={`${entry.date}-${i}`}>
                      <time dateTime={entry.date}>{entry.date}</time>
                      <p className="mt-2 max-w-prose whitespace-pre-wrap text-fg-secondary">
                        {entry.done}
                      </p>
                    </article>
                  ))
                )}
              </div>
            )}
          </>
        )}
        {checkedAt && (
          <p className="mt-8 text-xs text-fg-tertiary">
            Profile snapshot: {checkedAt}. Updates may take five minutes to appear.
          </p>
        )}
      </Page>
    </Shell>
  );
}

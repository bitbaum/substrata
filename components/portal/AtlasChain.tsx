import Link from 'next/link';
import { Figure } from './Figure';
import { TECHNOLOGIES } from '@/config/substrata-taxonomy';
import { STAGE_LABEL } from '@/config/substrata-stages';
import { atlasData } from '@/lib/atlas';
import { bottleneckHref, marketHref } from '@/lib/links';
import { BOTTLENECKS, type Bottleneck } from '@/lib/bottlenecks';

export function AtlasChain({ topic, chain }: { topic: string; chain: Bottleneck }) {
  const stages = atlasData(topic);
  const techs = TECHNOLOGIES.filter((t) => chain.technologies.includes(t.id));
  const listed = topic
    ? BOTTLENECKS.filter((b) => b.technologies.some((t) => t === topic))
    : BOTTLENECKS;
  return (
    <>
      <form action="/atlas" className="atlas-controls">
        <label>
          Technology
          <select name="topic" defaultValue={topic}>
            <option value="">All</option>
            {TECHNOLOGIES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bottleneck
          <select name="chain" defaultValue={chain.slug}>
            {listed.map((b) => (
              <option key={b.slug} value={b.slug}>
                {STAGE_LABEL[b.stage]} — {b.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="research-button">
          Show
        </button>
      </form>

      <div className="chain-board">
        <section>
          <h2>Who makes it, in this corpus</h2>
          {chain.producers.length === 0 ? (
            <p>No producer rows yet. That is a research gap.</p>
          ) : (
            <ul>
              {chain.producers.map((p) => (
                <li key={p.name}>
                  <Link href={marketHref(p.name)}>{p.name}</Link>
                  <small>{p.verification}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="chain-focus">
          <h2>The constraint</h2>
          <p className="chain-name">{chain.name}</p>
          <p>{chain.plain}</p>
          <p className="text-sm text-fg-tertiary">
            {chain.state} · severity <Figure method="severity">{chain.binding}/12</Figure>, judged{' '}
            {chain.judgedOn}
          </p>
          <p className="mt-4">
            <Link href={bottleneckHref(chain.slug)} className="research-button">
              Full evidence
            </Link>
          </p>
        </section>
        <section>
          <h2>What it gates</h2>
          <ul>
            {techs.map((t) => (
              <li key={t.id}>
                <Link href={`/atlas?topic=${t.id}`}>{t.name}</Link>
                <small>{t.detail}</small>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="atlas-caption">
        Lines here are coverage, not customer contracts. A sourced producer row means we have a
        document for that claim. Open the evidence.
      </p>

      <section className="atlas-index">
        <h2>All bottlenecks{topic ? ' in this technology' : ''}</h2>
        <ul>
          {listed.map((b) => (
            <li key={b.slug}>
              <Link href={`/atlas?${topic ? `topic=${topic}&` : ''}chain=${b.slug}`}>{b.name}</Link>
              <small>
                {STAGE_LABEL[b.stage]} · {b.state}
              </small>
            </li>
          ))}
        </ul>
      </section>

      <section className="atlas-coverage">
        <h2>Coverage by stage</h2>
        <ul>
          {stages.map((s) => (
            <li key={s.id}>
              <span>{s.name}</span>
              <span>
                <Figure method="stage-counts">{s.total}</Figure> mapped ·{' '}
                <Figure method="stage-counts">{s.sourced}</Figure> sourced
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

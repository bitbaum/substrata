import Link from 'next/link';

import type { CheckResult } from '@/lib/quality/types';
import { correctionUrl } from '@/lib/site';

const SHOWN = 12;

function Row({ label, f }: { label: string; f: CheckResult['failures'][number] }) {
  return (
    <li className="quality-failure">
      <span className="quality-row">{f.row}</span>
      <span className="quality-problem">{f.problem}</span>
      <span className="quality-links">
        {f.link && (
          <a href={f.link} rel="noopener noreferrer" target="_blank">
            Source
          </a>
        )}
        {f.page && <Link href={f.page}>On this site</Link>}
        <a
          href={correctionUrl(`${label}: ${f.row}`, { problem: f.problem, source: f.link })}
          rel="noopener noreferrer"
          target="_blank"
        >
          Report an error
        </a>
      </span>
    </li>
  );
}

/** Every failing row of one check, each with its source, its page and a way to report it. */
export function FailureList({ label, result }: { label: string; result: CheckResult }) {
  if (result.failures.length === 0) return null;
  const head = result.failures.slice(0, SHOWN);
  const rest = result.failures.slice(SHOWN);
  return (
    <div className="quality-check">
      <h4>
        {result.label} <span className="quality-count">{result.failures.length} failing</span>
      </h4>
      <ul>
        {head.map((f, i) => (
          <Row key={`${f.row}-${i}`} label={label} f={f} />
        ))}
      </ul>
      {rest.length > 0 && (
        <details>
          <summary>{rest.length} more</summary>
          <ul>
            {rest.map((f, i) => (
              <Row key={`${f.row}-${i}`} label={label} f={f} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

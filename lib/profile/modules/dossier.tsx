import { computeDossier, type Dossier } from '../../dossier/compute';
import { codeHref } from '../../methods';
import { correctionUrl } from '../../site';
import { t } from '../../i18n/messages';
import type { ProfileModule } from '../types';

// What the corpus knows about this entity, box by box, and what it does not.
// Computed from the rows (lib/dossier), never set by hand: the same rule
// behind the completeness table on /data/quality.

const STATUS_WORD = { full: 'Full', thin: 'Thin', empty: 'Empty' } as const;

const dossier: ProfileModule<Dossier> = {
  id: 'dossier',
  title: t('profile.dossier.title'),
  appliesTo: ['country'],
  importance: 86,
  load(entity) {
    return computeDossier(entity.id);
  },
  evidence: (d) =>
    `${d.tally.full} full · ${d.tally.thin} thin · ${d.tally.empty} empty, counted from stated rows`,
  Render({ data: d }) {
    return (
      <>
        <ul className="place-rows">
          {d.boxes.map((b) => (
            <li key={b.box} className="place-row">
              <span className="place-row-name">{b.label}</span>
              <p className="place-row-detail">
                {b.status === 'full'
                  ? `${b.counts.basis}.`
                  : `${b.counts.basis ? `${b.counts.basis}. ` : ''}Full needs ${b.fullMeans}.`}
              </p>
              <span className={`place-row-aside is-${b.status}`}>{STATUS_WORD[b.status]}</span>
            </li>
          ))}
        </ul>
        <p className="resource-source">
          Only stated rows count; candidate rows and rows worked out by a rule are shown elsewhere
          and never fill a box.{' '}
          <a href={codeHref('lib/dossier/README.md')} rel="noopener noreferrer">
            How each box is computed
          </a>{' '}
          ·{' '}
          <a href={correctionUrl(`the ${d.subject.name} dossier`)} rel="noopener noreferrer">
            Send a source for an empty box →
          </a>
        </p>
      </>
    );
  },
};

export { dossier };

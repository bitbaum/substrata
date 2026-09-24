import { GLOSSARY } from '@/config/substrata-glossary';
import { LEARNING_PATHS } from '@/lib/learning-paths';
import { allLearn } from '@/lib/notes';
import { learnHref } from '@/lib/links';
import { Rows } from '@/components/roles/RoleParts';
import { RoleSection } from '@/components/roles/RoleSection';
import { Paths } from '../../careers/_parts/Paths';
import { StartHere } from '../../_home/StartHere';

/** Plain words first, then a way to follow one thread, then a way in as a career. */
export function LearningView() {
  const explainers = allLearn();
  const start = explainers.filter((e) => e.tags.includes('start-here'));
  const ordered = [...start, ...explainers.filter((e) => !start.includes(e))].slice(0, 6);
  const paths = LEARNING_PATHS.filter((p) => p.careerChangers).slice(0, 4);

  return (
    <div className="role-grid">
      <RoleSection
        index="01"
        title="Explainers"
        why="A few minutes each, no prior knowledge needed. Start with the first."
        href="/learn"
        more={`All explainers and ${GLOSSARY.length} terms in plain words`}
      >
        <Rows
          rows={ordered.map((e) => ({
            key: e.slug,
            title: e.title,
            href: learnHref(e.slug),
            meta: `${e.readingMinutes} min · ${e.summary}`,
          }))}
          empty="No explainers yet."
        />
      </RoleSection>
      <RoleSection
        index="02"
        title="Follow one technology"
        why="Every bottleneck behind a technology or an industry, as a filtered list — the quickest way to see how one chain fits together."
        href="/atlas"
        more="Or trace a chain on the map"
      >
        <StartHere bare />
      </RoleSection>
      <RoleSection
        index="03"
        title="Retrain into these industries"
        why="Programmes that address career changers, from short technician courses to degrees, each checked on the provider’s own page."
        href="/careers/paths"
        more="Skills, and every training path"
        wide
      >
        <Paths paths={paths} />
      </RoleSection>
    </div>
  );
}

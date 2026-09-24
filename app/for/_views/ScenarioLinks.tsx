import { PRESETS } from '@/lib/scenario/presets';
import { parseTarget, scenarioHref } from '@/lib/scenario/target';
import { Rows } from '@/components/roles/RoleParts';

/** The corpus-backed scenario presets, each with the record that makes it live. */
export function ScenarioLinks({ limit }: { limit?: number }) {
  const rows = PRESETS.slice(0, limit).flatMap((p) => {
    const target = parseTarget(p.at);
    if (!target) return [];
    return [
      {
        key: p.id,
        title: p.title,
        href: scenarioHref({ at: target, only: p.only }),
        meta: p.basis.date ? `Basis: ${p.basis.label} (${p.basis.date})` : p.basis.label,
      },
    ];
  });
  return <Rows rows={rows} empty="No scenarios recorded yet." />;
}

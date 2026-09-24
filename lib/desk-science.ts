/**
 * Science-feed items as desk rows: a paper collected under two rails is one
 * row carrying both, dated by the source's own publication or award date.
 */
import type { DeskItem } from '@/lib/desk';
import { hostOf } from '@/lib/desk';
import { KIND_LABEL, titleKey } from '@/lib/science';
import type { StoredItem } from '@/lib/science-read';

export function scienceItems(items: readonly StoredItem[]): DeskItem[] {
  const byWork = new Map<string, Extract<DeskItem, { source: 'science' }>>();
  for (const item of items) {
    if (!item.publishedOn) continue;
    const key = titleKey(item.title);
    const seen = byWork.get(key);
    if (seen) {
      if (!seen.bottlenecks.includes(item.bottleneck)) seen.bottlenecks.push(item.bottleneck);
      continue;
    }
    byWork.set(key, {
      source: 'science',
      // Mark keys allow word characters, dots and dashes: "openalex:W1" → "openalex-W1".
      id: item.id.replace(/[^\w.-]/g, '-'),
      at: `${item.publishedOn}T12:00:00.000Z`,
      title: item.title,
      url: item.url,
      host: hostOf(item.url),
      bottlenecks: [item.bottleneck],
      effect: 'neutral',
      kind: KIND_LABEL[item.kind],
      dateOnly: true,
    });
  }
  return [...byWork.values()];
}

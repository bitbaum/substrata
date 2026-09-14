/**
 * The ladder: the loop's layers drawn to scale.
 *
 * One bar per layer, its length the log of one turn's period. Minutes to
 * years is six orders of magnitude, and the picture is the point: the eye
 * finds the jumps without reading a single paragraph. Each bar names what
 * it waits on, and each of those is a link to its row on the board.
 */

import React from 'react';
import Link from 'next/link';

import type { LoopLayer } from '@/config/substrata-programmes';
import { slugOf } from '@/lib/bottlenecks';

const MIN = 1.5;
const MAX = 8.5;

export function Ladder({ layers }: { layers: readonly LoopLayer[] }) {
  return (
    <ol className="divide-y divide-subtle border-y border-subtle">
      {layers.map((layer, index) => {
        const width = ((layer.magnitude - MIN) / (MAX - MIN)) * 100;
        return (
          <li
            key={layer.id}
            className="grid gap-x-6 gap-y-2 py-4 sm:grid-cols-[minmax(0,14rem)_1fr]"
          >
            <div>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-fg-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-medium text-fg-primary">{layer.name}</span>
              </div>
              <p className="mt-1 pl-7 text-sm text-fg-tertiary sm:pl-0 sm:pt-1">{layer.turn}</p>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-border-subtle">
                  <div
                    className="h-2 rounded-full bg-accent"
                    style={{ width: `${Math.max(4, Math.min(100, width))}%` }}
                  />
                </div>
                <span className="w-32 shrink-0 font-mono text-xs text-fg-secondary">
                  {layer.period}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-mono text-xs uppercase tracking-caps text-fg-muted">
                  waits on
                </span>
                {layer.gatedBy.map((name) => (
                  <Link
                    key={name}
                    href={`/bottlenecks/${slugOf(name)}`}
                    className="text-xs text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
                  >
                    {name}
                  </Link>
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

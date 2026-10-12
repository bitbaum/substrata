'use client';

/**
 * The lines of the route, drawn between the cards that are actually on
 * screen: one per dependency on record, from the input's right edge to the
 * left edge of the step that needs it. They flow — a moving dash from input
 * to output — so the direction reads without an arrow per column, and they
 * stand still for anyone who asked for reduced motion.
 *
 * Positions are measured from the DOM (one ResizeObserver on the flow), so
 * the diagram stays a list of accessible links and this is purely the drawing
 * on top. Hovering or focusing a card lights its own lines, in and out.
 */
import { useEffect, useRef, useState } from 'react';

const ROW_LAYOUT = '(min-width: 768px) and (max-width: 1023px), (min-width: 1280px)';

interface Line {
  from: string;
  to: string;
  d: string;
}

function centreOf(el: Element, host: DOMRect, side: 'left' | 'right' | 'top' | 'bottom') {
  const r = el.getBoundingClientRect();
  const x = side === 'left' ? r.left : side === 'right' ? r.right : r.left + r.width / 2;
  const y = side === 'top' ? r.top : side === 'bottom' ? r.bottom : r.top + r.height / 2;
  return { x: x - host.left, y: y - host.top };
}

function curve(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
}

export function ChainLinks({ edges }: { edges: [string, string][] }) {
  const svg = useRef<SVGSVGElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const el = svg.current;
    const flow = el?.parentElement;
    if (!el || !flow) return;

    function draw() {
      if (!flow) return;
      // Stacked (a phone, or 1024–1279px beside the panel), the flow has its
      // own arrows; nothing to draw. Same query as atlas-chain.css.
      if (!window.matchMedia(ROW_LAYOUT).matches) {
        setLines([]);
        return;
      }
      const host = flow.getBoundingClientRect();
      const card = (key: string) =>
        flow.querySelector<HTMLElement>(`[data-flow-node][data-key="${CSS.escape(key)}"]`);
      const next: Line[] = [];
      for (const [from, to] of edges) {
        const a = card(from);
        const b = card(to);
        if (!a || !b) continue;
        next.push({ from, to, d: curve(centreOf(a, host, 'right'), centreOf(b, host, 'left')) });
      }
      setSize({ w: host.width, h: host.height });
      setLines(next);
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(flow);
    for (const node of flow.querySelectorAll('[data-flow-node]')) ro.observe(node);
    window.addEventListener('resize', draw);

    const over = (e: Event) => {
      const node = (e.target as HTMLElement).closest<HTMLElement>('[data-flow-node]');
      setActive(node?.dataset.key ?? null);
    };
    const out = () => setActive(null);
    flow.addEventListener('pointerover', over);
    flow.addEventListener('focusin', over);
    flow.addEventListener('pointerleave', out);
    flow.addEventListener('focusout', out);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', draw);
      flow.removeEventListener('pointerover', over);
      flow.removeEventListener('focusin', over);
      flow.removeEventListener('pointerleave', out);
      flow.removeEventListener('focusout', out);
    };
  }, [edges]);

  return (
    <svg
      ref={svg}
      className="flow-links"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w || 1} ${size.h || 1}`}
      aria-hidden
      focusable="false"
    >
      {lines.map((line) => (
        <g
          key={`${line.from}>${line.to}`}
          data-active={active === line.from || active === line.to || undefined}
        >
          <path className="flow-link-track" d={line.d} />
          <path className="flow-link-flow" d={line.d} />
        </g>
      ))}
    </svg>
  );
}

'use client';

/**
 * The lines of the chain, drawn between the cards that are actually on
 * screen: each need into the bottleneck, each maker down into it, the
 * bottleneck out to each thing it holds up. They flow — a moving dash from
 * input to output — so the direction reads without an arrow per column, and
 * they stand still for anyone who asked for reduced motion.
 *
 * Positions are measured from the DOM (one ResizeObserver on the flow), so
 * the diagram stays a list of accessible links and this is purely the drawing
 * on top. Hovering or focusing a card lights its own line.
 */
import { useEffect, useRef, useState } from 'react';

type Lane = 'needs' | 'makers' | 'feeds';

interface Line {
  key: string;
  lane: Lane;
  d: string;
}

function centreOf(el: Element, host: DOMRect, side: 'left' | 'right' | 'top' | 'bottom') {
  const r = el.getBoundingClientRect();
  const x = side === 'left' ? r.left : side === 'right' ? r.right : r.left + r.width / 2;
  const y = side === 'top' ? r.top : side === 'bottom' ? r.bottom : r.top + r.height / 2;
  return { x: x - host.left, y: y - host.top };
}

function curve(a: { x: number; y: number }, b: { x: number; y: number }, vertical: boolean) {
  if (vertical) {
    const my = (a.y + b.y) / 2;
    return `M${a.x} ${a.y} C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  return `M${a.x} ${a.y} C${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
}

export function ChainLinks() {
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
      // Below 768px the flow is a column with its own arrows; nothing to draw.
      if (window.matchMedia('(max-width: 767px)').matches) {
        setLines([]);
        return;
      }
      const host = flow.getBoundingClientRect();
      const focus = flow.querySelector('[data-flow-focus]');
      if (!focus) return;
      const next: Line[] = [];
      for (const node of flow.querySelectorAll<HTMLElement>('[data-flow-node]')) {
        const lane = node.dataset.lane as Lane;
        const key = node.dataset.key ?? '';
        if (lane === 'needs') {
          next.push({
            key,
            lane,
            d: curve(centreOf(node, host, 'right'), centreOf(focus, host, 'left'), false),
          });
        } else if (lane === 'feeds') {
          next.push({
            key,
            lane,
            d: curve(centreOf(focus, host, 'right'), centreOf(node, host, 'left'), false),
          });
        } else if (lane === 'makers') {
          next.push({
            key,
            lane,
            d: curve(centreOf(node, host, 'bottom'), centreOf(focus, host, 'top'), true),
          });
        }
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
  }, []);

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
        <g key={line.key} data-lane={line.lane} data-active={active === line.key || undefined}>
          <path className="flow-link-track" d={line.d} />
          <path className="flow-link-flow" d={line.d} />
        </g>
      ))}
    </svg>
  );
}

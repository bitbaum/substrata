/**
 * A facet's row shape, printed for the model that writes it
 * (`scripts/research/add.ts <facet> --schema`, and prompts/data-entry.md).
 * The JSON Schema is generated from the Zod schema, so the two cannot differ;
 * the short form is that schema walked into a TypeScript-like block.
 */
import { z } from 'zod';

import type { Facet } from './candidate';
import { FACET_SPECS } from './schemas';

/** The JSON Schema a data agent reads (`add.ts <facet> --schema`). */
export function printedSchema(facet: Facet): unknown {
  return z.toJSONSchema(FACET_SPECS[facet].schema, { unrepresentable: 'any', io: 'input' });
}

/* eslint-disable @typescript-eslint/no-explicit-any -- walks a JSON Schema */
function typeOf(node: any, indent: string): string {
  if (!node || typeof node !== 'object') return 'unknown';
  if ('const' in node) return JSON.stringify(node.const);
  if (node.enum) return node.enum.map((v: unknown) => JSON.stringify(v)).join(' | ');
  if (node.anyOf) return node.anyOf.map((n: any) => typeOf(n, indent)).join(' | ');
  if (Array.isArray(node.type)) return node.type.join(' | ');
  if (node.type === 'null') return 'null';
  if (node.type === 'array') return `${wrap(typeOf(node.items, indent))}[]`;
  if (node.type === 'object') return objectShape(node, indent);
  if (node.type === 'integer') return 'integer';
  return node.type ?? 'unknown';
}

const wrap = (t: string) => (t.includes(' | ') ? `(${t})` : t);

function constraint(node: any): string {
  const notes: string[] = [];
  if (node?.pattern) notes.push(`/${node.pattern}/`);
  if (node?.minLength !== undefined || node?.maxLength !== undefined)
    notes.push(`${node.minLength ?? 0}–${node.maxLength ?? '∞'} chars`);
  if (node?.minimum !== undefined || node?.maximum !== undefined)
    notes.push(`${node.minimum ?? node.exclusiveMinimum ?? '−∞'}..${node.maximum ?? '∞'}`);
  if (node?.description) notes.push(node.description);
  return notes.length ? ` // ${notes.join('; ')}` : '';
}

function objectShape(node: any, indent: string): string {
  const required = new Set<string>(node.required ?? []);
  const inner = `${indent}  `;
  const lines = Object.entries(node.properties ?? {}).map(([name, child]: [string, any]) => {
    const t = typeOf(child, inner);
    const described = child?.type === 'array' ? { ...child.items, ...child } : child;
    const note = t.startsWith('{') ? '' : constraint(described);
    return `${inner}${name}${required.has(name) ? '' : '?'}: ${t};${note}`;
  });
  return `{\n${lines.join('\n')}\n${indent}}`;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** The facet's row as a short TypeScript-like shape, for a model to read before it writes. */
export function shapeOf(facet: Facet): string {
  return typeOf(printedSchema(facet), '');
}

/**
 * Finds numbers typed straight into page copy.
 *
 * A digit in JSX text, or in a prose string handed to a page (a stat note, a
 * lede, an aside), is a number no reader can trace: it is not a count of the
 * corpus, not a sourced figure, and not labelled as an estimate. That is the
 * "magic number" this project was full of. Numbers that ARE traceable are
 * written as expressions (`{totals.sourced}`) or wrapped in `<Figure>`, and
 * neither is counted here.
 *
 * Used by `test/figures.test.ts` as a ratchet; runnable on its own to list the
 * hits: `pnpm tsx test/bare-numbers.ts`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

export interface BareNumber {
  file: string;
  line: number;
  text: string;
}

/** Where page copy lives. Config data is covered by the truth gate instead. */
export const SCANNED_DIRS = ['app', 'components', 'lib/profile/modules'];

/** Attributes that carry markup, not copy. */
const NON_COPY_ATTRIBUTES = new Set([
  'className',
  'href',
  'src',
  'key',
  'id',
  'style',
  'viewBox',
  'd',
  'width',
  'height',
  'rel',
  'target',
  'type',
  'colSpan',
  'rowSpan',
  'x',
  'y',
  'fill',
  'stroke',
  'strokeWidth',
  'transform',
  'htmlFor',
  'name',
  'value',
  'defaultValue',
  'min',
  'max',
  'step',
  'rows',
  'cols',
  'maxLength',
  'minLength',
  'pattern',
  'autoComplete',
  'inputMode',
  'sizes',
  'index',
]);

/** Object keys whose string values are rendered to a reader as prose. */
const COPY_KEYS = new Set([
  'label',
  'note',
  'lede',
  'title',
  'description',
  'what',
  'next',
  'aside',
  'intro',
  'detail',
  'summary',
  'term',
]);

const HAS_DIGIT = /\d/;
/** A "number" worth tracing: a digit in something that reads as words. */
function isProseWithNumber(text: string): boolean {
  const t = text.trim();
  if (!HAS_DIGIT.test(t) || !/[A-Za-z]/.test(t)) return false;
  // Class lists, paths, ids and dates-as-keys are not copy.
  if (/^[\w:./#?=&%[\]-]+$/.test(t)) return false;
  return true;
}

function jsxTagName(node: ts.Node): string | undefined {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText();
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText();
  return undefined;
}

/** True when the node sits inside a <Figure> (explained) or a non-copy attribute. */
function isExcused(node: ts.Node): boolean {
  for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
    if (jsxTagName(cur) === 'Figure') return true;
    if (ts.isJsxAttribute(cur) && NON_COPY_ATTRIBUTES.has(cur.name.getText())) return true;
    if (ts.isImportDeclaration(cur) || ts.isExportDeclaration(cur)) return true;
    // A comparison, index or arithmetic operand is logic, not copy.
    if (ts.isElementAccessExpression(cur) || ts.isCallExpression(cur)) {
      const callee = ts.isCallExpression(cur) ? cur.expression.getText() : '';
      // Formatting helpers render; everything else computes.
      if (!/^(t|String)$/.test(callee)) return true;
    }
  }
  return false;
}

function isInJsx(node: ts.Node): boolean {
  for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
    if (ts.isJsxExpression(cur) || ts.isJsxAttribute(cur)) return true;
    if (ts.isFunctionLike(cur) || ts.isSourceFile(cur)) return false;
  }
  return false;
}

function isCopyProperty(node: ts.Node): boolean {
  const parent = node.parent;
  return (
    parent !== undefined &&
    ts.isPropertyAssignment(parent) &&
    parent.initializer === node &&
    COPY_KEYS.has(parent.name.getText())
  );
}

export function bareNumbersIn(file: string, source: string): BareNumber[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: BareNumber[] = [];
  const add = (node: ts.Node, text: string) =>
    hits.push({
      file,
      line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      text: text.trim().replace(/\s+/g, ' ').slice(0, 120),
    });

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (isProseWithNumber(node.text) && !isExcused(node)) add(node, node.text);
    } else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const holder =
        ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
          ? node
          : (node.parent.parent ?? node.parent);
      if (
        isProseWithNumber(node.text) &&
        (isInJsx(holder) || isCopyProperty(holder)) &&
        !isExcused(holder)
      ) {
        add(node, node.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

export function scanBareNumbers(root = process.cwd()): BareNumber[] {
  return SCANNED_DIRS.flatMap((dir) => tsxFiles(join(root, dir))).flatMap((path) =>
    bareNumbersIn(relative(root, path), readFileSync(path, 'utf8')),
  );
}

/** Per-file counts, the shape the baseline is stored in. */
export function countByFile(hits: BareNumber[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const hit of hits) counts[hit.file] = (counts[hit.file] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

if (process.argv[1]?.endsWith('bare-numbers.ts')) {
  for (const hit of scanBareNumbers()) console.log(`${hit.file}:${hit.line}  ${hit.text}`);
}

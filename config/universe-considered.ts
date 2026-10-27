/**
 * Names looked for on purpose and NOT admitted, because no source we could
 * open supports one of the three tests. Saying where we looked is what makes
 * "not on the list" mean something. A row leaves this file the day an
 * evidence row for the missing test lands (research/universe.json or
 * config/candidates/universe.json); test/universe.test.ts fails while a name
 * is both here and admitted.
 */
import type { Considered } from '@/lib/universe/types';

export const CONSIDERED: readonly Considered[] = [];

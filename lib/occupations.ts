/**
 * What the official occupational records say a role family needs, read from
 * research/occupations.json (built by scripts/research/occupations.ts from the
 * O*NET database and the ESCO API — never edited by hand).
 */
import data from '@/research/occupations.json';
import { FAMILY_BY_ID, type RoleFamilyId } from '@/config/careers-roles';

export interface OnetRecord {
  code: string;
  title: string;
  description: string;
  jobZone: { zone: number; name: string; education: string; training: string } | null;
  tasks: string[];
  skills: string[];
  knowledge: string[];
  hotTechnology: string[];
  url: string;
}

export interface EscoRecord {
  uri: string;
  title: string;
  iscoCode: string | null;
  description: string;
  essentialSkills: string[];
  url: string;
}

const FILE = data as unknown as {
  generatedOn: string;
  sources: {
    onet: { name: string; url: string; license: string };
    esco: { name: string; url: string };
  };
  onet: Record<string, OnetRecord>;
  esco: Record<string, EscoRecord>;
};

export const OCCUPATION_SOURCES = { ...FILE.sources, generatedOn: FILE.generatedOn };

export interface FamilyOccupation {
  onet: OnetRecord | null;
  esco: EscoRecord | null;
}

export function occupationsOf(family: RoleFamilyId): FamilyOccupation[] {
  return (FAMILY_BY_ID.get(family)?.occupations ?? []).map((o) => ({
    onet: o.onet ? (FILE.onet[o.onet] ?? null) : null,
    esco: o.esco ? (FILE.esco[o.esco] ?? null) : null,
  }));
}

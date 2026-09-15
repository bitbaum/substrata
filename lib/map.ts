/**
 * The map as data, for machines.
 *
 * The site renders the research for people. This builds the same objects —
 * the same coverage rows, the same evidence, the same thesis — into one JSON
 * document for an agent or a script that wants to consume the map rather
 * than scrape the prose. Nothing here is a second copy: every field is read
 * from the config the pages are drawn from, so the API cannot say something
 * the site does not.
 *
 * The verification vocabulary is the site's, and it is three-valued on
 * purpose: `sourced` is the firm's claim, `candidate` is the engine's lead,
 * and `unverified` is neither. A consumer that treats a candidate as a
 * finding has been told, in the field name, that it is not one.
 *
 * Created: 2026-09-14
 */

import { COMPANY, MANDATE_CURVES, MATERIALS, areaFor } from '@/config/substrata';
import {
  CHOKEPOINTS,
  COVERAGE,
  coverageProgress,
  chokepointProgress,
} from '@/config/substrata-coverage';
import { INVESTMENT_THESIS, READINESS } from '@/config/substrata-acting';
import { CHAIN_LAYERS, PARTICIPANTS } from '@/config/substrata-participants';
import { EVIDENCE, evidenceFor, verificationFor } from '@/config/substrata-evidence';
import { RESEARCH_PROGRAMMES, programmeProgress } from '@/config/substrata-programmes';
import { eventsNewestFirst } from '@/config/substrata-events';
import { STAGES } from '@/config/substrata-stages';
import { BOTTLENECKS } from '@/lib/bottlenecks';
import { portalTotals } from '@/lib/bottlenecks';
import { SITE } from '@/lib/site';

export function buildMap() {
  const coverage = coverageProgress();
  const chokepoints = chokepointProgress();
  // Candidates are counted on the joined rows, not the evidence file: a row
  // an analyst has since sourced is no longer waiting on anyone.
  const totals = portalTotals();

  return {
    name: COMPANY.name,
    tagline: COMPANY.tagline,
    host: SITE.host,
    generatedAt: new Date().toISOString(),
    evidenceGeneratedAt: EVIDENCE.generatedAt,
    notice:
      'Research, not advice. Rows are three-valued: "sourced" is a claim backed by a primary ' +
      'source, "candidate" is a page the research engine found that mentions the company with ' +
      'the material, "unverified" is a lead. Only "sourced" is a finding.',
    progress: {
      producers: {
        total: coverage.total,
        sourced: coverage.sourced,
        withCandidate: totals.candidates,
      },
      chokepoints: { total: chokepoints.total, sourced: chokepoints.sourced },
    },
    stages: STAGES.map((stage) => ({
      id: stage.id,
      name: stage.name,
      reliefTime: stage.reliefTime,
      bottlenecks: BOTTLENECKS.filter((b) => b.stage === stage.id).map((b) => b.slug),
    })),
    bottlenecks: BOTTLENECKS.map((b) => ({
      slug: b.slug,
      name: b.name,
      kind: b.kind,
      stage: b.stage,
      binding: b.binding,
      score: b.score,
      horizon: b.horizon,
      judgedOn: b.judgedOn,
      state: b.state,
      events: b.events.map((e) => e.id),
    })),
    events: eventsNewestFirst(),
    curves: MANDATE_CURVES.map((curve) => ({ id: curve.id, label: curve.label, test: curve.test })),
    materials: COVERAGE.map((entry) => {
      const listing = MATERIALS.find((m) => m.title === entry.material);
      return {
        material: entry.material,
        area: listing ? areaFor(listing).id : null,
        curve: listing ? areaFor(listing).curve : null,
        spec: listing?.spec ?? null,
        thesis: entry.thesis,
        producers: entry.producers.map((producer) => {
          const found = evidenceFor(entry.material, producer.name);
          return {
            name: producer.name,
            jurisdictions: producer.jurisdictions,
            role: producer.role,
            verification: verificationFor(entry.material, producer.name, producer.source),
            source: producer.source,
            candidates: found?.candidates.map((c) => ({ url: c.url, title: c.title })) ?? [],
          };
        }),
      };
    }),
    chokepoints: CHOKEPOINTS.map((point) => ({
      name: point.name,
      type: point.type,
      curve: point.curve,
      jurisdictions: point.jurisdictions,
      why: point.why,
      verification: point.source ? 'sourced' : 'unverified',
      source: point.source,
    })),
    participants: {
      layers: CHAIN_LAYERS.map((layer) => ({ id: layer.id, name: layer.name, curve: layer.curve })),
      rows: PARTICIPANTS.map((item) => ({
        name: item.name,
        layer: item.layer,
        role: item.role,
        jurisdictions: item.jurisdictions,
        scarcity: item.scarcity,
        why: item.why,
      })),
    },
    thesis: INVESTMENT_THESIS.map((claim) => ({
      id: claim.id,
      claim: claim.claim,
      falsifier: claim.falsifier,
    })),
    programmes: RESEARCH_PROGRAMMES.map((programme) => ({
      id: programme.id,
      title: programme.title,
      question: programme.question,
      commissioned: programme.commissioned,
      status: programme.status,
      progress: programmeProgress(programme),
      layers: programme.layers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        period: layer.period,
        gatedBy: layer.gatedBy,
      })),
      questions: programme.questions.map((q) => ({
        id: q.id,
        question: q.question,
        settledBy: q.settledBy,
      })),
    })),
    readiness: READINESS.map((item) => ({
      id: item.id,
      requirement: item.requirement,
      status: item.status,
    })),
  };
}

export type SubstrataMap = ReturnType<typeof buildMap>;

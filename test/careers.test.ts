/**
 * Open roles: reading each board, filing a posting, and the register of
 * boards. The filing rules are the whole of what Substrata adds to a posting,
 * so each rule that has been wrong once is pinned here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bottlenecksOf, classify, familyOf, seniorityOf, skillsOf } from '../lib/careers';
import { parseBoard, plain } from '../lib/careers-ats';
import { countriesIn, countryCode } from '../lib/careers-geo';
import { parseJobFollows, toggleJobFollow } from '../lib/job-follows';
import { FETCHABLE, boardFor, liveBoards } from '../lib/job-boards';
import { LEARNING_PATHS } from '../lib/learning-paths';
import { occupationsOf } from '../lib/occupations';
import { BOTTLENECK_NEEDS, ROLE_FAMILIES } from '../config/careers-roles';
import { BOTTLENECK_TERMS } from '../config/careers-terms';
import { BOTTLENECKS } from '../lib/bottlenecks';
import { MARKET_PARTICIPANTS } from '../lib/participants';
import { parseFollows } from '../lib/follows';

test('a title lands in the most specific family', () => {
  assert.equal(familyOf('Substation Technician II'), 'electrical-trades');
  assert.equal(familyOf('Data Center Technician'), 'data-centre');
  assert.equal(familyOf('Field Service Engineer, EUV'), 'equipment-service');
  assert.equal(familyOf('Etch Process Engineer'), 'process-engineering');
  assert.equal(familyOf('Process Technician'), 'technicians');
  assert.equal(familyOf('Software Engineer, Inference'), 'software-ai');
  assert.equal(familyOf('Account Executive'), 'business');
  assert.equal(familyOf('Nuclear Licensing Engineer'), 'nuclear');
});

test('seniority reads the title, and a lead is not an intern', () => {
  assert.equal(seniorityOf('Summer Intern, Materials'), 'entry');
  assert.equal(seniorityOf('Apprentice Lineworker'), 'entry');
  assert.equal(seniorityOf('Senior Yield Engineer'), 'senior');
  assert.equal(seniorityOf('Engineering Manager, Fab'), 'lead');
  assert.equal(seniorityOf('Equipment Engineer'), 'mid');
});

test('a bottleneck needs its title, or two mentions — one line of boilerplate is not enough', () => {
  assert.ok(
    bottlenecksOf('HBM Test Engineer', '').includes('high-bandwidth-memory-stacking-yield'),
  );
  assert.deepEqual(bottlenecksOf('Recruiter', 'We build the future of lithium batteries.'), []);
  assert.ok(
    bottlenecksOf('Chemist', 'Lithium hydroxide plant. Lithium purity control.').includes(
      'battery-grade-lithium-chemicals',
    ),
  );
});

test('a software or business posting is filed by its title alone', () => {
  const raw = {
    id: 'greenhouse:x:1',
    company: 'X',
    location: '',
    countries: [],
    remote: false,
    department: '',
    postedAt: null,
    url: 'u',
    text: 'Our foundry partners and our foundry roadmap.',
  };
  assert.deepEqual(classify({ ...raw, title: 'Recruiter' }).bottlenecks, []);
  assert.deepEqual(classify({ ...raw, title: 'Software Engineer' }).bottlenecks, []);
  assert.ok(
    classify({ ...raw, title: 'Equipment Engineer' }).bottlenecks.includes(
      'leading-edge-foundry-capacity',
    ),
  );
});

test('whole words only: "tin" and "sic" never match inside other words', () => {
  assert.deepEqual(bottlenecksOf('Testing lead for music systems', ''), []);
  assert.ok(!bottlenecksOf('Maintaining transformer models', 'transformer transformer').length);
});

test('skills and credentials are named, not inferred', () => {
  const skills = skillsOf(
    'Must hold a journeyman card and NFPA 70E training; PLC experience a plus.',
  );
  assert.ok(skills.includes('Electrical licence / journeyman card'));
  assert.ok(skills.includes('NFPA 70E / arc-flash'));
  assert.ok(skills.includes('PLC and industrial controls'));
  assert.ok(!skills.includes('Python'));
});

test('countries come from the place text, and an unknown place is left out', () => {
  assert.deepEqual(countriesIn('Chicago, IL / Toronto, ON'), ['US', 'CA']);
  assert.deepEqual(countriesIn('Taiwan > Hsinchu; Taiwan > Kaohsiung'), ['TW']);
  assert.deepEqual(countriesIn('Veldhoven, Netherlands'), ['NL']);
  assert.deepEqual(countriesIn('Atlantis'), []);
  assert.equal(countryCode('United States'), 'US');
  assert.equal(countryCode('de'), 'DE');
});

test('each board format reads into the same shape', () => {
  const gh = parseBoard('greenhouse', 'asm', 'ASM International', {
    jobs: [
      {
        id: 1,
        title: ' Etch Process Engineer ',
        absolute_url: 'https://www.asm.com/open-vacancies/?gh_jid=1',
        first_published: '2026-09-01T10:00:00-04:00',
        location: { name: 'US > Arizona > Phoenix' },
        content: '&lt;p&gt;Cleanroom &amp;amp; etch&lt;/p&gt;',
        departments: [{ name: 'R&D' }],
      },
    ],
  });
  assert.equal(gh[0].id, 'greenhouse:asm:1');
  assert.equal(gh[0].title, 'Etch Process Engineer');
  assert.deepEqual(gh[0].countries, ['US']);
  assert.equal(gh[0].text, 'Cleanroom & etch');
  const ab = parseBoard('ashby', 'openai', 'OpenAI', {
    jobs: [
      { id: 'a', title: 'Hidden', jobUrl: 'u', isListed: false },
      {
        id: 'b',
        title: 'Data Center Technician',
        jobUrl: 'https://jobs.ashbyhq.com/openai/b',
        isRemote: true,
        address: { postalAddress: { addressCountry: 'United States' } },
      },
    ],
  });
  assert.equal(ab.length, 1, 'an unlisted Ashby job is skipped');
  assert.equal(ab[0].remote, true);
  assert.deepEqual(ab[0].countries, ['US']);
  const lv = parseBoard('lever', 'x', 'X', [
    { id: 'l', text: 'Lineworker', hostedUrl: 'h', country: 'CA', workplaceType: 'onsite' },
  ]);
  assert.deepEqual(lv[0].countries, ['CA']);
  assert.equal(classify(lv[0]).family, 'electrical-trades');
  assert.equal(plain('a&nbsp;<b>b</b>'), 'a b');
});

test('every live board was verified on a careers page and sits on a public API', () => {
  const live = liveBoards();
  assert.ok(live.length > 0, 'no live boards at all');
  for (const b of live) {
    const record = boardFor(b.slug);
    assert.ok(FETCHABLE.includes(b.ats), `${b.slug}: ${b.ats} is not a public job-board API`);
    assert.match(record?.careersUrl ?? '', /^https:\/\//, `${b.slug}: no careers page recorded`);
    assert.ok((record?.evidence.length ?? 0) > 20, `${b.slug}: no evidence tying the board to it`);
  }
  for (const p of MARKET_PARTICIPANTS) {
    const r = boardFor(p.slug);
    if (r?.board) assert.ok(FETCHABLE.includes(r.ats as never), `${p.slug}: board on ${r.ats}`);
  }
});

test('every rule and mapping points at something that exists', () => {
  const slugs = new Set(BOTTLENECKS.map((b) => b.slug));
  for (const slug of Object.keys(BOTTLENECK_TERMS)) assert.ok(slugs.has(slug), `terms: ${slug}`);
  for (const slug of Object.keys(BOTTLENECK_NEEDS)) assert.ok(slugs.has(slug), `needs: ${slug}`);
  for (const b of BOTTLENECKS) {
    assert.ok(BOTTLENECK_TERMS[b.slug], `${b.slug} has no terms`);
    assert.ok(BOTTLENECK_NEEDS[b.slug]?.length, `${b.slug} needs no roles`);
  }
  for (const f of ROLE_FAMILIES) {
    for (const o of occupationsOf(f.id)) {
      assert.ok(o.onet || o.esco, `${f.id}: an occupation with no record — rerun the script`);
    }
  }
});

test('every learning path links an official page and says when it was checked', () => {
  const ids = new Set<string>();
  for (const p of LEARNING_PATHS) {
    assert.ok(!ids.has(p.id), `duplicate ${p.id}`);
    ids.add(p.id);
    assert.match(p.url, /^https?:\/\//);
    assert.match(p.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(p.families.length > 0, `${p.id}: no family`);
    for (const f of p.families) {
      assert.ok(
        ROLE_FAMILIES.some((r) => r.id === f),
        `${p.id}: unknown family ${f}`,
      );
    }
  }
});

test('job follows parse defensively and survive the follows round trip', () => {
  const parsed = parseJobFollows(
    { companies: ['asml', 'nope', 7], families: ['nuclear', 'astronaut'] },
    (s) => s === 'asml',
  );
  assert.deepEqual(parsed, { companies: ['asml'], families: ['nuclear'] });
  const on = toggleJobFollow(parsed, 'family', 'technicians', true);
  assert.deepEqual(on.families, ['nuclear', 'technicians']);
  assert.deepEqual(toggleJobFollow(on, 'company', 'asml', false).companies, []);
  const round = parseFollows(JSON.parse(JSON.stringify({ jobs: { companies: ['asml'] } })));
  assert.deepEqual(round.jobs.companies, ['asml']);
  assert.equal(parseFollows(['ai']).jobs.families.length, 0);
});

/**
 * How the numbers on /careers are arrived at. Spread into METHODS
 * (lib/methods.ts) so they render on /data like every other method; kept here
 * so the careers work does not grow a file every page shares.
 */
import type { Method } from './methods';

export const CAREER_METHODS = {
  'careers-open': {
    title: 'Open roles',
    formula:
      'Count of postings currently listed on the public job boards Substrata reads, after the page’s filters. By default software and business roles that name no bottleneck are left out; "Every role" puts them back.',
    explanation:
      'Boards are read once a day from the Greenhouse, Lever and Ashby public job-board APIs, for directory companies whose careers page was checked to use one. A posting that disappears from its board is closed. Companies on Workday, SuccessFactors or their own site are linked, not counted — so this is a count of what Substrata can read, never of how many people an industry is hiring.',
    code: ['lib/careers-store.ts', 'lib/careers-query.ts', 'research/job-boards.json'],
  },
  'careers-classify': {
    title: 'Postings per bottleneck and role family',
    formula:
      'A posting is filed under a bottleneck when its title names one of that bottleneck’s terms, or its description names them at least twice (title only for software and business roles); its role family is the first family whose title terms its title names.',
    explanation:
      'The terms are published in config/careers-terms.ts and config/careers-roles.ts and matched as whole words. Nobody reads the postings: a rule can file a posting wrongly, and one posting can sit under several bottlenecks, so the per-bottleneck counts add up to more than the total. Postings naming no bottleneck (most software and business roles) are counted in the total only.',
    code: ['lib/careers.ts', 'config/careers-terms.ts', 'config/careers-roles.ts'],
  },
  'careers-skills': {
    title: 'Skills and credentials named in postings',
    formula:
      'For each skill or credential in the published list, the number of open postings whose title or description names any of its terms.',
    explanation:
      'A count of mentions, not of requirements: "PhD asked" also counts a posting that says a PhD is not needed. The list is Substrata’s, chosen for these chains; a skill outside it is never counted. The occupational skills beside it come from O*NET and ESCO, not from postings.',
    code: ['lib/careers.ts', 'config/careers-terms.ts', 'lib/careers-query.ts'],
  },
  'careers-paths': {
    title: 'Learning paths',
    formula:
      'Count of programmes in research/learning-paths.json, each with the official page it was checked on.',
    explanation:
      'A programme is listed only after its official page was opened and matched what the entry says; format and entry facts are copied from that page. The list is a start, not a census of every course in the world, and a listing is not an endorsement.',
    code: ['research/learning-paths.json', 'lib/learning-paths.ts'],
  },
} as const satisfies Record<string, Method>;

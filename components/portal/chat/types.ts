export type Source = {
  number: number;
  id: string;
  title: string;
  href: string;
  evidence: string;
  primary: string[];
  kind: string;
};

export type WebFinding = { title: string; url: string; excerpt: string; cited?: boolean };

export type Verdict = 'Supported' | 'Contradicted' | 'Outdated' | 'Unverifiable';

/** A claim to check, as sent to /api/chat. */
export type VerifyInput = { claim: string; value?: string; source?: string };

/** A page the sweep found that nobody has reviewed. Never a finding. */
export type Lead = {
  title: string;
  url: string;
  bottleneck: string;
  foundAt: string;
  verdict: string | null;
};

export type Answer = {
  answer: string;
  sources: Source[];
  /** Open-web passages. Never corpus rows; rendered apart. */
  web?: WebFinding[];
  /** Unreviewed sweep leads the answer read. Rendered apart, labelled. */
  leads?: Lead[];
  /** Questions this assistant can answer, built from what it looked up. */
  followUps?: string[];
  /** What it looked up, in order. */
  trail?: string[];
  /** Whether the answer went past the corpus. Said on screen, not implied. */
  outside?: boolean;
  /** No model answered; this is the honest fallback. */
  degraded?: boolean;
  /** Verify mode: the verdict the answer opened with. */
  verdict?: Verdict;
};

export type Turn = {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  web?: WebFinding[];
  leads?: Lead[];
  followUps?: string[];
  trail?: string[];
  outside?: boolean;
  degraded?: boolean;
  verdict?: Verdict;
};

export type StreamEvent =
  | { type: 'status'; text: string }
  | { type: 'tool'; label: string }
  | { type: 'delta'; text: string }
  | { type: 'reset' }
  | { type: 'done'; data: Answer }
  | { type: 'error'; error: string };

/** The answer while it is being written: what it has looked up so far, and the text as it arrives. */
export type LiveAnswer = { steps: string[]; text: string; status: string };

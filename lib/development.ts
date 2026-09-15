/** Public, allowlisted projection from the canonical Loki profile. Never local roadmap copies. */
export interface DevelopmentProfile {
  slug: string;
  name: string;
  what: string | null;
  stack: string | null;
  identity: {
    problem: string | null;
    solution: string | null;
    mission: string | null;
    vision: string | null;
  };
  roadmap: {
    title: string;
    status: string | null;
    progress: number | null;
    targetDate: string | null;
    milestones: string[];
  }[];
  changelog: { date: string; done: string }[];
  urls: {
    live: string | null;
    repo: string | null;
    orangecat: string | null;
    solon: string | null;
  };
}
export async function developmentProfile(): Promise<{
  profile: DevelopmentProfile | null;
  checkedAt: string | null;
  unavailable: boolean;
}> {
  try {
    const response = await fetch('https://loki.orangecat.ch/api/fleet/map', {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Map unavailable');
    const data = await response.json();
    if (!Array.isArray(data.projects)) throw new Error('Invalid map');
    const profile = data.projects.find((p: DevelopmentProfile) => p.slug === 'substrata') ?? null;
    return {
      profile,
      checkedAt: typeof data.generatedAt === 'string' ? data.generatedAt : null,
      unavailable: false,
    };
  } catch {
    return { profile: null, checkedAt: null, unavailable: true };
  }
}

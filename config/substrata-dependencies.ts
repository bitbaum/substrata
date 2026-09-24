/**
 * What each bottleneck needs, and which companies rely on which bottleneck.
 *
 * Before this file the corpus could say who MAKES a bottleneck and nothing
 * about what a bottleneck is made FROM. "EUV scanners" and "EUV projection
 * optics" were two rows with no join between them; NVIDIA held no bottleneck
 * at all, so a reader asking "what does my NVIDIA position rest on?" got an
 * empty answer from a corpus that plainly knew the chain.
 *
 * Every row here is one directed dependency with the page that states it and
 * the sentence that carries it. Nothing is inferred from general knowledge,
 * however obvious: a join that is true but unsourced is left out and listed as
 * a gap on /xray, the same way a producer row starts unverified.
 *
 * Two kinds:
 *
 *   needs      — the dependent cannot be made or run without the input.
 *                Bottleneck → bottleneck, or company → bottleneck.
 *   sells-into — a company whose sales go to the holders of this bottleneck.
 *                The opposite direction of exposure: if the capacity stops
 *                growing, so does this company's market. The filings name a
 *                MARKET (foundry, DRAM), not a node, and the row says so.
 *
 * What these rows do NOT claim: a share, a volume, a contract, or that the
 * dependency has no substitute. Substitution is judged in the assessment.
 *
 * Read on 2026-09-24.
 */

export type DependencyKind = 'needs' | 'sells-into';

export interface Dependency {
  /** Exact bottleneck name, or exact directory company name. */
  from: string;
  fromKind: 'bottleneck' | 'company';
  kind: DependencyKind;
  /** Exact bottleneck name. */
  on: string;
  source: string;
  /** The sentence from the source that carries the join, verbatim. */
  quote: string;
  /** The company's own page or filing, or an official record. */
  primary: boolean;
  /** Where the source is narrower or broader than the join. */
  scope?: string;
  readOn: string;
}

const READ = '2026-09-24';

const EUV = 'EUV lithography scanners';
const OPTICS = 'EUV projection optics';
const TIN = 'High-purity tin, EUV droplet grade';
const FOUNDRY = 'Leading-edge foundry capacity';
const PACKAGING = 'Advanced packaging capacity';
const HBM = 'High-bandwidth memory stacking yield';
const RESIST = 'Photoresist formulation';
const WAFERS = '300 mm prime silicon wafers';
const POLY = 'Electronic-grade polysilicon';
const QUARTZ = 'Crucible-grade high-purity quartz sand';
const NEON = 'Neon, excimer laser grade';
const HELIUM = 'Liquid helium (He-4)';
const TRANSFORMERS = 'Large power transformer slots';
const GOES = 'Grain-oriented electrical steel (GOES)';
const SINTERING = 'Rare-earth magnet sintering';

const NVIDIA_10K =
  'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm';
const DOE_MAGNETS =
  'https://www.energy.gov/sites/default/files/2022-02/Neodymium%20Magnets%20Supply%20Chain%20Report%20-%20Final.pdf';
const SK_SILTRON = 'https://www.sksiltron.com/m/en/wafer/wafer.do';
const TSMC_AR_COWOS =
  'https://investor.tsmc.com/static/annualReports/2022/english/ebook/files/basic-html/page100.html';

function needs(
  from: string,
  on: string,
  source: string,
  quote: string,
  primary: boolean,
  scope?: string,
): Dependency {
  return {
    from,
    fromKind: 'bottleneck',
    kind: 'needs',
    on,
    source,
    quote,
    primary,
    readOn: READ,
    ...(scope ? { scope } : {}),
  };
}

function company(
  kind: DependencyKind,
  from: string,
  on: string,
  source: string,
  quote: string,
  scope?: string,
): Dependency {
  return {
    from,
    fromKind: 'company',
    kind,
    on,
    source,
    quote,
    primary: true,
    readOn: READ,
    ...(scope ? { scope } : {}),
  };
}

export const DEPENDENCIES: readonly Dependency[] = [
  // ---------- Inside the scanner ----------
  needs(
    EUV,
    OPTICS,
    'https://www.zeiss.com/semiconductor-manufacturing-technology/products/markets-and-partners.html',
    'The key element of the wafer scanners are lithography optics from the ZEISS Semiconductor Manufacturing Technology (SMT) segment.',
    true,
  ),
  needs(
    EUV,
    TIN,
    'https://www.asml.com/en/technology/lithography-principles/light-and-lasers',
    'molten tin droplets of around 25 microns in diameter are ejected from a generator at 70 meters per second',
    true,
  ),

  // ---------- Into the leading-edge fab ----------
  needs(
    FOUNDRY,
    EUV,
    'https://pr.tsmc.com/english/news/2010',
    'EUV technology enables TSMC to keep driving chip scaling as the shorter wavelength of EUV light is better able to print the nanometer-scale features of advanced technology designs.',
    true,
  ),
  needs(
    FOUNDRY,
    RESIST,
    'https://www.tok-pr.com/en/products/photoresist.html',
    'We continue to research and develop EUV resists with absorption wavelengths of 13.5nm, with a proven track record in mass production lines.',
    true,
    'A resist maker describing its own product in mass production; it does not name a fab.',
  ),
  needs(
    FOUNDRY,
    WAFERS,
    SK_SILTRON,
    '300mm Non-memory chip — MPU, CIS, Logic (Driver IC)',
    true,
    'A wafer maker’s product table: 300 mm wafers go to logic. It does not name a node.',
  ),
  needs(
    FOUNDRY,
    NEON,
    'https://www.theregister.com/2022/03/11/ukraine_neon_supplies/',
    'Their highly pure inert neon gas is needed as a buffer for lasers used during the chip fabrication process.',
    false,
    'Chip fabrication in general, not the leading edge only.',
  ),
  needs(
    FOUNDRY,
    HELIUM,
    'https://www.dw.com/en/iran-war-helium-semiconductor-industry-chips-oil-qatar-us-evs-smartphones/a-76380869',
    'Among the latest geopolitical uncertainties for the industry is a shortage of helium that could slow global production.',
    false,
    'Chip production in general, not the leading edge only.',
  ),

  // ---------- Memory and packaging ----------
  needs(
    HBM,
    WAFERS,
    SK_SILTRON,
    '300mm Memory chip — DRAM, Flash(NAND)',
    true,
    'DRAM in general; HBM is stacked DRAM.',
  ),
  needs(
    PACKAGING,
    FOUNDRY,
    TSMC_AR_COWOS,
    'so that various chiplets such as SoC and and high bandwidth memory (HBM) can be placed on it',
    true,
    'TSMC’s 2022 annual report on the CoWoS interposer. The SoC dies are the logic side.',
  ),
  needs(
    PACKAGING,
    HBM,
    TSMC_AR_COWOS,
    'so that various chiplets such as SoC and and high bandwidth memory (HBM) can be placed on it',
    true,
  ),

  // ---------- Silicon, upstream ----------
  needs(
    WAFERS,
    POLY,
    'https://www.hscpoly.com/markets-technologies/electronics/',
    'Our hyper-pure polysilicon becomes fabricated wafers and integrated circuit chips used by leading semiconductor manufacturers.',
    true,
  ),
  needs(
    WAFERS,
    QUARTZ,
    'https://www.thequartzcorp.com/high-purity-quartz',
    'Quartz crucibles are a critical component in the manufacture of photovoltaic cells and semiconductor chips. They are used to grow ingots that are then sliced and polished into ultra-thin wafers.',
    true,
  ),

  // ---------- Grid ----------
  needs(
    TRANSFORMERS,
    GOES,
    'https://www.clevelandcliffs.com/operations/steelmaking/butler-works',
    'Regular Grain-Oriented (RGO) products are used for power and distribution transformers.',
    true,
  ),

  // ---------- Magnets ----------
  needs(
    SINTERING,
    'Didymium (Nd-Pr) metal, magnet feed',
    DOE_MAGNETS,
    'The metals most commonly used in magnet production are didymium (NdPr), a mix of Nd and Pr, pure Nd, and ferrodysprosium (DyFe), with Tb metal used less frequently.',
    true,
  ),
  needs(
    SINTERING,
    'Dysprosium metal',
    DOE_MAGNETS,
    'heavy REs such as dysprosium (Dy) and terbium (Tb) are used primarily in sintered magnets to improve their resistance to demagnetization at temperatures above 120 degrees C.',
    true,
  ),

  // ---------- Companies that hold no bottleneck but rest on several ----------
  company(
    'needs',
    'NVIDIA',
    FOUNDRY,
    NVIDIA_10K,
    'We utilize foundries, such as Taiwan Semiconductor Manufacturing Company Limited, or TSMC, and Samsung Electronics Co., Ltd., or Samsung, to produce our semiconductor wafers.',
    'The filing names the foundries, not the node.',
  ),
  company(
    'needs',
    'NVIDIA',
    HBM,
    NVIDIA_10K,
    'We purchase memory from SK Hynix Inc., Micron Technology, Inc., and Samsung.',
    'Memory in general; these three are the recorded HBM makers.',
  ),
  company(
    'needs',
    'NVIDIA',
    PACKAGING,
    NVIDIA_10K,
    'We utilize CoWoS technology for semiconductor packaging.',
  ),
  company(
    'needs',
    'AMD',
    FOUNDRY,
    'https://www.sec.gov/Archives/edgar/data/2488/000000248826000018/amd-20251227.htm',
    'We utilize Taiwan Semiconductor Manufacturing Company Limited (TSMC) for the production of wafers for our HPC, FPGA and adaptive SoC products',
    'The filing names the foundry, not the node.',
  ),
  company(
    'needs',
    'Broadcom',
    FOUNDRY,
    'https://www.sec.gov/Archives/edgar/data/1730168/000173016825000121/avgo-20251102.htm',
    'The majority of our front-end wafer manufacturing operations is outsourced to external foundries, including Taiwan Semiconductor Manufacturing Company Limited ("TSMC").',
    'The filing names the foundry, not the node.',
  ),
  company(
    'sells-into',
    'Applied Materials',
    FOUNDRY,
    'https://www.sec.gov/Archives/edgar/data/6951/000162828025056742/amat-20251026.htm',
    'Our Semiconductor Systems sales are to customers that serve the following markets: foundry, logic and other; dynamic random access memory (DRAM); and flash memory (NAND).',
    'Names the market (foundry and logic), not the leading edge only.',
  ),
  company(
    'sells-into',
    'Applied Materials',
    HBM,
    'https://www.sec.gov/Archives/edgar/data/6951/000162828025056742/amat-20251026.htm',
    'Our Semiconductor Systems sales are to customers that serve the following markets: foundry, logic and other; dynamic random access memory (DRAM); and flash memory (NAND).',
    'Names DRAM, not HBM stacking specifically.',
  ),
  company(
    'sells-into',
    'Lam Research',
    FOUNDRY,
    'https://www.sec.gov/Archives/edgar/data/707549/000070754925000075/lrcx-20250629.htm',
    'Our customer base includes leading semiconductor memory, foundry, and integrated device manufacturers ("IDMs") that make products such as non-volatile memory ("NVM"), dynamic random-access memory ("DRAM"), and logic devices.',
    'Names the market (foundry, logic), not the leading edge only.',
  ),
  company(
    'sells-into',
    'Lam Research',
    HBM,
    'https://www.sec.gov/Archives/edgar/data/707549/000070754925000075/lrcx-20250629.htm',
    'Our customer base includes leading semiconductor memory, foundry, and integrated device manufacturers ("IDMs") that make products such as non-volatile memory ("NVM"), dynamic random-access memory ("DRAM"), and logic devices.',
    'Names DRAM, not HBM stacking specifically.',
  ),
];

/**
 * Joins a reader would expect and the corpus cannot yet support with a
 * source. Shown on /xray and /scenarios as the edge of the map, so an empty
 * answer reads as "not recorded", never as "not exposed".
 */
export const DEPENDENCY_GAPS: readonly string[] = [
  'Hyperscalers and model developers (Microsoft, Google, Meta, Amazon, OpenAI) → accelerators, power and transformers: no filing sentence recorded yet.',
  'Tokyo Electron, KLA, ASM International → the fabs they sell to: no filing sentence recorded yet.',
  'Marvell → leading-edge foundry: its annual report names "independent foundries" but not which.',
  'Germanium, and every chip input the corpus does not cover as a bottleneck (specialty gases other than neon and helium, substrates for packaging).',
  'Robot drives, encoders and servo motors → rare-earth magnets: not recorded.',
  'Gas turbines, switchgear and cable → their own inputs: not recorded.',
];

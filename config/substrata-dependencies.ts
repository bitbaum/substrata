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
 * Read on 2026-09-24; the hyperscaler, lab and equipment-maker rows on
 * 2026-09-25 (each row carries its own date).
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
const GRID = 'Grid interconnection queues';
const TURBINES = 'Heavy-duty gas turbine order books';
const SWITCHGEAR = 'High-voltage cable and switchgear';

const NVIDIA_10K =
  'https://www.sec.gov/Archives/edgar/data/1045810/000104581026000021/nvda-20260125.htm';
const DOE_MAGNETS =
  'https://www.energy.gov/sites/default/files/2022-02/Neodymium%20Magnets%20Supply%20Chain%20Report%20-%20Final.pdf';
const SK_SILTRON = 'https://www.sksiltron.com/m/en/wafer/wafer.do';
const MSFT_10K =
  'https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm';
const MAIA =
  'https://blogs.microsoft.com/blog/2026/01/26/maia-200-the-ai-accelerator-built-for-inference/';
const CRWV_10K =
  'https://www.sec.gov/Archives/edgar/data/1769628/000176962826000104/crwv-20251231.htm';
const ANTHROPIC_POLICY = 'https://www.anthropic.com/news/build-ai-in-america';
const ANTHROPIC_REPORT =
  'https://www-cdn.anthropic.com/0dc382a2086f6a054eeb17e8a531bd9625b8e6e5.pdf';
const KLA_10K =
  'https://www.sec.gov/Archives/edgar/data/319201/000031920126000027/klac-20260630.htm';
const TEL_IR = 'https://www.tel.com/ir/library/ar/g4alje00000000pq-att/ir2026_all_en.pdf';
const ASM_AR = 'https://www.asm.com/media/3skhiimk/asm-2025-annual-report.pdf';
const CANON_AR = 'https://global.canon/en/ir/annual/canon-annual-report-2025.pdf';
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
  readOn: string = READ,
): Dependency {
  return {
    from,
    fromKind: 'company',
    kind,
    on,
    source,
    quote,
    primary: true,
    readOn,
    ...(scope ? { scope } : {}),
  };
}

/** A company row read on 2026-09-25. Scope is required: none of these is a one-to-one join. */
const read25 = (
  kind: DependencyKind,
  from: string,
  on: string,
  source: string,
  quote: string,
  scope: string,
) => company(kind, from, on, source, quote, scope, '2026-09-25');

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
    '300 mm Non-memory chip / MPU / CIS / Logic (Driver IC)',
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
    '300 mm Memory chip / DRAM / Flash(NAND)',
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

  {
    ...needs(
      GRID,
      SWITCHGEAR,
      'https://eta-publications.lbl.gov/sites/default/files/2026-02/lbnl_2026.02.23_ba_interconnection_costs.pdf',
      'May require modest upgrades (breakers) or reconstruction of several high-voltage transmission lines.',
      true,
      'LBNL (Feb 2026), on network upgrades a new generator triggers. A cost item in the queue, not a stated supply constraint.',
    ),
    readOn: '2026-09-25',
  },

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

  // ---------- Hyperscalers and model developers ----------
  read25(
    'needs',
    'Microsoft',
    GRID,
    MSFT_10K,
    'Limitations in power availability, delays in obtaining power connections, outages, shortages, increased energy costs, or requirements imposed by utilities, regulators, or other market participants could restrict our ability to develop or expand datacenter capacity.',
    'Fiscal 2026 10-K risk factor. Names delays in power connections, not the interconnection queue by name.',
  ),
  read25(
    'needs',
    'Microsoft',
    FOUNDRY,
    MAIA,
    'Fabricated on TSMC’s cutting-edge 3-nanometer process, each Maia 200 chip contains over 140 billion transistors',
    'Microsoft’s own Maia 200 accelerator only, not the GPUs it buys.',
  ),
  read25(
    'needs',
    'Microsoft',
    HBM,
    MAIA,
    'a redesigned memory system with 216GB HBM3e at 7 TB/s',
    'Maia 200 only. Names HBM3e, not its supplier.',
  ),
  read25(
    'needs',
    'Google',
    GRID,
    'https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm',
    'We have experienced and may in the future experience supply shortages, price increases, quality issues, or longer lead times that could harm our operations, driven by raw material or component availability, manufacturing capacity, labor shortages, industry allocations, logistics capacity, inflation, foreign currency exchange rates, tariffs, sanctions and export controls, trade disputes and barriers, forced labor concerns, sourcing requirements, geopolitical tensions, armed conflicts, natural disasters or pandemics, the effects of climate change, power and transmission availability, and significant changes in the financial or business condition of our suppliers.',
    'Alphabet’s 2025 10-K. "Power and transmission availability" is one cause in a long list.',
  ),
  read25(
    'needs',
    'Google',
    HBM,
    'https://blog.google/products/google-cloud/ironwood-tpu-age-of-inference/',
    'Ironwood features enhanced SparseCore, increased HBM capacity and bandwidth, and improved ICI networking.',
    'Google’s own TPU. Names HBM, not its supplier.',
  ),
  read25(
    'needs',
    'Amazon Web Services',
    HBM,
    'https://aws.amazon.com/ai/machine-learning/trainium/',
    '144 GB HBM3e per chip, 4.9 TB/s bandwidth - 1.7x higher than Trainium2.',
    'AWS’s own Trainium3 chip. Names HBM3e, not its supplier.',
  ),
  read25(
    'needs',
    'Amazon Web Services',
    FOUNDRY,
    'https://www.aboutamazon.com/news/aws/trainium-3-ultraserver-faster-ai-training-lower-cost',
    "Amazon EC2 Trn3 UltraServers powered by AWS's first 3nm AI chip help organizations of all sizes run their most ambitious AI training and inference workloads.",
    'Names a 3 nm chip, which only leading-edge foundries make; does not name the foundry.',
  ),
  read25(
    'needs',
    'CoreWeave',
    GRID,
    CRWV_10K,
    'Limitations on generation, transmission, and distribution may limit our ability to obtain sufficient power capacity for our potential expansion sites in new or existing markets.',
    'Power capacity for new sites; does not say "queue".',
  ),
  read25(
    'needs',
    'CoreWeave',
    FOUNDRY,
    CRWV_10K,
    'For example, NVIDIA relies on suppliers such as Taiwan Semiconductor Manufacturing Company for semiconductor fabrication and other manufacturers for compute and networking components.',
    'Through NVIDIA, its GPU supplier. CoreWeave buys no wafers itself.',
  ),
  read25(
    'needs',
    'OpenAI',
    HBM,
    'https://openai.com/news/rss.xml',
    'Samsung and SK join OpenAI’s Stargate initiative to expand global AI infrastructure, scaling advanced memory chip production and building next-gen data centers in Korea.',
    'OpenAI’s own news feed; its article page refuses automated reads. Says advanced memory, not HBM.',
  ),
  read25(
    'needs',
    'Anthropic',
    GRID,
    ANTHROPIC_POLICY,
    'The U.S. can enable the buildout of large-scale infrastructure for AI training in strategic locations, including by accelerating permitting, supporting targeted transmission projects, and collaborating with utilities to speed up grid interconnection processes.',
    'A policy recommendation for US AI infrastructure, not a statement about Anthropic’s own sites.',
  ),
  read25(
    'needs',
    'Anthropic',
    TURBINES,
    ANTHROPIC_POLICY,
    'creating strategic reserves of critical grid components and gas turbines',
    'A policy recommendation. Says gas turbines, not heavy-duty ones.',
  ),
  read25(
    'needs',
    'Anthropic',
    TRANSFORMERS,
    ANTHROPIC_REPORT,
    'supply chain risks with critical grid components, including transformers and circuit breakers.',
    'Anthropic’s "Build AI in America" report on US AI infrastructure, not its own suppliers.',
  ),
  read25(
    'needs',
    'Anthropic',
    SWITCHGEAR,
    ANTHROPIC_REPORT,
    'supply chain risks with critical grid components, including transformers and circuit breakers.',
    'Circuit breakers are switchgear; cable is not named. A policy report, not its own suppliers.',
  ),
  read25(
    'needs',
    'Marvell',
    FOUNDRY,
    'https://www.sec.gov/Archives/edgar/data/1835632/000183563226000011/mrvl-20260131.htm',
    'Most of our products are manufactured by third-party foundries located in Taiwan, and other sources are located in China, Germany, South Korea, Singapore and the United States.',
    'Fiscal 2026 10-K. Names Taiwan, not TSMC and not the node.',
  ),

  // ---------- Equipment makers, by their customers ----------
  read25(
    'sells-into',
    'KLA',
    FOUNDRY,
    KLA_10K,
    'For the fiscal years ended June 30, 2026, 2025 and 2024, the following customers each accounted for more than 10% of total revenues, primarily in the Semiconductor Process Control segment:',
    'The table under this sentence names Taiwan Semiconductor Manufacturing Company Limited in all three years.',
  ),
  read25(
    'sells-into',
    'KLA',
    HBM,
    KLA_10K,
    'Our semiconductor customers generally operate in one or both of the major semiconductor device manufacturing markets: memory and foundry/logic.',
    'Memory in general. The 10-K does not mention HBM.',
  ),
  read25(
    'sells-into',
    'KLA',
    PACKAGING,
    KLA_10K,
    'Increasing complexity and value of semiconductor packages, particularly for AI and HPC applications, is also driving significant growth in our advanced packaging business.',
    'KLA’s own advanced packaging business.',
  ),
  read25(
    'sells-into',
    'Tokyo Electron',
    FOUNDRY,
    TEL_IR,
    'In the Account Sales Division, we receive and leverage next-generation technology needs shared by major semiconductor manufacturers such as those in memory, logic, and foundry businesses driving current momentum in the AI device market',
    'Integrated Report 2026. Its table of major customers names Samsung Electronics and TSMC.',
  ),
  read25(
    'sells-into',
    'Tokyo Electron',
    HBM,
    TEL_IR,
    'For DRAM, we are meeting demand for high aspect ratio etch and highly difficult capacitor film deposition to secure the capacitance necessary for 2D scaling.',
    'DRAM front-end etch and deposition, not HBM stacking.',
  ),
  read25(
    'sells-into',
    'Tokyo Electron',
    PACKAGING,
    TEL_IR,
    'In the backend process, we also possess wafer probers used in wafer testing and bonding/ debonding systems that realize 3D packaging.',
    'A product line (as extracted from the PDF), not a named customer.',
  ),
  read25(
    'sells-into',
    'ASM International',
    FOUNDRY,
    ASM_AR,
    'The leading-edge logic/foundry market was the main growth driver for ASM, on the back of 2nm investments.',
    'Annual Report 2025. Customers are not named.',
  ),
  read25(
    'sells-into',
    'ASM International',
    HBM,
    ASM_AR,
    'Advanced DRAM and HBM remain the engine for memory customers, both in terms of innovation and capacity requirements.',
    'ASM’s deposition tools for HBM-related DRAM, not the stacking step.',
  ),
  read25(
    'sells-into',
    'Canon',
    PACKAGING,
    CANON_AR,
    'unit sales of Canon’s advanced back-end lithography systems, which have become the industry standard, exceeded those of the previous year.',
    'Annual Report 2025. Back-end lithography is packaging; customers are not named.',
  ),
  read25(
    'sells-into',
    'Canon',
    HBM,
    CANON_AR,
    'Strong demand from AI data centers driving equipment growth for memory devices.',
    'A headline in the annual report. Memory in general, not HBM.',
  ),
];

/**
 * Joins a reader would expect and the corpus cannot yet support with a
 * source. Shown on /xray and /scenarios as the edge of the map, so an empty
 * answer reads as "not recorded", never as "not exposed".
 */
export const DEPENDENCY_GAPS: readonly string[] = [
  'Meta and xAI → accelerators, foundry, HBM, power: Meta’s 2025 10-K names "components, power, and network capacity" only; xAI’s own pages name NVIDIA GPUs and terrestrial power, no grid, turbine or foundry sentence.',
  'Hyperscalers → advanced packaging (CoWoS): no hyperscaler or lab source read names it. Their dependence on NVIDIA, Broadcom or other chip designers is a company-to-company join the layer does not model.',
  'Microsoft, Google, AWS, Meta, CoreWeave → transformers, turbines, switchgear: their filings name power availability, not the equipment. Anthropic’s rows are a policy report, not its own suppliers.',
  'Marvell → TSMC by name: its fiscal 2025 and 2026 10-Ks say only "third-party foundries located in Taiwan".',
  'Nikon → any fab customer, and ASM International → advanced packaging: their 2025 reports describe back-end development or R&D engagements, no sales.',
  'Robot drives, encoders and servo motors → rare-earth magnets: IEA and the EU JRC name permanent magnets for robot motion control, but no source says reduction drives or encoders use them, and no robot maker’s current report names rare earths.',
  'Gas turbines → their inputs: GE Vernova’s 2025 10-K names "specialty metals and rare earths" for the whole company; castings, forgings and blades appear only in secondary press. None is a corpus bottleneck.',
  'Switchgear and cable → their inputs: SF6 (EPA), copper, aluminium and insulation (IEA) are named by official sources but are not corpus bottlenecks; nor is transformer copper wire (DOE, 2024).',
  'Germanium: USGS (2025) records China’s export licensing and its December 2024 ban on exports to the United States. It is not a corpus bottleneck yet, so it has no assessment to join to.',
  'Specialty gases other than neon and helium, and substrates for packaging: not corpus bottlenecks.',
];

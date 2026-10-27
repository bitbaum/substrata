/**
 * What fundamentals are read, and from which XBRL concepts, in the filer's
 * preference order (lib/market-data/fundamentals/xbrl.ts explains the rules).
 */
export type MetricId =
  | 'revenue'
  | 'grossProfit'
  | 'operatingIncome'
  | 'netIncome'
  | 'researchAndDevelopment'
  | 'capex'
  | 'cash'
  | 'totalAssets'
  | 'longTermDebt'
  | 'sharesOutstanding';

export interface MetricSpec {
  id: MetricId;
  label: string;
  /** "duration" (over a period) or "instant" (on a date). */
  kind: 'duration' | 'instant';
  concepts: string[];
}

export const METRICS: readonly MetricSpec[] = [
  {
    id: 'revenue',
    label: 'Revenue',
    kind: 'duration',
    concepts: [
      'us-gaap:Revenues',
      'us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax',
      'us-gaap:SalesRevenueNet',
      'us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax',
      'ifrs-full:Revenue',
    ],
  },
  {
    id: 'grossProfit',
    label: 'Gross profit',
    kind: 'duration',
    concepts: ['us-gaap:GrossProfit', 'ifrs-full:GrossProfit'],
  },
  {
    id: 'operatingIncome',
    label: 'Operating income',
    kind: 'duration',
    concepts: ['us-gaap:OperatingIncomeLoss', 'ifrs-full:ProfitLossFromOperatingActivities'],
  },
  {
    id: 'netIncome',
    label: 'Net income',
    kind: 'duration',
    concepts: [
      'us-gaap:NetIncomeLoss',
      'ifrs-full:ProfitLossAttributableToOwnersOfParent',
      'ifrs-full:ProfitLoss',
    ],
  },
  {
    id: 'researchAndDevelopment',
    label: 'Research and development',
    kind: 'duration',
    concepts: [
      'us-gaap:ResearchAndDevelopmentExpense',
      'us-gaap:ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost',
      'ifrs-full:ResearchAndDevelopmentExpense',
    ],
  },
  {
    id: 'capex',
    label: 'Capital expenditure (purchases of property, plant and equipment)',
    kind: 'duration',
    concepts: [
      'us-gaap:PaymentsToAcquirePropertyPlantAndEquipment',
      'us-gaap:PaymentsToAcquireProductiveAssets',
      'ifrs-full:PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities',
    ],
  },
  {
    id: 'cash',
    label: 'Cash and cash equivalents',
    kind: 'instant',
    concepts: ['us-gaap:CashAndCashEquivalentsAtCarryingValue', 'ifrs-full:CashAndCashEquivalents'],
  },
  {
    id: 'totalAssets',
    label: 'Total assets',
    kind: 'instant',
    concepts: ['us-gaap:Assets', 'ifrs-full:Assets'],
  },
  {
    id: 'longTermDebt',
    label: 'Long-term debt (as tagged; current portion included where the filer tags it so)',
    kind: 'instant',
    concepts: [
      'us-gaap:LongTermDebt',
      'us-gaap:LongTermDebtNoncurrent',
      'ifrs-full:NoncurrentPortionOfNoncurrentBondsIssued',
      'ifrs-full:LongtermBorrowings',
    ],
  },
  {
    id: 'sharesOutstanding',
    label: 'Shares outstanding (cover page)',
    kind: 'instant',
    concepts: ['dei:EntityCommonStockSharesOutstanding'],
  },
];

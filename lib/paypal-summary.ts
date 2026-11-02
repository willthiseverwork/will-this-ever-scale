import type {Analysis} from './types';

export type PayPalSummary = {
  period: string;
  cameIn: number;
  fees: number;
  refunds: number;
  reachedAccount: number;
};

const monthLabel=(month:string)=>new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`));

/** Totals that can be stated from PayPal activity alone. */
export function paypalSummary(analysis:Analysis):PayPalSummary {
  const totals=analysis.period_summaries?.whole.money_map||analysis.money_map;
  const cameIn=Number(totals.came_in||0);
  const fees=Number(totals.paypal_fees||0);
  const refunds=Number(totals.refunds||0);
  return {
    period:analysis.period.start===analysis.period.end?monthLabel(analysis.period.start):`${monthLabel(analysis.period.start)}–${monthLabel(analysis.period.end)}`,
    cameIn,
    fees,
    refunds,
    reachedAccount:cameIn-fees-refunds,
  };
}

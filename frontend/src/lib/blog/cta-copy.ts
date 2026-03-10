import type { BlogCategory } from "./types";

interface CTACopy {
  headline: string;
  description: string;
}

/**
 * Category-specific inline CTA copy. Feels contextual to what the reader
 * is already learning about, rather than a generic pitch.
 */
export const INLINE_CTA_COPY: Record<BlogCategory, CTACopy> = {
  "industry-analysis": {
    headline: "See these market signals in real time",
    description:
      "DispoSight tracks distress signals across industries so you can act on trends like these before competitors.",
  },
  "asset-recovery": {
    headline: "Find asset recovery opportunities faster",
    description:
      "DispoSight surfaces distressed companies with recoverable assets — from WARN filings to bankruptcy dockets.",
  },
  "bankruptcy-guide": {
    headline: "Monitor bankruptcy filings automatically",
    description:
      "DispoSight tracks Chapter 7 and Chapter 11 filings in real time so you never miss a disposition opportunity.",
  },
  "warn-act": {
    headline: "Get WARN Act alerts as they happen",
    description:
      "DispoSight monitors every state's WARN filings and surfaces the ones most likely to produce asset deals.",
  },
  "due-diligence": {
    headline: "Streamline your deal research",
    description:
      "DispoSight aggregates distress signals from four data pipelines into one risk-scored dashboard.",
  },
  "liquidation-strategy": {
    headline: "Spot liquidation events early",
    description:
      "DispoSight detects closure signals, forced liquidations, and sell-offs before they hit the market.",
  },
  "equipment-remarketing": {
    headline: "Source equipment deals before competitors",
    description:
      "DispoSight flags companies shedding assets — from data center decommissions to plant closures.",
  },
  "distressed-investing": {
    headline: "Track distressed investment opportunities",
    description:
      "DispoSight monitors SEC filings, bankruptcy courts, and news signals to surface high-value distressed deals.",
  },
};

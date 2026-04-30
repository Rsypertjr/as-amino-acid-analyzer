// In-memory build progress tracker (zero DB overhead for polling)

export const buildProgress = {
  proteinRows: 0,
  proteinTotal: 0,
  proteinPercent: 0,
  miniMotifRows: 0,
  miniMotifProteinsProcessed: 0,
  miniMotifProteinsTotal: 0,
  miniMotifEstimatedTotal: 0,
  phase: "idle" as "idle" | "proteins" | "minimotifs" | "done" | "cancelled",
  cancelled: false,

  reset() {
    this.proteinRows = 0;
    this.proteinTotal = 0;
    this.proteinPercent = 0;
    this.miniMotifRows = 0;
    this.miniMotifProteinsProcessed = 0;
    this.miniMotifProteinsTotal = 0;
    this.miniMotifEstimatedTotal = 0;
    this.phase = "idle";
    this.cancelled = false;
  },

  cancel() {
    this.cancelled = true;
    this.phase = "cancelled";
  },
};

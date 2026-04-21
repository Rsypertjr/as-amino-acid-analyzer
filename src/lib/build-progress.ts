// In-memory build progress tracker (zero DB overhead for polling)

export const buildProgress = {
  proteinRows: 0,
  miniMotifRows: 0,
  miniMotifPercent: 0,
  phase: "idle" as "idle" | "proteins" | "minimotifs" | "done",

  reset() {
    this.proteinRows = 0;
    this.miniMotifRows = 0;
    this.miniMotifPercent = 0;
    this.phase = "idle";
  },
};

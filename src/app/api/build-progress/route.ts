import { buildProgress } from "@/lib/build-progress";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    proteinRows: buildProgress.proteinRows,
    proteinTotal: buildProgress.proteinTotal,
    proteinPercent: buildProgress.proteinPercent,
    miniMotifRows: buildProgress.miniMotifRows,
    miniMotifProteinsProcessed: buildProgress.miniMotifProteinsProcessed,
    miniMotifProteinsTotal: buildProgress.miniMotifProteinsTotal,
    miniMotifEstimatedTotal: buildProgress.miniMotifEstimatedTotal,
    phase: buildProgress.phase,
  });
}

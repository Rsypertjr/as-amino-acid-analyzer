import { buildProgress } from "@/lib/build-progress";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    proteinRows: buildProgress.proteinRows,
    miniMotifRows: buildProgress.miniMotifRows,
    miniMotifPercent: buildProgress.miniMotifPercent,
    phase: buildProgress.phase,
  });
}

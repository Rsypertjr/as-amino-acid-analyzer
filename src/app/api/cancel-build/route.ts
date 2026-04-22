import { buildProgress } from "@/lib/build-progress";
import { NextResponse } from "next/server";

export async function POST() {
  buildProgress.cancel();
  return NextResponse.json({ ok: true });
}

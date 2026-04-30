import { NextResponse } from "next/server";
import { buildDatabase } from "@/app/actions";

export async function POST(request: Request) {
  const { fileName, maxMotifLength } = await request.json();
  const result = await buildDatabase(fileName, maxMotifLength);
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { buildDatabase } from "@/app/actions";

export async function POST(request: Request) {
  const { fileName } = await request.json();
  const result = await buildDatabase(fileName);
  return NextResponse.json(result);
}

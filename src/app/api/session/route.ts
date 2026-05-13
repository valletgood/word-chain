import { NextResponse } from "next/server";
import { getOrCreateSessionId } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const sessionId = await getOrCreateSessionId();
  return NextResponse.json({ sessionId });
}

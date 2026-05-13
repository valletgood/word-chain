import { NextRequest, NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";
import { processLeave } from "@/lib/leave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sessionId = await getSessionId();
  if (sessionId) await processLeave(id, sessionId);
  return NextResponse.json({ ok: true });
}

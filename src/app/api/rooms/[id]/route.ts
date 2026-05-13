import { NextRequest, NextResponse } from "next/server";
import { loadRoomState } from "@/lib/roomState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const state = await loadRoomState(id);
  if (!state) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ room: state });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOrCreateSessionId } from "@/lib/session";
import { CH, publish } from "@/lib/realtime/bus";
import { loadRoomState } from "@/lib/roomState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sessionId = await getOrCreateSessionId();
  const body = await req.json().catch(() => ({}));
  const nickname = (body?.nickname ?? "").toString().trim();
  if (!nickname) return NextResponse.json({ error: "닉네임은 필수입니다" }, { status: 400 });

  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) return NextResponse.json({ error: "방을 찾을 수 없습니다" }, { status: 404 });

  // 본인이 호스트면 그대로 성공
  if (room.hostSessionId === sessionId) {
    const state = await loadRoomState(id);
    return NextResponse.json({ room: state });
  }
  // 이미 게스트로 참여했으면 성공
  if (room.guestSessionId === sessionId) {
    const state = await loadRoomState(id);
    return NextResponse.json({ room: state });
  }
  if (room.guestSessionId) {
    return NextResponse.json({ error: "방이 가득 찼습니다" }, { status: 409 });
  }
  if (room.status !== "waiting") {
    return NextResponse.json({ error: "참여할 수 없는 방입니다" }, { status: 409 });
  }

  await db
    .update(rooms)
    .set({ guestSessionId: sessionId, guestNickname: nickname, updatedAt: new Date() })
    .where(eq(rooms.id, id));

  const state = await loadRoomState(id);
  publish(CH.room(id), "room_updated", state);
  publish(CH.lobby, "room_updated", {
    id: room.id,
    name: room.name,
    hostNickname: room.hostNickname,
    guestNickname: nickname,
    status: room.status,
    createdAt: room.createdAt.toISOString(),
  });
  return NextResponse.json({ room: state });
}

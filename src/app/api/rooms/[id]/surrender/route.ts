import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/db/client";
import { rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionId } from "@/lib/session";
import { CH, publish } from "@/lib/realtime/bus";
import { loadRoomState } from "@/lib/roomState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sessionId = await getSessionId();
  if (!sessionId) return NextResponse.json({ error: "세션 없음" }, { status: 401 });

  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) return NextResponse.json({ error: "방 없음" }, { status: 404 });

  const isHost = room.hostSessionId === sessionId;
  const isGuest = room.guestSessionId === sessionId;
  if (!isHost && !isGuest) {
    return NextResponse.json({ error: "참가자가 아닙니다" }, { status: 403 });
  }
  if (room.status === "finished") {
    return NextResponse.json({ ok: true });
  }
  if (!room.guestSessionId) {
    return NextResponse.json({ error: "상대가 없습니다" }, { status: 409 });
  }

  const winner = isHost ? room.guestSessionId : room.hostSessionId;
  await db
    .update(rooms)
    .set({
      status: "finished",
      winnerSessionId: winner,
      loserReason: "surrender",
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, id));

  const state = await loadRoomState(id);
  after(
    Promise.all([
      publish(CH.room(id), "game_over", state),
      publish(CH.lobby, "room_updated", {
        id: room.id,
        name: room.name,
        hostNickname: room.hostNickname,
        guestNickname: room.guestNickname,
        status: "finished",
        createdAt: room.createdAt.toISOString(),
      }),
    ])
  );
  return NextResponse.json({ ok: true });
}

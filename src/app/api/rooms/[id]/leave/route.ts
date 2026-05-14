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
  if (!sessionId) return NextResponse.json({ ok: true });

  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) return NextResponse.json({ ok: true });

  const isHost = room.hostSessionId === sessionId;
  const isGuest = room.guestSessionId === sessionId;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });
  if (room.status === "finished") return NextResponse.json({ ok: true });

  if (room.status === "playing") {
    const winner = isHost ? room.guestSessionId : room.hostSessionId;
    await db
      .update(rooms)
      .set({
        status: "finished",
        winnerSessionId: winner,
        loserReason: "leave",
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

  // waiting
  if (isHost) {
    // 방장이 대기중에 나가도 row 는 보존 — 이력 표시용으로 finished 처리
    await db
      .update(rooms)
      .set({
        status: "finished",
        winnerSessionId: null,
        loserReason: "host_abandoned",
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, id));
    after(
      Promise.all([
        publish(CH.room(id), "room_closed", { id }),
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
  } else {
    await db
      .update(rooms)
      .set({ guestSessionId: null, guestNickname: null, updatedAt: new Date() })
      .where(eq(rooms.id, id));
    const state = await loadRoomState(id);
    after(
      Promise.all([
        publish(CH.room(id), "room_updated", state),
        publish(CH.lobby, "room_updated", {
          id: room.id,
          name: room.name,
          hostNickname: room.hostNickname,
          guestNickname: null,
          status: "waiting",
          createdAt: room.createdAt.toISOString(),
        }),
      ])
    );
  }
  return NextResponse.json({ ok: true });
}

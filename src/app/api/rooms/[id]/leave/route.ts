import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionId } from "@/lib/session";
import { CH, publish } from "@/lib/realtime/bus";
import { loadRoomState } from "@/lib/roomState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// sendBeacon 은 content-type 을 임의로 지정 못하므로 body 파싱은 텍스트로도 받음.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sessionId = await getSessionId();
  if (!sessionId) return NextResponse.json({ ok: true });

  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) return NextResponse.json({ ok: true });

  const isHost = room.hostSessionId === sessionId;
  const isGuest = room.guestSessionId === sessionId;
  if (!isHost && !isGuest) return NextResponse.json({ ok: true });

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
    publish(CH.room(id), "game_over", state);
    publish(CH.lobby, "room_removed", { id });
    return NextResponse.json({ ok: true });
  }

  if (room.status === "waiting") {
    if (isHost) {
      // 방장이 나가면 방 자체 폐기
      await db.delete(rooms).where(eq(rooms.id, id));
      publish(CH.room(id), "room_closed", { id });
      publish(CH.lobby, "room_removed", { id });
    } else {
      // 게스트만 자리에서 빠짐
      await db
        .update(rooms)
        .set({ guestSessionId: null, guestNickname: null, updatedAt: new Date() })
        .where(eq(rooms.id, id));
      const state = await loadRoomState(id);
      publish(CH.room(id), "room_updated", state);
      publish(CH.lobby, "room_updated", {
        id: room.id,
        name: room.name,
        hostNickname: room.hostNickname,
        guestNickname: null,
        status: "waiting",
        createdAt: room.createdAt.toISOString(),
      });
    }
  }
  return NextResponse.json({ ok: true });
}

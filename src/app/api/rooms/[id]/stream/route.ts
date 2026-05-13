import { createSSE } from "@/lib/realtime/sse";
import { CH, publish, subscribe } from "@/lib/realtime/bus";
import { db } from "@/db/client";
import { rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { loadRoomState } from "@/lib/roomState";
import { getSessionId } from "@/lib/session";
import { markPresenceClose, markPresenceOpen } from "@/lib/leave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// SSE 는 길게 열려야 하므로 명시
export const maxDuration = 300;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sessionId = await getSessionId();
  return createSSE((send) => {
    let stopped = false;
    if (sessionId) markPresenceOpen(id, sessionId);

    // 초기 상태 전송
    (async () => {
      const state = await loadRoomState(id);
      if (state) send("state", state);
    })();

    const unsub = subscribe(CH.room(id), (event, data) => send(event, data));

    // 타이머 감시 — 1초마다 deadline 체크
    const tick = setInterval(async () => {
      if (stopped) return;
      const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
      if (!room) return;
      if (room.status !== "playing" || !room.turnDeadline || !room.currentTurnSessionId) return;
      if (new Date() > room.turnDeadline) {
        const loser = room.currentTurnSessionId;
        const winner = loser === room.hostSessionId ? room.guestSessionId : room.hostSessionId;
        await db
          .update(rooms)
          .set({
            status: "finished",
            winnerSessionId: winner,
            loserReason: "timeout",
            updatedAt: new Date(),
          })
          .where(eq(rooms.id, id));
        const state = await loadRoomState(id);
        publish(CH.room(id), "game_over", state);
        publish(CH.lobby, "room_removed", { id });
      }
    }, 1000);

    return () => {
      stopped = true;
      clearInterval(tick);
      unsub();
      if (sessionId) markPresenceClose(id, sessionId);
    };
  });
}

import { db } from "@/db/client";
import { rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { CH, publish } from "./realtime/bus";
import { loadRoomState } from "./roomState";

// 한 사용자가 방에서 빠질 때의 통합 처리.
// - 대기 중 호스트 → 방 폐기
// - 대기 중 게스트 → 자리만 비움
// - 진행 중 누구든 → 상대 승리로 종료
export async function processLeave(roomId: string, sessionId: string): Promise<void> {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return;

  const isHost = room.hostSessionId === sessionId;
  const isGuest = room.guestSessionId === sessionId;
  if (!isHost && !isGuest) return;
  if (room.status === "finished") return;

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
      .where(eq(rooms.id, roomId));
    const state = await loadRoomState(roomId);
    publish(CH.room(roomId), "game_over", state);
    publish(CH.lobby, "room_removed", { id: roomId });
    return;
  }

  // waiting
  if (isHost) {
    await db.delete(rooms).where(eq(rooms.id, roomId));
    publish(CH.room(roomId), "room_closed", { id: roomId });
    publish(CH.lobby, "room_removed", { id: roomId });
  } else {
    await db
      .update(rooms)
      .set({ guestSessionId: null, guestNickname: null, updatedAt: new Date() })
      .where(eq(rooms.id, roomId));
    const state = await loadRoomState(roomId);
    publish(CH.room(roomId), "room_updated", state);
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

// 새로고침/순간 네트워크 끊김은 leave 로 잡지 않도록, SSE 끊김 후
// grace period 동안 새 연결이 안 오면 그제서야 processLeave 실행.
const GRACE_MS = 5000;
type Key = string; // `${roomId}:${sessionId}`

declare global {
  // eslint-disable-next-line no-var
  var __wc_pending_leave__: Map<Key, NodeJS.Timeout> | undefined;
  // eslint-disable-next-line no-var
  var __wc_active_presence__: Map<Key, number> | undefined;
}

const g = globalThis as typeof globalThis & {
  __wc_pending_leave__?: Map<Key, NodeJS.Timeout>;
  __wc_active_presence__?: Map<Key, number>;
};

const pending: Map<Key, NodeJS.Timeout> = g.__wc_pending_leave__ ?? (g.__wc_pending_leave__ = new Map());
// 같은 (room, session) 으로 동시에 여러 SSE 가 열려 있을 수 있으므로 카운트.
const active: Map<Key, number> = g.__wc_active_presence__ ?? (g.__wc_active_presence__ = new Map());

function k(roomId: string, sessionId: string): Key {
  return `${roomId}:${sessionId}`;
}

export function markPresenceOpen(roomId: string, sessionId: string): void {
  const key = k(roomId, sessionId);
  active.set(key, (active.get(key) ?? 0) + 1);
  const timer = pending.get(key);
  if (timer) {
    clearTimeout(timer);
    pending.delete(key);
  }
}

export function markPresenceClose(roomId: string, sessionId: string): void {
  const key = k(roomId, sessionId);
  const cur = (active.get(key) ?? 0) - 1;
  if (cur > 0) {
    active.set(key, cur);
    return;
  }
  active.delete(key);
  // 마지막 연결이 끊긴 경우만 leave 예약
  const existing = pending.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pending.delete(key);
    processLeave(roomId, sessionId).catch((e) => console.error("[leave] failed", e));
  }, GRACE_MS);
  pending.set(key, timer);
}

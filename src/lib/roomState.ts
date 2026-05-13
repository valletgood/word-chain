import { db } from "@/db/client";
import { rooms, words } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import type { RoomState, WordRow } from "@/types/game";

export async function loadRoomState(roomId: string): Promise<RoomState | null> {
  const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  if (!room) return null;
  const ws = await db
    .select()
    .from(words)
    .where(eq(words.roomId, roomId))
    .orderBy(asc(words.submissionIndex));
  return toRoomState(room, ws);
}

export function toRoomState(
  room: typeof rooms.$inferSelect,
  ws: (typeof words.$inferSelect)[]
): RoomState {
  return {
    id: room.id,
    name: room.name,
    hostNickname: room.hostNickname,
    hostSessionId: room.hostSessionId,
    guestNickname: room.guestNickname,
    guestSessionId: room.guestSessionId,
    status: room.status as RoomState["status"],
    currentTurnSessionId: room.currentTurnSessionId,
    turnDeadline: room.turnDeadline ? room.turnDeadline.toISOString() : null,
    winnerSessionId: room.winnerSessionId,
    loserReason: room.loserReason,
    words: ws.map(toWordRow),
  };
}

export function toWordRow(w: typeof words.$inferSelect): WordRow {
  return {
    id: w.id,
    turnNumber: w.turnNumber,
    submissionIndex: w.submissionIndex,
    playerSessionId: w.playerSessionId,
    playerNickname: w.playerNickname,
    word: w.word,
    isValid: w.isValid,
    invalidReason: w.invalidReason,
    submittedAt: w.submittedAt.toISOString(),
  };
}

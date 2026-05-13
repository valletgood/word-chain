import { db } from "@/db/client";
import { rooms } from "@/db/schema";
import { desc, ne } from "drizzle-orm";
import { LobbyView } from "@/components/lobby/LobbyView";
import type { RoomListItem } from "@/types/game";
import { getOrCreateSessionId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  await getOrCreateSessionId(); // 세션 쿠키 발급
  let list: RoomListItem[] = [];
  try {
    const rows = await db
      .select()
      .from(rooms)
      .where(ne(rooms.status, "finished"))
      .orderBy(desc(rooms.createdAt))
      .limit(50);
    list = rows.map((r) => ({
      id: r.id,
      name: r.name,
      hostNickname: r.hostNickname,
      guestNickname: r.guestNickname,
      status: r.status as RoomListItem["status"],
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (e) {
    console.error("[home] failed to load rooms", e);
  }
  return <LobbyView initialRooms={list} />;
}

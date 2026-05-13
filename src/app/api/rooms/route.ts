import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { rooms } from "@/db/schema";
import { desc, eq, ne } from "drizzle-orm";
import { getOrCreateSessionId } from "@/lib/session";
import { CH, publish } from "@/lib/realtime/bus";
import type { RoomListItem } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toListItem(r: typeof rooms.$inferSelect): RoomListItem {
  return {
    id: r.id,
    name: r.name,
    hostNickname: r.hostNickname,
    guestNickname: r.guestNickname,
    status: r.status as RoomListItem["status"],
    createdAt: r.createdAt.toISOString(),
  };
}

export async function GET() {
  const list = await db
    .select()
    .from(rooms)
    .where(ne(rooms.status, "finished"))
    .orderBy(desc(rooms.createdAt))
    .limit(50);
  return NextResponse.json({ rooms: list.map(toListItem) });
}

export async function POST(req: NextRequest) {
  const sessionId = await getOrCreateSessionId();
  const body = await req.json().catch(() => ({}));
  const name = (body?.name ?? "").toString().trim();
  const nickname = (body?.nickname ?? "").toString().trim();
  if (!name || !nickname) {
    return NextResponse.json({ error: "방 이름과 닉네임은 필수입니다" }, { status: 400 });
  }

  const [room] = await db
    .insert(rooms)
    .values({
      name,
      hostNickname: nickname,
      hostSessionId: sessionId,
    })
    .returning();

  await publish(CH.lobby, "room_created", toListItem(room));
  return NextResponse.json({ room: toListItem(room) });
}

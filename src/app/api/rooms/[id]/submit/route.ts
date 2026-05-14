import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/db/client";
import { rooms, words } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getSessionId } from "@/lib/session";
import { CH, publish } from "@/lib/realtime/bus";
import { loadRoomState, toWordRow } from "@/lib/roomState";
import { validateSubmission, lastChar } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sessionId = await getSessionId();
  if (!sessionId) return NextResponse.json({ error: "세션 없음" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const word = (body?.word ?? "").toString().trim();
  if (!word) return NextResponse.json({ error: "단어 필요" }, { status: 400 });

  const [room] = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!room) return NextResponse.json({ error: "방 없음" }, { status: 404 });

  // 두 플레이어 모두 차있어야 게임 가능
  if (!room.guestSessionId) {
    return NextResponse.json({ error: "참가자 부족" }, { status: 409 });
  }
  if (room.status === "finished") {
    return NextResponse.json({ error: "이미 종료된 방" }, { status: 409 });
  }

  // 첫 단어 — 방장만, 아직 playing 이 아닌 상태 (waiting → playing 으로 진입)
  const isFirstWord = room.status === "waiting";

  if (isFirstWord) {
    if (room.hostSessionId !== sessionId) {
      return NextResponse.json({ error: "첫 단어는 방장만 입력할 수 있습니다" }, { status: 403 });
    }
  } else {
    if (room.currentTurnSessionId !== sessionId) {
      return NextResponse.json({ error: "당신 차례가 아닙니다" }, { status: 403 });
    }
  }

  // 직전 유효 단어 조회
  const [lastValid] = await db
    .select()
    .from(words)
    .where(and(eq(words.roomId, id), eq(words.isValid, true)))
    .orderBy(desc(words.submissionIndex))
    .limit(1);

  // 마지막 제출 (turnNumber/submissionIndex 계산용)
  const [lastAny] = await db
    .select()
    .from(words)
    .where(eq(words.roomId, id))
    .orderBy(desc(words.submissionIndex))
    .limit(1);

  const nickname =
    sessionId === room.hostSessionId ? room.hostNickname : room.guestNickname ?? "?";

  const prevLastChar = lastValid ? lastChar(lastValid.word) : null;
  const result = await validateSubmission({ roomId: id, word, prevLastChar });

  const submissionIndex = (lastAny?.submissionIndex ?? 0) + 1;
  let turnNumber: number;
  if (isFirstWord) {
    turnNumber = 1;
  } else if (result.ok) {
    // 정답 → 같은 턴의 마지막 행보다 1 증가
    turnNumber = (lastValid?.turnNumber ?? 0) + 1;
  } else {
    // 오답 → 현재 활성 턴 유지. currentTurn 의 활성 턴 = lastValid.turnNumber + 1 (정답 차례)
    turnNumber = (lastValid?.turnNumber ?? 0) + 1;
  }

  const [inserted] = await db
    .insert(words)
    .values({
      roomId: id,
      turnNumber,
      submissionIndex,
      playerSessionId: sessionId,
      playerNickname: nickname,
      word,
      isValid: result.ok,
      invalidReason: result.ok ? null : result.reason ?? null,
    })
    .returning();

  // word_submitted 는 응답 후 백그라운드에서 발행 (사용자가 응답 기다리지 않게)
  const wordRow = toWordRow(inserted);

  if (result.ok) {
    // 턴 전환 — DB 업데이트는 응답 전 필수 (다음 요청 정합성)
    const nextTurn = otherSession(room, sessionId);
    await db
      .update(rooms)
      .set({
        status: "playing",
        currentTurnSessionId: nextTurn,
        turnDeadline: null,
        updatedAt: new Date(),
      })
      .where(eq(rooms.id, id));

    const state = await loadRoomState(id);
    after(
      Promise.all([
        publish(CH.room(id), "word_submitted", wordRow),
        publish(CH.room(id), "turn_changed", state),
        isFirstWord ? publish(CH.lobby, "room_updated", { id }) : Promise.resolve(),
      ])
    );
  } else {
    after(publish(CH.room(id), "word_submitted", wordRow));
  }

  return NextResponse.json({ ok: result.ok, reason: result.reason ?? null });
}

function otherSession(room: typeof rooms.$inferSelect, sessionId: string): string {
  if (sessionId === room.hostSessionId) return room.guestSessionId!;
  return room.hostSessionId;
}

// 서버 → 클라이언트 실시간 알림을 Supabase Realtime Broadcast 로 발행.
// Vercel 서버리스 환경에서 인스턴스 간 메모리 공유가 안되는 문제를
// Supabase 가 외부 브로커 역할을 하면서 해결한다.
//
// 발행은 Realtime HTTP API (`/realtime/v1/api/broadcast`) 로 fire-and-forget.
// 클라이언트는 supabase-js 의 `channel().on('broadcast', ...)` 로 구독한다.

import { SUPABASE_ANON, SUPABASE_URL } from "../supabase";

export const CH = {
  lobby: "lobby",
  room: (id: string) => `room:${id}`,
};

interface Message {
  topic: string;
  event: string;
  payload: unknown;
  private?: boolean;
}

export async function publish(channel: string, event: string, payload: unknown): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.warn("[bus] Supabase env 미설정 — publish 건너뜀");
    return;
  }
  const messages: Message[] = [{ topic: channel, event, payload, private: false }];
  try {
    const res = await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({ messages }),
      // Vercel 서버리스에서 응답 대기로 함수 시간 늘리지 않도록.
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[bus] broadcast failed ${res.status}: ${await res.text()}`);
    }
  } catch (e) {
    console.error("[bus] broadcast error", e);
  }
}

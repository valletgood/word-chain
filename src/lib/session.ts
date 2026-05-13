import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const COOKIE = "wc_session";

// 서버 컴포넌트에서도 안전하게 호출 가능.
// - 일반적으로 미들웨어가 쿠키를 미리 발급해 두지만, 누락된 케이스를 위해
//   Route Handler / Server Action 컨텍스트라면 직접 set 시도하고 실패하면 메모리 id 반환.
export async function getOrCreateSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  try {
    store.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {
    // Server Component 등 set 불가 컨텍스트 — 미들웨어가 다음 요청에서 발급함
  }
  return id;
}

export async function getSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

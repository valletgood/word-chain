import { NextRequest, NextResponse } from "next/server";

const COOKIE = "wc_session";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get(COOKIE)?.value) {
    const id = crypto.randomUUID();
    res.cookies.set(COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}

export const config = {
  // /api/ 는 제외 — 라우트 핸들러가 직접 쿠키를 다루고, SSE 스트리밍 응답에
  // 미들웨어가 끼어드는 걸 막기 위함.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

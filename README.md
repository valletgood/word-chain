# 끝말잇기 (Word Chain)

한국어 끝말잇기 1:1 실시간 웹게임. Next.js + React 19 + Drizzle ORM + Supabase + SSE.

## 셋업

1. 의존성 설치
   ```bash
   pnpm install
   ```

2. `.env.local` 작성 (`.env.local.example` 참고)
   ```
   DATABASE_URL=postgresql://...      # Supabase Postgres pooled URL
   STDICT_API_KEY=...                 # 국립국어원 표준국어대사전 오픈API 키
   ```

3. DB 스키마 적용
   ```bash
   pnpm db:push
   ```

4. 개발 서버
   ```bash
   pnpm dev
   ```

   `http://localhost:3000` 접속 → 닉네임 입력 → 방 생성/참여.

## 게임 규칙
- 2인 1조. 방장이 첫 단어를 입력하면서 게임 시작
- 끝말 ↔ 다음 단어 첫 글자 일치 (한글 두음법칙 적용)
- 1글자 단어 금지
- 같은 방에서 동일 단어 재사용 금지
- 표준국어대사전에 등재된 단어만 정답
- 30초 안에 정답을 못 내면 패배 — 오답은 같은 턴 내 재제출 가능

## 구조
- `src/lib/duum.ts` — 두음법칙 매핑
- `src/lib/stdict.ts` — 표준국어대사전 API
- `src/lib/validate.ts` — 제출 검증
- `src/lib/realtime/*` — SSE pub/sub
- `src/app/api/rooms/*` — 방 생성/참여/제출/스트림
- `src/app/page.tsx` — 로비
- `src/app/rooms/[id]/page.tsx` — 게임 화면 (구글 스프레드시트 스타일)

## 검증 시나리오
다른 브라우저(또는 시크릿 창) 두 개를 띄우고:
1. 양쪽 모두 닉네임 입력
2. 한 쪽에서 "새 방" 생성 → 다른 쪽 로비에 즉시 표시되는지 확인
3. 두 번째 사용자가 입장 → 양쪽 모두 "진행중" 으로 전환되는지 확인
4. 방장이 첫 단어 ("사과") → 게스트 차례, "과" 시작 단어 필요
5. 오답 (1글자 / 끝말 불일치 / 사전 미등재 / 중복) → 같은 턴 유지, 30초 카운트 계속
6. 30초 무응답 → 자동 패배 + 게임 종료

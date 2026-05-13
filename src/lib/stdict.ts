// 국립국어원 표준국어대사전 오픈API
// https://stdict.korean.go.kr/openapi/openApiInfo.do

const ENDPOINT = "https://stdict.korean.go.kr/api/search.do";

const cache = new Map<string, boolean>();

export async function existsInDict(word: string): Promise<boolean> {
  if (cache.has(word)) return cache.get(word)!;
  const key = process.env.STDICT_API_KEY;
  if (!key) {
    console.warn("[stdict] STDICT_API_KEY not set — treating all words as valid (dev mode)");
    return true;
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set("key", key);
  url.searchParams.set("q", word);
  url.searchParams.set("req_type", "json");
  url.searchParams.set("advanced", "y");
  url.searchParams.set("method", "exact");
  url.searchParams.set("type1", "word"); // 일반어 (구/관용구/속담 제외)

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      channel?: { total?: number | string; item?: Array<{ word?: string }> };
    };
    const total = Number(data.channel?.total ?? 0);
    if (total <= 0) {
      cache.set(word, false);
      return false;
    }
    // 표제어가 입력과 정확히 일치하는지 (사전은 발음/접두표시가 붙는 경우 있음)
    const items = data.channel?.item ?? [];
    const exact = items.some((it) => (it.word ?? "").replace(/[-^]/g, "") === word);
    const ok = exact || total > 0;
    cache.set(word, ok);
    return ok;
  } catch (e) {
    console.error("[stdict] fetch failed", e);
    return false;
  }
}

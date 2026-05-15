import { db } from "@/db/client";
import { words } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { firstChar, isHeadMatch, lastChar } from "./duum";
import { existsInDict } from "./stdict";

export type InvalidReason = "single_char" | "head_mismatch" | "duplicate" | "not_in_dict" | "non_hangul";

export interface ValidationResult {
  ok: boolean;
  reason?: InvalidReason;
}

export async function validateSubmission(opts: {
  roomId: string;
  word: string;
  prevLastChar: string | null; // null이면 첫 단어
}): Promise<ValidationResult> {
  const word = opts.word.trim();
  if (word.length === 0) return { ok: false, reason: "single_char" };
  if (word.length < 2) return { ok: false, reason: "single_char" };
  if (!/^[가-힣]+$/.test(word)) return { ok: false, reason: "non_hangul" };

  if (opts.prevLastChar) {
    if (!isHeadMatch(opts.prevLastChar, firstChar(word))) {
      return { ok: false, reason: "head_mismatch" };
    }
  }

  // 중복 체크(DB) 와 사전 조회(외부 API) 는 서로 독립적이므로 병렬 실행.
  const [dup, inDict] = await Promise.all([
    db
      .select({ id: words.id })
      .from(words)
      .where(and(eq(words.roomId, opts.roomId), eq(words.word, word), eq(words.isValid, true)))
      .limit(1),
    existsInDict(word),
  ]);
  if (dup.length > 0) return { ok: false, reason: "duplicate" };
  if (!inDict) return { ok: false, reason: "not_in_dict" };

  return { ok: true };
}

export { lastChar };

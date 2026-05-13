// 한글 두음법칙 처리: 단어의 끝 음절(prev)이 주어졌을 때
// 다음 단어의 첫 음절(next)이 매칭되는지 판정.

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

const CHO_BASE = 21 * 28;
const JUNG_BASE = 28;

// 초성 인덱스: 0:ㄱ 1:ㄲ 2:ㄴ 3:ㄷ 4:ㄸ 5:ㄹ 6:ㅁ 7:ㅂ 8:ㅃ 9:ㅅ 10:ㅆ 11:ㅇ
// 12:ㅈ 13:ㅉ 14:ㅊ 15:ㅋ 16:ㅌ 17:ㅍ 18:ㅎ
// 중성 인덱스: 0:ㅏ 1:ㅐ 2:ㅑ 3:ㅒ 4:ㅓ 5:ㅔ 6:ㅕ 7:ㅖ 8:ㅗ 9:ㅘ 10:ㅙ 11:ㅚ
// 12:ㅛ 13:ㅜ 14:ㅝ 15:ㅞ 16:ㅟ 17:ㅠ 18:ㅡ 19:ㅢ 20:ㅣ
const CHO_NIEUN = 2;
const CHO_RIEUL = 5;
const CHO_IEUNG = 11;

function isHangulSyllable(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= HANGUL_BASE && code <= HANGUL_END;
}

function decompose(ch: string): { cho: number; jung: number; jong: number } | null {
  if (!isHangulSyllable(ch)) return null;
  const idx = ch.charCodeAt(0) - HANGUL_BASE;
  return {
    cho: Math.floor(idx / CHO_BASE),
    jung: Math.floor((idx % CHO_BASE) / JUNG_BASE),
    jong: idx % JUNG_BASE,
  };
}

function compose(cho: number, jung: number, jong: number): string {
  return String.fromCharCode(HANGUL_BASE + cho * CHO_BASE + jung * JUNG_BASE + jong);
}

// 두음법칙으로 음절 변환:
// 1) 초성 ㄹ + 중성[ㅑ,ㅕ,ㅖ,ㅛ,ㅠ,ㅣ] → 초성 ㅇ (예: 력→역, 료→요, 리→이, 류→유)
// 2) 초성 ㄹ + 중성[ㅏ,ㅐ,ㅗ,ㅚ,ㅜ,ㅡ] → 초성 ㄴ (예: 락→낙, 래→내, 로→노, 뢰→뇌, 루→누)
// 3) 초성 ㄴ + 중성[ㅑ,ㅕ,ㅖ,ㅛ,ㅠ,ㅣ] → 초성 ㅇ (예: 녀→여, 뇨→요, 니→이)
const JUNG_TO_IEUNG = new Set([2, 6, 7, 12, 17, 20]); // ㅑㅕㅖㅛㅠㅣ
const JUNG_TO_NIEUN = new Set([0, 1, 8, 11, 13, 18]); // ㄹ + ㅏㅐㅗㅚㅜㅡ → ㄴ

function applyDuumVariants(ch: string): string[] {
  const d = decompose(ch);
  if (!d) return [ch];
  const variants = new Set<string>([ch]);
  if (d.cho === CHO_RIEUL) {
    if (JUNG_TO_IEUNG.has(d.jung)) variants.add(compose(CHO_IEUNG, d.jung, d.jong));
    if (JUNG_TO_NIEUN.has(d.jung)) variants.add(compose(CHO_NIEUN, d.jung, d.jong));
  } else if (d.cho === CHO_NIEUN) {
    if (JUNG_TO_IEUNG.has(d.jung)) variants.add(compose(CHO_IEUNG, d.jung, d.jong));
  }
  return [...variants];
}

// prev 의 끝 음절을 기준으로 next 의 첫 음절이 받아들여지는 모든 변형 후보.
// 끝 음절 자체 + 그 음절의 두음변환들도 시작점이 될 수 있다.
export function getAcceptableHeads(lastChar: string): Set<string> {
  return new Set(applyDuumVariants(lastChar));
}

export function isHeadMatch(prevLast: string, nextFirst: string): boolean {
  return getAcceptableHeads(prevLast).has(nextFirst);
}

export function lastChar(word: string): string {
  return word[word.length - 1] ?? "";
}

export function firstChar(word: string): string {
  return word[0] ?? "";
}

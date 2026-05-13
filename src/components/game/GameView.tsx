"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomState, WordRow } from "@/types/game";
import { SheetToolbar } from "@/components/SheetHeader";

const INVALID_LABEL: Record<string, string> = {
  single_char: "한 글자 단어 금지",
  head_mismatch: "끝말 불일치",
  duplicate: "중복 단어",
  not_in_dict: "사전에 없음",
  non_hangul: "한글만 가능",
};

export function GameView({
  initialState,
  mySessionId,
}: {
  initialState: RoomState;
  mySessionId: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<RoomState>(initialState);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // SSE
  useEffect(() => {
    const es = new EventSource(`/api/rooms/${state.id}/stream`);
    es.addEventListener("state", (e) => {
      setState(JSON.parse((e as MessageEvent).data));
    });
    es.addEventListener("turn_changed", (e) => {
      setState(JSON.parse((e as MessageEvent).data));
    });
    es.addEventListener("game_over", (e) => {
      setState(JSON.parse((e as MessageEvent).data));
    });
    es.addEventListener("room_updated", (e) => {
      setState(JSON.parse((e as MessageEvent).data));
    });
    es.addEventListener("word_submitted", (e) => {
      const w = JSON.parse((e as MessageEvent).data) as WordRow;
      setState((cur) => ({
        ...cur,
        words: [...cur.words.filter((x) => x.id !== w.id), w].sort(
          (a, b) => a.submissionIndex - b.submissionIndex
        ),
      }));
    });
    return () => es.close();
  }, [state.id]);

  const isHost = state.hostSessionId === mySessionId;
  const isGuest = state.guestSessionId === mySessionId;
  const amInRoom = isHost || isGuest;
  const myNickname = isHost ? state.hostNickname : state.guestNickname ?? "?";

  const isFirstWord = state.status === "waiting";
  const canSubmit =
    state.status !== "finished" &&
    amInRoom &&
    !!state.guestSessionId &&
    (isFirstWord ? isHost : state.currentTurnSessionId === mySessionId);

  const lastValid = useMemo(
    () => [...state.words].reverse().find((w) => w.isValid),
    [state.words]
  );
  const needHead = lastValid ? lastChar(lastValid.word) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const w = input.trim();
    if (!w) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/rooms/${state.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: w }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "제출 실패");
      } else if (!data.ok) {
        setMsg(INVALID_LABEL[data.reason] ?? "오답");
        setInput("");
      } else {
        setInput("");
        setMsg(null);
      }
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <SheetToolbar
        title={`끝말잇기 — ${state.name}`}
        right={
          <button
            onClick={() => router.push("/")}
            className="h-7 border border-sheet-headerBorder bg-white px-3 text-sm hover:bg-sheet-header"
          >
            로비로
          </button>
        }
      />

      <StatusBar state={state} mySessionId={mySessionId} myNickname={myNickname} />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-16" />
            <col className="w-40" />
            <col />
            <col className="w-32" />
            <col className="w-44" />
          </colgroup>
          <thead>
            <tr className="bg-sheet-header">
              {["", "A   턴", "B   플레이어", "C   단어", "D   시간", "E   결과"].map((h, i) => (
                <th
                  key={i}
                  className="border border-sheet-headerBorder px-2 py-1 text-left text-xs font-normal text-[#5f6368]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.words.map((w, i) => (
              <tr
                key={w.id}
                className={
                  w.isValid
                    ? i % 2 === 1
                      ? "bg-sheet-rowAlt"
                      : "bg-white"
                    : "bg-sheet-error"
                }
              >
                <td className="border border-sheet-border px-2 py-1 text-right text-[#5f6368]">{i + 1}</td>
                <td className="border border-sheet-border px-2 py-1">{w.turnNumber}</td>
                <td className="border border-sheet-border px-2 py-1">{w.playerNickname}</td>
                <td className="border border-sheet-border px-2 py-1 font-medium">{w.word}</td>
                <td className="border border-sheet-border px-2 py-1 text-[#5f6368]">
                  {new Date(w.submittedAt).toLocaleTimeString("ko-KR", { hour12: false })}
                </td>
                <td className="border border-sheet-border px-2 py-1">
                  {w.isValid ? (
                    <span className="text-sheet-validText">✓ 정답</span>
                  ) : (
                    <span className="text-sheet-errorText">
                      ✗ {INVALID_LABEL[w.invalidReason ?? ""] ?? w.invalidReason}
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {/* 입력 행 (활성 셀) */}
            {state.status !== "finished" && (
              <tr className="bg-white">
                <td className="border border-sheet-border px-2 py-1 text-right text-[#5f6368]">
                  {state.words.length + 1}
                </td>
                <td className="border border-sheet-border px-2 py-1 text-[#5f6368]">
                  {(lastValid?.turnNumber ?? 0) + 1}
                </td>
                <td className="border border-sheet-border px-2 py-1">
                  {currentTurnNickname(state)}
                </td>
                <td className="relative border border-sheet-border p-0">
                  <form onSubmit={onSubmit}>
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={!canSubmit || submitting}
                      placeholder={
                        canSubmit
                          ? needHead
                            ? `'${needHead}' 로 시작하는 단어 (두음 허용)`
                            : "첫 단어를 입력하세요"
                          : "차례를 기다리는 중…"
                      }
                      className={`h-8 w-full bg-transparent px-2 outline-none ${
                        canSubmit
                          ? "outline-2 outline-sheet-selected -outline-offset-2"
                          : ""
                      }`}
                    />
                  </form>
                </td>
                <td className="border border-sheet-border px-2 py-1">
                  {state.status === "playing" && state.turnDeadline ? (
                    <Countdown deadline={state.turnDeadline} />
                  ) : (
                    <span className="text-[#5f6368]">—</span>
                  )}
                </td>
                <td className="border border-sheet-border px-2 py-1 text-xs">
                  {msg && <span className="text-sheet-errorText">{msg}</span>}
                  {canSubmit && !msg && <span className="text-[#5f6368]">Enter 로 제출</span>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {state.status === "finished" && <GameOverBanner state={state} mySessionId={mySessionId} />}
    </div>
  );
}

function lastChar(s: string): string {
  return s[s.length - 1] ?? "";
}

function currentTurnNickname(state: RoomState): string {
  if (state.status === "waiting") return state.hostNickname + " (첫 단어)";
  const id = state.currentTurnSessionId;
  if (!id) return "—";
  return id === state.hostSessionId ? state.hostNickname : state.guestNickname ?? "?";
}

function StatusBar({
  state,
  mySessionId,
  myNickname,
}: {
  state: RoomState;
  mySessionId: string;
  myNickname: string;
}) {
  const youAre = state.hostSessionId === mySessionId ? "방장" : state.guestSessionId === mySessionId ? "게스트" : "관전";
  return (
    <div className="flex items-center gap-4 border-b border-sheet-border bg-sheet-header px-4 py-2 text-xs text-[#5f6368]">
      <span>내 닉네임: <b className="text-black">{myNickname}</b> ({youAre})</span>
      <span>방장: {state.hostNickname}</span>
      <span>게스트: {state.guestNickname ?? "— (대기중)"}</span>
      <span>
        상태:{" "}
        <b className="text-black">
          {state.status === "waiting" ? "대기" : state.status === "playing" ? "진행중" : "종료"}
        </b>
      </span>
    </div>
  );
}

function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  const remain = Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
  const color = remain <= 5 ? "text-sheet-errorText" : remain <= 10 ? "text-[#b06000]" : "text-black";
  return <span className={`font-mono ${color}`}>{remain}s 남음</span>;
}

function GameOverBanner({ state, mySessionId }: { state: RoomState; mySessionId: string }) {
  const winnerNick =
    state.winnerSessionId === state.hostSessionId
      ? state.hostNickname
      : state.winnerSessionId === state.guestSessionId
      ? state.guestNickname
      : "?";
  const youWon = state.winnerSessionId === mySessionId;
  return (
    <div className="mx-4 mt-4 border border-sheet-headerBorder bg-sheet-header p-4 text-center">
      <div className="text-base">
        🏁 게임 종료 — <b>{winnerNick}</b> 승리 (사유: {state.loserReason === "timeout" ? "시간 초과" : state.loserReason})
      </div>
      <div className="mt-1 text-xs text-[#5f6368]">
        {youWon ? "당신이 이겼습니다!" : state.winnerSessionId ? "다음 기회에…" : ""}
      </div>
    </div>
  );
}

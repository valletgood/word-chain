"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomListItem } from "@/types/game";
import { SheetToolbar } from "@/components/SheetHeader";
import { getSupabase } from "@/lib/supabase";
import { CH } from "@/lib/realtime/bus";

const NICK_KEY = "wc_nickname";

export function LobbyView({ initialRooms }: { initialRooms: RoomListItem[] }) {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomListItem[]>(initialRooms);
  const [nickname, setNickname] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setNickname(localStorage.getItem(NICK_KEY) ?? "");
  }, []);
  useEffect(() => {
    if (nickname) localStorage.setItem(NICK_KEY, nickname);
  }, [nickname]);

  // Supabase Realtime — 로비 채널 구독
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase.channel(CH.lobby);
    channel.on("broadcast", { event: "room_created" }, ({ payload }) => {
      const r = payload as RoomListItem;
      setRooms((cur) => [r, ...cur.filter((x) => x.id !== r.id)]);
    });
    channel.on("broadcast", { event: "room_updated" }, ({ payload }) => {
      const r = payload as Partial<RoomListItem> & { id: string };
      setRooms((cur) => cur.map((x) => (x.id === r.id ? { ...x, ...r } : x)));
    });
    channel.on("broadcast", { event: "room_removed" }, ({ payload }) => {
      const r = payload as { id: string };
      setRooms((cur) => cur.filter((x) => x.id !== r.id));
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function ensureSession() {
    await fetch("/api/session");
  }

  async function createRoom() {
    setErr(null);
    if (!nickname.trim()) return setErr("닉네임을 입력하세요");
    if (!newName.trim()) return setErr("방 이름을 입력하세요");
    setCreating(true);
    try {
      await ensureSession();
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      router.push(`/rooms/${data.room.id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function joinRoom(id: string) {
    setErr(null);
    if (!nickname.trim()) return setErr("닉네임을 입력하세요");
    setJoiningId(id);
    try {
      await ensureSession();
      const res = await fetch(`/api/rooms/${id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "참여 실패");
      router.push(`/rooms/${id}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setJoiningId(null);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <SheetToolbar
        title="끝말잇기 — 게임방"
        right={
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#5f6368]">닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={12}
              placeholder="닉네임"
              className="h-7 w-32 border border-sheet-headerBorder px-2 text-sm outline-none focus:border-sheet-selected"
            />
          </div>
        }
      />

      {/* 생성 영역 — 스프레드시트 입력 줄 느낌 */}
      <div className="flex items-center gap-2 border-b border-sheet-border bg-sheet-header px-4 py-2">
        <span className="text-xs text-[#5f6368]">새 방</span>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="방 이름"
          maxLength={30}
          className="h-7 w-64 border border-sheet-headerBorder bg-white px-2 text-sm outline-none focus:border-sheet-selected"
        />
        <button
          onClick={createRoom}
          disabled={creating}
          className="h-7 border border-sheet-headerBorder bg-white px-3 text-sm hover:bg-sheet-header disabled:opacity-50"
        >
          {creating ? "생성중…" : "생성"}
        </button>
        {err && <span className="text-xs text-sheet-errorText">{err}</span>}
      </div>

      {/* 시트 헤더 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-40" />
            <col className="w-40" />
            <col className="w-24" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className="bg-sheet-header">
              {["", "A   방 이름", "B   방장", "C   참가자", "D   상태", "E   입장"].map((h, i) => (
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
            {rooms.length === 0 && (
              <tr>
                <td className="border border-sheet-border px-2 py-1 text-right text-[#5f6368]">1</td>
                <td colSpan={5} className="border border-sheet-border px-2 py-2 text-center text-[#5f6368]">
                  생성된 방이 없습니다. 새 방을 만들어 보세요.
                </td>
              </tr>
            )}
            {rooms.map((r, i) => (
              <tr key={r.id} className={i % 2 === 1 ? "bg-sheet-rowAlt" : "bg-white"}>
                <td className="border border-sheet-border px-2 py-1 text-right text-[#5f6368]">{i + 1}</td>
                <td className="border border-sheet-border px-2 py-1">{r.name}</td>
                <td className="border border-sheet-border px-2 py-1">{r.hostNickname}</td>
                <td className="border border-sheet-border px-2 py-1">{r.guestNickname ?? "—"}</td>
                <td className="border border-sheet-border px-2 py-1">
                  <StatusBadge status={r.status} />
                </td>
                <td className="border border-sheet-border px-2 py-1">
                  <button
                    onClick={() => joinRoom(r.id)}
                    disabled={joiningId === r.id || (r.status !== "waiting" && r.guestNickname !== null)}
                    className="h-6 border border-sheet-headerBorder bg-white px-2 text-xs hover:bg-sheet-header disabled:opacity-50"
                  >
                    {joiningId === r.id ? "…" : "입장"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: RoomListItem["status"] }) {
  const map = {
    waiting: { bg: "#fff7e0", color: "#b06000", label: "대기" },
    playing: { bg: "#e6f4ea", color: "#137333", label: "진행중" },
    finished: { bg: "#fce8e6", color: "#c5221f", label: "종료" },
  } as const;
  const v = map[status];
  return (
    <span
      className="inline-block rounded-sm px-1.5 py-0.5 text-xs"
      style={{ background: v.bg, color: v.color }}
    >
      {v.label}
    </span>
  );
}

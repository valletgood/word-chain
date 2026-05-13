import { notFound } from "next/navigation";
import { loadRoomState } from "@/lib/roomState";
import { getOrCreateSessionId } from "@/lib/session";
import { GameView } from "@/components/game/GameView";

export const dynamic = "force-dynamic";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = await getOrCreateSessionId();
  const state = await loadRoomState(id);
  if (!state) notFound();
  return <GameView initialState={state} mySessionId={sessionId} />;
}

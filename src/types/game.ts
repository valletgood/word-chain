export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomListItem {
  id: string;
  name: string;
  hostNickname: string;
  guestNickname: string | null;
  status: RoomStatus;
  createdAt: string;
}

export interface WordRow {
  id: string;
  turnNumber: number;
  submissionIndex: number;
  playerSessionId: string;
  playerNickname: string;
  word: string;
  isValid: boolean;
  invalidReason: string | null;
  submittedAt: string;
}

export interface RoomState {
  id: string;
  name: string;
  hostNickname: string;
  hostSessionId: string;
  guestNickname: string | null;
  guestSessionId: string | null;
  status: RoomStatus;
  currentTurnSessionId: string | null;
  turnDeadline: string | null;
  winnerSessionId: string | null;
  loserReason: string | null;
  words: WordRow[];
}

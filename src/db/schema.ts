import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, boolean, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  hostNickname: text("host_nickname").notNull(),
  hostSessionId: text("host_session_id").notNull(),
  guestNickname: text("guest_nickname"),
  guestSessionId: text("guest_session_id"),
  status: text("status").notNull().default("waiting"), // waiting | playing | finished
  currentTurnSessionId: text("current_turn_session_id"),
  turnDeadline: timestamp("turn_deadline", { withTimezone: true }),
  winnerSessionId: text("winner_session_id"),
  loserReason: text("loser_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const words = pgTable(
  "words",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roomId: uuid("room_id").notNull().references(() => rooms.id, { onDelete: "cascade" }),
    turnNumber: integer("turn_number").notNull(),
    submissionIndex: integer("submission_index").notNull(),
    playerSessionId: text("player_session_id").notNull(),
    playerNickname: text("player_nickname").notNull(),
    word: text("word").notNull(),
    isValid: boolean("is_valid").notNull(),
    invalidReason: text("invalid_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    roomIdx: index("words_room_idx").on(t.roomId, t.submissionIndex),
    validIdx: uniqueIndex("words_room_valid_word_idx")
      .on(t.roomId, t.word)
      .where(sql`is_valid = true`),
  })
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Word = typeof words.$inferSelect;
export type NewWord = typeof words.$inferInsert;

// In-memory pub/sub for SSE. MVP: assumes single Node instance.
// Replace with Supabase Realtime / Redis pubsub when scaling.

type Listener = (event: string, data: unknown) => void;

declare global {
  // eslint-disable-next-line no-var
  var __wc_bus__: Map<string, Set<Listener>> | undefined;
}

const g = globalThis as typeof globalThis & { __wc_bus__?: Map<string, Set<Listener>> };
const channels: Map<string, Set<Listener>> =
  g.__wc_bus__ ?? (g.__wc_bus__ = new Map());

export function subscribe(channel: string, listener: Listener): () => void {
  let set = channels.get(channel);
  if (!set) {
    set = new Set();
    channels.set(channel, set);
  }
  set.add(listener);
  console.log(`[bus] sub ${channel} → ${set.size} listeners`);
  return () => {
    set!.delete(listener);
    console.log(`[bus] unsub ${channel} → ${set!.size} listeners`);
    if (set!.size === 0) channels.delete(channel);
  };
}

export function publish(channel: string, event: string, data: unknown): void {
  const set = channels.get(channel);
  console.log(`[bus] pub ${channel} ${event} → ${set?.size ?? 0} listeners`);
  if (!set) return;
  for (const l of set) {
    try {
      l(event, data);
    } catch (e) {
      console.error("[bus] listener error", e);
    }
  }
}

export const CH = {
  lobby: "lobby",
  room: (id: string) => `room:${id}`,
};

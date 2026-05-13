import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 비어있음");
}

declare global {
  // eslint-disable-next-line no-var
  var __wc_supabase__: SupabaseClient | undefined;
}

export function getSupabase(): SupabaseClient {
  if (globalThis.__wc_supabase__) return globalThis.__wc_supabase__;
  if (!url || !anon) {
    throw new Error(
      "Supabase env 가 비어있습니다. .env.local 에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정하세요."
    );
  }
  const client = createClient(url, anon, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  if (process.env.NODE_ENV !== "production") globalThis.__wc_supabase__ = client;
  return client;
}

export const SUPABASE_URL = url ?? "";
export const SUPABASE_ANON = anon ?? "";

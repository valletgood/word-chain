import { createSSE } from "@/lib/realtime/sse";
import { CH, subscribe } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return createSSE((send) => {
    return subscribe(CH.lobby, (event, data) => send(event, data));
  });
}

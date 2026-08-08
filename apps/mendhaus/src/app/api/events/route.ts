import { NextResponse } from "next/server";
import { z } from "zod";
import { MH_EVENTS, recordEvent, recordEvents, type EventInput } from "@/lib/events";

const EventSchema = z.object({
  name: z.enum(MH_EVENTS),
  sessionId: z.string().uuid(),
  productId: z.string().max(80).optional(),
  attribution: z.unknown().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const Body = z.union([
  EventSchema,
  z.object({
    events: z.array(EventSchema).min(1).max(50),
  }),
]);

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const items: EventInput[] =
    "events" in parsed.data
      ? parsed.data.events.map((e) => ({
          name: e.name,
          sessionId: e.sessionId,
          productId: e.productId,
          attribution: e.attribution,
          metadata: e.metadata,
        }))
      : [
          {
            name: parsed.data.name,
            sessionId: parsed.data.sessionId,
            productId: parsed.data.productId,
            attribution: parsed.data.attribution,
            metadata: parsed.data.metadata,
          },
        ];

  if (items.length === 1) {
    await recordEvent(items[0]);
  } else {
    await recordEvents(items);
  }

  return NextResponse.json({ ok: true, accepted: items.length });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { MH_EVENTS, recordEvent, recordEvents, type EventInput } from "@/lib/events";

const EventSchema = z.object({
  eventId: z.string().uuid(),
  name: z.enum(MH_EVENTS),
  sessionId: z.string().uuid(),
  productId: z.string().max(80).optional(),
  attribution: z
    .object({
      channel: z.string().max(40).optional(),
      persona: z.string().max(80).optional(),
      angleIndex: z.number().int().min(0).max(20).optional(),
      landingPath: z.string().max(180).optional(),
      patternKey: z.string().max(160).optional(),
    })
    .optional(),
  metadata: z
    .record(z.string().max(50), z.union([z.string().max(240), z.number(), z.boolean()]))
    .optional(),
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
          eventId: e.eventId,
          name: e.name,
          sessionId: e.sessionId,
          productId: e.productId,
          attribution: e.attribution,
          metadata: e.metadata,
        }))
      : [
          {
            eventId: parsed.data.eventId,
            name: parsed.data.name,
            sessionId: parsed.data.sessionId,
            productId: parsed.data.productId,
            attribution: parsed.data.attribution,
            metadata: parsed.data.metadata,
          },
        ];

  try {
    if (items.length === 1) {
      await recordEvent(items[0]);
    } else {
      await recordEvents(items);
    }
  } catch (error) {
    return NextResponse.json(
      { error: `Event capture unavailable: ${(error as Error).message}` },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, accepted: items.length });
}

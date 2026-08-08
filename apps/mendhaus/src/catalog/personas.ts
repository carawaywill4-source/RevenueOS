/**
 * Mendhaus buyer personas — portable archetypes, not individuals.
 * Used to tag catalog products and plan truthful acquisition angles.
 */

export type PersonaId = "renter" | "kitchen-reset" | "desk-worker" | "pet-home";

export type Persona = {
  id: PersonaId;
  label: string;
  tagline: string;
  traits: string[];
  channels: string[];
  angles: string[];
  habits: string[];
  triggers: string[];
  objections: string[];
  notes: string;
};

export const PERSONAS: Persona[] = [
  {
    id: "renter",
    label: "Renter who still wants it to feel like home",
    tagline:
      "Small upgrades that install without a drill, and come down when the lease does.",
    traits: [
      "lease-conscious",
      "budget-aware but not cheap",
      "wants a calmer apartment without risking the deposit",
      "reads install instructions before buying",
    ],
    channels: [
      "organic_search",
      "content_seo",
      "communities",
      "social_organic",
      "reddit_renting",
      "pinterest",
      "apartment_forums",
    ],
    angles: [
      "No-drill and over-the-door first — keep the walls intact",
      "Check your lease; we describe install honestly, not as damage-proof",
      "Takes minutes, comes with you when you move",
      "A better apartment without a renovation",
    ],
    habits: [
      "searches 'no drill', 'renter friendly', 'over the door', 'tension rod'",
      "screenshots product pages to send a roommate before buying",
      "abandons listings that require screws into tile or painted drywall",
      "shops after moving in, then again after the first annoying week",
    ],
    triggers: [
      "a new lease and empty walls",
      "a landlord email about holes or paint",
      "a roommate's mess with nowhere to hang things",
      "a dark hallway or steamy bathroom that is annoying every day",
    ],
    objections: [
      "Will this mark the paint when I leave?",
      "Is tension actually stable, or will it fall at 2 a.m.?",
      "Does my building even allow adhesive on walls?",
      "Can I take it to the next place?",
    ],
    notes:
      "Never claim landlord approval, deposit protection, or damage-free guarantees. Adhesive and film copy must say results depend on paint, humidity, and removal method.",
  },
  {
    id: "kitchen-reset",
    label: "Kitchen reset — tired of the daily mess",
    tagline: "The sink, fridge, and counters finally have a place for the annoying stuff.",
    traits: [
      "time-poor on weeknights",
      "visually bothered by clutter",
      "will pay for one tool that removes a daily friction",
      "compares materials (steel, bamboo, food-safe plastic) not just price",
    ],
    channels: [
      "organic_search",
      "content_seo",
      "pinterest",
      "youtube_shorts",
      "instagram",
      "tiktok_home",
      "communities",
    ],
    angles: [
      "One small fix for the spot you wipe every night",
      "See the before: bottles under the sink, dishes in the basin",
      "Not a full reno — a better Tuesday",
      "Materials you can actually clean, not flimsy dropship plastic",
    ],
    habits: [
      "searches the exact problem ('under sink organizer leaking bottles')",
      "watches 15-second install clips before adding to cart",
      "buys after cooking when the mess is still visible",
      "bundles a second kitchen tool if shipping is already happening",
    ],
    triggers: [
      "a leaky soap bottle pooling under the sink",
      "guests coming over and the counter looks chaotic",
      "a new apartment kitchen with zero useful storage",
      "meal-prep Sunday when the fridge door will not close",
    ],
    objections: [
      "Will this fit my cabinet / sink width?",
      "Is it food-safe / rust-proof near water?",
      "Does it trap grime in hard-to-clean corners?",
      "Is this just another gadget I will not use?",
    ],
    notes:
      "Lead with dimensions, drain holes, and wipe-clean materials. Do not claim it 'transforms' a kitchen or replaces a remodel.",
  },
  {
    id: "desk-worker",
    label: "Desk worker with a small home office",
    tagline: "A clearer desk, fewer cables, a screen at a height that does not hurt.",
    traits: [
      "works from home some or all days",
      "noticeable neck/wrist fatigue",
      "cares about a tidy video-call background",
      "will research weight ratings and desk depth",
    ],
    channels: [
      "organic_search",
      "content_seo",
      "youtube",
      "reddit_wfh",
      "linkedin_organic",
      "communities",
      "email_list",
    ],
    angles: [
      "Raise the screen, hide the cables, keep the footprint small",
      "Built for a real desk, not a warehouse aesthetic shot",
      "Comfort you notice by 3 p.m., not a gadget you forget",
      "One order that makes the workday look and feel calmer",
    ],
    habits: [
      "searches 'monitor stand with storage', 'cable management raceway', 'laptop riser aluminum'",
      "measures desk depth before buying",
      "watches sit/stand and cable-routing demos",
      "buys mid-week after a sore-neck day, not only on payday",
    ],
    triggers: [
      "a new WFH setup or a move to a smaller desk",
      "a video call where the camera angle looks bad",
      "cables catching on a chair every time they stand up",
      "a partner commenting on the living-room office mess",
    ],
    objections: [
      "Will this hold my monitor / laptop weight?",
      "Is the height actually useful, or just a tiny lift?",
      "Will adhesive cable clips ruin the desk finish?",
      "Does it look cheap on camera?",
    ],
    notes:
      "Publish weight ratings, desk-depth fit, and adhesive vs screw options. No ergonomic medical claims.",
  },
  {
    id: "pet-home",
    label: "Pet home — hair, bowls, and muddy paws",
    tagline: "Less hair on the sofa, fewer bowls underfoot, a floor you can actually reset.",
    traits: [
      "lives with at least one dog or cat",
      "cleans more often than they want to",
      "skeptical of 'pet hair miracle' gadgets",
      "will pay for tools that survive daily use",
    ],
    channels: [
      "organic_search",
      "communities",
      "instagram",
      "tiktok_pets",
      "facebook_groups",
      "youtube",
      "referral",
    ],
    angles: [
      "Made for daily pet mess, not a one-time unboxing",
      "Hair, water, and mud — pick the actual problem",
      "No miracle coat claims; just tools that pick up what you can see",
      "Renter-safe options for bowls, hooks, and entryway mess",
    ],
    habits: [
      "searches 'pet hair broom', 'rubber broom hardwood', 'entryway boot tray'",
      "asks in pet groups what actually lasts",
      "rebuy or bundles cleaning tools after grooming season",
      "avoids products that look flimsy around water bowls",
    ],
    triggers: [
      "shedding season hitting the sofa",
      "a guest sitting down and standing up covered in hair",
      "wet paws after rain",
      "a new puppy or a second pet overwhelming the old routine",
    ],
    objections: [
      "Does this work on my floor type (hardwood vs carpet)?",
      "Will the dog knock it over?",
      "Is this just a lint roller with extra steps?",
      "Can I wash the parts, or do I keep buying refills?",
    ],
    notes:
      "Never claim to eliminate shedding, allergies, or odors. Be specific about floor type and washable parts.",
  },
];

export function getPersona(id: string): Persona | undefined {
  return PERSONAS.find((persona) => persona.id === id);
}

export function listPersonaIds(): PersonaId[] {
  return PERSONAS.map((persona) => persona.id);
}

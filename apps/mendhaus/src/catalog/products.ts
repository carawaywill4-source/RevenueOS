/**
 * Mendhaus product catalog — small fixes for a better home.
 * Supplier SKUs and live prices are hints until the owner confirms them.
 */

export const CATEGORIES = [
  "kitchen",
  "bathroom",
  "bedroom",
  "closet",
  "desk",
  "cleaning",
  "lighting",
  "renter",
] as const;

export type ProductCategory = (typeof CATEGORIES)[number];

export type SupplierNetwork = "cj_us_warehouse" | "spocket_us" | "cj_china";

export type Supplier = {
  network: SupplierNetwork;
  skuHint: string;
  etaDaysMin: number;
  etaDaysMax: number;
  shipsTo: ["US"];
  notes: string;
  ownerAction: string;
};

export type ProductFaq = {
  q: string;
  a: string;
};

export type DemoPotential = "high" | "medium";

export type Product = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  problem: string;
  solution: string;
  category: ProductCategory;
  priceUsd: number;
  compareAtUsd?: number;
  cogsUsd: number;
  shippingCostUsd: number;
  fulfillmentFeeUsd: number;
  stripeFeeEstimateUsd: number;
  estimatedGrossProfitUsd: number;
  marginRatio: number;
  supplier: Supplier;
  weightOz: number;
  inStock: boolean;
  minMarginUsd: number;
  bundleWith?: string[];
  seoTitle: string;
  seoDescription: string;
  faqs: ProductFaq[];
  searchQueries: string[];
  personaIds: string[];
  angles: string[];
  demoPotential: DemoPotential;
  demandNote: string;
};

export type ProductEconomics = {
  grossProfit: number;
  marginRatio: number;
};

const OWNER_ACTION =
  "Owner must create a supplier account and confirm the live SKU, unit price, and stock before the first paid order.";

const US_ONLY = ["US"] as const;

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

export function stripeFeeEstimate(priceUsd: number): number {
  return roundUsd(priceUsd * 0.029 + 0.3);
}

type ProductDraft = Omit<
  Product,
  "stripeFeeEstimateUsd" | "estimatedGrossProfitUsd" | "marginRatio"
>;

function defineProduct(draft: ProductDraft): Product {
  const stripeFeeEstimateUsd = stripeFeeEstimate(draft.priceUsd);
  const estimatedGrossProfitUsd = roundUsd(
    draft.priceUsd -
      draft.cogsUsd -
      draft.shippingCostUsd -
      draft.fulfillmentFeeUsd -
      stripeFeeEstimateUsd,
  );
  const marginRatio = estimatedGrossProfitUsd / draft.priceUsd;
  return {
    ...draft,
    stripeFeeEstimateUsd,
    estimatedGrossProfitUsd,
    marginRatio,
  };
}

function usWarehouse(partial: {
  skuHint: string;
  etaDaysMin?: number;
  etaDaysMax?: number;
  notes: string;
}): Supplier {
  return {
    network: "cj_us_warehouse",
    skuHint: partial.skuHint,
    etaDaysMin: partial.etaDaysMin ?? 3,
    etaDaysMax: partial.etaDaysMax ?? 7,
    shipsTo: [...US_ONLY],
    notes: partial.notes,
    ownerAction: OWNER_ACTION,
  };
}

function spocketUs(partial: {
  skuHint: string;
  etaDaysMin?: number;
  etaDaysMax?: number;
  notes: string;
}): Supplier {
  return {
    network: "spocket_us",
    skuHint: partial.skuHint,
    etaDaysMin: partial.etaDaysMin ?? 3,
    etaDaysMax: partial.etaDaysMax ?? 7,
    shipsTo: [...US_ONLY],
    notes: partial.notes,
    ownerAction: OWNER_ACTION,
  };
}

function cjChina(partial: {
  skuHint: string;
  notes: string;
}): Supplier {
  return {
    network: "cj_china",
    skuHint: partial.skuHint,
    etaDaysMin: 9,
    etaDaysMax: 14,
    shipsTo: [...US_ONLY],
    notes: `${partial.notes} Ships from China: expect 9–14 days, not 3–7. Label transit time honestly on the product page.`,
    ownerAction: OWNER_ACTION,
  };
}

export const PRODUCTS: Product[] = [
  defineProduct({
    id: "mh-under-sink-caddy",
    slug: "under-sink-caddy",
    name: "Basin Rail Under-Sink Caddy",
    tagline: "Bottles off the cabinet floor, where leaks actually happen.",
    problem:
      "Cleaning bottles, dishwasher tabs, and spare sponges sit in a puddle on the cabinet floor. You cannot see what you own, and a slow leak soaks everything.",
    solution:
      "A two-tier sliding caddy that lifts supplies off the floor, with a removable drip tray you can wipe. Measure your cabinet opening before ordering; this is not a one-size cabinet.",
    category: "kitchen",
    priceUsd: 39,
    compareAtUsd: 48,
    cogsUsd: 9.7,
    shippingCostUsd: 5.4,
    fulfillmentFeeUsd: 3.1,
    supplier: usWarehouse({
      skuHint: "CJ US warehouse: 2-tier pull-out under sink organizer, stainless + plastic tray",
      notes:
        "Confirm interior cabinet width, height under the P-trap, and whether the live SKU includes the drip tray. Reject SKUs with no drain holes in the lower tray.",
    }),
    weightOz: 48,
    inStock: true,
    minMarginUsd: 12,
    bundleWith: ["sink-sponge-caddy", "grout-brush-set"],
    seoTitle: "Under-Sink Caddy | Mendhaus",
    seoDescription:
      "A two-tier under-sink caddy that keeps bottles off a wet cabinet floor. Measure your opening. US shipping, typically 3–7 days.",
    faqs: [
      {
        q: "Will this fit around my garbage disposal or P-trap?",
        a: "Many under-sink cabinets have pipes in the way. Check the live listing for interior width and whether the tiers are L-shaped or adjustable. If your disposal sits low, this may not fit — check the live listing photos for interior width before you buy.",
      },
      {
        q: "Is the tray actually removable?",
        a: "The intended SKU has a removable lower tray you can take to the sink. Confirm that on the supplier page; some lookalikes are one molded piece.",
      },
      {
        q: "Does this stop leaks?",
        a: "No. It keeps supplies out of standing water and makes a drip easier to see. It is not a leak detector or a plumbing fix.",
      },
    ],
    searchQueries: [
      "under sink organizer",
      "under sink caddy pull out",
      "cabinet organizer for cleaning bottles",
      "under sink storage two tier",
    ],
    personaIds: ["kitchen-reset", "renter"],
    angles: [
      "Lift the bottles off the wet cabinet floor",
      "See what you own without kneeling in the dark",
      "A drip tray you can actually wipe",
    ],
    demoPotential: "high",
    demandNote:
      "Evergreen kitchen query with strong before/after demo. Fit questions are the main return driver — publish dimensions early.",
  }),
  defineProduct({
    id: "mh-roll-up-dish-rack",
    slug: "roll-up-dish-rack",
    name: "Roll-Up Over-Sink Rack",
    tagline: "Dry dishes over the basin, then roll it away.",
    problem:
      "A bulky dish rack permanently steals counter space in a small kitchen, and water pools underneath it.",
    solution:
      "A roll-up rack that sits across a standard sink, drains into the basin, and rolls up when you need the counter. Confirm your sink width; it will not span a farmhouse apron or an extra-wide double sink.",
    category: "kitchen",
    priceUsd: 34,
    cogsUsd: 2.92,
    shippingCostUsd: 5.1,
    fulfillmentFeeUsd: 3.0,
    supplier: usWarehouse({
      skuHint: "CJ US: stainless roll up dish drying rack over sink, silicone-coated bars",
      notes:
        "Lock a width range (typically ~15–20 in rolled out) and food-contact stainless, not painted mild steel that rusts at the welds.",
    }),
    weightOz: 22,
    inStock: true,
    minMarginUsd: 10,
    bundleWith: ["sink-sponge-caddy", "fridge-bin-set"],
    seoTitle: "Roll-Up Over-Sink Dish Rack | Mendhaus",
    seoDescription:
      "A roll-up rack that dries dishes over the sink instead of on the counter. Measure sink width. Ships from the US in about 3–7 days.",
    faqs: [
      {
        q: "What sink size does this fit?",
        a: "Most SKUs span a standard single or 50/50 sink in the mid-teens to about 20 inches. Measure inside rim to inside rim. It will not work on a very wide double sink or a sink with no rear ledge.",
      },
      {
        q: "Will it scratch a stainless sink?",
        a: "Look for silicone-coated ends. Even then, grit under the feet can mark a sink — rinse the rim before you set it down.",
      },
      {
        q: "Can I put a hot pan on it?",
        a: "It is a drying rack, not a trivet. Let cookware cool first so coatings and welds last.",
      },
    ],
    searchQueries: [
      "over the sink dish rack roll up",
      "roll up dish drying rack",
      "small kitchen dish rack over sink",
      "space saving dish rack apartment",
    ],
    personaIds: ["kitchen-reset", "renter"],
    angles: [
      "Counter space back when dinner is done",
      "Water goes in the sink, not under a plastic rack",
      "Rolls up — not another permanent gadget",
    ],
    demoPotential: "high",
    demandNote:
      "High visual demo (roll/unroll over a messy counter). Width mismatch is the #1 return reason.",
  }),
  defineProduct({
    id: "mh-fridge-bin-set",
    slug: "fridge-bin-set",
    name: "Clear Fridge Bin Set",
    tagline: "Four bins so the condiments stop migrating.",
    problem:
      "Open jars, cheese sticks, and leftover containers slide into a jumble every time the door closes. You buy duplicates because you cannot see what is in the back.",
    solution:
      "A set of four clear bins that pull out like drawers. They organize; they do not make food last longer. Measure shelf depth — some apartment fridges are shallower than the photos imply.",
    category: "kitchen",
    priceUsd: 34,
    compareAtUsd: 42,
    cogsUsd: 14.49,
    shippingCostUsd: 5.2,
    fulfillmentFeeUsd: 3.0,
    supplier: spocketUs({
      skuHint: "Spocket US: BPA-free clear fridge organizer bins set of 4, mixed sizes",
      notes:
        "Confirm bin outer dimensions vs common US fridge shelves (often 11–14 in deep). Prefer a mixed-size set over four identical large bins.",
    }),
    weightOz: 36,
    inStock: true,
    minMarginUsd: 9,
    bundleWith: ["magnetic-spice-tins", "under-sink-caddy"],
    seoTitle: "Clear Fridge Organizer Bins | Mendhaus",
    seoDescription:
      "A four-bin fridge set that keeps condiments and leftovers from sliding into a pile. Measure shelf depth before you buy.",
    faqs: [
      {
        q: "Are these food-safe?",
        a: "We only list a set the supplier marks as food-contact plastic (typically PET or similar). They are everyday fridge bins, not airtight storage.",
      },
      {
        q: "Will they fit a mini fridge?",
        a: "Probably not. These are sized for a full-height apartment or house fridge. Mini-fridge shelves are usually too short and too shallow.",
      },
      {
        q: "Do they work in the freezer?",
        a: "Only if the confirmed SKU is rated for freezer temps. Many fridge bins get brittle when frozen — we will say yes or no on the page, not guess.",
      },
    ],
    searchQueries: [
      "fridge organizer bins",
      "clear refrigerator storage bins",
      "fridge condiment organizer",
      "apartment fridge organization",
    ],
    personaIds: ["kitchen-reset", "renter"],
    angles: [
      "See the back of the shelf without unloading it",
      "Stop buying a second jar of the same mustard",
      "Pull the bin out like a drawer",
    ],
    demoPotential: "high",
    demandNote:
      "Strong Pinterest/search demand. Fit and 'not airtight' honesty reduce refunds.",
  }),
  defineProduct({
    id: "mh-magnetic-spice-tins",
    slug: "magnetic-spice-tins",
    name: "Glass Spice Jars, Set of 12",
    tagline: "Twelve labeled jars so cumin is not a scavenger hunt.",
    problem:
      "Spice jars eat a full cabinet shelf and you still cannot find cumin. A lazy Susan helps only if you have the footprint.",
    solution:
      "Twelve square glass spice jars with lids and stickers for a clearer cabinet shelf. They sit on a shelf — they are not magnetic fridge tins.",
    category: "kitchen",
    priceUsd: 48,
    cogsUsd: 19,
    shippingCostUsd: 5.5,
    fulfillmentFeeUsd: 2.8,
    supplier: usWarehouse({
      skuHint: "CJ US: 12 Pcs Square Spice Jars With Stickers",
      notes: "Confirm jar volume and whether lids are sift or solid.",
    }),
    weightOz: 18,
    inStock: true,
    minMarginUsd: 8,
    bundleWith: ["fridge-bin-set"],
    seoTitle: "Glass Spice Jars (12) | Mendhaus",
    seoDescription:
      "Twelve glass spice jars with lids and labels for a clearer cabinet shelf. US shipping typically 3–7 days.",
    faqs: [
      {
        q: "Are these magnetic?",
        a: "No. They are glass jars for a cabinet or counter. If you need fridge magnets, this is the wrong product.",
      },
      {
        q: "Are the lids airtight?",
        a: "No. They are everyday spice jars, not long-term oxygen-barrier storage. Use them for spices you go through.",
      },
      {
        q: "Do labels come printed?",
        a: "You get blank stickers (and often a sticker sheet). Write your own names — cumin stays cumin.",
      },
    ],
    searchQueries: [
      "glass spice jars set of 12",
      "square spice jars with labels",
      "kitchen spice jar set",
      "small kitchen spice storage",
    ],
    personaIds: ["kitchen-reset", "renter"],
    angles: [
      "Cabinet shelf back, spices where you cook",
      "Labeled jars beat mystery tins",
      "Not a fridge magnet set",
    ],
    demoPotential: "medium",
    demandNote: "Good kitchen-reset add-on. Keep magnetic claims out — this SKU is shelf jars.",
  }),
  defineProduct({
    id: "mh-sink-sponge-caddy",
    slug: "sink-sponge-caddy",
    name: "Drain-Well Sponge Caddy",
    tagline: "The sponge stops sitting in its own water.",
    problem:
      "A wet sponge on the sink deck stays sour, stains the stainless, and looks messy in every photo of your kitchen.",
    solution:
      "A small caddy with drain slots that hangs or sits at the sink. It does not sanitize the sponge; it just lets it dry instead of soaking. Empty the drip well when you do the dishes.",
    category: "kitchen",
    priceUsd: 19,
    cogsUsd: 2.11,
    shippingCostUsd: 3.6,
    fulfillmentFeeUsd: 2.4,
    supplier: usWarehouse({
      skuHint: "CJ US: stainless sponge holder with drip tray, sink deck or suction",
      notes:
        "Prefer a model with a removable drip tray over pure suction-only cups, which fail on textured sinks. Confirm food-adjacent stainless grade.",
    }),
    weightOz: 8,
    inStock: true,
    minMarginUsd: 6,
    bundleWith: ["under-sink-caddy", "roll-up-dish-rack"],
    seoTitle: "Sink Sponge Caddy | Mendhaus",
    seoDescription:
      "A small drain-well caddy so your sponge is not sitting in standing water. Empty the tray when you do the dishes.",
    faqs: [
      {
        q: "Does this attach with suction?",
        a: "Some SKUs use a sink-deck stand; some add optional suction. Suction fails on textured or dirty sinks. We will specify the confirmed attach method — we will not claim it sticks to every sink.",
      },
      {
        q: "Will it rust?",
        a: "A decent stainless holder still rusts if cheap hardware sits wet. Dry the drip tray. It is not dishwasher-proof unless the confirmed SKU says so.",
      },
      {
        q: "Does this replace sponge replacement?",
        a: "No. A drier sponge lasts longer and smells less. You still need to replace sponges.",
      },
    ],
    searchQueries: [
      "sponge holder for sink",
      "stainless sponge caddy",
      "sink sponge tray drain",
      "kitchen sponge organizer",
    ],
    personaIds: ["kitchen-reset", "renter"],
    angles: [
      "Let the sponge dry instead of stew",
      "A $19 fix for the ugliest spot in the kitchen",
      "Pairs with the under-sink caddy",
    ],
    demoPotential: "medium",
    demandNote:
      "Low price, easy add-on. High attach-to-order rate next to the under-sink caddy.",
  }),
  defineProduct({
    id: "mh-tension-shower-caddy",
    slug: "tension-shower-caddy",
    name: "Steel Tension Shower Caddy",
    tagline: "Shelves in the shower without drilling tile.",
    problem:
      "Bottles live on the tub edge, fall, and leave rings. Drilling tile is a bad idea in a rental and a hassle in a house.",
    solution:
      "A spring-tension pole caddy that wedges between tub/floor and ceiling. Stability depends on a level ceiling, the right height range, and not overloading the top shelf. Check your lease before installing anything that presses on ceiling texture.",
    category: "bathroom",
    priceUsd: 58,
    compareAtUsd: 69,
    cogsUsd: 8.8,
    shippingCostUsd: 7.8,
    fulfillmentFeeUsd: 4.2,
    supplier: usWarehouse({
      skuHint: "CJ US: stainless tension pole shower caddy 4 shelf, rust-resistant",
      notes:
        "Confirm height range vs US 8 ft ceilings and tub-to-ceiling measurements. Avoid chrome-over-steel that rusts at weld points. Include rust disclaimer in PDP.",
    }),
    weightOz: 96,
    inStock: true,
    minMarginUsd: 18,
    bundleWith: ["foam-soap-dispenser", "grout-brush-set"],
    seoTitle: "Tension Shower Caddy (No Drill) | Mendhaus",
    seoDescription:
      "A steel tension-pole shower caddy for bottles off the tub ledge. No tile drilling. Measure floor-to-ceiling. Typically 3–7 day US shipping.",
    faqs: [
      {
        q: "Will this damage my ceiling?",
        a: "Tension poles press upward. On sturdy painted drywall they usually leave little or no mark; on popcorn or weak texture they can crush or stain. We do not promise a damage-free install. Use the rubber pads and do not over-tighten.",
      },
      {
        q: "Does it work in a tub/shower with a sloped ceiling?",
        a: "It needs two reasonably parallel surfaces. A steep slope or a very high ceiling outside the SKU range will not hold. Measure before you buy.",
      },
      {
        q: "Is it rust-proof?",
        a: "Nothing in a steamy shower is rust-proof forever. Stainless lasts longer than chrome-plated steel. Wipe standing water off shelves after hot showers.",
      },
    ],
    searchQueries: [
      "tension shower caddy no drill",
      "pole shower organizer rust resistant",
      "renter friendly shower caddy",
      "shower caddy for bathtub",
    ],
    personaIds: ["renter", "kitchen-reset"],
    angles: [
      "Bottles off the tub ledge, no tile holes",
      "Measure floor to ceiling before you order",
      "Honest about rust and ceiling texture",
    ],
    demoPotential: "high",
    demandNote:
      "Core renter bathroom SKU. Height-range and rust honesty will determine review quality.",
  }),
  defineProduct({
    id: "mh-toothbrush-drip-stand",
    slug: "toothbrush-drip-stand",
    name: "Drip-Tray Toothbrush Stand",
    tagline: "Brushes upright, water in a tray you can wash.",
    problem:
      "Toothbrushes lie on a wet sink rim or lean in a cup that never dries. The counter looks dirty even when the rest of the bathroom is fine.",
    solution:
      "A compact stand with separate slots and a removable drip tray. It organizes brushes and paste; it does not sterilize them.",
    category: "bathroom",
    priceUsd: 28,
    cogsUsd: 11.28,
    shippingCostUsd: 3.9,
    fulfillmentFeeUsd: 2.6,
    supplier: spocketUs({
      skuHint: "Spocket US: ceramic or stoneware toothbrush holder with drip tray",
      notes:
        "Prefer ceramic/stoneware over thin plastic. Confirm tray is removable and dishwasher-safe or hand-wash only — say which.",
    }),
    weightOz: 18,
    inStock: true,
    minMarginUsd: 6,
    bundleWith: ["tension-shower-caddy"],
    seoTitle: "Toothbrush Stand with Drip Tray | Mendhaus",
    seoDescription:
      "A small toothbrush stand with a washable drip tray so brushes are not lying on a wet sink. Not a sterilizer.",
    faqs: [
      {
        q: "How many brushes does it hold?",
        a: "The target SKU holds about four brushes plus a paste tube. Count the brush slots in the product photos before you buy.",
      },
      {
        q: "Is it dishwasher-safe?",
        a: "Only if the confirmed material is. Ceramic trays often are; some coatings are not. The page will say hand-wash or dishwasher.",
      },
      {
        q: "Will it stain from toothpaste?",
        a: "Dye in some pastes can tint light ceramic. Wash the tray. This is a stand, not a self-cleaning gadget.",
      },
    ],
    searchQueries: [
      "toothbrush holder with drip tray",
      "ceramic toothbrush stand",
      "bathroom sink toothbrush organizer",
      "small toothbrush holder apartment",
    ],
    personaIds: ["renter", "kitchen-reset"],
    angles: [
      "The sink rim is not a toothbrush parking spot",
      "A tray you can actually wash",
      "Looks like a bathroom object, not a gadget",
    ],
    demoPotential: "medium",
    demandNote:
      "Steady bathroom search, good AOV add-on with the shower caddy. Material quality is the brand test.",
  }),
  defineProduct({
    id: "mh-foam-soap-dispenser",
    slug: "foam-soap-dispenser",
    name: "Foam Soap Dispenser",
    tagline: "One pump of foam instead of a slick puddle on the sink.",
    problem:
      "A wet bar of soap or a drippy pump leaves the sink sticky, and guests never know where to put their hands.",
    solution:
      "An automatic foam soap dispenser for the bathroom or kitchen sink. Fill it with liquid soap according to the reservoir marks — overfilling makes a mess. Needs batteries or USB power depending on the unit; check the listing.",
    category: "bathroom",
    priceUsd: 32,
    cogsUsd: 10.28,
    shippingCostUsd: 5.1,
    fulfillmentFeeUsd: 2.9,
    supplier: usWarehouse({
      skuHint: "CJ: Bathroom Automatic Intelligent Foam Soap Dispenser",
      notes: "Confirm power type (battery vs USB) and reservoir size before first order.",
    }),
    weightOz: 18,
    inStock: true,
    minMarginUsd: 8,
    bundleWith: ["tension-shower-caddy", "toothbrush-drip-stand", "shower-squeegee"],
    seoTitle: "Foam Soap Dispenser | Mendhaus",
    seoDescription:
      "An automatic foam soap dispenser for a cleaner sink. Confirm power type. US shipping typically 3–7 days.",
    faqs: [
      {
        q: "Does it need batteries?",
        a: "Most units use batteries or USB. The product page notes which. Keep a spare set if it is battery-powered — sensors die mid-week without warning.",
      },
      {
        q: "Can I use any soap?",
        a: "Use liquid hand soap diluted per the maker notes if required. Thick gel soaps can clog foam pumps.",
      },
    ],
    searchQueries: ["foam soap dispenser", "automatic soap dispenser bathroom", "touchless soap pump"],
    personaIds: ["renter", "kitchen-reset"],
    angles: ["cleaner sink", "guest-ready bathroom", "less mess"],
    demoPotential: "medium",
    demandNote: "Steady bathroom accessory demand; pairs with shower caddy.",
  }),
  defineProduct({
    id: "mh-toilet-paper-stand",
    slug: "toilet-paper-stand",
    name: "Freestanding Paper Stand",
    tagline: "Spare rolls off the tank, no wall holes.",
    problem:
      "Extra toilet paper lives on the tank, on the floor, or in a closet two rooms away. Wall-mounted holders mean drilling tile or painted drywall.",
    solution:
      "A freestanding stand with a spindle and a small shelf for spares. It sits on the floor; it will tip if you yank the roll sideways like a wall holder. Place it where it cannot be kicked in a tiny bathroom.",
    category: "bathroom",
    priceUsd: 36,
    cogsUsd: 2.28,
    shippingCostUsd: 6.4,
    fulfillmentFeeUsd: 3.4,
    supplier: spocketUs({
      skuHint: "Spocket US: freestanding toilet paper holder with storage shelf, matte black",
      notes:
        "Confirm base footprint vs small bathrooms and finish (matte black powder coat preferred). Avoid hollow chrome tubes that rattle.",
    }),
    weightOz: 52,
    inStock: true,
    minMarginUsd: 11,
    bundleWith: ["toothbrush-drip-stand", "over-door-hook-rack"],
    seoTitle: "Freestanding Toilet Paper Stand | Mendhaus",
    seoDescription:
      "A floor-standing toilet paper holder with space for spare rolls. No drilling. Watch the footprint in a small bathroom.",
    faqs: [
      {
        q: "Is this stable?",
        a: "A weighted or wide base helps. It is still a freestanding object — a hard sideways yank can tip it. If you have kids or a large dog who plays in the bathroom, a wall holder (with landlord permission) may be safer.",
      },
      {
        q: "Does it fit jumbo rolls?",
        a: "Only if the confirmed spindle height allows it. Many stands fit standard and mega rolls, not commercial jumbo. We will publish the max roll diameter.",
      },
      {
        q: "Can I take it when I move?",
        a: "Yes. That is the point versus a drilled holder.",
      },
    ],
    searchQueries: [
      "freestanding toilet paper holder",
      "toilet paper stand with storage",
      "no drill toilet paper holder",
      "apartment bathroom toilet paper stand",
    ],
    personaIds: ["renter", "pet-home"],
    angles: [
      "Spare rolls without drilling tile",
      "Comes with you to the next place",
      "Check the base size in a tiny bathroom",
    ],
    demoPotential: "medium",
    demandNote:
      "Reliable renter bathroom search. Stability and jumbo-roll fit are the only hard questions.",
  }),
  defineProduct({
    id: "mh-laundry-basket",
    slug: "laundry-basket",
    name: "Foldable Laundry Basket",
    tagline: "Dirty clothes get a place that collapses when you travel.",
    problem:
      "Laundry piles on the chair. A hard hamper eats closet floor and is a pain to store when you move.",
    solution:
      "A foldable fabric laundry basket for the bedroom or closet. It is a basket — not odor control. Empty it; do not invent a laundry system around one bin.",
    category: "bedroom",
    priceUsd: 24,
    cogsUsd: 2.63,
    shippingCostUsd: 4.4,
    fulfillmentFeeUsd: 2.6,
    supplier: usWarehouse({
      skuHint: "CJ: Foldable Moisture-proof Stripes Laundry Basket",
      notes: "Confirm open dimensions and whether handles are reinforced.",
    }),
    weightOz: 16,
    inStock: true,
    minMarginUsd: 8,
    bundleWith: ["slim-velvet-hangers", "hanging-closet-organizer"],
    seoTitle: "Foldable Laundry Basket | Mendhaus",
    seoDescription:
      "A collapsible laundry basket for small bedrooms and moves. Not a fragrance solution. US shipping ~3–7 days.",
    faqs: [
      {
        q: "How big is it open?",
        a: "Roughly a standard bedroom hamper footprint when expanded. Open dimensions are in the product photos — measure your closet or laundry nook.",
      },
      {
        q: "Will it stand on its own?",
        a: "Yes when open and filled. Empty and soft-sided baskets can slump — that is normal for foldables.",
      },
    ],
    searchQueries: ["foldable laundry basket", "collapsible hamper", "laundry basket for apartment"],
    personaIds: ["renter", "pet-home"],
    angles: ["chair is not a hamper", "moves with you", "closet floor"],
    demoPotential: "medium",
    demandNote: "Evergreen apartment search; strong with hangers.",
  }),
  defineProduct({
    id: "mh-bedside-caddy",
    slug: "bedside-caddy",
    name: "Mattress-Tuck Bedside Caddy",
    tagline: "Glasses, a book, and the remote without a nightstand.",
    problem:
      "Studio apartments and small bedrooms often have no room for a nightstand. Phones and glasses end up on the floor.",
    solution:
      "A fabric caddy that tucks between mattress and box spring or platform. It holds small items; it will sag if you load it with a laptop or water pitcher. Not a substitute for a stable table for drinks.",
    category: "bedroom",
    priceUsd: 29,
    cogsUsd: 4.31,
    shippingCostUsd: 4.6,
    fulfillmentFeeUsd: 2.9,
    supplier: spocketUs({
      skuHint: "Spocket US: bedside caddy organizer felt or canvas, mattress tuck, pockets",
      notes:
        "Confirm pocket layout (phone + glasses + book) and whether it fits platform beds with a tight gap. Felt looks more premium than thin polyester.",
    }),
    weightOz: 14,
    inStock: true,
    minMarginUsd: 9,
    bundleWith: ["laundry-basket", "clip-on-reading-light"],
    seoTitle: "Bedside Caddy (No Nightstand) | Mendhaus",
    seoDescription:
      "A mattress-tuck bedside caddy for glasses, a book, and the remote when there is no room for a nightstand.",
    faqs: [
      {
        q: "Will this work on a platform bed?",
        a: "Only if there is a gap to tuck the board. Some platform beds sit flush with no gap. Check before ordering.",
      },
      {
        q: "Can I put a drink in it?",
        a: "We do not recommend it. Fabric pockets tip. Keep liquids on a stable surface.",
      },
      {
        q: "Does it scratch the mattress?",
        a: "A rigid insert can wear fabric if it is sharp-edged. The intended SKU uses a covered board. If your mattress has a delicate cover, check after the first week.",
      },
    ],
    searchQueries: [
      "bedside caddy no nightstand",
      "mattress bedside organizer",
      "bedside pocket for phone",
      "small bedroom nightstand alternative",
    ],
    personaIds: ["renter", "desk-worker"],
    angles: [
      "When the bedroom has no room for a table",
      "Phone and glasses off the floor",
      "Not for laptops or full water bottles",
    ],
    demoPotential: "high",
    demandNote:
      "Strong renter/studio search. Demo is a 10-second tuck-in. Platform-bed fit must be explicit.",
  }),
  defineProduct({
    id: "mh-blackout-window-liner",
    slug: "blackout-window-liner",
    name: "Rod-Hung Blackout Liner",
    tagline: "Darker mornings without replacing the landlord's curtains.",
    problem:
      "Streetlights and early sun wash out sleep. Renters often cannot replace existing rods or drill new ones, and adhesive film on glass is a different (and messier) job.",
    solution:
      "A blackout liner meant to hang from a tension or existing curtain rod behind the decorative curtain. It reduces light; it will not make a room pitch-black if light leaks around the frame. No adhesive on glass.",
    category: "bedroom",
    priceUsd: 32,
    compareAtUsd: 40,
    cogsUsd: 3.19,
    shippingCostUsd: 4.9,
    fulfillmentFeeUsd: 3.0,
    supplier: usWarehouse({
      skuHint: "CJ US: blackout curtain liner panel rod pocket, 1 or 2 pack",
      notes:
        "Confirm width/length vs common US windows and rod-pocket vs clip rings. Do not sell as 100% blackout. Pairs with blackout liners and renter-friendly mounts.",
    }),
    weightOz: 20,
    inStock: true,
    minMarginUsd: 10,
    bundleWith: ["lumbar-pillow", "laundry-basket"],
    seoTitle: "Blackout Curtain Liner | Mendhaus",
    seoDescription:
      "A rod-hung blackout liner that goes behind existing curtains. Reduces light; does not seal every leak. No glass adhesive.",
    faqs: [
      {
        q: "Will this make my room completely dark?",
        a: "Unlikely. Liners help a lot on the fabric area. Light still comes around the frame, through side gaps, and under the rod. For shift sleep, you may still want side coverage or a sleep mask.",
      },
      {
        q: "Do I need to drill?",
        a: "Not if you already have a rod, or if you pair this with a tension rod that fits your frame. Check your lease before installing any rod that presses on trim.",
      },
      {
        q: "Is this the same as window film?",
        a: "No. This hangs on a rod. Static-cling privacy film is a separate product and goes on glass.",
      },
    ],
    searchQueries: [
      "blackout curtain liner",
      "blackout liner for existing curtains",
      "renter friendly blackout curtains",
      "rod pocket blackout panel",
    ],
    personaIds: ["renter", "desk-worker"],
    angles: [
      "Keep the landlord's curtains, add a liner",
      "Darker, not magically pitch-black",
      "Works with a tension rod if you need one",
    ],
    demoPotential: "high",
    demandNote:
      "High-intent sleep/renter search. Under-promise on '100% blackout' or reviews will punish the brand.",
  }),
  defineProduct({
    id: "mh-slim-velvet-hangers",
    slug: "slim-velvet-hangers",
    name: "Slim Clothes Hangers",
    tagline: "Slim hangers that save rod space in a small closet.",
    problem:
      "Wire hangers stretch shirts and dump silk. Thick plastic hangers eat half the closet rod in a small apartment.",
    solution:
      "Slim clothes hangers with a consistent hook direction so a small closet rod holds more without the bulk of plastic. Not heirloom hotel wood — practical hangers for everyday clothes.",
    category: "closet",
    priceUsd: 26,
    cogsUsd: 1.67,
    shippingCostUsd: 4.8,
    fulfillmentFeeUsd: 2.9,
    supplier: usWarehouse({
      skuHint: "CJ US: slim velvet hangers 30 pack, non-slip, gold or black hook",
      notes:
        "Confirm pack count, hook color, and whether notches are included. Avoid the cheapest foam that rubs off in a week.",
    }),
    weightOz: 48,
    inStock: true,
    minMarginUsd: 8,
    bundleWith: ["makeup-organizer", "hanging-closet-organizer"],
    seoTitle: "Slim Clothes Hangers | Mendhaus",
    seoDescription:
      "Slim clothes hangers that save rod space in a small closet. Practical everyday hangers — not hotel velvet.",
    faqs: [
      {
        q: "Will these hold heavy coats?",
        a: "They are meant for shirts, dresses, and light jackets. Heavy wool coats belong on a sturdier hanger. Overloading slim hangers is how hooks bend.",
      },
      {
        q: "Does the velvet come off on clothes?",
        a: "A little fuzz on the first few uses is common. If the coating is still shedding after a week, that SKU is too cheap — we will not relist it.",
      },
      {
        q: "Are the hooks 360° rotating?",
        a: "Depends on the confirmed SKU. We will state rotating vs fixed on the page.",
      },
    ],
    searchQueries: [
      "slim velvet hangers 30 pack",
      "space saving hangers apartment",
      "non slip velvet hangers",
      "small closet hangers",
    ],
    personaIds: ["renter", "kitchen-reset"],
    angles: [
      "More rod space without a bigger closet",
      "Camisoles that stay on the hanger",
      "A 30-pack, not a lifetime furniture piece",
    ],
    demoPotential: "medium",
    demandNote:
      "Commodity category — win on honest pack photos and not overselling velvet quality.",
  }),
  defineProduct({
    id: "mh-makeup-organizer",
    slug: "makeup-organizer",
    name: "Vanity Organizer Set",
    tagline: "Makeup and brushes stop living in a single spilled cup.",
    problem:
      "Cosmetics crowd the sink edge, fall in water, and make a small bathroom look unfinished.",
    solution:
      "A clear vanity organizer set with compartments for bottles, brushes, and small tools. Measure your counter depth. It organizes; it does not create counter space you do not have.",
    category: "bathroom",
    priceUsd: 26,
    cogsUsd: 4.11,
    shippingCostUsd: 4.6,
    fulfillmentFeeUsd: 2.7,
    supplier: usWarehouse({
      skuHint: "CJ: Makeup Storage Organizer Set",
      notes: "Confirm piece count in the set and acrylic thickness.",
    }),
    weightOz: 22,
    inStock: true,
    minMarginUsd: 8,
    bundleWith: ["foam-soap-dispenser", "toothbrush-drip-stand"],
    seoTitle: "Vanity Organizer Set | Mendhaus",
    seoDescription:
      "A compartmented vanity organizer for makeup and brushes. Measure the counter. US shipping typically 3–7 days.",
    faqs: [
      {
        q: "Is it one piece or a set?",
        a: "It is a multi-piece organizer set. Piece count is on the product media after supplier lock.",
      },
      {
        q: "Will it fit a tiny sink shelf?",
        a: "Measure depth and width. Many apartment sinks only fit a single tray — if your ledge is under 4 inches deep, skip this.",
      },
    ],
    searchQueries: ["makeup organizer", "vanity organizer set", "acrylic cosmetic organizer"],
    personaIds: ["renter", "kitchen-reset"],
    angles: ["sink edge mess", "guest bathroom", "small counter"],
    demoPotential: "high",
    demandNote: "Strong social demo potential; keep claims about capacity honest.",
  }),
  defineProduct({
    id: "mh-hanging-closet-organizer",
    slug: "hanging-closet-organizer",
    name: "Hanging Closet Shelves",
    tagline: "Six cubbies that hang from the rod you already have.",
    problem:
      "A small closet has a rod and almost no useful shelves. Folded clothes live in a laundry basket.",
    solution:
      "A hanging organizer with fabric cubbies that slips over the closet rod. It steals some hanging width. It will sag if you load it with jeans and boots; it is for sweaters, tees, and light accessories.",
    category: "closet",
    priceUsd: 38,
    compareAtUsd: 46,
    cogsUsd: 1.67,
    shippingCostUsd: 6.2,
    fulfillmentFeeUsd: 3.5,
    supplier: spocketUs({
      skuHint: "Spocket US: hanging closet organizer 6 shelf, canvas, metal hooks",
      notes:
        "Confirm rod hook style and weight rating. Canvas looks more Mendhaus than shiny nonwoven PP. Note cubby dimensions on PDP.",
    }),
    weightOz: 42,
    inStock: true,
    minMarginUsd: 12,
    bundleWith: ["slim-velvet-hangers", "makeup-organizer", "over-door-shoe-organizer"],
    seoTitle: "Hanging Closet Organizer | Mendhaus",
    seoDescription:
      "Fabric cubbies that hang from your existing closet rod. For folded tees and sweaters, not a boot warehouse.",
    faqs: [
      {
        q: "Will this break my closet rod?",
        a: "A loaded organizer is heavy. If your rod already bows with hangers, do not add this. It is meant for a standard supported rod, not a tension rod used as a closet pole.",
      },
      {
        q: "How much hanging space does it use?",
        a: "Usually about 12 inches of rod width, plus whatever the sides bulge. Measure before you give up shirt space.",
      },
      {
        q: "Can I wash it?",
        a: "Spot-clean canvas. A washing machine will wreck the cardboard or fiberboard inserts in most hanging organizers.",
      },
    ],
    searchQueries: [
      "hanging closet organizer",
      "closet hanging shelves",
      "small closet storage hanging",
      "apartment closet organizer no install",
    ],
    personaIds: ["renter", "kitchen-reset"],
    angles: [
      "Shelves without drilling into the closet",
      "Uses the rod you already have",
      "Sweaters and tees, not a boot dump",
    ],
    demoPotential: "high",
    demandNote:
      "Classic renter closet search. Weight rating and 'not for boots' copy protect reviews.",
  }),
  defineProduct({
    id: "mh-aluminum-laptop-riser",
    slug: "aluminum-laptop-riser",
    name: "Aluminum Laptop Riser",
    tagline: "Screen up, airflow underneath, desk looking less like a dorm.",
    problem:
      "A laptop flat on the desk puts the screen too low and traps heat. Cheap plastic risers flex and look temporary on camera.",
    solution:
      "A rigid aluminum riser that lifts a notebook a few inches and leaves space for a keyboard. Check weight rating vs your machine. This is not an ergonomic medical device and will not fix neck pain by itself.",
    category: "desk",
    priceUsd: 44,
    compareAtUsd: 55,
    cogsUsd: 11.02,
    shippingCostUsd: 5.6,
    fulfillmentFeeUsd: 3.3,
    supplier: usWarehouse({
      skuHint: "CJ US: aluminum laptop stand riser, vented, foldable or fixed",
      notes:
        "Confirm max laptop size (13–16 in typical) and weight rating. Prefer CNC or thick extrusion over stamped tin that rings hollow.",
    }),
    weightOz: 28,
    inStock: true,
    minMarginUsd: 14,
    bundleWith: ["desk-cable-clips", "cable-sleeve-kit", "monitor-stand-drawer"],
    seoTitle: "Aluminum Laptop Riser | Mendhaus",
    seoDescription:
      "A rigid aluminum stand that lifts your laptop for a better screen height and airflow. Check weight rating. US shipping ~3–7 days.",
    faqs: [
      {
        q: "Will this fit a 16-inch laptop?",
        a: "Most aluminum risers do. We will publish the confirmed width and weight limit. Gaming laptops that are both wide and heavy can exceed cheap stands — we will not list those.",
      },
      {
        q: "Is it height-adjustable?",
        a: "Depends on the locked SKU. Some are a single height; some have two or three steps. The page will say which.",
      },
      {
        q: "Does this replace an external keyboard?",
        a: "If you raise the laptop, you will probably want an external keyboard and mouse. The riser does not include them.",
      },
    ],
    searchQueries: [
      "aluminum laptop riser",
      "laptop stand for desk",
      "ergonomic laptop stand aluminum",
      "laptop stand for video calls",
    ],
    personaIds: ["desk-worker", "renter"],
    angles: [
      "A calmer desk on camera",
      "Metal that does not flex under a real laptop",
      "Height helps; it is not a medical device",
    ],
    demoPotential: "high",
    demandNote:
      "Core desk-worker SKU with strong demo. Weight rating honesty avoids 1-star 'bent on day one' reviews.",
  }),
  defineProduct({
    id: "mh-monitor-stand-drawer",
    slug: "monitor-stand-drawer",
    name: "Monitor Stand with Drawer",
    tagline: "Screen up, clutter in a drawer instead of around the base.",
    problem:
      "A monitor sits too low, and the desk around it accumulates pens, dongles, and notebooks until the camera background looks chaotic.",
    solution:
      "A wood or wood-look stand with a shallow drawer that raises a monitor and hides small supplies. Confirm width vs your monitor feet and the weight rating. Not for ultra-wide monitors that overhang badly.",
    category: "desk",
    priceUsd: 54,
    compareAtUsd: 68,
    cogsUsd: 17.35,
    shippingCostUsd: 8.4,
    fulfillmentFeeUsd: 4.1,
    supplier: spocketUs({
      skuHint: "Spocket US: bamboo or oak monitor stand with drawer, 20+ lb rating",
      notes:
        "Confirm platform width/depth, drawer clearance, and weight rating vs common 24–27 in monitors. Avoid MDF that chips in transit.",
    }),
    weightOz: 80,
    inStock: true,
    minMarginUsd: 16,
    bundleWith: ["aluminum-laptop-riser", "desk-cable-clips", "desk-drawer-tray"],
    seoTitle: "Monitor Stand with Drawer | Mendhaus",
    seoDescription:
      "A monitor riser with a shallow drawer for pens and dongles. Check width and weight rating. Typically 3–7 day US shipping.",
    faqs: [
      {
        q: "How much weight can it hold?",
        a: "We will only sell a stand with a published rating that covers a typical 24–27 inch monitor. If your monitor is a heavy 32-inch or an all-in-one, measure and compare before ordering.",
      },
      {
        q: "Will my monitor's feet fit?",
        a: "Some monitors have wide V-shaped feet. Compare the stand's top platform to your base. A stand that is too narrow is unsafe.",
      },
      {
        q: "Is the drawer big enough for a keyboard?",
        a: "Usually no. It is for pens, USB drives, and notepads. Full-size keyboards belong on the desk or on a tray.",
      },
    ],
    searchQueries: [
      "monitor stand with drawer",
      "bamboo monitor riser storage",
      "desk monitor stand organizer",
      "raise computer monitor with storage",
    ],
    personaIds: ["desk-worker"],
    angles: [
      "One object: height plus a place for the mess",
      "Built for a real 24–27 inch monitor",
      "Looks finished on a video call",
    ],
    demoPotential: "high",
    demandNote:
      "Premium desk SKU. Dimensional shipping is the margin risk — stay US warehouse/Spocket, not China.",
  }),
  defineProduct({
    id: "mh-desk-cable-clips",
    slug: "desk-cable-clips",
    name: "Under-Desk Cable Clips",
    tagline: "The charger cable stops falling behind the desk.",
    problem:
      "Cables slide off the desk edge, tangle in the chair wheels, and show up on every video call.",
    solution:
      "Magnetic or adhesive under-desk cable clips that route cords along the desk edge. Adhesive can lift finish on cheap laminate — wipe and press firmly, or use the screw option if included. Not a full raceway system.",
    category: "desk",
    priceUsd: 14,
    cogsUsd: 0.05,
    shippingCostUsd: 3.2,
    fulfillmentFeeUsd: 2.4,
    supplier: usWarehouse({
      skuHint: "CJ: Magnetic Cable Clip Under Desk Cable Management",
      notes: "Confirm pack count and magnetic vs adhesive mount.",
    }),
    weightOz: 6,
    inStock: true,
    minMarginUsd: 5,
    bundleWith: ["aluminum-laptop-riser", "cable-sleeve-kit", "monitor-stand-drawer"],
    seoTitle: "Under-Desk Cable Clips | Mendhaus",
    seoDescription:
      "Cable clips that keep chargers on the desk edge instead of on the floor. Honest about adhesive. US shipping ~3–7 days.",
    faqs: [
      {
        q: "How many clips are in the pack?",
        a: "Pack count is listed on the product media. Expect a small multi-pack, not a whole-room kit.",
      },
      {
        q: "Will adhesive damage the desk?",
        a: "It can on soft laminate or fresh paint. Test a small area. Prefer magnetic mounts on metal desks.",
      },
    ],
    searchQueries: ["under desk cable clips", "desk cable management clips", "magnetic cable holder desk"],
    personaIds: ["desk-worker", "renter"],
    angles: ["video call cables", "chair wheels", "desk edge"],
    demoPotential: "high",
    demandNote: "Low AOV add-on with laptop riser; easy demo.",
  }),
  defineProduct({
    id: "mh-desk-drawer-tray",
    slug: "desk-drawer-tray",
    name: "Desk Drawer Organizer Tray",
    tagline: "The junk drawer, but with lanes.",
    problem:
      "Pens, charging tips, stamps, and mints share one drawer until nothing is findable. Buying a second of everything becomes the workaround.",
    solution:
      "An adjustable or grid tray that drops into a standard desk drawer. Measure interior drawer width and depth; office-supply 'universal' trays are not universal.",
    category: "desk",
    priceUsd: 27,
    cogsUsd: 1.92,
    shippingCostUsd: 4.5,
    fulfillmentFeeUsd: 2.8,
    supplier: spocketUs({
      skuHint: "Spocket US: expandable bamboo or plastic desk drawer organizer",
      notes:
        "Confirm expand range vs common US desk drawers. Bamboo fits brand better than brittle white plastic if margin holds.",
    }),
    weightOz: 20,
    inStock: true,
    minMarginUsd: 8,
    bundleWith: ["monitor-stand-drawer", "cable-sleeve-kit"],
    seoTitle: "Desk Drawer Organizer | Mendhaus",
    seoDescription:
      "A drop-in tray that gives a desk drawer actual lanes for pens and small tools. Measure the drawer first.",
    faqs: [
      {
        q: "Will this fit my drawer?",
        a: "Only if your interior width/depth match the confirmed range. Measure inside the drawer, not the desk face.",
      },
      {
        q: "Is it one piece or modular?",
        a: "We will specify. Expandable trays cover more widths; modular grids look cleaner but need more measuring.",
      },
      {
        q: "Can I use it in a kitchen drawer?",
        a: "Yes, if the size matches. It is not marketed as food-safe unless the confirmed material is.",
      },
    ],
    searchQueries: [
      "desk drawer organizer",
      "expandable drawer organizer desk",
      "bamboo office drawer tray",
      "junk drawer organizer for desk",
    ],
    personaIds: ["desk-worker", "kitchen-reset"],
    angles: [
      "Measure once, stop losing the good pen",
      "Lanes, not another catch-all bin",
      "Works in a kitchen drawer if the size matches",
    ],
    demoPotential: "medium",
    demandNote:
      "Steady office search. Fit is everything — publish interior dimensions in inches.",
  }),
  defineProduct({
    id: "mh-cable-sleeve-kit",
    slug: "cable-sleeve-kit",
    name: "Braided Cable Sleeve Kit",
    tagline: "The visible cords, wrapped into one line.",
    problem:
      "TV stands and desk legs show a spray of black cords. Raceways help under the desk; the last visible run still looks messy.",
    solution:
      "A zip-on or wrap sleeve kit plus a few clips for the visible run from desk to wall or TV to outlet. Clips may be adhesive — same caution as the raceway. This does not increase cable safety ratings.",
    category: "desk",
    priceUsd: 19,
    cogsUsd: 0.25,
    shippingCostUsd: 3.5,
    fulfillmentFeeUsd: 2.4,
    supplier: usWarehouse({
      skuHint: "CJ US: neoprene or PET braided cable sleeve zip, 2 lengths + clips",
      notes:
        "Confirm sleeve diameter vs a typical laptop brick + HDMI bundle. Include adhesive-clip warning if clips are included.",
    }),
    weightOz: 8,
    inStock: true,
    minMarginUsd: 6,
    bundleWith: ["desk-cable-clips", "aluminum-laptop-riser"],
    seoTitle: "Braided Cable Sleeve Kit | Mendhaus",
    seoDescription:
      "A wrap sleeve for the visible cable run on a desk or TV stand. Optional adhesive clips — not a damage-free claim.",
    faqs: [
      {
        q: "How many cables fit?",
        a: "A typical sleeve covers a power cord plus a couple of thin data cables. A bundle of thick power bricks will not zip closed. We will publish inner diameter.",
      },
      {
        q: "Is this a fire-safety upgrade?",
        a: "No. It is for appearance and tangle reduction. Do not cover damaged cords or overload a sleeve until it traps heat.",
      },
      {
        q: "Do I need the raceway too?",
        a: "They solve different parts: raceway under the desk, sleeve for the visible drop. Many people want both.",
      },
    ],
    searchQueries: [
      "cable sleeve for desk",
      "braided cord concealer",
      "tv cord cover sleeve",
      "wrap cables together kit",
    ],
    personaIds: ["desk-worker", "renter"],
    angles: [
      "One line instead of a spray of cords",
      "Pairs with the under-desk raceway",
      "Looks tidier on camera",
    ],
    demoPotential: "high",
    demandNote:
      "Cheap, highly demoable add-on. Natural bundle with the raceway.",
  }),
  defineProduct({
    id: "mh-under-cabinet-puck-lights",
    slug: "under-cabinet-puck-lights",
    name: "Rechargeable Puck Lights, 3",
    tagline: "Light under the cabinet without an electrician.",
    problem:
      "Kitchen and closet work surfaces sit in shadow. Hardwired under-cabinet lights mean drilling, wiring, and often a landlord conversation.",
    solution:
      "A three-pack of rechargeable puck lights with adhesive or magnetic mounts. Battery life depends on brightness and how often you use them. They are task lights, not a room's only illumination.",
    category: "lighting",
    priceUsd: 36,
    cogsUsd: 2.69,
    shippingCostUsd: 4.2,
    fulfillmentFeeUsd: 2.6,
    supplier: usWarehouse({
      skuHint: "CJ US: rechargeable LED puck lights 3 pack, USB-C, magnetic mount",
      notes:
        "Confirm battery capacity, color temperature, and whether remote is RF or IR. Adhesive pads fail on dusty undersides — mention prep.",
    }),
    weightOz: 14,
    inStock: true,
    minMarginUsd: 11,
    bundleWith: ["motion-closet-light", "under-sink-caddy"],
    seoTitle: "Rechargeable Under-Cabinet Puck Lights | Mendhaus",
    seoDescription:
      "A 3-pack of rechargeable puck lights for cabinets and closets. No hardwiring. Battery life varies. US shipping typically 3–7 days.",
    faqs: [
      {
        q: "How long does the battery last?",
        a: "It depends on brightness. Treat marketing '30 days' claims as best case on the lowest setting. Expect a few evenings between charges on a brighter setting.",
      },
      {
        q: "Will the adhesive hold under a cabinet?",
        a: "On a clean, smooth underside, usually. On dusty particleboard or heavily textured paint, it may drop. Degrease first. Magnetic mounts need a steel plate.",
      },
      {
        q: "Can renters use these?",
        a: "They do not require wiring. Adhesive may still mark paint when removed. Check your lease and use the magnetic option if the SKU includes plates.",
      },
    ],
    searchQueries: [
      "rechargeable under cabinet lights",
      "puck lights for kitchen no wiring",
      "battery under cabinet lighting",
      "closet puck lights rechargeable",
    ],
    personaIds: ["kitchen-reset", "renter", "desk-worker"],
    angles: [
      "Task light without calling an electrician",
      "Rechargeable, not a monthly battery run",
      "Apartment-friendly install",
    ],
    demoPotential: "high",
    demandNote:
      "High demo potential (dark counter → lit). Battery overclaims are the review killer — stay conservative.",
  }),
  defineProduct({
    id: "mh-motion-closet-light",
    slug: "motion-closet-light",
    name: "Motion Closet Light",
    tagline: "The closet turns on when you open the door.",
    problem:
      "Closets and pantries are dark. A pull-chain bulb is easy to forget, and hardwiring a fixture is more project than most people want.",
    solution:
      "A battery or rechargeable bar with a motion sensor, mounted with adhesive or a magnetic strip. Sensors false-trigger in breezy hallways and miss you if aimed wrong. Not a security system.",
    category: "lighting",
    priceUsd: 24,
    cogsUsd: 8.13,
    shippingCostUsd: 3.8,
    fulfillmentFeeUsd: 2.5,
    supplier: usWarehouse({
      skuHint: "CJ US: rechargeable motion sensor closet light bar, magnetic",
      notes:
        "Confirm detection angle and whether it is always-on, night-only, or motion. Magnetic + adhesive plate is more renter-friendly than screws into a shelf.",
    }),
    weightOz: 8,
    inStock: true,
    minMarginUsd: 6,
    bundleWith: ["under-cabinet-puck-lights", "hanging-closet-organizer"],
    seoTitle: "Motion Sensor Closet Light | Mendhaus",
    seoDescription:
      "A small motion light for closets and pantries. Aim it well; it is not a security camera. US shipping typically 3–7 days.",
    faqs: [
      {
        q: "Will it turn on every time I walk down the hall?",
        a: "If you mount it facing a hallway, yes. Aim it into the closet and use a night-only mode if the SKU has one.",
      },
      {
        q: "Batteries or rechargeable?",
        a: "We will lock a rechargeable US-warehouse bar if stock exists. If we fall back to AA, the page will say so — no surprise battery type.",
      },
      {
        q: "Does this work in a fridge?",
        a: "No. These are not rated for cold, moisture, or food compartments.",
      },
    ],
    searchQueries: [
      "motion sensor closet light",
      "rechargeable closet light",
      "pantry motion light",
      "under shelf motion light",
    ],
    personaIds: ["renter", "kitchen-reset", "desk-worker"],
    angles: [
      "Hands full of hangers, light still comes on",
      "Aim it into the closet, not the hallway",
      "A small bar, not a security product",
    ],
    demoPotential: "high",
    demandNote:
      "Easy demo, strong renter + closet pairing. Sensor false-trigger education reduces returns.",
  }),
  defineProduct({
    id: "mh-clip-on-reading-light",
    slug: "clip-on-reading-light",
    name: "Clip-On Task Light",
    tagline: "Light on the page, not on the whole room.",
    problem:
      "A partner is asleep, or the overhead is too harsh, and the bedside lamp is on the wrong side of the bed — or there is no lamp at all.",
    solution:
      "A clip-on LED that attaches to a headboard, shelf, or book. Check clip opening vs your headboard thickness. It is a reading light, not a therapy lamp.",
    category: "lighting",
    priceUsd: 24,
    cogsUsd: 2.81,
    shippingCostUsd: 4.0,
    fulfillmentFeeUsd: 2.6,
    supplier: spocketUs({
      skuHint: "Spocket US: clip on LED reading light, rechargeable, warm/cool",
      notes:
        "Confirm clip gap, color temperature options, and battery life claims. Prefer warm-dim for bedroom use.",
    }),
    weightOz: 7,
    inStock: true,
    minMarginUsd: 7,
    bundleWith: ["bedside-caddy", "foam-soap-dispenser", "blackout-window-liner"],
    seoTitle: "Clip-On Reading Light | Mendhaus",
    seoDescription:
      "A rechargeable clip-on light for a headboard, shelf, or book. Check clip width. For reading, not light therapy.",
    faqs: [
      {
        q: "Will it clip to my headboard?",
        a: "Only if the clip opening fits the thickness. Upholstered headboards and very thick wood often do not. A shelf or music stand may work better.",
      },
      {
        q: "Is the light warm or blue?",
        a: "We will prefer a warm or adjustable SKU for bedrooms. Cool white is harder on a partner trying to sleep.",
      },
      {
        q: "Can I use it while charging?",
        a: "Depends on the locked SKU. Some cheap lights cannot. We will say pass-through or not.",
      },
    ],
    searchQueries: [
      "clip on reading light",
      "headboard reading lamp rechargeable",
      "book light clip on",
      "bed reading light for partner",
    ],
    personaIds: ["desk-worker", "renter"],
    angles: [
      "Read without lighting the whole room",
      "Clips on — no nightstand required",
      "Warm light, not a garage LED",
    ],
    demoPotential: "medium",
    demandNote:
      "Gift and bedroom add-on. Clip-gap mismatch is the main return reason.",
  }),
  defineProduct({
    id: "mh-rubber-pet-broom",
    slug: "rubber-pet-broom",
    name: "Rubber Pet-Hair Broom",
    tagline: "Hair off hard floors without a spray of dust.",
    problem:
      "Pet hair cakes on hardwood and tile. A regular broom flicks it around; a vacuum is loud and overkill for a daily pass.",
    solution:
      "A rubber-bristle broom plus dustpan that gathers hair on hard floors. It is not a carpet rake, not an allergy treatment, and not a substitute for washing bedding. Works poorly on thick carpet.",
    category: "cleaning",
    priceUsd: 32,
    compareAtUsd: 39,
    cogsUsd: 3.29,
    shippingCostUsd: 5.4,
    fulfillmentFeeUsd: 3.2,
    supplier: usWarehouse({
      skuHint: "CJ US: rubber broom pet hair with squeegee + dustpan, hardwood",
      notes:
        "Confirm broom width and whether the rubber is squeegee-capable on tile. Explicitly exclude thick carpet on PDP.",
    }),
    weightOz: 26,
    inStock: true,
    minMarginUsd: 10,
    bundleWith: ["washable-lint-roller", "flat-mop-pads", "over-door-hook-rack"],
    seoTitle: "Rubber Pet-Hair Broom | Mendhaus",
    seoDescription:
      "A rubber-bristle broom for pet hair on hardwood and tile. Not for thick carpet and not an allergy cure. US shipping ~3–7 days.",
    faqs: [
      {
        q: "Does this work on carpet?",
        a: "On low-pile, maybe a little. On anything plush, no — use a vacuum or a carpet-specific rake. We sell this for hard floors.",
      },
      {
        q: "Will it scratch hardwood?",
        a: "Rubber bristles are gentler than stiff corn brooms, but grit under the broom can scratch any floor. Sweep grit carefully.",
      },
      {
        q: "Does this reduce shedding?",
        a: "No. It picks up hair that already fell. Shedding is a dog or cat thing, not a broom thing.",
      },
    ],
    searchQueries: [
      "rubber broom pet hair",
      "pet hair broom hardwood",
      "squeegee broom for dog hair",
      "best broom for cat hair on tile",
    ],
    personaIds: ["pet-home", "renter", "kitchen-reset"],
    angles: [
      "Daily hair on hard floors, without hauling the vacuum",
      "Rubber bristles, not a miracle coat treatment",
      "Honest: skip it if you only have thick carpet",
    ],
    demoPotential: "high",
    demandNote:
      "Hero pet-home SKU. Demo is extremely shareable. Floor-type honesty keeps star rating intact.",
  }),
  defineProduct({
    id: "mh-flat-mop-pads",
    slug: "flat-mop-pads",
    name: "Flat Mop + Washable Pads",
    tagline: "A mop you can actually wash, not a refill subscription.",
    problem:
      "Disposable pad mops lock you into refills. A string mop stays wet and smells. Small apartments still need something that dries fast.",
    solution:
      "A flat mop with machine-washable microfiber pads. It cleans hard floors; pad life depends on grit and washing. Not a steam mop and not a chemical system.",
    category: "cleaning",
    priceUsd: 29,
    cogsUsd: 3.32,
    shippingCostUsd: 5.6,
    fulfillmentFeeUsd: 3.1,
    supplier: spocketUs({
      skuHint: "Spocket US: microfiber flat mop with 3 washable pads, spray optional",
      notes:
        "Prefer a non-spray or separately filled spray bottle over mystery solution cartridges. Confirm pad count and wash instructions.",
    }),
    weightOz: 32,
    inStock: true,
    minMarginUsd: 9,
    bundleWith: ["rubber-pet-broom", "grout-brush-set"],
    seoTitle: "Flat Mop with Washable Pads | Mendhaus",
    seoDescription:
      "A flat mop and washable microfiber pads for hard floors. No disposable refill lock-in. Not a steam mop.",
    faqs: [
      {
        q: "How do I wash the pads?",
        a: "Machine wash, no fabric softener (it kills microfiber grab). We will print the confirmed temperature on the insert.",
      },
      {
        q: "Does it spray cleaner?",
        a: "Only if the locked SKU includes a spray bottle. We will not ship mystery branded solution. Use a cleaner you already trust on your floor type.",
      },
      {
        q: "Can I use this on hardwood?",
        a: "A damp microfiber pad is what most hardwood makers want — not a soaking string mop. Still follow your floor manufacturer's guidance. We do not warranty floors.",
      },
    ],
    searchQueries: [
      "flat mop washable pads",
      "microfiber mop no disposable pads",
      "apartment mop for hardwood",
      "reusable pad mop",
    ],
    personaIds: ["pet-home", "renter", "kitchen-reset"],
    angles: [
      "Wash the pads, skip the refill aisle",
      "Damp, not dripping — better for hard floors",
      "Pairs with the rubber broom for hair then wash",
    ],
    demoPotential: "medium",
    demandNote:
      "Replaces a consumable habit. Pad count and wash instructions should be on-page, not only in a PDF.",
  }),
  defineProduct({
    id: "mh-grout-brush-set",
    slug: "grout-brush-set",
    name: "Grout Brush Trio",
    tagline: "Three stiff brushes for the lines the mop skips.",
    problem:
      "Grout, faucet bases, and the sink rim collect grime a flat mop never reaches. A worn toothbrush is the usual workaround.",
    solution:
      "A set of three narrow, stiff brushes for grout and edges. They take elbow grease. They do not bleach grout white and they will not repair cracked grout.",
    category: "cleaning",
    priceUsd: 18,
    cogsUsd: 0.55,
    shippingCostUsd: 3.4,
    fulfillmentFeeUsd: 2.3,
    supplier: usWarehouse({
      skuHint: "CJ US: grout brush set of 3, stiff nylon, narrow handle",
      notes:
        "Confirm bristle stiffness (too soft is useless; too stiff scratches polished stone). Do not claim grout restoration.",
    }),
    weightOz: 6,
    inStock: true,
    minMarginUsd: 6,
    bundleWith: ["flat-mop-pads", "under-sink-caddy", "tension-shower-caddy"],
    seoTitle: "Grout Brush Set | Mendhaus",
    seoDescription:
      "Three narrow stiff brushes for grout and edges. They take work. They do not bleach grout or fix cracks.",
    faqs: [
      {
        q: "Will this scratch tile?",
        a: "Stiff nylon can mark soft stone, acrylic tubs, and cheap glazed tile if you lean on it. Test a corner. Do not use on polished marble unless you know it is safe.",
      },
      {
        q: "Does this include cleaner?",
        a: "No. Use a cleaner rated for your surface. We are not selling bleach kits.",
      },
      {
        q: "How is this different from a toothbrush?",
        a: "Longer handle, stiffer bristles, shapes meant for grout lines. Still manual work.",
      },
    ],
    searchQueries: [
      "grout brush set",
      "narrow grout cleaning brush",
      "tile grout scrub brush",
      "bathroom grout brush",
    ],
    personaIds: ["kitchen-reset", "renter", "pet-home"],
    angles: [
      "The mop skips the grout — these don't",
      "Elbow grease, not a miracle foam",
      "A cheap add-on next to the shower caddy",
    ],
    demoPotential: "medium",
    demandNote:
      "Low AOV cleaner with high attach rate. Avoid any 'restore grout' language.",
  }),
  defineProduct({
    id: "mh-washable-lint-roller",
    slug: "washable-lint-roller",
    name: "Washable Silicone Lint Roller",
    tagline: "Hair off the sofa without a stack of sticky sheets.",
    problem:
      "Disposable lint rollers run out mid-shed season. Pet hair on upholstery is a daily reset, not a once-a-month chore.",
    solution:
      "A reusable silicone or rubber roller you rinse clean. It works on many fabrics; it works worse on very deep weaves. It does not replace washing throw blankets.",
    category: "cleaning",
    priceUsd: 21,
    cogsUsd: 3.91,
    shippingCostUsd: 3.8,
    fulfillmentFeeUsd: 2.5,
    supplier: usWarehouse({
      skuHint: "CJ US: reusable silicone lint roller pet hair, washable",
      notes:
        "Confirm it rinses clean vs needing a separate scraper. Avoid 'electrostatic miracle' copy. State fabric limits.",
    }),
    weightOz: 8,
    inStock: true,
    minMarginUsd: 7,
    bundleWith: ["rubber-pet-broom", "over-door-hook-rack"],
    seoTitle: "Washable Lint Roller | Mendhaus",
    seoDescription:
      "A reusable silicone roller for pet hair on sofas and clothes. Rinse it off. Not a substitute for washing blankets.",
    faqs: [
      {
        q: "How do I clean it?",
        a: "Rinse under water and let it dry. Some hair needs a fingernail or the included scraper. Do not put cheap silicone in a hot dishwasher unless the SKU says so.",
      },
      {
        q: "Does it work on clothes?",
        a: "Often yes on flatter weaves. On very fuzzy sweaters it can pill or do little. Test a hem.",
      },
      {
        q: "Is this better than a rubber broom?",
        a: "Different jobs. Broom is for floors; roller is for upholstery and clothes. Many pet homes want both.",
      },
    ],
    searchQueries: [
      "reusable lint roller pet hair",
      "washable silicone lint roller",
      "lint roller no refills",
      "dog hair roller for couch",
    ],
    personaIds: ["pet-home", "renter"],
    angles: [
      "Stop buying sticky paper refills",
      "Rinse and go again during shed season",
      "Sofa and clothes, not hardwood — that is the broom",
    ],
    demoPotential: "high",
    demandNote:
      "Highly demoable pet SKU. Natural bundle with the rubber broom.",
  }),
  defineProduct({
    id: "mh-over-door-hook-rack",
    slug: "over-door-hook-rack",
    name: "Over-Door Hook Rail",
    tagline: "Coats and bags off the chair, no wall anchors.",
    problem:
      "The back of the chair becomes the coat rack. Wall hooks mean drilling, and many leases limit holes in entryways.",
    solution:
      "A hook rail that hangs over a standard interior door. It needs enough clearance with the frame and a door thick enough for the bracket. It can scratch paint if it rattles — use bumpers. Check your lease; over-door hardware is usually allowed but not universally.",
    category: "renter",
    priceUsd: 28,
    cogsUsd: 0.86,
    shippingCostUsd: 4.8,
    fulfillmentFeeUsd: 2.9,
    supplier: usWarehouse({
      skuHint: "CJ US: over the door hook rack 6 hook, padded, heavy duty",
      notes:
        "Confirm door thickness range and whether bumpers are included. Weight rating per hook matters for winter coats.",
    }),
    weightOz: 24,
    inStock: true,
    minMarginUsd: 9,
    bundleWith: ["over-door-shoe-organizer", "freestanding-coat-tree", "rubber-pet-broom"],
    seoTitle: "Over-Door Hook Rack | Mendhaus",
    seoDescription:
      "A padded over-door hook rail for coats and bags. No wall drilling. Check door thickness and your lease.",
    faqs: [
      {
        q: "Will this fit my door?",
        a: "Most US interior doors work. Extra-thick doors, some metal doors, and doors that already sit tight to the frame may not. Measure thickness and top gap.",
      },
      {
        q: "Will it scratch the door?",
        a: "It can, especially if it rattles. Use the bumpers and do not slam the door. We do not guarantee unmarked paint.",
      },
      {
        q: "How much weight can it hold?",
        a: "We will publish per-hook and total ratings. A wet winter coat on every hook can exceed cheap racks — we will not list those.",
      },
    ],
    searchQueries: [
      "over the door hook rack",
      "over door coat hooks renter",
      "no drill door hooks",
      "apartment entryway hooks",
    ],
    personaIds: ["renter", "pet-home", "desk-worker"],
    angles: [
      "The chair is not a coat rack",
      "No wall anchors, still check the lease",
      "Bumpers on, or the paint may mark",
    ],
    demoPotential: "high",
    demandNote:
      "Flagship renter SKU. Door-fit and scratch honesty belong above the fold.",
  }),
  defineProduct({
    id: "mh-lumbar-pillow",
    slug: "lumbar-pillow",
    name: "Desk Lumbar Pillow",
    tagline: "Lower-back support for the chair you already own.",
    problem:
      "A cheap desk chair leaves your lower back unsupported by afternoon, and buying a whole new chair is not in the budget.",
    solution:
      "A memory-foam lumbar pillow for office or home chairs. Position it at the curve of your lower back — too high and it is useless. It is not a medical device and will not fix every chair.",
    category: "desk",
    priceUsd: 28,
    cogsUsd: 3.9,
    shippingCostUsd: 4.8,
    fulfillmentFeeUsd: 2.7,
    supplier: usWarehouse({
      skuHint: "CJ: memory foam lumbar / neck pillow office home seat",
      notes: "Confirm firmness and cover washability.",
    }),
    weightOz: 20,
    inStock: true,
    minMarginUsd: 8,
    bundleWith: ["aluminum-laptop-riser", "desk-cable-clips"],
    seoTitle: "Desk Lumbar Pillow | Mendhaus",
    seoDescription:
      "A memory-foam lumbar pillow for long desk days. Not a medical claim. US shipping typically 3–7 days.",
    faqs: [
      {
        q: "Will it fit my chair?",
        a: "It works on most office and dining chairs with a back. Bucket car seats are a different shape — this listing is for desk use.",
      },
      {
        q: "Is the cover washable?",
        a: "Most have a removable cover. Check care notes in the listing photos.",
      },
    ],
    searchQueries: ["lumbar pillow desk", "office chair back support", "memory foam lumbar cushion"],
    personaIds: ["desk-worker"],
    angles: ["afternoon back pain", "cheap chair upgrade", "WFH"],
    demoPotential: "medium",
    demandNote: "Evergreen WFH search; keep medical claims out.",
  }),
  defineProduct({
    id: "mh-shower-squeegee",
    slug: "shower-squeegee",
    name: "Shower Glass Squeegee",
    tagline: "Glass stops looking permanently fogged and spotted.",
    problem:
      "Shower glass dries with spots and soap film until the bathroom always looks unfinished.",
    solution:
      "A flexible shower squeegee for glass doors and tile. Use it after each shower while the glass is wet. It is maintenance, not a one-time clean.",
    category: "bathroom",
    priceUsd: 18,
    cogsUsd: 6.42,
    shippingCostUsd: 3.8,
    fulfillmentFeeUsd: 2.4,
    supplier: usWarehouse({
      skuHint: "CJ: Multi-function Glass Wiper Scraper bathroom shower",
      notes: "Confirm blade material and whether a hang hook is included.",
    }),
    weightOz: 8,
    inStock: true,
    minMarginUsd: 4,
    bundleWith: ["tension-shower-caddy", "foam-soap-dispenser", "grout-brush-set"],
    seoTitle: "Shower Glass Squeegee | Mendhaus",
    seoDescription:
      "A shower squeegee for glass doors and tile. Use after each shower. US shipping typically 3–7 days.",
    faqs: [
      {
        q: "Will this remove old hard-water stains?",
        a: "It prevents new spots. Old mineral buildup needs a cleaner first — then the squeegee keeps it from coming back as fast.",
      },
      {
        q: "Does it scratch glass?",
        a: "A clean soft blade on wet glass is fine. Do not drag grit across the pane.",
      },
    ],
    searchQueries: ["shower squeegee", "shower glass wiper", "bathroom window squeegee"],
    personaIds: ["renter", "kitchen-reset"],
    angles: ["spotted glass", "daily 10 seconds", "rental bathroom"],
    demoPotential: "high",
    demandNote: "Great short demo; pairs with shower caddy.",
  }),
  defineProduct({
    id: "mh-over-door-shoe-organizer",
    slug: "over-door-shoe-organizer",
    name: "Over-Door Shoe Pockets",
    tagline: "Shoes off the entry floor, hanging on the door you already close.",
    problem:
      "Shoes pile at the door, collect pet hair, and make a small entry feel smaller. Floor racks eat the only walking path.",
    solution:
      "A pocket organizer that hangs over a door. It holds flats, sneakers, and small accessories better than boots. Same door-clearance and scratch cautions as the hook rail. Check your lease.",
    category: "renter",
    priceUsd: 38,
    cogsUsd: 21.84,
    shippingCostUsd: 4.4,
    fulfillmentFeeUsd: 2.8,
    supplier: usWarehouse({
      skuHint: "CJ US: over door shoe organizer 12-24 pocket, clear or fabric",
      notes:
        "Confirm pocket size (adult sneakers vs kids only) and door-hook depth. Clear pockets demo better; fabric looks more premium — pick one and stay consistent.",
    }),
    weightOz: 16,
    inStock: true,
    minMarginUsd: 7,
    bundleWith: ["over-door-hook-rack", "hanging-closet-organizer", "rubber-pet-broom"],
    seoTitle: "Over-Door Shoe Organizer | Mendhaus",
    seoDescription:
      "Door-hung pockets for sneakers and flats. Not for heavy boots. Check door clearance and your lease.",
    faqs: [
      {
        q: "Will adult shoes fit?",
        a: "Many cheap organizers are sized for kids or flats. We will only list a SKU whose pockets fit a typical adult sneaker. Boots still belong on the floor or a rack.",
      },
      {
        q: "Will the door still close?",
        a: "Usually, if there is enough top clearance. Thick carpet plus a tight frame can bind. Test before loading every pocket.",
      },
      {
        q: "Is this only for shoes?",
        a: "People also use pockets for spray bottles, gloves, or bathroom extras. Weight still adds up — stay within the rating.",
      },
    ],
    searchQueries: [
      "over the door shoe organizer",
      "door shoe pockets apartment",
      "renter shoe storage no rack",
      "hanging shoe organizer door",
    ],
    personaIds: ["renter", "pet-home"],
    angles: [
      "Get the shoe pile off the walking path",
      "Sneakers and flats, not hiking boots",
      "Same over-door idea as the hook rail",
    ],
    demoPotential: "high",
    demandNote:
      "Classic renter search. Adult-sneaker pocket size must be true or the listing fails.",
  }),
  defineProduct({
    id: "mh-freestanding-coat-tree",
    slug: "freestanding-coat-tree",
    name: "Freestanding Coat Tree",
    tagline: "An entry that works even when you cannot touch the walls.",
    problem:
      "Some leases, brick walls, or roommates make wall hooks impossible. Over-door racks are full. Coats still land on the sofa.",
    solution:
      "A weighted freestanding coat tree for the entry or bedroom corner. It needs a stable base and a sensible load — it will tip if you hang everything on one side. No drilling. Not a clothing retail fixture.",
    category: "renter",
    priceUsd: 79,
    compareAtUsd: 95,
    cogsUsd: 33.5,
    shippingCostUsd: 10.2,
    fulfillmentFeeUsd: 4.8,
    supplier: spocketUs({
      skuHint: "Spocket US: freestanding coat rack tree, metal, weighted base, 8 hook",
      notes:
        "Confirm assembled height, base diameter, and tip-test notes. Dimensional shipping is the margin watch-item. Prefer US stock over China freight.",
    }),
    weightOz: 160,
    inStock: true,
    minMarginUsd: 14,
    bundleWith: ["over-door-hook-rack", "over-door-shoe-organizer"],
    seoTitle: "Freestanding Coat Tree | Mendhaus",
    seoDescription:
      "A weighted freestanding coat rack for entries where you cannot drill. Load it evenly. Typically 3–7 day US shipping.",
    faqs: [
      {
        q: "Will this tip over?",
        a: "Any freestanding rack can tip if you hang all the heavy coats on one hook or if a kid or dog yanks it. Use the base as designed, load both sides, and keep it out of a high-traffic bump zone.",
      },
      {
        q: "Does it need assembly?",
        a: "Almost certainly yes. Expect about 15–30 minutes with basic tools — not a 30-second pop-up.",
      },
      {
        q: "Can I take it when I move?",
        a: "Yes. That is the reason to buy a tree instead of wall anchors.",
      },
    ],
    searchQueries: [
      "freestanding coat rack",
      "coat tree no drill",
      "apartment entryway coat stand",
      "metal coat rack weighted base",
    ],
    personaIds: ["renter", "pet-home", "desk-worker"],
    angles: [
      "When the walls are off-limits",
      "A real base, not a stick in a tiny disc",
      "Comes apart when you move",
    ],
    demoPotential: "medium",
    demandNote:
      "Highest AOV renter SKU. Freight and tip-overs are the risks; US/Spocket stock only.",
  }),
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

export function listByCategory(category: ProductCategory): Product[] {
  return PRODUCTS.filter((product) => product.category === category);
}

export function economics(
  product: Pick<
    Product,
    "priceUsd" | "cogsUsd" | "shippingCostUsd" | "fulfillmentFeeUsd" | "stripeFeeEstimateUsd"
  >,
): ProductEconomics {
  const grossProfit = roundUsd(
    product.priceUsd -
      product.cogsUsd -
      product.shippingCostUsd -
      product.fulfillmentFeeUsd -
      product.stripeFeeEstimateUsd,
  );
  return {
    grossProfit,
    marginRatio: grossProfit / product.priceUsd,
  };
}

export function listCategoryValues(): ProductCategory[] {
  return [...CATEGORIES];
}

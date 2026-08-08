/**
 * Future product hypotheses for Mendhaus — not live SKUs.
 * Confidence is 0–1 belief that the idea is worth the recommended action.
 */

export type OpportunityAction = "TEST" | "WATCH" | "IGNORE";

export type ProductOpportunity = {
  id: string;
  name: string;
  hypothesis: string;
  evidence: string;
  expectedDemand: string;
  expectedEconomics: string;
  targetCustomer: string;
  acquisitionPaths: string[];
  confidence: number;
  recommendedAction: OpportunityAction;
};

export const PRODUCT_OPPORTUNITIES: ProductOpportunity[] = [
  {
    id: "opp-pet-stairs",
    name: "Low-profile pet stairs for sofa and bed",
    hypothesis:
      "Pet-home buyers already in the Mendhaus catalog for hair tools will add a second order for joint-friendly access to the couch, if we sell a stable, washable-cover stair that does not look like a toy.",
    evidence:
      "High-intent queries around 'dog stairs for couch' and 'cat stairs for bed' stay elevated year-round. Adjacent rubber-broom and entryway searches already map to the pet-home persona. Returns risk is real if height or carpet-tread grip is wrong — that is testable with one US-warehouse SKU and a 30-day window.",
    expectedDemand:
      "Steady, not viral: a few sales per week once a dedicated landing page ranks for sofa/bed height variants. Stronger in Q4 gift season and after puppy-adoption spikes. Unlikely to outsell core kitchen/renter SKUs in year one.",
    expectedEconomics:
      "Retail $54–$69. US warehouse COGS likely $18–$24 plus heavier outbound shipping ($8–$11) and fulfillment. After Stripe, contribution roughly 36–45% if we avoid China lead times. Weight and dimensional shipping are the kill switch — if billed as oversize, IGNORE.",
    targetCustomer:
      "Pet-home owners with older dogs or small apartments; secondary overlap with renters who cannot install wall-mounted ramps.",
    acquisitionPaths: [
      "organic_search: dog stairs for couch / bed",
      "content_seo: how to choose stair height vs ramp",
      "communities: honest replies in pet aging threads, disclosed",
      "bundles: with rubber pet-hair broom after first purchase",
    ],
    confidence: 0.62,
    recommendedAction: "TEST",
  },
  {
    id: "opp-entry-boot-tray",
    name: "Raised entryway boot tray + wipeable mat",
    hypothesis:
      "A simple raised tray that actually contains wet paws and winter salt will convert renters and pet homes better than another decorative doormat, because the problem is runoff onto hardwood, not style.",
    evidence:
      "Seasonal search spikes for 'boot tray', 'shoe drip tray', and 'pet paw mat' align with rain and snow. Renter persona already buys over-door hooks and privacy film; an entryway SKU completes the 'leave the mess at the door' story. Commodity Amazon listings are ugly and leak; a deeper lip and wipe-clean surface is a credible differentiator.",
    expectedDemand:
      "Highly seasonal (Oct–Mar in most US climates) with a smaller year-round pet-paw baseline. Good email/SMS restock candidate. Risk of dead inventory in summer if we over-order.",
    expectedEconomics:
      "Retail $22–$32. Plastic/rubber US or Spocket SKUs can clear 40–50% after fees if shipping stays under ~18 oz. A stone or acacia tray looks more premium but freight destroys margin — stay with molded tray + separate washable mat.",
    targetCustomer:
      "Renter and pet-home buyers in apartments with hard floors; kitchen-reset is a weak overlap.",
    acquisitionPaths: [
      "organic_search: boot tray for apartment / wet shoes",
      "pinterest and instagram: entryway reset stills",
      "seasonal content: 'what to put under wet shoes without ruining hardwood'",
      "bundle with over-door hook rack",
    ],
    confidence: 0.71,
    recommendedAction: "TEST",
  },
  {
    id: "opp-under-sink-leak-sensor",
    name: "Battery leak sensor for under-sink and washer hoses",
    hypothesis:
      "Pairing a simple leak alarm with the under-sink caddy would raise AOV and feel on-brand ('small fixes'), but support, false alarms, and battery claims may cost more than the margin.",
    evidence:
      "Leak-sensor search intent is real and often urgent. Home-warranty and insurance content drives curiosity. Reviews on cheap sensors frequently cite false positives, dead batteries, and Wi-Fi apps that stop working — a brand-trust risk for a new store. CJ/Spocket electronics also carry higher RMA rates than passive organizers.",
    expectedDemand:
      "Spiky: a burst after a viral leak video or a local freeze, then quiet. Not a weekly hero SKU. Could work as an add-on at checkout if the primary caddy is already in cart.",
    expectedEconomics:
      "Retail $18–$29. Component COGS $6–$11. Margin can look like 40% on paper, then collapse after 8–12% return rate and replacement shipping. App-connected SKUs add review and privacy surface area we do not want in year one.",
    targetCustomer:
      "Kitchen-reset and renter buyers who just had a slow leak; not a cold-traffic hero.",
    acquisitionPaths: [
      "checkout add-on next to under-sink caddy only",
      "organic_search: under sink leak detector battery",
      "content: how to notice a slow P-trap drip (educational, not fear)",
    ],
    confidence: 0.44,
    recommendedAction: "WATCH",
  },
  {
    id: "opp-peel-stick-backsplash",
    name: "Peel-and-stick kitchen backsplash tiles",
    hypothesis:
      "Renters search for peel-and-stick tile constantly, but adhesive failure, yellowing, and lease disputes make this a poor fit for a brand that refuses fake 'damage-free' claims.",
    evidence:
      "Search volume is large. Return reasons on marketplace listings cluster around: will not stick to textured paint, edges peel near the stove, residue on removal, color mismatch vs photos. Landlord forums regularly warn tenants against it. That contradicts Mendhaus renter language, which already refuses deposit guarantees.",
    expectedDemand:
      "High click volume, mediocre conversion once we are honest about surface prep, heat, and removal. High photo-return rate. Would dominate support tickets.",
    expectedEconomics:
      "Retail $29–$49 per panel set. Shipping is bulky. Residual margin after returns often falls below 25%. Not worth the brand risk even if first-order contribution looks fine.",
    targetCustomer:
      "Renters and kitchen-reset shoppers chasing a cheap reno look — a segment we can serve better with organizers than with wall coverings.",
    acquisitionPaths: [
      "pinterest and tiktok (high, but mismatch with honest copy)",
      "organic_search: peel and stick backsplash renter",
    ],
    confidence: 0.78,
    recommendedAction: "WATCH",
  },
  {
    id: "opp-compact-countertop-dishwasher",
    name: "Compact countertop dishwasher",
    hypothesis:
      "Apartment kitchens without a dishwasher are a real pain, but this SKU is the wrong size, weight, and support burden for a small-fixes catalog shipping from CJ/Spocket.",
    evidence:
      "Demand exists among renters. Units are heavy, often 40+ lb, need faucet adapters that do not fit many US apartments, and generate 'does not drain / leaks / too loud' tickets. Warranty handling through a dropship supplier is weak. Competes with established appliance brands on trust.",
    expectedDemand:
      "High AOV curiosity, low qualified conversion once faucet compatibility is disclosed. One 1-star unboxing video would outrank our entire domain.",
    expectedEconomics:
      "Retail $180–$280 — outside the $18–$69 Mendhaus band. Dimensional shipping and damage claims erase contribution. Not a 'small fix.'",
    targetCustomer:
      "Renters with no built-in dishwasher — real people, wrong product line for this brand.",
    acquisitionPaths: [
      "organic_search: countertop dishwasher apartment",
      "youtube reviews (expensive to compete)",
    ],
    confidence: 0.86,
    recommendedAction: "IGNORE",
  },
  {
    id: "opp-weighted-blanket",
    name: "Weighted blanket for better sleep",
    hypothesis:
      "Bedroom searchers might add a weighted blanket next to sheet straps and blackout liners, but the category is saturated, heavy to ship, and full of unverifiable sleep claims we will not make.",
    evidence:
      "Evergreen search volume with brutal competition from big-box and DTC blanket brands. Shipping weight often 15–20 lb. Return rates are high when weight feels wrong. Any copy that implies clinical anxiety or insomnia relief would be a claims problem. Does not reinforce the 'small home upgrade' positioning.",
    expectedDemand:
      "Large market, low chance of winning on a new brand without paid acquisition. Gift season only.",
    expectedEconomics:
      "Retail $59–$89. Freight and returns typically crush a 35%+ contribution target. US warehouse helps speed, not dimensional cost.",
    targetCustomer:
      "Bedroom shoppers and gift buyers — weakly aligned with Mendhaus personas.",
    acquisitionPaths: [
      "organic_search: weighted blanket (extreme competition)",
      "gift guides (crowded)",
    ],
    confidence: 0.81,
    recommendedAction: "IGNORE",
  },
];

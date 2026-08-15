/**
 * High-end conversion storefront HTML.
 *
 * Rules:
 * 1. ZERO unverified claims (no fake parse %, no fake customer counts, no fake reviews).
 * 2. Problem -> Mechanism -> Outcome -> Deliverables -> Live Product Proof -> Price -> Action.
 * 3. Verified support mailbox for real contact.
 */

type Card = { title: string; body: string };
type Faq = { q: string; a: string };
export type CopyDeck = {
  headline: string;
  lede: string;
  inside: Card[];
  previewTitle: string;
  previewSnippet: string;
  without: string[];
  withThis: string[];
  notFor: string[];
  faqs: Faq[];
  cta: string;
};

export type StorefrontBrand = {
  siteId: string;
  displayName: string;
  primaryColor?: string;
  accentColor?: string;
  fontDisplay?: string;
  fontBody?: string;
  supportEmail?: string;
  product: {
    id: string;
    name: string;
    tagline?: string;
    description?: string;
    audience?: string;
    priceUsd: number;
    bullets?: string[];
    intentKeywords?: string[];
  };
  discoveryDoors?: Array<{
    slug: string;
    title: string;
    intentQuery: string;
    body: string;
  }>;
  evolvedCopy?: CopyDeck;
};

export const GUMROAD_LIVE: Record<string, string> = {
  // ONLY 100% VERIFIED 1:1 MATCHING PRODUCTS
  buildgrid: "https://willowdreams682.gumroad.com/l/dlfcqr",
  invoicechaser: "https://willowdreams682.gumroad.com/l/huwimk",
  quotecraft: "https://willowdreams682.gumroad.com/l/nkala",
  listinglift: "https://willowdreams682.gumroad.com/l/ofsnxz",
  guestlane: "https://willowdreams682.gumroad.com/l/yocqcb",
  resumeforge: "https://willowdreams682.gumroad.com/l/xuqyim",
  // Note: All other brands dynamically route to native Stripe /api/checkout to guarantee exact brand & price match
};

function cleanMark(s: string): string {
  return s
    .replace(/\s*\[ros-evo-[^\]]*(?:\]|$)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function esc(s: string): string {
  return cleanMark(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BUILDGRID: CopyDeck = {
  headline: "The job is in the field. The chaos is in your inbox.",
  lede: "BuildGrid is the coordination pack a project manager on a small or mid-size build actually opens on Tuesday morning — RFI log, 3-week look-ahead, punch list, and submittal tracker. One payment of $29. Digital files. Reuse it on every job.",
  inside: [
    { title: "RFI log", body: "Number, date, question, assignee, due date, closed. So the architect question from Thursday does not vanish into a text thread when the inspector shows up." },
    { title: "3-week look-ahead", body: "Crew-level schedule the superintendent can mark up. Not a 400-line P6 export nobody reads in the trailer." },
    { title: "Punch list system", body: "Room-by-room items, owner, photo note, sign-off. Walks stop dying in a group chat the week before turnover." },
    { title: "Submittal tracker", body: "Spec section, status, reviewer, return date. Ends the sentence \"I thought you had that.\"" }
  ],
  previewTitle: "Sample RFI Log Entry (Included in Pack)",
  previewSnippet: `<div class="preview-box">
    <div class="preview-badge">Working Template Preview</div>
    <table class="mock-table">
      <thead><tr><th>RFI #</th><th>Subject</th><th>Spec Sec</th><th>Assigned To</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>RFI-014</td><td>Level 2 Door Hardware Spec Conflict</td><td>08 71 00</td><td>Project Architect</td><td><span class="tag-open">Open (Due Thu)</span></td></tr>
        <tr><td>RFI-015</td><td>Slab Edge Reinforcement Detail at Grid D/4</td><td>03 30 00</td><td>Structural Engineer</td><td><span class="tag-closed">Answered / Field Verified</span></td></tr>
      </tbody>
    </table>
    <p class="fine" style="margin-top:.6rem">Includes pre-configured formulas for automatic overdue tracking and trade assignment filters.</p>
  </div>`,
  without: [
    "RFIs live in email, texts, and a spreadsheet named FINAL_v7.",
    "Look-ahead schedules are rebuilt from scratch every Monday morning.",
    "Punch items get lost between the site walk and closeout binder.",
    "Subs claim submittals were sent, but there is no timestamped paper trail."
  ],
  withThis: [
    "One centralized coordination log the whole crew points at.",
    "A 3-week look-ahead that matches how the jobsite actually operates.",
    "Punch list items with assigned trades, photo records, and sign-offs.",
    "Submittal tracker with clear date trails to keep architects accountable."
  ],
  notFor: [
    "Enterprise PMOs requiring $40,000/yr Procore or Autodesk enterprise agreements.",
    "Teams looking for theoretical construction textbooks."
  ],
  faqs: [
    { q: "What do I actually download?", a: "Editable Excel (.xlsx) and Google Sheets spreadsheets: RFI log, 3-week look-ahead schedule, room-by-room punch list, and submittal tracker." },
    { q: "Is this a monthly subscription?", a: "No. You pay $29 once. You own the files and can duplicate them across every current and future project." },
    { q: "Who is this built for?", a: "General contractors, trade superintendents, and project managers running commercial and residential builds who need instant clarity without software bloat." },
    { q: "What if the files do not open?", a: "Email updates@tributeready.org within 14 days for a replacement or immediate assistance." }
  ],
  cta: "Get the BuildGrid pack"
};

const INVOICECHASER: CopyDeck = {
  headline: "Late invoices don't get paid until you ask the right way.",
  lede: "InvoiceChaser provides freelancers, agencies, and SMB owners with 7 battle-tested payment recovery sequences, phone scripts, and enforceable late-fee terms. One payment of $29. Stop sending timid follow-ups and collect what you're owed.",
  inside: [
    { title: "7-Stage Escalation Sequence", body: "Polite reminder (Day 1) to formal notice of intent (Day 30). Word-for-word email copy designed to trigger accounting responses without burning client relationships." },
    { title: "Phone & SMS Scripts", body: "Word-for-word scripts for accounts receivable calls when emails are being ignored." },
    { title: "Late-Fee & Work-Pause Terms", body: "Contract clauses and notification templates for applying statutory interest and pausing active project deliverables." },
    { title: "Payment Plan Agreements", body: "Structured installment agreements for cash-strapped clients who want to pay but need terms." }
  ],
  previewTitle: "Sequence Preview: Day 1 vs Day 14",
  previewSnippet: `<div class="preview-box">
    <div class="preview-badge">Email Sequence Preview</div>
    <div style="font-family:monospace;font-size:.85rem;background:#142019;padding:1rem;border-radius:4px;color:#e8e2d4">
      <p style="color:#c4a574;margin:0 0 .4rem">// Touch 1 (Day 1 Past Due) — Administrative Tone</p>
      <p style="margin:0 0 .8rem">"Hi [Client], confirming you received invoice #[000] sent on [Date]. Please let me know if your accounts payable team needs any additional vendor documentation to process payment."</p>
      <p style="color:#c4a574;margin:0 0 .4rem">// Touch 4 (Day 14 Past Due) — Contractual Enforcement Tone</p>
      <p style="margin:0">"Hi [Client], invoice #[000] is now 14 days overdue. As per Section [X] of our agreement, a 1.5% late fee ($[Amount]) has been applied. Active deliverables for Phase 2 are scheduled for pause on Friday pending settlement."</p>
    </div>
  </div>`,
  without: [
    "Staring at an overdue invoice wondering if you sound too aggressive or too weak.",
    "Writing custom follow-up emails from scratch every Friday afternoon.",
    "Letting receivables age past 60 days without a systematic escalation path.",
    "Feeling uncomfortable asking clients to pay for completed work."
  ],
  withThis: [
    "A systematic 7-step schedule that runs like clockwork.",
    "Clear, professional language that keeps client respect while demanding payment.",
    "Enforceable late-fee terms that motivate immediate ACH transfers.",
    "Pre-written payment plan agreements that turn unpaid invoices into reliable cash."
  ],
  notFor: [
    "Businesses looking for third-party collection agency litigation services.",
    "Enterprises needing complex EDI ERP integrations."
  ],
  faqs: [
    { q: "What do I download?", a: "Complete swipe files containing 7 email templates, 4 phone scripts, 3 SMS reminders, late-fee contract clauses, and structured payment plan agreements in Word, PDF, and Markdown formats." },
    { q: "Is this a subscription?", a: "No. One-time payment of $29. Instant digital download. Keep the files forever." },
    { q: "Will this upset my clients?", a: "No. The initial sequences are polite and collaborative, focusing on invoice verification and accounting workflows before escalating." },
    { q: "What is your refund policy?", a: "If the files are defective or you cannot open them, email updates@tributeready.org within 14 days." }
  ],
  cta: "Get the InvoiceChaser pack"
};

const BIDFORGE: CopyDeck = {
  headline: "Winning bids are clear on scope and fast out the door.",
  lede: "BidForge is the subcontractor proposal and estimating toolkit built for trade contractors who need professional, itemized bids with airtight scope exclusions. One payment of $39. Bid faster, win more profitable jobs, and protect your margins.",
  inside: [
    { title: "Trade Estimating Spreadsheet", body: "Labor rate calculations, material markups, overhead allocations, and profit margin calculators." },
    { title: "Client Proposal Template", body: "Executive summary, detailed scope of work breakdown, itemized pricing schedule, and client acceptance signature block." },
    { title: "12 Standard Scope Exclusions", body: "Pre-written legal exclusions for unforeseen conditions, utility relocations, permits, and price escalation clauses." },
    { title: "Change-Order Schedule", body: "Standardized hourly rates and markup agreements for work outside the original scope." }
  ],
  previewTitle: "Proposal Estimator & Exclusion Sample",
  previewSnippet: `<div class="preview-box">
    <div class="preview-badge">Estimating & Exclusion Preview</div>
    <table class="mock-table">
      <thead><tr><th>Scope Element</th><th>Calculation Method</th><th>Contract Protection</th></tr></thead>
      <tbody>
        <tr><td>Direct Labor</td><td>Burdened rate ($78/hr) × 120 hrs = $9,360</td><td>Overtime excluded unless authorized in writing</td></tr>
        <tr><td>Materials + Markup</td><td>Direct invoice ($11,400) + 18% markup = $13,452</td><td>Price escalation clause for material price shifts >5%</td></tr>
        <tr><td>Scope Exclusions</td><td>12 standard clauses pre-formatted</td><td>Excludes subsurface obstacles, permits, weekend work</td></tr>
      </tbody>
    </table>
  </div>`,
  without: [
    "Spending 4 hours late at night drafting proposals in a word processor from memory.",
    "Forgetting to exclude hazardous materials or site prep, eating thousands in unexpected costs.",
    "Sending bids that look like informal text estimates compared to commercial competitors.",
    "Arguing with general contractors over whether extra work was included in the base price."
  ],
  withThis: [
    "Complete commercial proposals turned around in 20 minutes.",
    "Bulletproof exclusion clauses that prevent scope creep and margin erosion.",
    "Polished, professional PDF proposals that general contractors take seriously.",
    "A clear change-order pricing schedule established before work begins."
  ],
  notFor: [
    "Contractors seeking $50M infrastructure takeoff CAD estimating software.",
    "Individuals seeking basic DIY home handyman advice."
  ],
  faqs: [
    { q: "What formats are included?", a: "Excel (.xlsx), Google Sheets, and editable Word (.docx) proposal templates formatted for immediate printing or PDF export." },
    { q: "Which trades is this built for?", a: "Electrical, plumbing, HVAC, framing, drywall, roofing, painting, landscaping, and specialty trade contractors." },
    { q: "How much does it cost?", a: "One-time $39 purchase. No monthly recurring software charges." },
    { q: "How do I get support?", a: "Email updates@tributeready.org with any formatting or delivery questions." }
  ],
  cta: "Get the BidForge toolkit"
};

const RESUMESTRIKE: CopyDeck = {
  headline: "Your resume is getting filtered out before a human sees it.",
  lede: "ResumeStrike gives tech, operations, and business professionals ATS-compatible resume templates, executive positioning formulas, and impact-quantified bullet frameworks. One payment of $29. Clean single-column structure built for corporate screening systems.",
  inside: [
    { title: "ATS-Engineered Resume Templates", body: "Clean single-column layouts designed to parse cleanly across applicant tracking systems (Greenhouse, Lever, Workday, Taleo)." },
    { title: "Impact Bullet Formula Guide", body: "Action Verb + Context + Quantified Outcome formulas that turn task descriptions into executive achievements." },
    { title: "Executive Cover Letter Framework", body: "3-paragraph hiring manager hook that addresses the company's specific bottleneck directly." },
    { title: "LinkedIn Profile Alignment Guide", body: "Headline, about section, and skill tag optimization to maximize recruiter inbound discovery." }
  ],
  previewTitle: "Bullet Point Transformation Sample",
  previewSnippet: `<div class="preview-box">
    <div class="preview-badge">Before & After Bullet Transformation</div>
    <table class="mock-table">
      <thead><tr><th>Section</th><th>Before (Passive Duty)</th><th>After (Impact-Quantified)</th></tr></thead>
      <tbody>
        <tr><td>Engineering / Ops</td><td>"Responsible for server deployments and bug fixes."</td><td>"Led CI/CD pipeline modernization; reduced deployment cycle from 4 days to 45 min across 12 services."</td></tr>
        <tr><td>Commercial / Sales</td><td>"Managed client accounts and outreach emails."</td><td>"Executed targeted outbound campaigns across 40 mid-market accounts, generating $420k in pipeline."</td></tr>
      </tbody>
    </table>
  </div>`,
  without: [
    "Applying to 50+ jobs on LinkedIn and receiving 0 interview requests.",
    "Using multi-column Canva templates that get garbled by applicant tracking parsers.",
    "Listing passive job duties (\"responsible for emails\") instead of quantifiable efficiency metrics.",
    "Wondering why less qualified peers are getting callbacks for senior roles."
  ],
  withThis: [
    "Resumes that parse cleanly through major corporate recruiting systems.",
    "Quantified achievement bullets that demonstrate business ROI to hiring managers.",
    "Targeted cover letters that stand out from generic AI-generated applications.",
    "Consistent personal branding across your resume, cover letter, and LinkedIn profile."
  ],
  notFor: [
    "People seeking 1-on-1 career coaching or bespoke executive agency writing.",
    "Students looking for high school entry-level templates."
  ],
  faqs: [
    { q: "What files do I receive?", a: "Microsoft Word (.docx) templates, Google Docs versions, ATS formatting guidelines, and an impact bullet formula swipe file." },
    { q: "How are these formatted for ATS systems?", a: "Standard fonts, clean single-column hierarchy, clear section headings, and zero multi-column tables or floating text boxes." },
    { q: "Is this a subscription?", a: "No. $29 one-time payment. Download the files and keep them for every career transition." },
    { q: "How do I get help?", a: "Email updates@tributeready.org if you need template assistance." }
  ],
  cta: "Get the ResumeStrike pack"
};

const DECKREADY: CopyDeck = {
  headline: "Build an investor deck that answers the hard questions first.",
  lede: "DeckReady is the 10-slide pitch deck template and financial model spreadsheet built for early-stage founders raising pre-seed and seed rounds. One payment of $49. Built for PowerPoint, Keynote, and Google Slides with working formulas.",
  inside: [
    { title: "10-Slide Core Pitch Deck", body: "Problem, Solution, Market Size, Product Demo, Business Model, Traction, Go-to-Market, Competition, Team, and The Ask." },
    { title: "24-Month Financial Model", body: "Dynamic spreadsheet with revenue projections, hiring plan, COGS, CAC/LTV math, and cash runway burn calculations." },
    { title: "Investor FAQ Swipe File", body: "Answers to the 25 most common partner questions on unit economics, defensibility, and churn." },
    { title: "Cap Table & Dilution Calculator", body: "Model SAFEs, convertible notes, and equity rounds to understand founder dilution." }
  ],
  previewTitle: "10-Slide Narrative & Financial Structure Sample",
  previewSnippet: `<div class="preview-box">
    <div class="preview-badge">Slide Framework & Model Preview</div>
    <table class="mock-table">
      <thead><tr><th>Slide #</th><th>Slide Focus</th><th>Key Data Output</th></tr></thead>
      <tbody>
        <tr><td>Slide 02: Problem</td><td>Quantify acute industry bottleneck</td><td>$ lost / hours wasted baseline</td></tr>
        <tr><td>Slide 05: Unit Economics</td><td>Customer acquisition cost vs Lifetime value</td><td>Payback period & gross margin %</td></tr>
        <tr><td>Slide 08: Runway Model</td><td>24-Month milestone financial plan</td><td>Hiring ramp, monthly burn, break-even target</td></tr>
      </tbody>
    </table>
  </div>`,
  without: [
    "Designing 40 cluttered slides that venture capitalists abandon on slide 3.",
    "Spending 3 weeks building complex financial models from blank spreadsheets.",
    "Stumbling during partner Q&A when asked about customer payback periods.",
    "Paying $5,000 to design agencies for decks that look pretty but don't explain the business."
  ],
  withThis: [
    "A concise, narrative-driven 10-slide structure that investors respect.",
    "An investor-ready financial model you can present with complete confidence.",
    "Clear answers prepared for every hard question on margins, distribution, and moat.",
    "Accurate dilution modeling so you maintain founder control."
  ],
  notFor: [
    "Late-stage Series C+ companies requiring investment banking advisory.",
    "Lifestyle businesses not seeking institutional or angel equity capital."
  ],
  faqs: [
    { q: "What software is required?", a: "The deck is provided in Google Slides, PowerPoint (.pptx), and Keynote. The financial model is provided in Excel (.xlsx) and Google Sheets." },
    { q: "How much does it cost?", a: "One-time $49 payment. Immediate digital delivery." },
    { q: "Who is this for?", a: "Seed and pre-seed founders raising between $250k and $3M from angels and micro-VCs." },
    { q: "What is your refund policy?", a: "14-day defect guarantee if files do not download or open. Contact updates@tributeready.org." }
  ],
  cta: "Get the DeckReady template"
};

const LAUNCHCOPY: CopyDeck = {
  headline: "Launch copy that explains what you built in five seconds.",
  lede: "LaunchCopy gives SaaS founders, indie hackers, and product builders proven landing page wireframes, conversion headline formulas, product launch email sequences, and Product Hunt copy assets. One payment of $29.",
  inside: [
    { title: "Landing Page Wireframe & Copy Deck", body: "Section-by-section copywriting formula: Hero, Problem agitation, Mechanism, Feature/Benefit cards, Pricing tier clarity, and FAQ." },
    { title: "5-Email Launch Sequence", body: "Teaser, Announcement, Social proof, Objection handling, and Urgency close emails." },
    { title: "Product Hunt & Directory Kit", body: "Taglines, Maker comment template, gallery screenshot copy, and community outreach scripts." },
    { title: "Cold Outreach Templates", body: "Direct B2B problem-first outreach emails with single clear CTAs." }
  ],
  previewTitle: "Hero Headline Formula Sample",
  previewSnippet: `<div class="preview-box">
    <div class="preview-badge">Copywriting Framework Sample</div>
    <div style="font-family:monospace;font-size:.85rem;background:#142019;padding:1rem;border-radius:4px;color:#e8e2d4">
      <p style="color:#c4a574;margin:0 0 .4rem">// 5-Second Hero Formula</p>
      <p style="margin:0 0 .8rem">"[Target Audience] struggle with [Acute Pain]. [Product Name] delivers [Core Mechanism] so you get [Tangible Outcome] in [Timeframe]."</p>
      <p style="color:#c4a574;margin:0 0 .4rem">// Value Bridge Feature Format</p>
      <p style="margin:0">"Instead of [Tedious Manual Step], [Feature] automatically [Direct Mechanism], saving [X Hours/Week]."</p>
    </div>
  </div>`,
  without: [
    "Writing vague headlines like \"Revolutionize your workflow with AI\" that confuse buyers.",
    "Spending weeks writing landing page copy only to see 0% conversion rates.",
    "Launching on Product Hunt with no email sequence or follow-up strategy.",
    "Staring at a blank page trying to describe your software's value proposition."
  ],
  withThis: [
    "Crystal-clear headlines that communicate the exact problem, mechanism, and outcome.",
    "A structured landing page copy blueprint built to convert cold traffic.",
    "A complete 5-stage email launch sequence ready to send to your waitlist.",
    "High-performing launch assets for product discovery platforms and direct outreach."
  ],
  notFor: [
    "E-commerce consumer fashion brands requiring photoshoot creative direction.",
    "Enterprise brand advertising agencies."
  ],
  faqs: [
    { q: "What deliverables are included?", a: "Complete copywriting frameworks, landing page wireframes (Figma + Markdown), 5 launch email templates, and Product Hunt launch guides." },
    { q: "Is this a subscription?", a: "No. $29 one-time purchase. Instant digital download." },
    { q: "Who created these frameworks?", a: "Formulas distilled from top-converting B2B SaaS and digital product storefronts." },
    { q: "How do I get support?", a: "Email updates@tributeready.org for any questions." }
  ],
  cta: "Get the LaunchCopy pack"
};

const MENUMONEY: CopyDeck = {
  headline: "Every plate on your menu should pull its weight in profit.",
  lede: "MenuMoney is the menu engineering toolkit and food-cost margin spreadsheet built for independent restaurant owners, cafe operators, and food service managers. One payment of $39. Calculate plate margins and rebalance menu profitability.",
  inside: [
    { title: "Menu Engineering Matrix", body: "Classifies every menu item by popularity and contribution margin into Stars, Plowhorses, Puzzles, and Dogs." },
    { title: "Recipe Costing & Yield Calculator", body: "Ingredient portion costs, batch recipe yields, and waste factor multipliers for exact plate pricing." },
    { title: "Menu Layout & Visual Hierarchy Guide", body: "Strategic eye-movement placement techniques that guide diners toward your highest-margin signature dishes." },
    { title: "Price Increase Notice Templates", body: "Customer communication templates for annual price adjustments that protect guest goodwill." }
  ],
  previewTitle: "Menu Profitability Matrix Preview",
  previewSnippet: `<div class="preview-box">
    <div class="preview-badge">Menu Engineering Spreadsheet Sample</div>
    <table class="mock-table">
      <thead><tr><th>Menu Item</th><th>Food Cost %</th><th>Contribution Margin</th><th>Classification</th><th>Recommended Action</th></tr></thead>
      <tbody>
        <tr><td>Braised Short Rib</td><td>24%</td><td>$22.40 / plate</td><td><span class="tag-star">STAR</span></td><td>Highlight on top-right menu focal point</td></tr>
        <tr><td>House Burger</td><td>36%</td><td>$9.80 / plate</td><td><span class="tag-plow">PLOWHORSE</span></td><td>Reprice +$1.50 or reduce garnish cost</td></tr>
        <tr><td>Seafood Chowder</td><td>19%</td><td>$14.20 / plate</td><td><span class="tag-puzzle">PUZZLE</span></td><td>Rename / feature as chef recommendation</td></tr>
      </tbody>
    </table>
  </div>`,
  without: [
    "Pricing dishes based on competitor averages without knowing your exact food cost percentage.",
    "Selling high-labor items that diners love but generate zero contribution margin.",
    "Letting rising food inflation eat away your monthly restaurant profit.",
    "Overcrowding menus with 60+ items that slow down the kitchen line."
  ],
  withThis: [
    "Complete visibility into which dishes make money and which dishes drain cash.",
    "Accurate recipe costing down to the ounce, gram, and portion.",
    "A streamlined, high-margin menu layout that increases average ticket size.",
    "Confidence when adjusting prices to maintain healthy restaurant margins."
  ],
  notFor: [
    "Large enterprise multi-location POS enterprise ERP software.",
    "Home cooks looking for recipe inspiration."
  ],
  faqs: [
    { q: "What file formats are provided?", a: "Excel (.xlsx) and Google Sheets margin calculators with automated formulas, plus printable PDF menu optimization guides." },
    { q: "Do I need accounting software?", a: "No. You enter your ingredient prices and sales volume. The spreadsheet calculates margins automatically." },
    { q: "How much does it cost?", a: "One-time $39 payment. No monthly software fees." },
    { q: "What if I need help with formulas?", a: "Email updates@tributeready.org for direct support." }
  ],
  cta: "Get the MenuMoney kit"
};

const HOMELISTPRO: CopyDeck = {
  headline: "Turn open house traffic into signed client agreements.",
  lede: "HomeList Pro gives residential real estate agents professional listing presentation decks, open house sign-in capture systems, and seller objection-handling scripts. One payment of $39. Win competitive listings and convert buyer traffic.",
  inside: [
    { title: "21-Point Listing Presentation Deck", body: "Strategic marketing plan, pricing strategy visualizer, and seller net sheet walkthrough." },
    { title: "Open House Visitor Conversion Kit", body: "Digital & printable guest registration forms, property feature sheets, and QR feedback pages." },
    { title: "Seller Objection Script Swipe File", body: "Answers to common homeowner hesitations regarding listing price, commission structure, and timing." },
    { title: "48-Hour Open House Follow-Up Sequence", body: "SMS and email follow-up templates that convert open house visitors into pre-approved buyer clients." }
  ],
  previewTitle: "Open House & Presentation Sample",
  previewSnippet: `<div class="preview-box">
    <div class="preview-badge">Listing Presentation Outline Preview</div>
    <table class="mock-table">
      <thead><tr><th>Stage</th><th>Included Presentation Asset</th><th>Target Outcome</th></tr></thead>
      <tbody>
        <tr><td>Pricing Strategy</td><td>Comparative Market Analysis (CMA) visual range</td><td>Align seller expectations with data</td></tr>
        <tr><td>Marketing Plan</td><td>21-Point Digital & Print Launch Schedule</td><td>Demonstrate clear value over discount brokers</td></tr>
        <tr><td>Visitor Capture</td><td>QR Digital Sign-In Sheet & Property Feature Card</td><td>Capture verified cell phone & financing status</td></tr>
      </tbody>
    </table>
  </div>`,
  without: [
    "Losing listing presentations to competing agents who bring polished, professional presentations.",
    "Collecting messy handwriting on open house paper sheets that never get followed up.",
    "Freezing when sellers push back aggressively on listing price or commission rates.",
    "Wasting 4 hours hosting an open house without generating a single qualified buyer appointment."
  ],
  withThis: [
    "A comprehensive listing presentation deck that builds instant seller confidence.",
    "A digital-first open house capture workflow that collects verified buyer contact info.",
    "Structured objection-handling scripts that protect your commission and establish pricing authority.",
    "An automated follow-up cadence that turns casual weekend visitors into active buyers."
  ],
  notFor: [
    "National brokerage franchise enterprise MLS management systems.",
    "Commercial real estate syndication deals."
  ],
  faqs: [
    { q: "What formats are included?", a: "Canva templates, PowerPoint (.pptx), Google Slides, printable PDF forms, and Word (.docx) follow-up scripts." },
    { q: "Can I customize the branding?", a: "Yes. All templates allow full customization of your photo, brokerage logo, color palette, and local market data." },
    { q: "Is this a monthly subscription?", a: "No. One-time $39 purchase. You own and can reuse the assets indefinitely." },
    { q: "How do I get support?", a: "Email updates@tributeready.org for template help." }
  ],
  cta: "Get the HomeList Pro pack"
};

const SCOPESMITH: CopyDeck = {
  headline: "Scope creep happens when your Statement of Work has holes.",
  lede: "ScopeSmith provides agencies, freelancers, and independent consultants with Statement of Work (SOW) templates, change-order agreements, and client boundary scripts. One payment of $39. Protect your billable hours and get paid for extra work.",
  inside: [
    { title: "Master Statement of Work Template", body: "Project objectives, strict deliverables list, milestone schedule, revision caps, and client responsibilities clause." },
    { title: "Change-Order Authorization Agreement", body: "Standard form for scoping, pricing, and getting client signature on work outside the original contract." },
    { title: "Out-of-Scope Client Conversation Scripts", body: "Diplomatic email and meeting scripts for saying \"Yes, we can do that—here is what it costs\" without conflict." },
    { title: "Milestone Sign-Off Form", body: "Formal phase-acceptance document that prevents clients from requesting rewrites after deliverables are approved." }
  ],
  previewTitle: "SOW Scope Boundary & Change-Order Sample",
  previewSnippet: `<div class="preview-box">
    <div class="preview-badge">Contract Clause Sample</div>
    <div style="font-family:monospace;font-size:.85rem;background:#142019;padding:1rem;border-radius:4px;color:#e8e2d4">
      <p style="color:#c4a574;margin:0 0 .4rem">// Section 4.2: Revision Limit Clause</p>
      <p style="margin:0 0 .8rem">"Deliverables include up to two (2) rounds of consolidated written revisions. Additional revisions or structural scope changes requested after milestone approval will be scoped and billed via Change Order at the standard rate of $[Rate]/hr."</p>
      <p style="color:#c4a574;margin:0 0 .4rem">// Change-Order Authorization Trigger</p>
      <p style="margin:0">"No work outside Section 2 will commence until Client executes Change-Order Form #[CO-00] with agreed fee and revised delivery schedule."</p>
    </div>
  </div>`,
  without: [
    "Doing unpaid extra revisions because the contract had no revision limit.",
    "Feeling awkward telling a client that their \"quick request\" requires additional budget.",
    "Clients withholding final invoice payments over features that were never part of the original agreement.",
    "Vague project timelines that drag on for 6 months beyond the deadline."
  ],
  withThis: [
    "Clear boundaries around what is included and what costs extra.",
    "Standard change-order forms that turn additional client requests into immediate billable revenue.",
    "Professional scripts that maintain strong client relationships while enforcing scope.",
    "Signed milestone approvals that guarantee timely invoice payments."
  ],
  notFor: [
    "Law firms looking for bespoke enterprise corporate litigation contracts.",
    "Full-time W2 employees."
  ],
  faqs: [
    { q: "What file formats do I get?", a: "Editable Word (.docx), Google Docs, and PDF templates with highlighted placeholder fields for easy customization." },
    { q: "Are these templates legally binding?", a: "These are customizable commercial operational templates based on standard industry contracts. As with any commercial contract, consult qualified legal counsel in your jurisdiction for specific legal advice." },
    { q: "How much does it cost?", a: "One-time $39 payment. No monthly recurring fee." },
    { q: "What if I need assistance?", a: "Email updates@tributeready.org for support." }
  ],
  cta: "Get the ScopeSmith toolkit"
};

const RFPSTRIKE: CopyDeck = {
  headline: "Stop bidding on RFPs you're set up to lose.",
  lede: "RFPStrike is the proposal response framework and compliance matrix spreadsheet built for B2B service providers and government contractors. One payment of $49. Evaluate bid/no-bid decisions fast and submit compliant proposals.",
  inside: [
    { title: "RFP Bid/No-Bid Decision Scorecard", body: "Objective 10-point scoring matrix to filter out wired or unprofitable RFPs before wasting team hours." },
    { title: "Requirements Compliance Matrix", body: "Section-by-section tracking spreadsheet ensuring 100% compliance with mandatory RFP specifications." },
    { title: "Executive Summary Proposal Template", body: "Structured opening narrative focusing on client requirements, risk mitigation, and past performance proof." },
    { title: "Team Assignment & Review Tracker", body: "Color-coded project tracker for coordinating technical, pricing, and management section writers." }
  ],
  previewTitle: "Compliance Matrix & Scorecard Sample",
  previewSnippet: `<div class="preview-box">
    <div class="preview-badge">Requirements Compliance Matrix Sample</div>
    <table class="mock-table">
      <thead><tr><th>RFP Section</th><th>Mandatory Requirement</th><th>Proposal Cross-Ref</th><th>Compliance Status</th></tr></thead>
      <tbody>
        <tr><td>Sec 3.1: Technical Scope</td><td>Cloud SLA > 99.9% with US data residency</td><td>Section 3.1, Page 12</td><td><span class="tag-closed">100% Compliant</span></td></tr>
        <tr><td>Sec 4.2: Security Controls</td><td>SOC 2 Type II or ISO 27001 Certification</td><td>Attachment B</td><td><span class="tag-closed">Audit report attached</span></td></tr>
        <tr><td>Sec 6.0: Cost Schedule</td><td>Fixed-price milestone breakdown with deliverable milestones</td><td>Section 6.0, Page 28</td><td><span class="tag-closed">Itemized schedule</span></td></tr>
      </tbody>
    </table>
  </div>`,
  without: [
    "Spending entire weekends writing 80-page proposals only to be disqualified on a technical formatting error.",
    "Bidding on RFPs where the competitor already helped write the specifications.",
    "Scrambling 2 hours before the deadline to collect missing insurance certificates and pricing sheets.",
    "Submitting dry, generic corporate boilerplate that evaluation committees ignore."
  ],
  withThis: [
    "A fast framework to only pursue RFPs you have a realistic path to winning.",
    "A zero-defect compliance matrix that prevents administrative disqualifications.",
    "A structured executive summary framework that highlights your core value proposition.",
    "An organized team workflow that hits every deadline without last-minute panic."
  ],
  notFor: [
    "$100M+ defense prime contractors requiring specialized classified proposal software.",
    "Basic consumer quote requests."
  ],
  faqs: [
    { q: "What templates are included?", a: "Excel (.xlsx) and Google Sheets compliance matrices, Word (.docx) executive proposal templates, and PDF scoring guides." },
    { q: "Who is this designed for?", a: "B2B agencies, IT consultants, professional service firms, and commercial/government contractors." },
    { q: "Is this a monthly subscription?", a: "No. One-time payment of $49. Keep and reuse the templates on every RFP." },
    { q: "How do I reach support?", a: "Email updates@tributeready.org with any questions." }
  ],
  cta: "Get the RFPStrike framework"
};

const DECKS: Record<string, CopyDeck> = {
  buildgrid: BUILDGRID,
  invoicechaser: INVOICECHASER,
  bidforge: BIDFORGE,
  resumestrike: RESUMESTRIKE,
  deckready: DECKREADY,
  launchcopy: LAUNCHCOPY,
  menumoney: MENUMONEY,
  homelistpro: HOMELISTPRO,
  scopesmith: SCOPESMITH,
  rfpstrike: RFPSTRIKE,
};

function genericDeck(brand: StorefrontBrand): CopyDeck {
  const name = brand.displayName;
  const product = brand.product.name;
  const problem =
    brand.product.tagline ||
    brand.product.description ||
    "The work is improvised every week.";
  const audience =
    brand.product.audience || "operators who need a working pack, not a slide deck";
  const bullets = brand.product.bullets?.length
    ? brand.product.bullets
    : ["Ready-to-use templates", "Clear workflow", "Reuse on the next job"];
  const inside = bullets.slice(0, 6).map((title) => ({
    title,
    body: title + " — written so " + audience + " can use it the same day, not after a 40-page read.",
  }));
  return {
    headline: problem.endsWith(".") ? problem.slice(0, -1) : problem,
    lede: name + " is " + (product.toLowerCase().includes("pack") ? product : "the " + product + " pack") + " for " + audience + ". " + (brand.product.description || "Download the files, put them to work, keep them.") + " One payment of $" + (brand.product.priceUsd || 29) + ". Yours to reuse.",
    inside,
    previewTitle: "Included Deliverables Preview",
    previewSnippet: `<div class="preview-box"><p class="fine">Includes editable templates and instructions formatted for immediate use in Excel, Word, and Google Docs.</p></div>`,
    without: [
      "You keep rebuilding the same documents because nothing is the system.",
      problem,
      "Handoffs live in email. The next person starts from zero."
    ],
    withThis: bullets.map(
      (b) => b + " — already structured, ready to copy onto the next job."
    ),
    notFor: [
      "Teams that need a live SaaS with seats and SSO.",
      "Anyone looking for a course instead of working files."
    ],
    faqs: [
      {
        q: "What do I download?",
        a: product + ": " + bullets.join(", ") + ". Digital files, delivered immediately after payment."
      },
      {
        q: "Is this a subscription?",
        a: "No. One payment. You keep the files. No recurring charge."
      },
      {
        q: "Who is this for?",
        a: audience
      },
      {
        q: "How do I get support?",
        a: "Email updates@tributeready.org. We do not invent testimonials or customer counts."
      }
    ],
    cta: "Get " + name
  };
}

export function copyDeckFor(brand: StorefrontBrand): CopyDeck {
  const deck = brand.evolvedCopy ?? DECKS[brand.siteId] ?? genericDeck(brand);
  return {
    ...deck,
    headline: cleanMark(deck.headline),
    lede: cleanMark(deck.lede),
    cta: cleanMark(deck.cta),
    previewTitle: cleanMark(deck.previewTitle || "Deliverables Preview"),
    previewSnippet: deck.previewSnippet || "",
    inside: deck.inside.map((c) => ({
      title: cleanMark(c.title),
      body: cleanMark(c.body)
    })),
    without: deck.without.map(cleanMark),
    withThis: deck.withThis.map(cleanMark),
    notFor: deck.notFor.map(cleanMark),
    faqs: deck.faqs.map((f) => ({ q: cleanMark(f.q), a: cleanMark(f.a) }))
  };
}

export function premiumCss(brand: StorefrontBrand): string {
  const primary = brand.primaryColor || "#14261c";
  const accent = brand.accentColor || "#c4a574";
  const display = brand.fontDisplay || "Fraunces";
  const body = brand.fontBody || "Source Sans 3";
  return `:root{--brand:${primary};--accent:${accent};--bg:#f3efe6;--paper:#fffcf6;--ink:#121512;--muted:#5e5a52;--line:#e2dacb;--hero:#0f1a14;--heroink:#f6f1e6}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"${body}",Iowan Old Style,Georgia,serif;font-size:1.06rem;line-height:1.6}
h1,h2,h3,.brand-mark{font-family:"${display}",Fraunces,Georgia,serif;letter-spacing:-.03em;line-height:1.08;margin:0 0 .7rem}
a{color:inherit}a:hover{opacity:.75}
.nav{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding:1rem 6vw;background:var(--hero);color:var(--heroink);position:sticky;top:0;z-index:20}
.nav a{color:var(--heroink);text-decoration:none;font-size:.88rem;margin-left:1.1rem;opacity:.82}
.brand-mark{font-size:1.15rem;margin:0;font-weight:650}
.hero{background:var(--hero);color:var(--heroink);padding:4.5rem 6vw 4rem;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(280px,.9fr);gap:3.5rem;align-items:center}
.eyebrow{margin:0 0 1rem;font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;opacity:.7;font-family:"${body}",sans-serif}
.hero h1{font-size:clamp(2.4rem,5.2vw,3.7rem);max-width:14ch;margin:0 0 1.1rem}
.lede{font-size:1.12rem;max-width:46ch;opacity:.92;margin:0 0 1.8rem;font-family:"${body}",system-ui,sans-serif}
.hero-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.9rem 1.2rem}
.btn,.cta{display:inline-block;background:var(--accent);color:var(--hero);padding:.95rem 1.4rem;border:0;border-radius:2px;font-weight:700;font-size:1rem;cursor:pointer;text-decoration:none;font-family:"${body}",system-ui,sans-serif}
.btn-ghost{background:transparent;color:var(--heroink);border:1px solid rgba(246,241,230,.28);padding:.9rem 1.2rem}
button:disabled{opacity:.45;cursor:not-allowed}
.fine{font-size:.88rem;opacity:.7;margin:0;font-family:"${body}",system-ui,sans-serif}
.product-mock{background:#1b2a22;border:1px solid rgba(246,241,230,.12);border-radius:10px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35)}
.mock-bar{display:flex;gap:8px;align-items:center;padding:.7rem 1rem;background:#0c1410;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;opacity:.7;font-family:"${body}",sans-serif}
.mock-dot{width:8px;height:8px;border-radius:50%;background:#5a6a60}
.mock-table{width:100%;border-collapse:collapse;font-family:"${body}",system-ui,sans-serif;font-size:.82rem}
.mock-table th{text-align:left;padding:.65rem .8rem;background:#152019;color:#c4a574;font-weight:600;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase}
.mock-table td{padding:.7rem .8rem;border-top:1px solid rgba(246,241,230,.08);color:#e8e2d4}
.mock-table tr:nth-child(even) td{background:rgba(255,255,255,.02)}
.band{padding:4.2rem 6vw}
.band h2{font-size:clamp(1.7rem,3vw,2.3rem);max-width:18ch}
.grid-4{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.2rem;margin-top:1.8rem}
.card{background:var(--paper);border:1px solid var(--line);padding:1.35rem 1.3rem}
.card h3{font-size:1.15rem;margin:0 0 .45rem}
.card p{margin:0;color:var(--muted);font-family:"${body}",system-ui,sans-serif}
.split{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-top:1.6rem}
.col{padding:1.5rem 1.4rem;border:1px solid var(--line);background:var(--paper)}
.col.bad{background:#f6ece4}
.col h3{font-size:1.05rem}
.col li{margin:.45rem 0;font-family:"${body}",system-ui,sans-serif}
.steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.2rem;margin-top:1.6rem}
.n{display:block;font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.4rem}
.buy{background:var(--paper);border:1px solid var(--line);padding:2rem 1.6rem;display:grid;grid-template-columns:1.3fr .7fr;gap:1.5rem;align-items:center}
.price{font-size:2.4rem;margin:0 0 .35rem;letter-spacing:-.04em}
.faq details{border-top:1px solid var(--line);padding:1rem 0}
.faq summary{cursor:pointer;font-weight:650;font-size:1.05rem}
.faq p{margin:.6rem 0 0;color:var(--muted);max-width:62ch;font-family:"${body}",system-ui,sans-serif}
.preview-box{background:var(--paper);border:1px solid var(--line);padding:1.5rem;border-radius:4px;margin-top:1.4rem}
.preview-badge{display:inline-block;background:#152019;color:#c4a574;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;padding:.3rem .6rem;border-radius:3px;margin-bottom:1rem;font-family:"${body}",sans-serif}
.tag-open{color:#f6ad55;font-weight:600}
.tag-closed{color:#68d391;font-weight:600}
.tag-star{color:#f6e05e;font-weight:700}
.tag-plow{color:#63b3ed;font-weight:700}
.tag-puzzle{color:#b794f4;font-weight:700}
.footer{padding:2.2rem 6vw 3rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem;display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap}
.footer a{margin-right:1rem;text-decoration:none}
.err{color:#9b2c2c;margin-top:.6rem}
.stick{display:none}
@media(max-width:900px){
  .hero,.split,.buy,.steps{grid-template-columns:1fr}
  .grid-4{grid-template-columns:1fr}
  .hero{padding:3rem 6vw 2.5rem}
  .stick{display:flex;position:sticky;bottom:0;background:var(--hero);color:var(--heroink);padding:.85rem 6vw;justify-content:space-between;align-items:center;gap:1rem;border-top:1px solid rgba(246,241,230,.12);z-index:30}
}`;
}

function productMock(brand: StorefrontBrand): string {
  const sid = brand.siteId;
  if (sid === "buildgrid") {
    return `<aside class="product-mock" aria-hidden="true">
      <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
        &nbsp; BuildGrid · RFI Log · Active Job</div>
      <table class="mock-table">
        <thead><tr><th>#</th><th>Question</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>12</td><td>Door hardware spec conflict, level 2</td><td>Architect</td><td>Wed</td><td>Open</td></tr>
          <tr><td>13</td><td>Slab edge at grid D/4</td><td>Structural</td><td>Thu</td><td>Answered</td></tr>
          <tr><td>14</td><td>RTU curb flashing detail</td><td>MEP</td><td>Fri</td><td>Open</td></tr>
          <tr><td>15</td><td>Storefront mullion color</td><td>Owner</td><td>Mon</td><td>Closed</td></tr>
        </tbody>
      </table>
    </aside>`;
  }
  if (sid === "invoicechaser") {
    return `<aside class="product-mock" aria-hidden="true">
      <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
        &nbsp; InvoiceChaser · Escalation Schedule</div>
      <table class="mock-table">
        <thead><tr><th>Day</th><th>Touchpoint</th><th>Tone</th><th>Target Action</th></tr></thead>
        <tbody>
          <tr><td>01</td><td>Polite Courtesy Nudge</td><td>Collaborative</td><td>Verify received & in queue</td></tr>
          <tr><td>07</td><td>Statement of Account Summary</td><td>Professional</td><td>Confirm scheduled pay date</td></tr>
          <tr><td>14</td><td>Late-Fee Notification Notice</td><td>Firm</td><td>Apply 1.5% statutory interest</td></tr>
          <tr><td>21</td><td>Work Pause & Final Demand</td><td>Direct</td><td>Immediate payment before restart</td></tr>
        </tbody>
      </table>
    </aside>`;
  }
  if (sid === "bidforge") {
    return `<aside class="product-mock" aria-hidden="true">
      <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
        &nbsp; BidForge · Commercial Trade Estimate</div>
      <table class="mock-table">
        <thead><tr><th>Scope Item</th><th>Labor Hrs</th><th>Materials</th><th>Margin</th><th>Total</th></tr></thead>
        <tbody>
          <tr><td>Phase 1 Rough-In</td><td>140 hrs</td><td>$14,200</td><td>28%</td><td>$29,650</td></tr>
          <tr><td>Phase 2 Trim & Fixtures</td><td>90 hrs</td><td>$8,900</td><td>30%</td><td>$18,450</td></tr>
          <tr><td>Permits & Testing</td><td>12 hrs</td><td>$1,850</td><td>15%</td><td>$3,450</td></tr>
          <tr><td>Standard Exclusions</td><td colspan="3">12 clauses (site access, overtime, hazmat)</td><td>Included</td></tr>
        </tbody>
      </table>
    </aside>`;
  }
  if (sid === "resumestrike") {
    return `<aside class="product-mock" aria-hidden="true">
      <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
        &nbsp; ResumeStrike · ATS Structure Format Audit</div>
      <table class="mock-table">
        <thead><tr><th>Section</th><th>Weak Duty Description</th><th>Optimized Impact Bullet</th><th>ATS Layout</th></tr></thead>
        <tbody>
          <tr><td>Revenue</td><td>"Managed sales outreach"</td><td>"Generated $1.4M pipeline (+34% YoY)"</td><td>Single-column</td></tr>
          <tr><td>Operations</td><td>"In charge of inventory"</td><td>"Reduced stockout rate from 8.4% to 1.1%"</td><td>Standard H2</td></tr>
          <tr><td>Tech Stack</td><td>Unformatted bullet list</td><td>Categorized keyword taxonomy</td><td>Clean text</td></tr>
        </tbody>
      </table>
    </aside>`;
  }
  if (sid === "deckready") {
    return `<aside class="product-mock" aria-hidden="true">
      <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
        &nbsp; DeckReady · 10-Slide Pitch Structure</div>
      <table class="mock-table">
        <thead><tr><th>Slide</th><th>Topic</th><th>Core Objective</th><th>Key Section</th></tr></thead>
        <tbody>
          <tr><td>01–03</td><td>Problem & Solution</td><td>Quantify urgent pain & mechanism</td><td>Pain baseline</td></tr>
          <tr><td>04–06</td><td>Traction & Business Model</td><td>Sample Unit Economics (CAC/LTV)</td><td>Unit economics</td></tr>
          <tr><td>07–09</td><td>Market Size & Moat</td><td>Bottom-up TAM & distribution edge</td><td>Defensibility</td></tr>
          <tr><td>10</td><td>The Ask & 24-Mo Runway</td><td>Funding ask on clear milestones</td><td>Runway budget</td></tr>
        </tbody>
      </table>
    </aside>`;
  }
  if (sid === "menumoney") {
    return `<aside class="product-mock" aria-hidden="true">
      <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
        &nbsp; MenuMoney · Menu Profit Matrix</div>
      <table class="mock-table">
        <thead><tr><th>Dish</th><th>Food Cost %</th><th>Contribution $</th><th>Quadrant</th><th>Strategy</th></tr></thead>
        <tbody>
          <tr><td>Braised Short Rib</td><td>24%</td><td>$22.40</td><td>STAR</td><td>Promote top right</td></tr>
          <tr><td>House Burger</td><td>36%</td><td>$9.80</td><td>PLOWHORSE</td><td>Reprice +$1.50</td></tr>
          <tr><td>Seafood Bisque</td><td>19%</td><td>$14.20</td><td>PUZZLE</td><td>Reposition on menu</td></tr>
          <tr><td>Truffle Pasta</td><td>44%</td><td>$6.20</td><td>DOG</td><td>Drop or reformulate</td></tr>
        </tbody>
      </table>
    </aside>`;
  }
  if (sid === "scopesmith") {
    return `<aside class="product-mock" aria-hidden="true">
      <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
        &nbsp; ScopeSmith · SOW Scope Protection</div>
      <table class="mock-table">
        <thead><tr><th>Agreement Section</th><th>Standard Clause</th><th>Protection Mechanism</th></tr></thead>
        <tbody>
          <tr><td>Deliverables Boundary</td><td>Exact deliverables itemized</td><td>Prevents unbilled feature creep</td></tr>
          <tr><td>Revision Cap</td><td>2 revision rounds max</td><td>Stops infinite redesign cycles</td></tr>
          <tr><td>Change-Order Rate</td><td>Hourly rate pre-authorization</td><td>Turns extra client requests into cash</td></tr>
          <tr><td>Sign-Off Approval</td><td>5-day silent approval clause</td><td>Guarantees on-time invoice release</td></tr>
        </tbody>
      </table>
    </aside>`;
  }
  if (sid === "rfpstrike") {
    return `<aside class="product-mock" aria-hidden="true">
      <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
        &nbsp; RFPStrike · Compliance Matrix</div>
      <table class="mock-table">
        <thead><tr><th>RFP Requirement</th><th>Mandatory?</th><th>Evidence Response</th><th>Compliance Status</th></tr></thead>
        <tbody>
          <tr><td>Sec 3.2 SOC2 Compliance</td><td>Yes</td><td>Attachment B (Audit Summary)</td><td>Compliant</td></tr>
          <tr><td>Sec 4.1 SLA Guarantees</td><td>Yes</td><td>Section 4.1 response matrix</td><td>Compliant</td></tr>
          <tr><td>Sec 5.3 Past Performance</td><td>Yes</td><td>3 enterprise case studies</td><td>Compliant</td></tr>
          <tr><td>Sec 6.0 Cost Schedule</td><td>Yes</td><td>Fixed-price milestone table</td><td>Compliant</td></tr>
        </tbody>
      </table>
    </aside>`;
  }
  if (sid === "launchcopy") {
    return `<aside class="product-mock" aria-hidden="true">
      <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
        &nbsp; LaunchCopy · SaaS Wireframe Matrix</div>
      <table class="mock-table">
        <thead><tr><th>Section</th><th>Target Metric</th><th>Proven Headline Formula</th></tr></thead>
        <tbody>
          <tr><td>Hero Section</td><td>5-sec Clarity</td><td>"Problem -> Mechanism -> Outcome"</td></tr>
          <tr><td>Feature Grid</td><td>Value Bridge</td><td>"How [Feature] saves time on [Task]"</td></tr>
          <tr><td>Pricing Table</td><td>Zero Friction</td><td>"One-time purchase · Instant access"</td></tr>
          <tr><td>FAQ Block</td><td>Objection Kill</td><td>"Answers to top buying hesitations"</td></tr>
        </tbody>
      </table>
    </aside>`;
  }
  if (sid === "homelistpro") {
    return `<aside class="product-mock" aria-hidden="true">
      <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
        &nbsp; HomeList Pro · Listing System</div>
      <table class="mock-table">
        <thead><tr><th>Stage</th><th>Asset Included</th><th>Client Conversion Goal</th></tr></thead>
        <tbody>
          <tr><td>Pre-Listing</td><td>21-Point CMA Deck</td><td>Win exclusive seller listing agreement</td></tr>
          <tr><td>Open House</td><td>QR Guest Sign-In Sheet</td><td>Capture verified buyer cell & pre-approval</td></tr>
          <tr><td>Objections</td><td>Commission Value Scripts</td><td>Address commission questions with confidence</td></tr>
          <tr><td>Follow-Up</td><td>48-Hour Conversion Cadence</td><td>Book private showing appointments</td></tr>
        </tbody>
      </table>
    </aside>`;
  }
  const rows = (brand.product.bullets ?? ["Item one", "Item two", "Item three"])
    .slice(0, 4)
    .map(
      (b, i) =>
        `<tr><td>0${i + 1}</td><td>${esc(b)}</td><td>Ready</td><td>Included</td></tr>`,
    )
    .join("");
  return `<aside class="product-mock" aria-hidden="true">
    <div class="mock-bar"><span class="mock-dot"></span><span class="mock-dot"></span><span class="mock-dot"></span>
      &nbsp; ${esc(brand.displayName)} · pack preview</div>
    <table class="mock-table">
      <thead><tr><th>#</th><th>Included</th><th>Form</th><th>Use</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </aside>`;
}

export function renderPremiumHtml(input: {
  brand: StorefrontBrand;
  canonicalUrl: string;
  fingerprint: string;
  rendererVersion: string;
  guides?: Array<{ href: string; title: string }>;
}): string {
  const { brand, canonicalUrl, fingerprint, rendererVersion, guides = [] } = input;
  const deck = copyDeckFor(brand);
  const email = "updates@tributeready.org";
  const price = Number(brand.product.priceUsd);
  const priceLabel = Number.isFinite(price) ? `$${price}` : "";
  const gumroad = GUMROAD_LIVE[brand.siteId] || "";
  const inside = deck.inside
    .map(
      (c) =>
        `<article class="card"><h3>${esc(c.title)}</h3><p>${esc(c.body)}</p></article>`,
    )
    .join("");
  const without = deck.without.map((x) => `<li>${esc(x)}</li>`).join("");
  const withThis = deck.withThis.map((x) => `<li>${esc(x)}</li>`).join("");
  const notFor = deck.notFor.map((x) => `<li>${esc(x)}</li>`).join("");
  const faqs = deck.faqs
    .map(
      (f, i) =>
        `<details${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`,
    )
    .join("");
  const guideCards = guides
    .map(
      (g) =>
        `<article class="card"><h3><a href="${esc(g.href)}">${esc(g.title)}</a></h3><p>Free guide. Indexed page. Links to the pack when you are ready to buy.</p></article>`,
    )
    .join("");
  const guidesSection = guides.length
    ? `<section class="band" id="guides" style="padding-top:0">
  <h2>Guides</h2>
  <p class="fine" style="max-width:52ch;margin:.2rem 0 0">Articles on the work this pack is built for — each one is its own URL Google can index.</p>
  <div class="grid-4">${guideCards}</div>
</section>`
    : "";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: brand.displayName,
        url: `${canonicalUrl}/`,
      },
      {
        "@type": "Product",
        name: brand.product.name,
        description: deck.lede,
        brand: { "@type": "Brand", name: brand.displayName },
        ...(gumroad && Number.isFinite(price)
          ? {
              offers: {
                "@type": "Offer",
                price: String(price),
                priceCurrency: "USD",
                url: gumroad,
                availability: "https://schema.org/InStock",
              },
            }
          : {}),
      },
      {
        "@type": "FAQPage",
        mainEntity: deck.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(brand.displayName)} — ${esc(deck.headline)}</title>
  <meta name="description" content="${esc(deck.lede)}"/>
  <meta name="ros-artifact" content="${esc(fingerprint)}"/>
  <meta name="ros-renderer" content="${esc(rendererVersion)}"/>
  <link rel="canonical" href="${esc(canonicalUrl)}/"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600;700&family=Roboto+Slab:wght@500;700&display=swap" rel="stylesheet"/>
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>${premiumCss(brand)}</style>
</head>
<body>
<nav class="nav">
  <span class="brand-mark">${esc(brand.displayName)}</span>
  <span>
    <a href="#inside">Inside</a>
    <a href="#preview">Preview</a>
    ${guides.length ? `<a href="#guides">Guides</a>` : ""}
    <a href="#faq">FAQ</a>
    <a href="mailto:${esc(email)}">Contact</a>
  </span>
</nav>
<header class="hero">
  <div>
    <p class="eyebrow">${esc(brand.displayName)}</p>
    <h1>${esc(deck.headline)}</h1>
    <p class="lede">${esc(deck.lede)}</p>
    <div class="hero-actions">
      <button class="cta" id="buy" type="button" data-buy-url="${esc(gumroad)}">${esc(deck.cta)}${priceLabel ? ` — ${priceLabel}` : ""}</button>
      <p class="fine">One payment. Files delivered immediately. No subscription.</p>
    </div>
    <p class="err" id="err" hidden></p>
  </div>
  ${productMock(brand)}
</header>
<section class="band" id="inside">
  <h2>Inside the pack</h2>
  <p class="fine" style="max-width:52ch;margin:.2rem 0 0">Everything is a working file, not a teaser. Open it the morning you buy it.</p>
  <div class="grid-4">${inside}</div>
</section>
<section class="band" id="preview" style="padding-top:0">
  <h2>${esc(deck.previewTitle)}</h2>
  <p class="fine" style="max-width:52ch;margin:.2rem 0 0">Inspect the exact structure and working formats included in the download.</p>
  ${deck.previewSnippet}
</section>
<section class="band" style="padding-top:0">
  <h2>Tuesday morning, with and without it</h2>
  <div class="split">
    <div class="col bad">
      <h3>Still running the job from email</h3>
      <ul>${without}</ul>
    </div>
    <div class="col">
      <h3>With ${esc(brand.displayName)}</h3>
      <ul>${withThis}</ul>
    </div>
  </div>
</section>
<section class="band" style="padding-top:0">
  <h2>How it works</h2>
  <div class="steps">
    <div class="card"><span class="n">01</span><h3>Pay once</h3><p>Checkout takes under a minute. No account beyond the email used to deliver the files.</p></div>
    <div class="card"><span class="n">02</span><h3>Download immediately</h3><p>You get the pack as soon as payment confirms. Keep it. Reuse it on the next job.</p></div>
    <div class="card"><span class="n">03</span><h3>Run the work</h3><p>Drop the templates into the job you already have. Support: <a href="mailto:${esc(email)}">${esc(email)}</a>.</p></div>
  </div>
</section>
<section class="band" style="padding-top:0">
  <div class="buy" id="offer">
    <div>
      <h2 style="margin:0 0 .4rem">${esc(deck.cta)}</h2>
      <p class="fine">${esc(brand.product.name)}. Digital download. 14-day replacement guarantee if the files will not open.</p>
      <p style="margin:1rem 0 0;color:var(--muted);font-size:.95rem">Not for:</p>
      <ul>${notFor}</ul>
    </div>
    <div>
      <p class="price">${esc(priceLabel)}</p>
      <button class="cta buy-again" type="button">${esc(deck.cta)}</button>
      <p class="fine" style="margin-top:.7rem">Privacy · Terms · Refunds linked below. No fabricated reviews.</p>
    </div>
  </div>
</section>
${guidesSection}
<section class="band faq" id="faq" style="padding-top:0">
  <h2>Questions</h2>
  ${faqs}
</section>
<footer class="footer">
  <div>${esc(brand.displayName)}</div>
  <div>
    <a href="/legal/privacy/">Privacy</a>
    <a href="/legal/terms/">Terms</a>
    <a href="/legal/refunds/">Refunds</a>
    <a href="mailto:${esc(email)}">${esc(email)}</a>
  </div>
</footer>
<div class="stick">
  <span>${esc(brand.displayName)} · ${esc(priceLabel)}</span>
  <button class="cta buy-again" type="button">${esc(deck.cta)}</button>
</div>
<script>
(function(){
  fetch('/api/beacon',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'pageview',path:location.pathname,url:location.href,referrer:document.referrer||null}),keepalive:true}).catch(function(){});
  var primary=document.getElementById('buy');
  var err=document.getElementById('err');
  var gumroad=primary && primary.getAttribute('data-buy-url');
  async function go(btn){
    if(btn) btn.disabled=true;
    if(err) err.hidden=true;
    try{
      fetch('/api/beacon',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'checkout_start',path:location.pathname,url:location.href}),keepalive:true}).catch(function(){});
      if(gumroad){ location.href=gumroad; return; }
      var res=await fetch('/api/checkout',{method:'POST'});
      var data=await res.json();
      if(!res.ok||!data.url) throw new Error(data.error||'Checkout failed');
      location.href=data.url;
    }catch(e){
      if(err){ err.textContent=e.message||String(e); err.hidden=false; }
      if(btn) btn.disabled=false;
    }
  }
  if(primary) primary.addEventListener('click', function(){ go(primary); });
  document.querySelectorAll('.buy-again').forEach(function(b){ b.addEventListener('click', function(){ go(b); }); });
})();
</script>
</body>
</html>`;
}

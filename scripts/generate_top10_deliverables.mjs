import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const appsRoot = "/Users/willsmacbook/Developer/tributeready/apps";

const legalDisclaimer = `
---
*DISCLAIMER: This document is a customizable commercial operational template provided for informational and business management purposes. It does not constitute formal legal advice. Contractual enforcement varies by state and jurisdiction. Have qualified legal counsel review any formal commercial agreements prior to execution.*
---
`;

// Helper to write XLSX
function makeWorkbook(filepath, sheets) {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, data] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  XLSX.writeFile(wb, filepath);
}

// 1. BuildGrid
const bgDir = path.join(appsRoot, "buildgrid", "content", "product");
fs.mkdirSync(bgDir, { recursive: true });
makeWorkbook(path.join(bgDir, "01-BuildGrid-RFI-Log-Template.xlsx"), {
  "RFI Log": [
    ["RFI #", "Spec Section", "Description / Subject", "Assigned Subcontractor", "Date Submitted", "Required By Date", "Date Answered", "Cost Impact ($)", "Schedule Impact (Days)", "Status", "Resolution Summary"],
    ["RFI-001", "03 30 00", "Rebar clearance at elevator pit wall", "Apex Rebar", "2026-08-01", "2026-08-05", "2026-08-04", 0, 0, "CLOSED", "Structural engineer approved 2-inch clearance per detail S-301."],
    ["RFI-002", "26 05 00", "Conduit clash with HVAC main duct on Level 2", "Volt Electric", "2026-08-03", "2026-08-08", "2026-08-07", 450, 0, "CLOSED", "Reroute conduit 6 inches below cable tray per MEP coordinator."],
    ["RFI-003", "08 44 00", "Curtain wall anchor embed elevation variance", "Pinnacle Glazing", "2026-08-10", "2026-08-15", "", 1200, 2, "OPEN", "Pending EOR response on slotted shim plate."],
  ]
});
makeWorkbook(path.join(bgDir, "02-BuildGrid-Three-Week-Lookahead-Schedule.xlsx"), {
  "3-Week Lookahead": [
    ["Activity ID", "CSI Division", "Trade / Subcontractor", "Location", "Crew Size", "Mon (W1)", "Tue (W1)", "Wed (W1)", "Thu (W1)", "Fri (W1)", "Mon (W2)", "Tue (W2)", "Wed (W2)", "Thu (W2)", "Fri (W2)", "Mon (W3)", "Tue (W3)", "Wed (W3)", "Thu (W3)", "Fri (W3)", "Pre-requisite / Inspection"],
    ["ACT-101", "09 22 00", "Metal Stud Framing", "Floor 2 - West Wing", 6, "X", "X", "X", "X", "X", "", "", "", "", "", "", "", "", "", "", "Layout sign-off complete"],
    ["ACT-102", "22 11 00", "Plumbing Rough-In", "Floor 2 - West Wing", 4, "", "", "X", "X", "X", "X", "X", "", "", "", "", "", "", "", "", "In-wall rough inspection #4"],
    ["ACT-103", "26 05 00", "Electrical Rough-In", "Floor 2 - West Wing", 5, "", "", "", "", "X", "X", "X", "X", "X", "", "", "", "", "", "City electrical rough inspection"],
    ["ACT-104", "09 29 00", "Drywall Hang & Tape", "Floor 2 - West Wing", 8, "", "", "", "", "", "", "", "X", "X", "X", "X", "X", "X", "X", "X", "Framing & MEP sign-off required"],
  ]
});
makeWorkbook(path.join(bgDir, "03-BuildGrid-Room-by-Room-Punch-List.xlsx"), {
  "Punch List": [
    ["Item #", "Room / Area", "Trade Responsible", "Defect Description", "Priority", "Date Identified", "Assigned To", "Target Completion", "Date Verified", "Sign-Off GC"],
    ["P-001", "Room 204 (Office)", "Drywall / Paint", "Touch up flashing above door header", "Low", "2026-08-12", "Apex Paint", "2026-08-16", "", "Pending"],
    ["P-002", "Room 205 (Conference)", "Electrical", "Install missing faceplate on AV box", "Medium", "2026-08-12", "Volt Electric", "2026-08-15", "", "Pending"],
    ["P-003", "Corridor 2B", "Flooring", "Replace chipped ceramic tile at threshold", "High", "2026-08-13", "Master Tile", "2026-08-16", "", "Pending"],
  ]
});
makeWorkbook(path.join(bgDir, "04-BuildGrid-CSI-Submittal-Log-Tracker.xlsx"), {
  "Submittal Log": [
    ["Submittal #", "Spec Division", "Description", "Subcontractor", "Lead Time (Weeks)", "Target Submittal Date", "Date Sent to Architect", "Architect Review Status", "Date Returned", "Status", "On-Site Date Required"],
    ["SUB-03-001", "03 30 00", "Concrete Mix Design (4000 PSI)", "Titan Ready Mix", 2, "2026-08-01", "2026-08-02", "APPROVED AS NOTED", "2026-08-08", "CLOSED", "2026-08-20"],
    ["SUB-08-002", "08 11 00", "Hollow Metal Doors & Hardware Schedule", "Pinnacle Doors", 6, "2026-08-03", "2026-08-05", "UNDER REVIEW", "", "OPEN", "2026-09-15"],
  ]
});
fs.writeFileSync(path.join(bgDir, "05-BuildGrid-Project-Manager-Quick-Start-Guide.md"), `# BuildGrid Project Manager Quick Start Guide

Welcome to the **BuildGrid Construction Coordination Pack**.

### Included Assets:
1. **01-BuildGrid-RFI-Log-Template.xlsx**: Multi-column RFI tracking with priority levels, subcontractor cost impact, and schedule variance.
2. **02-BuildGrid-Three-Week-Lookahead-Schedule.xlsx**: Daily trade crew scheduling with inspection gates.
3. **03-BuildGrid-Room-by-Room-Punch-List.xlsx**: Structured room-by-room architectural closeout sheet.
4. **04-BuildGrid-CSI-Submittal-Log-Tracker.xlsx**: CSI MasterFormat submittal tracking with lead times.

### How to Deploy on Your Jobsite:
- Open the .xlsx files in Microsoft Excel or upload directly to Google Sheets.
- Distribute lookaheads at Monday morning foreman coordination meetings.
- Track RFI cost impacts to ensure change orders are flagged before work proceeds.
${legalDisclaimer}`);

// 2. InvoiceChaser
const icDir = path.join(appsRoot, "invoicechaser", "content", "product");
fs.mkdirSync(icDir, { recursive: true });
makeWorkbook(path.join(icDir, "05-InvoiceChaser-AR-Aging-Tracker.xlsx"), {
  "AR Aging Summary": [
    ["Client Name", "Invoice #", "Invoice Date", "Due Date", "Total Amount ($)", "Days Overdue", "Aging Bucket", "Escalation Stage", "Last Contact Date", "Promised Payment Date", "Notes"],
    ["Acme Corp", "INV-1042", "2026-07-01", "2026-07-31", 4500, 15, "1-30 Days", "Stage 3 (Firm Notice)", "2026-08-10", "2026-08-20", "AP manager confirmed invoice in queue"],
    ["Beta Labs", "INV-1011", "2026-06-01", "2026-07-01", 8200, 45, "31-60 Days", "Stage 5 (Executive Call)", "2026-08-12", "2026-08-18", "Settlement agreement drafted"],
  ]
});
fs.writeFileSync(path.join(icDir, "01-7-Stage-Escalation-Sequences.md"), `# InvoiceChaser 7-Stage AR Recovery Sequences

### Stage 1: Courtesy Reminder (Day -3 before due date)
**Subject:** Friendly reminder: Invoice {{invoice_number}} due on {{due_date}}
Hi {{first_name}},
Quick reminder that invoice {{invoice_number}} for {{project_name}} ($ {{amount}}) is due on {{due_date}}.
Let us know if you need any updated ACH or wiring details.

### Stage 2: Due Date Notification (Day 0)
**Subject:** Invoice {{invoice_number}} is due today
Hi {{first_name}},
Invoice {{invoice_number}} ($ {{amount}}) is due today. Please reply with the remittance confirmation when payment is issued.

### Stage 3: Grace Period Follow-Up (Day +7)
**Subject:** Update on overdue invoice {{invoice_number}}
Hi {{first_name}},
We haven't received payment for invoice {{invoice_number}} ($ {{amount}}), which was due on {{due_date}}. Could you check with accounts payable and let us know when we can expect disbursement?

### Stage 4: Formal Past-Due Notice with Late Fees (Day +14)
**Subject:** PAST DUE: Invoice {{invoice_number}} — Action Required
Dear {{first_name}},
Invoice {{invoice_number}} is now 14 days past due. Per section 4 of our master service agreement, a 1.5% monthly late finance charge will accrue if balance is not settled by {{cut_off_date}}. Please issue payment today.

### Stage 5: Work Pause / Deliverable Freeze Notice (Day +21)
**Subject:** NOTICE: Service pause due to outstanding balance (Invoice {{invoice_number}})
Dear {{first_name}},
Because invoice {{invoice_number}} remains unpaid after 21 days, active project deliverables and consulting services are temporarily paused effective {{pause_date}}. We will immediately resume once payment is confirmed.

### Stage 6: Installment Plan Offer (Day +30)
**Subject:** Payment plan options for Invoice {{invoice_number}}
Dear {{first_name}},
We understand cash flow timing challenges. We have attached a 3-part installment agreement allowing you to settle the $ {{amount}} balance in installments of {{installment_amount}} over 60 days.

### Stage 7: Final Legal Referral Notice (Day +45)
**Subject:** FINAL NOTICE: Transfer to legal recovery for Invoice {{invoice_number}}
Dear {{first_name}},
Despite repeated notices, invoice {{invoice_number}} remains outstanding. Unless full payment or an executed installment agreement is received by {{final_date}}, this account will be transferred to outside legal collections.
${legalDisclaimer}`);

fs.writeFileSync(path.join(icDir, "02-AR-Phone-and-SMS-Scripts.md"), `# InvoiceChaser Phone & SMS Collection Scripts

### SMS Template 1 (Day 5 Post-Due):
"Hi {{first_name}}, quick note from {{your_company}} regarding Invoice #{{invoice_num}} ($ {{amount}}). Did you need a fresh copy sent over? Thanks!"

### SMS Template 2 (Day 15 Post-Due):
"Hi {{first_name}}, we noticed Invoice #{{invoice_num}} is still open. Please let us know who to coordinate with in AP so we can keep the project on schedule."

### Phone Call Script (Day 20):
**You:** "Hi {{first_name}}, this is {{your_name}} from {{your_company}}. I'm calling directly regarding invoice {{invoice_num}} for {{amount}} that was due on {{due_date}}."
**Prospect:** "I think accounting is processing that next week."
**You:** "Understood. Who in accounting has the disbursement file right now, and what check run is it scheduled for? I'd like to get the confirmation number into our system so no automated pause flags are triggered."
${legalDisclaimer}`);

fs.writeFileSync(path.join(icDir, "03-Late-Fee-and-Work-Pause-Contract-Clauses.md"), `# Late Fee & Work Pause Contract Clauses

### 1. Late Payment Fee Clause (Insert into Master Service Agreement)
"Invoices shall be payable within thirty (30) days of receipt. Any amount not paid when due shall bear interest from the due date until paid at the rate of 1.5% per month (18% per annum) or the maximum rate permitted by law, whichever is less. Client shall reimburse Provider for all reasonable costs incurred in collecting past-due amounts, including reasonable attorney fees."

### 2. Work Suspension Clause
"If Client fails to pay any undisputed invoice within twenty-one (21) days after written notice of delinquency, Provider reserves the right to suspend performance of all Services and withhold access to deliverables until all outstanding balances, including accrued interest, are paid in full. Provider shall not be liable for any project delays resulting from such suspension."
${legalDisclaimer}`);

fs.writeFileSync(path.join(icDir, "04-Customizable-B2B-Installment-Payment-Agreement-Template.md"), `# Customizable B2B Installment Payment Agreement Template

**PARTIES:**
This Payment Plan Agreement ("Agreement") is made effective as of {{effective_date}}, by and between **{{creditor_company}}** ("Creditor") and **{{debtor_company}}** ("Debtor").

**RECITALS:**
WHEREAS, Debtor owes Creditor the principal sum of **$ {{total_debt_amount}}** pursuant to unpaid Invoice(s) #{{invoice_numbers}}; and
WHEREAS, both parties agree to a structured installment schedule to settle the balance in full without immediate litigation;

**NOW, THEREFORE, the parties agree as follows:**
1. **Payment Schedule:** Debtor agrees to make scheduled payments per the table below:
   - Installment 1: $ {{amount_1}} due on {{date_1}}
   - Installment 2: $ {{amount_2}} due on {{date_2}}
   - Installment 3: $ {{amount_3}} due on {{date_3}}
2. **Acceleration Clause:** In the event Debtor fails to make any installment within five (5) business days of its due date, the entire remaining balance shall become immediately due and payable without further notice.
3. **Governing Law:** This agreement shall be governed by and construed in accordance with the laws of the State of {{state_jurisdiction}}.

**SIGNATURES:**

Creditor: _______________________ Date: _________
Debtor:   _______________________ Date: _________
${legalDisclaimer}`);

// 3. DeckReady
const drDir = path.join(appsRoot, "deckready", "content", "product");
fs.mkdirSync(drDir, { recursive: true });
makeWorkbook(path.join(drDir, "02-DeckReady-24-Month-SaaS-Financial-Model.xlsx"), {
  "Executive Summary": [
    ["Metric", "Month 1", "Month 6", "Month 12", "Month 18", "Month 24"],
    ["Monthly Recurring Revenue (MRR)", 5000, 22000, 65000, 140000, 275000],
    ["Annual Recurring Revenue (ARR)", 60000, 264000, 780000, 1680000, 3300000],
    ["Active Paid Customers", 50, 200, 550, 1100, 2000],
    ["Average Revenue Per Account (ARPA)", 100, 110, 118, 127, 137],
    ["Gross Margin %", "82%", "84%", "86%", "87%", "88%"],
    ["Net Burn ($)", 18000, 22000, 19000, 12000, -15000],
    ["Ending Cash Runway (Months)", 18, 15, 12, 14, 24],
  ]
});
makeWorkbook(path.join(drDir, "04-DeckReady-Cap-Table-and-SAFE-Dilution-Calculator.xlsx"), {
  "Cap Table & SAFE Dilution": [
    ["Shareholder / Security", "Pre-Round Shares", "Pre-Round %", "Investment ($)", "Post-Money Valuation ($)", "Post-Round Shares", "Post-Round %"],
    ["Founders Common Stock", 8000000, "80.0%", 0, 0, 8000000, "64.0%"],
    ["Employee Option Pool (Unallocated)", 2000000, "20.0%", 0, 0, 2000000, "16.0%"],
    ["Seed SAFE Investors (Post-Money)", 0, "0.0%", 1000000, 5000000, 2500000, "20.0%"],
    ["Total Diluted Capitalization", 10000000, "100.0%", 1000000, 5000000, 12500000, "100.0%"],
  ]
});
fs.writeFileSync(path.join(drDir, "01-DeckReady-10-Slide-Investor-Pitch-Framework.md"), `# DeckReady 10-Slide Investor Pitch Deck Blueprint

### Slide 1: Title & Core Value Proposition
- **Headline:** One-sentence category definition.
- **Subheadline:** The tangible economic result for the primary buyer.
- **Rules:** No buzzword soup. Clearly identify who you sell to and what metric you change.

### Slide 2: The Urgent Market Problem
- **The Hair-on-Fire Pain:** Why current tools fail and cost companies money.
- **Quantification:** How many hours or dollars are lost per customer per month.

### Slide 3: The Solution / Product Demonstration
- **Product Architecture:** Visual workflow showing the inputs and immediate output.
- **Value Unlock:** Why this is 10x faster or cheaper than status quo.

### Slide 4: Market Size (TAM / SAM / SOM)
- **Top-Down & Bottom-Up:** Calculation based on number of qualified businesses * ACV.

### Slide 5: Business Model & Pricing Architecture
- **Pricing Tiers:** Transparent ACV, expansion triggers, and gross margin structure.

### Slide 6: Go-to-Market & Customer Acquisition Strategy
- **Acquisition Channels:** CAC payback metrics, outbound playbook, and partner distribution.

### Slide 7: Competitive Landscape & Defensibility
- **Direct Competitors vs Inertia:** Why incumbent tools cannot quickly replicate this wedge.

### Slide 8: Early Traction & Evidence
- **Metrics:** Revenue growth, customer logos, cohort retention, and verified engagement.

### Slide 9: Core Team & Unfair Advantage
- **Operator Backgrounds:** Domain expertise and previous exits/engineering leadership.

### Slide 10: The Ask & Use of Funds
- **Round Target:** Capital required, hiring plan, and milestone targets over 18 months.
${legalDisclaimer}`);

fs.writeFileSync(path.join(drDir, "03-Investor-FAQ-Swipe-File.md"), `# Investor FAQ & Objection Swipe File

1. **"Why won't the incumbent build this?"**
   *Response:* "Incumbents are optimized for enterprise suites with 6-month sales cycles. Our wedge captures the SMB/mid-market in 5 minutes without IT integration."
2. **"What does your customer acquisition cost look like at scale?"**
   *Response:* "Our model leverages outbound directory discovery with an ACV payback under 3 months."
${legalDisclaimer}`);

// 4. BidForge
const bfDir = path.join(appsRoot, "bidforge", "content", "product");
fs.mkdirSync(bfDir, { recursive: true });
makeWorkbook(path.join(bfDir, "01-BidForge-Burdened-Estimating-Matrix.xlsx"), {
  "Cost Estimating Matrix": [
    ["Division / Trade Code", "Item Description", "Unit", "Quantity", "Raw Labor ($/hr)", "Labor Burden Factor", "Fully Burdened Labor ($)", "Material Unit Cost ($)", "Material Total ($)", "Equipment / Sub ($)", "Total Direct Cost ($)", "Markup %", "Bid Price ($)"],
    ["03 30 00", "Slab on Grade (4-inch with wire mesh)", "SF", 5000, 35, 1.42, 24850, 4.25, 21250, 3500, 49600, "18%", 58528],
    ["09 22 00", "Interior Drywall Framing (3-5/8 stud @ 16 oc)", "LF", 1200, 32, 1.42, 10905, 6.50, 7800, 800, 19505, "18%", 23015],
  ]
});
makeWorkbook(path.join(bfDir, "04-BidForge-Change-Order-Rate-Schedule.xlsx"), {
  "T&M Rate Schedule": [
    ["Classification / Trade", "Straight Time ($/hr)", "Overtime 1.5x ($/hr)", "Double Time 2.0x ($/hr)", "Material Markup %", "Equipment Markup %"],
    ["Foreman / Supervisor", 95, 142.50, 190.00, "15%", "15%"],
    ["Journeyman Carpenter", 78, 117.00, 156.00, "15%", "15%"],
    ["Apprentice / Laborer", 52, 78.00, 104.00, "15%", "15%"],
  ]
});
fs.writeFileSync(path.join(bfDir, "02-BidForge-Subcontractor-Proposal-Template.md"), `# Subcontractor Bid Proposal Document

**TO:** {{general_contractor_name}}  
**PROJECT:** {{project_name}} — {{project_location}}  
**DATE:** {{proposal_date}}  

### Base Scope of Work Included:
1. Complete supply and installation per drawings dated {{drawing_date}} (Sheets {{sheet_numbers}}).
2. All site safety equipment, personal protection, and daily cleanup.
3. One-year warranty on all workmanship and manufacturer-warranted materials.

### Exclusions & Clarifications:
- Overtime or weekend work unless authorized via written change order.
- Repair of damage caused by other trades post-installation.
${legalDisclaimer}`);

fs.writeFileSync(path.join(bfDir, "03-BidForge-Scope-Exclusions-Checklist.md"), `# BidForge Scope Inclusions & Exclusions Checklist

Always include these mandatory standard exclusions in every commercial bid proposal:
1. **Utility Relocation:** Underground utility locating and relocation outside property boundaries.
2. **Hazardous Materials:** Abatement, testing, or disposal of asbestos, lead, or contaminated soil.
3. **Permit Fees:** City plan check, architectural engineering stamp, and municipal permit fees.
4. **Temporary Utilities:** Jobsite temporary power, water, heating, and sanitation facilities.
${legalDisclaimer}`);

// 5. ResumeStrike
const rsDir = path.join(appsRoot, "resumestrike", "content", "product");
fs.mkdirSync(rsDir, { recursive: true });
fs.writeFileSync(path.join(rsDir, "01-ATS-Executive-Resume-Template.md"), `# ATS-Optimized Executive & Senior Resume Template

**[YOUR FULL NAME]**  
[City, State] | [Phone Number] | [Email Address] | [LinkedIn URL]

### EXECUTIVE SUMMARY
Results-driven **[Target Role Title]** with **[X] years of leadership experience** driving operational efficiency and revenue expansion. Proven track record scaling teams from [A] to [B], reducing cycle times by [X]%, and managing P&L budgets up to $[X]M.

### CORE COMPETENCIES
- Strategic Operations & P&L Management
- Cross-Functional Team Leadership
- Vendor Contract & SLA Negotiation
- Process Automation & Systems Modernization

### PROFESSIONAL EXPERIENCE
**[Company Name]** — [City, State]  
*[Job Title]* | [Month Year – Present]
- Spearheaded company-wide operational reset across 4 business units, increasing annual throughput by **28%** and saving **$420K** in overhead.
- Restructured procurement workflows across 12 tier-1 vendors, reducing material lead times from 18 days to 7 days.
${legalDisclaimer}`);

fs.writeFileSync(path.join(rsDir, "02-100-Power-Metric-Bullet-Formulas.md"), `# 100 Power Metric Resume Bullet Formulas

Use the **XYZ Formula**: *Accomplished [X], as measured by [Y], by doing [Z].*

1. "Engineered [system/process] reducing processing time by **[X]%** across **[N] team members**."
2. "Recovered **$[X]K** in delinquent accounts receivable within **[N] days** by deploying automated escalation sequences."
3. "Negotiated vendor contracts across **[N] suppliers**, capturing **$[X]K** in annual cost savings without sacrificing quality."
${legalDisclaimer}`);

fs.writeFileSync(path.join(rsDir, "03-Cover-Letter-Framework.md"), `# High-Conversion Executive Cover Letter Framework

Dear [Hiring Manager Name / Search Committee],

I am writing to express my strong interest in the **[Target Role Title]** at **[Company Name]**. With a track record of delivering measurable operational improvements and scaling cross-functional teams, I am confident in my ability to drive immediate results for your organization.

In my previous role at [Previous Company], I led the transition of [Key Business Process], which generated **$[X]K** in savings and increased team productivity by **[X]%**.

I look forward to discussing how my experience aligns with [Company Name]'s growth objectives.
${legalDisclaimer}`);

fs.writeFileSync(path.join(rsDir, "04-LinkedIn-Profile-Optimization-Guide.md"), `# LinkedIn Profile Optimization & ATS Visibility Guide

### 1. Headline Formula:
\`[Current Title] | Helping [Target Audience] Achieve [Core Outcome] | [3 Core Hard Skills]\`

### 2. About Section:
- First 3 lines must deliver the hook before the "see more" cutoff.
- Include structured bullet points detailing key career milestones.
${legalDisclaimer}`);

// 6. LaunchCopy
const lcDir = path.join(appsRoot, "launchcopy", "content", "product");
fs.mkdirSync(lcDir, { recursive: true });
fs.writeFileSync(path.join(lcDir, "01-SaaS-Landing-Page-Copywriting-Deck.md"), `# SaaS Landing Page High-Conversion Wireframe & Copy Deck

### Section 1: Above-the-Fold Hero
- **Eyebrow:** The category qualifier (e.g., "For Commercial Construction Teams").
- **H1 Headline:** The concrete economic outcome (e.g., "Eliminate Subcontractor Delays and RFI Rework").
- **Subheadline:** How the product works in 1 sentence.
- **Primary CTA:** "Get the Toolkit — $29 Instant Download".
- **Trust Badge:** "14-Day Replacement Guarantee • Instant OpenXML/Excel Files".

### Section 2: The Cost of Doing Nothing (Pain Breakdown)
- Highlight 3 specific daily breakdowns caused by existing messy processes.

### Section 3: Feature-by-Feature Deliverable Breakdown
- Interactive or visual tables showing every file, sheet, and formula included.
${legalDisclaimer}`);

fs.writeFileSync(path.join(lcDir, "02-5-Stage-Waitlist-Launch-Sequence.md"), `# 5-Stage Waitlist to Launch Email Sequence

### Email 1: Welcome & Behind-the-Scenes Access
**Subject:** You're on the early access list for {{product_name}}
Hi {{first_name}}, thanks for joining. We're building this because existing tools are bloated and overpriced. Over the next week, we'll show you exactly how it works.

### Email 2: The Core Problem Deep-Dive
**Subject:** Why most teams lose 4 hours a week on {{pain_point}}
Hi {{first_name}}, here is the breakdown of where time and money leak out during the workflow...

### Email 3: The Live Demonstration
**Subject:** Look inside {{product_name}} (Full walk-through)
Hi {{first_name}}, take a look at the actual templates and calculators included in the kit.

### Email 4: Launch Day Offer
**Subject:** {{product_name}} is live (Early bird access open)
Hi {{first_name}}, you can now download the complete toolkit for a one-time payment of $29.

### Email 5: Final Call (Offer Expiry)
**Subject:** Last chance: Early access pricing closes tonight
Hi {{first_name}}, early access pricing closes at midnight. Download your copy now.
${legalDisclaimer}`);

fs.writeFileSync(path.join(lcDir, "03-Product-Hunt-Launch-Kit.md"), `# Product Hunt Launch Kit & Maker Comment Guide

### Maker Comment Framework:
"Hi Product Hunt! 👋 I'm [Name], creator of [Product]. We built this because we were tired of paying $100/mo subscriptions for simple spreadsheets and checklists. [Product] gives you the complete production assets for a one-time price with instant download."
${legalDisclaimer}`);

fs.writeFileSync(path.join(lcDir, "04-B2B-Cold-Outreach-Swipe.md"), `# B2B Cold Outreach Email Framework

**Subject:** Quick question regarding {{company}}'s {{workflow_area}}
Hi {{first_name}},
Noticed you're managing {{operation_area}} at {{company}}. We built a streamlined toolkit with pre-configured templates that eliminate {{specific_pain}}.
Would you be open to checking out a 2-minute overview?
${legalDisclaimer}`);

// 7. MenuMoney
const mmDir = path.join(appsRoot, "menumoney", "content", "product");
fs.mkdirSync(mmDir, { recursive: true });
makeWorkbook(path.join(mmDir, "01-MenuMoney-Engineering-Margin-Matrix.xlsx"), {
  "Menu Matrix": [
    ["Item Name", "Category", "Menu Price ($)", "Food Cost ($)", "Food Cost %", "Unit Margin ($)", "Weekly Volume Sold", "Weekly Gross Profit ($)", "Matrix Classification", "Action Strategy"],
    ["Truffle Burger", "Entrees", 18.50, 4.25, "23.0%", 14.25, 240, 3420, "STAR (High Vol / High Margin)", "Promote prominently; protect recipe quality"],
    ["Wagyu Ribeye", "Entrees", 42.00, 18.50, "44.0%", 23.50, 45, 1057.50, "PUZZLE (Low Vol / High Margin)", "Reposition on menu page; highlight culinary story"],
    ["Crispy Calamari", "Appetizers", 14.00, 3.10, "22.1%", 10.90, 310, 3379, "STAR (High Vol / High Margin)", "Feature in top-right sweet spot"],
    ["House Salad", "Sides", 8.50, 3.80, "44.7%", 4.70, 190, 893, "DOG (Low Vol / Low Margin)", "Reformulate ingredients or increase price to $9.75"],
  ]
});
makeWorkbook(path.join(mmDir, "02-MenuMoney-Recipe-Costing-Sheet.xlsx"), {
  "Recipe Costing": [
    ["Ingredient", "Purchase Pack Size", "Pack Cost ($)", "Recipe Quantity Used", "Unit of Measure", "Ingredient Cost ($)"],
    ["Ground Chuck (80/20)", "10 lbs", 38.00, 0.5, "lbs", 1.90],
    ["Brioche Bun", "12 pack", 6.50, 1, "each", 0.54],
    ["Aged Cheddar Slice", "50 slices", 12.00, 2, "slices", 0.48],
    ["Truffle Aioli", "32 oz", 14.00, 1.5, "oz", 0.66],
    ["Packaging / Skewer", "100 count", 8.00, 1, "set", 0.08],
  ]
});
fs.writeFileSync(path.join(mmDir, "03-Eye-Movement-Menu-Layout-Guide.md"), `# Eye-Movement Menu Layout & Design Guide

### 1. The "Golden Triangle":
Diners read menus in a predictable pattern:
1. **Center of the page:** First impression. Place high-margin chef specials here.
2. **Top right corner:** Secondary anchor. Place your #1 highest-profit appetizer or entree here.
3. **Top left corner:** Common starting point for appetizers and starters.

### 2. Price Decoy Tactics:
- Never align prices in a right-hand column with dotted lines (which encourages price shopping).
- Remove dollar signs ($) to reduce psychological friction.
${legalDisclaimer}`);

fs.writeFileSync(path.join(mmDir, "04-Price-Increase-Customer-Notice.md"), `# Price Increase Communication Templates

### Table Notice / Social Post:
"To our valued guests: To maintain our commitment to sourcing premium, ethically raised ingredients and supporting our culinary team with competitive wages, we are making modest adjustments to our menu pricing starting [Date]. We deeply appreciate your continued support."
${legalDisclaimer}`);

// 8. HomeListPro
const hlpDir = path.join(appsRoot, "homelistpro", "content", "product");
fs.mkdirSync(hlpDir, { recursive: true });
fs.writeFileSync(path.join(hlpDir, "01-21-Point-Listing-Presentation-Framework.md"), `# HomeListPro 21-Point Real Estate Listing Presentation

### Section 1: The Pricing Strategy
1. Comparative Market Analysis (CMA) range explanation.
2. The "First 14 Days" pricing curve and buyer demand spike.
3. Absorption rate in the target zip code.

### Section 2: The Multi-Channel Marketing Plan
4. Professional photography, twilight shoots, and drone footage.
5. 3D virtual tour and architectural floor plans.
6. Targeted geo-fenced social advertising campaigns.
7. Broker network caravan and private preview invitations.

### Section 3: Negotiation & Transaction Management
8. Pre-inspection strategy to remove buyer leverage.
9. Multiple-offer management matrix.
10. Escrow milestone tracking to ensure on-time closing.
${legalDisclaimer}`);

fs.writeFileSync(path.join(hlpDir, "02-Open-House-Lead-Capture-and-Followup.md"), `# Open House Lead Capture & 48-Hour Follow-Up

### Sign-In Sheet Script:
"Welcome! For the seller's security and so I can email you the property disclosure packet and neighborhood sales report, please write your name and best email below."

### Follow-Up Text (Sunday Evening):
"Hi {{first_name}}, thanks for stopping by {{property_address}} today! Here is the link to the property disclosure packet: {{link}}. Are you looking to buy within the next 30-60 days?"
${legalDisclaimer}`);

fs.writeFileSync(path.join(hlpDir, "03-Commission-Objection-Handling-Scripts.md"), `# Commission Objection Handling Scripts

**Client:** "Will you cut your commission from 6% to 4%?"
**Agent:** "I appreciate you asking. If an agent gives away their own money in the first 5 minutes of meeting you, how effectively do you think they will negotiate when a buyer tries to discount $30,000 off the price of your home? My full-service marketing plan is designed to net you the highest possible proceeds, not just list it on the MLS."
${legalDisclaimer}`);

fs.writeFileSync(path.join(hlpDir, "04-Seller-Onboarding-Checklist.md"), `# Seller Onboarding & Photo-Prep Checklist

- [ ] Declutter all kitchen countertops and remove refrigerator magnets.
- [ ] Replace burned-out lightbulbs with matching color temperature LEDs.
- [ ] Remove personalized family photographs.
- [ ] Deep clean windows and power-wash front entryway.
${legalDisclaimer}`);

// 9. ScopeSmith
const ssDir = path.join(appsRoot, "scopesmith", "content", "product");
fs.mkdirSync(ssDir, { recursive: true });
makeWorkbook(path.join(ssDir, "03-ScopeSmith-Out-of-Scope-Rate-Schedule.xlsx"), {
  "Rate Schedule": [
    ["Role / Service Tier", "Standard Hourly Rate ($/hr)", "Rush / Weekend Rate ($/hr)", "Minimum Billing Unit (Hrs)", "Description"],
    ["Principal Architect / Strategist", 195, 290, 1, "System architecture and technical roadmap reviews"],
    ["Senior Full-Stack Engineer", 145, 215, 1, "Core API and frontend implementation"],
    ["UI/UX Designer", 125, 185, 1, "Figma design systems and interactive prototypes"],
    ["QA & Automation Specialist", 95, 140, 0.5, "End-to-end regression testing and browser automation"],
  ]
});
fs.writeFileSync(path.join(ssDir, "01-Customizable-Master-SOW-Agreement.md"), `# Customizable Master Statement of Work (SOW) Agreement Template

**PROJECT:** {{project_name}}  
**CLIENT:** {{client_company}}  
**PROVIDER:** {{provider_company}}  
**EFFECTIVE DATE:** {{effective_date}}  

### 1. Scope of Deliverables:
Provider shall deliver the following items as defined in Exhibit A:
- Deliverable 1: {{deliverable_1_description}}
- Deliverable 2: {{deliverable_2_description}}

### 2. Revision Caps:
The fixed fee includes up to two (2) rounds of revisions per milestone. Revisions requested after sign-off or exceeding the cap will be billed per the Out-of-Scope Rate Schedule.

### 3. Acceptance & Sign-Off:
Client shall have five (5) business days from delivery to review and provide written notice of any material non-conformance. In the absence of written feedback within 5 days, the deliverable is deemed accepted.
${legalDisclaimer}`);

fs.writeFileSync(path.join(ssDir, "02-Scope-Change-Request-Form.md"), `# Scope Change Request (SCR) Form

**SCR #:** {{scr_number}}  
**DATE:** {{request_date}}  
**REQUESTED BY:** {{requested_by_name}}  

### Proposed Change Description:
{{detailed_description_of_change}}

### Impact Assessment:
- **Cost Impact:** $ {{cost_delta}}
- **Schedule Impact:** {{days_delta}} additional business days
- **Technical Dependencies:** {{dependency_notes}}

**APPROVAL:**  
Client Signature: _______________________ Date: _________
${legalDisclaimer}`);

fs.writeFileSync(path.join(ssDir, "04-Client-Sign-Off-Acceptance-Certificate.md"), `# Milestone Acceptance Certificate

**MILESTONE NAME:** {{milestone_name}}  
**PROJECT:** {{project_name}}  

Client confirms that all deliverables associated with the milestone listed above have been inspected and meet the agreed specifications. Final invoice for this milestone ($ {{amount}}) is authorized for payment.

Client Signer: _______________________ Date: _________
${legalDisclaimer}`);

// 10. RFPStrike
const rfpDir = path.join(appsRoot, "rfpstrike", "content", "product");
fs.mkdirSync(rfpDir, { recursive: true });
makeWorkbook(path.join(rfpDir, "01-RFPStrike-Bid-No-Bid-Scorecard.xlsx"), {
  "Bid-No-Bid Matrix": [
    ["Evaluation Factor", "Weight (1-5)", "Score (1-5)", "Weighted Score", "Decision Threshold Notes"],
    ["Strategic Fit & Core Capability", 5, 4, 20, "Meets all primary technical requirements"],
    ["Incumbent Relationship & Advantage", 4, 3, 12, "Competitor is incumbent but has service delivery complaints"],
    ["Profit Margin & Price Viability", 5, 4, 20, "Budget range supports 28% gross margin"],
    ["Resource & Delivery Bandwidth", 3, 4, 12, "Team available to start within 30 days of award"],
    ["Proposal Team Bandwidth to Respond", 3, 5, 15, "14 days remaining; standard templates available"],
    ["TOTAL SCORE", "", "", 79, "Scores > 70 = PROCEED WITH BID; Scores < 50 = NO-BID"],
  ]
});
makeWorkbook(path.join(rfpDir, "02-RFPStrike-Compliance-Matrix-Tracker.xlsx"), {
  "Compliance Matrix": [
    ["RFP Section #", "Requirement Statement", "Compliance (Full/Partial/None)", "Proposal Section Reference", "Assigned Lead Writer", "Draft Review Status", "Proof of Compliance Evidence"],
    ["Section 3.1", "Vendor must hold active SOC 2 Type II certification", "Full", "Vol 1, Section 2.4", "Security Director", "FINAL SIGN-OFF", "Attach AICPA audit report (Appendix C)"],
    ["Section 3.2", "System must support SAML 2.0 / Okta SSO", "Full", "Vol 1, Section 3.1", "Lead Architect", "FINAL SIGN-OFF", "Architecture diagram S-102"],
    ["Section 4.1", "Dedicated account manager response SLA < 2 hours", "Full", "Vol 2, Section 1.2", "VP Client Success", "FINAL SIGN-OFF", "SLA contract terms"],
  ]
});
fs.writeFileSync(path.join(rfpDir, "03-Executive-Summary-Proposal-Framework.md"), `# RFP Executive Summary Proposal Framework

### Section 1: Understanding the Client's Mission & Stakes
"{{client_agency}} is undertaking {{project_initiative}} to solve {{core_mission_challenge}}. Achieving this requires a partner with proven experience in {{core_competency}}."

### Section 2: Our Differentiated Solution
"{{our_company}} delivers a comprehensive approach designed specifically to minimize risk, accelerate delivery by {{x_weeks}}, and ensure 100% compliance with {{standard_name}}."

### Section 3: Proof of Performance & Past Experience
"In similar deployments with {{reference_client_1}} and {{reference_client_2}}, our team achieved {{specific_metric_result}}."
${legalDisclaimer}`);

fs.writeFileSync(path.join(rfpDir, "04-Proposal-Team-Assignment-Matrix.md"), `# Proposal Team Assignment & Milestone Tracker

- **RFP Shredding & Compliance Matrix Build:** Day 1–2
- **First Color Team Review (Pink Team - Storyboards):** Day 5
- **Second Color Team Review (Red Team - 90% Draft):** Day 10
- **Gold Team Review (Executive Sign-Off & Pricing):** Day 12
- **Final Packaging & Submission:** Day 13
${legalDisclaimer}`);

console.log("SUCCESS: Generated complete physical deliverables across all 10 top businesses!");

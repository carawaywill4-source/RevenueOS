/**
 * Distinct premium theme presets for autonomously created storefronts.
 * Avoid identical AI-gradient clones — compose by niche.
 */

export type DesignTheme = {
  id: string;
  primaryColor: string;
  accentColor: string;
  fontDisplay: string;
  fontBody: string;
  heroStyle: "deep_panel" | "editorial_split" | "quiet_studio" | "civic_band";
  density: "airy" | "balanced" | "compact";
};

export const DESIGN_THEMES: DesignTheme[] = [
  {
    id: "managerial_deep",
    primaryColor: "#1C2541",
    accentColor: "#5BC0BE",
    fontDisplay: "Fraunces",
    fontBody: "Source Sans 3",
    heroStyle: "deep_panel",
    density: "balanced",
  },
  {
    id: "freelancer_ink",
    primaryColor: "#2D1E2F",
    accentColor: "#E07A5F",
    fontDisplay: "Libre Baskerville",
    fontBody: "IBM Plex Sans",
    heroStyle: "editorial_split",
    density: "airy",
  },
  {
    id: "civic_slate",
    primaryColor: "#1B3A4B",
    accentColor: "#D4A373",
    fontDisplay: "Cormorant Garamond",
    fontBody: "Nunito Sans",
    heroStyle: "civic_band",
    density: "balanced",
  },
  {
    id: "creator_warm",
    primaryColor: "#241C15",
    accentColor: "#F4A261",
    fontDisplay: "Playfair Display",
    fontBody: "Lato",
    heroStyle: "quiet_studio",
    density: "airy",
  },
  {
    id: "nonprofit_horizon",
    primaryColor: "#0F4C5C",
    accentColor: "#E36414",
    fontDisplay: "DM Serif Display",
    fontBody: "DM Sans",
    heroStyle: "editorial_split",
    density: "balanced",
  },
];

export function themeForIndustry(industry: string): DesignTheme {
  const key = industry.toLowerCase();
  if (/people|manager|hr/.test(key)) return DESIGN_THEMES[0]!;
  if (/freelance|contract|scope/.test(key)) return DESIGN_THEMES[1]!;
  if (/hoa|board|civic|nonprofit|grant/.test(key)) {
    return /grant|nonprofit/.test(key) ? DESIGN_THEMES[4]! : DESIGN_THEMES[2]!;
  }
  if (/creator|podcast|guest/.test(key)) return DESIGN_THEMES[3]!;
  return DESIGN_THEMES[Math.abs(hash(industry)) % DESIGN_THEMES.length]!;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

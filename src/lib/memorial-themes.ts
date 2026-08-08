export type MemorialTheme = "garden" | "classic" | "sky";

export type MemorialThemeStyle = {
  id: MemorialTheme;
  name: string;
  copy: string;
  swatches: [string, string, string];
  paper: string;
  ink: string;
  inkMuted: string;
  accent: string;
  gold: string;
  rule: string;
  frame: string;
  portraitRing: string;
};

export const memorialThemes: Record<MemorialTheme, MemorialThemeStyle> = {
  garden: {
    id: "garden",
    name: "Quiet Garden",
    copy: "Soft sage, warm ivory, botanical calm",
    swatches: ["#dbe5df", "#f7f3e8", "#8da399"],
    paper: "#fffdf8",
    ink: "#173e35",
    inkMuted: "rgba(23, 62, 53, 0.58)",
    accent: "#8da399",
    gold: "#b9985f",
    rule: "#8da399",
    frame: "rgba(141, 163, 153, 0.22)",
    portraitRing: "#ffffff",
  },
  classic: {
    id: "classic",
    name: "Timeless",
    copy: "Deep forest, cream, restrained gold",
    swatches: ["#173e35", "#fffdf8", "#b9985f"],
    paper: "#fffdf8",
    ink: "#173e35",
    inkMuted: "rgba(23, 62, 53, 0.62)",
    accent: "#173e35",
    gold: "#b9985f",
    rule: "#173e35",
    frame: "rgba(185, 152, 95, 0.28)",
    portraitRing: "#fffdf8",
  },
  sky: {
    id: "sky",
    name: "Open Sky",
    copy: "Mist blue, pearl light, gentle horizon",
    swatches: ["#dce8ec", "#f9faf7", "#657476"],
    paper: "#f9faf7",
    ink: "#2a4548",
    inkMuted: "rgba(42, 69, 72, 0.58)",
    accent: "#91aeb7",
    gold: "#8a9da3",
    rule: "#91aeb7",
    frame: "rgba(145, 174, 183, 0.24)",
    portraitRing: "#ffffff",
  },
};

export function resolveMemorialTheme(theme?: string): MemorialThemeStyle {
  if (theme && theme in memorialThemes) {
    return memorialThemes[theme as MemorialTheme];
  }
  return memorialThemes.garden;
}

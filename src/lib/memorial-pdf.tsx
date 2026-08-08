import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { MemorialDetails, MemorialDraft } from "@/lib/supabase-admin";
import { resolveMemorialTheme } from "@/lib/memorial-themes";

function createStyles(themeId?: string) {
  const theme = resolveMemorialTheme(themeId);
  return StyleSheet.create({
    page: {
      backgroundColor: theme.paper,
      color: theme.ink,
      fontFamily: "Times-Roman",
      padding: 58,
    },
    rule: {
      backgroundColor: theme.rule,
      height: 7,
      left: 0,
      position: "absolute",
      right: 0,
      top: 0,
    },
    frame: {
      borderColor: theme.frame,
      borderWidth: 1,
      bottom: 34,
      left: 34,
      position: "absolute",
      right: 34,
      top: 34,
    },
    eyebrow: {
      color: theme.gold,
      fontFamily: "Helvetica-Bold",
      fontSize: 8,
      letterSpacing: 3.2,
      marginBottom: 18,
      textAlign: "center",
      textTransform: "uppercase",
    },
    title: {
      color: theme.ink,
      fontFamily: "Times-Bold",
      fontSize: 36,
      lineHeight: 1.02,
      marginBottom: 8,
      textAlign: "center",
    },
    portrait: {
      borderColor: theme.portraitRing,
      borderRadius: 56,
      borderWidth: 4,
      height: 112,
      marginBottom: 22,
      marginHorizontal: "auto",
      objectFit: "cover",
      width: 112,
    },
    years: {
      color: theme.inkMuted,
      fontFamily: "Helvetica",
      fontSize: 8,
      letterSpacing: 2.4,
      marginBottom: 20,
      textAlign: "center",
    },
    heading: {
      color: theme.ink,
      fontFamily: "Times-Italic",
      fontSize: 19,
      lineHeight: 1.35,
      marginBottom: 28,
      marginHorizontal: "auto",
      maxWidth: 380,
      textAlign: "center",
    },
    divider: {
      backgroundColor: theme.gold,
      height: 1,
      marginBottom: 26,
      marginHorizontal: "auto",
      width: 56,
    },
    body: {
      color: theme.inkMuted,
      fontSize: 11.5,
      lineHeight: 1.75,
      marginBottom: 16,
    },
    sectionLabel: {
      color: theme.gold,
      fontFamily: "Helvetica-Bold",
      fontSize: 7,
      letterSpacing: 2.2,
      marginBottom: 10,
      marginTop: 8,
      textAlign: "center",
      textTransform: "uppercase",
    },
    closing: {
      color: theme.ink,
      fontFamily: "Times-Italic",
      fontSize: 16,
      marginTop: 24,
      textAlign: "center",
    },
    footer: {
      bottom: 24,
      color: theme.inkMuted,
      fontFamily: "Helvetica",
      fontSize: 7,
      left: 0,
      letterSpacing: 1.6,
      position: "absolute",
      right: 0,
      textAlign: "center",
      textTransform: "uppercase",
    },
    cardPage: {
      alignItems: "center",
      backgroundColor: theme.accent,
      color: "#ffffff",
      display: "flex",
      justifyContent: "center",
      padding: 88,
      textAlign: "center",
    },
    cardEyebrow: {
      color: theme.gold,
      fontFamily: "Helvetica-Bold",
      fontSize: 8,
      letterSpacing: 3.2,
      marginBottom: 24,
      textTransform: "uppercase",
    },
    cardTitle: {
      fontFamily: "Times-Bold",
      fontSize: 42,
      lineHeight: 1.02,
      marginBottom: 30,
    },
    cardQuote: {
      color: "#f4f7f5",
      fontFamily: "Times-Italic",
      fontSize: 19,
      lineHeight: 1.45,
      maxWidth: 340,
    },
    spreadPage: {
      backgroundColor: theme.paper,
      color: theme.ink,
      display: "flex",
      flexDirection: "row",
      fontFamily: "Times-Roman",
    },
    spreadPanel: {
      height: "100%",
      paddingBottom: 40,
      paddingHorizontal: 42,
      paddingTop: 40,
      position: "relative",
      width: "50%",
    },
    foldGuide: {
      backgroundColor: theme.frame,
      bottom: 18,
      position: "absolute",
      right: 0,
      top: 18,
      width: 0.5,
    },
    panelLabel: {
      color: theme.gold,
      fontFamily: "Helvetica-Bold",
      fontSize: 7,
      letterSpacing: 2.2,
      marginBottom: 12,
      textAlign: "center",
      textTransform: "uppercase",
    },
    coverName: {
      color: theme.ink,
      fontFamily: "Times-Bold",
      fontSize: 28,
      lineHeight: 1.02,
      marginBottom: 8,
      textAlign: "center",
    },
    coverHeading: {
      color: theme.ink,
      fontFamily: "Times-Italic",
      fontSize: 15,
      lineHeight: 1.35,
      marginHorizontal: "auto",
      maxWidth: 260,
      textAlign: "center",
    },
    insideTitle: {
      color: theme.ink,
      fontFamily: "Times-Bold",
      fontSize: 20,
      marginBottom: 14,
      textAlign: "center",
    },
    insideBody: {
      color: theme.inkMuted,
      fontSize: 9.2,
      lineHeight: 1.55,
      marginBottom: 12,
    },
    serviceLine: {
      borderBottomColor: theme.frame,
      borderBottomWidth: 0.5,
      color: theme.inkMuted,
      fontSize: 9.5,
      lineHeight: 1.4,
      paddingBottom: 5,
      paddingTop: 5,
      textAlign: "center",
    },
    printNote: {
      bottom: 13,
      color: theme.inkMuted,
      fontFamily: "Helvetica",
      fontSize: 5.5,
      left: 0,
      letterSpacing: 0.8,
      position: "absolute",
      right: 0,
      textAlign: "center",
      textTransform: "uppercase",
    },
  });
}

// Every panel in this document is a fixed height, so any line of type that
// wraps once more than expected pushes out an extra page. On the bifold that
// destroys the fold; on the keepsake it turns the promised single sheet into
// two. The scales below trade a little type size for a page count that holds
// across the full range the schema permits. Page counts are asserted in tests.
function sheetTypeScale(obituary: string, remembrance: string) {
  const total = obituary.trim().length + remembrance.trim().length;
  if (total <= 1200) return { fontSize: 11.5, lineHeight: 1.75 };
  if (total <= 1700) return { fontSize: 10.4, lineHeight: 1.6 };
  if (total <= 2100) return { fontSize: 9.4, lineHeight: 1.48 };
  return { fontSize: 8.6, lineHeight: 1.4 };
}

function sheetTitleSize(name: string) {
  const length = name.trim().length;
  if (length <= 22) return 36;
  if (length <= 32) return 28;
  if (length <= 46) return 22;
  if (length <= 64) return 18;
  return 15;
}

function sheetHeadingSize(heading: string) {
  const length = heading.trim().length;
  if (length <= 34) return 19;
  if (length <= 55) return 15;
  if (length <= 80) return 13;
  return 11.5;
}

function cardTitleSize(name: string) {
  const length = name.trim().length;
  if (length <= 14) return 42;
  if (length <= 20) return 34;
  if (length <= 28) return 27;
  if (length <= 38) return 22;
  return 18;
}

function cardQuoteSize(heading: string) {
  const length = heading.trim().length;
  if (length <= 30) return 19;
  if (length <= 55) return 15;
  if (length <= 85) return 12.5;
  return 11;
}

type StyleMap = ReturnType<typeof createStyles>;

// Applied only on a retry, so ordinary orders render at full size.
function scaleStyles(styles: StyleMap, scale: number): StyleMap {
  if (scale === 1) return styles;
  const scaled = Object.fromEntries(
    Object.entries(styles).map(([key, value]) => [
      key,
      value && typeof value === "object" && "fontSize" in value
        ? { ...value, fontSize: (value.fontSize as number) * scale }
        : value,
    ]),
  );
  return scaled as StyleMap;
}

async function renderMemorial(
  name: string,
  draft: MemorialDraft,
  details: MemorialDetails,
  photoDataUri: string | undefined,
  scale: number,
) {
  const styles = scaleStyles(createStyles(details.theme), scale);
  const base = sheetTypeScale(draft.obituary, draft.remembrance);
  const sheetScale = { ...base, fontSize: base.fontSize * scale };
  const theme = resolveMemorialTheme(details.theme);
  const years = [details.birthYear, details.passingYear]
    .filter(Boolean)
    .join(" — ");
  const serviceLines = (
    details.orderOfService ||
    details.serviceDetails ||
    "Welcome\nWords of remembrance\nClosing reflection"
  )
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  const isBifold = details.programFormat !== "keepsake";
  const document = (
    <Document
      title={`${name} — Memorial Collection`}
      author="TributeReady"
      subject="Memorial collection"
    >
      {isBifold ? (
        <>
          <Page size="LETTER" orientation="landscape" style={styles.spreadPage}>
            <View style={styles.spreadPanel}>
              <View style={styles.foldGuide} />
              <Text style={styles.panelLabel}>With gratitude</Text>
              <Text style={[styles.insideTitle, { marginTop: 28 }]}>
                Thank you for remembering {name}
              </Text>
              <View style={styles.divider} />
              <Text
                style={[
                  styles.insideBody,
                  { fontFamily: "Times-Italic", fontSize: 12, textAlign: "center" },
                ]}
              >
                {details.acknowledgments ||
                  "Your presence, kindness, and support have meant more than words can say. Thank you for helping us honor a life held so dear."}
              </Text>
              <Text style={[styles.closing, { fontSize: 13 }]}>
                {draft.closing}
              </Text>
              <Text style={styles.printNote}>
                Back cover · print double-sided, flip on short edge
              </Text>
            </View>
            <View style={[styles.spreadPanel, { justifyContent: "center" }]}>
              <View
                style={{
                  backgroundColor: theme.rule,
                  height: 7,
                  left: 0,
                  position: "absolute",
                  right: 0,
                  top: 0,
                }}
              />
              <Text style={styles.panelLabel}>
                {details.serviceTitle || "In loving memory"}
              </Text>
              {photoDataUri ? (
                <Image
                  src={photoDataUri}
                  style={[styles.portrait, { height: 96, width: 96 }]}
                  aria-label={`Portrait of ${name}`}
                />
              ) : null}
              <Text style={styles.coverName}>{name}</Text>
              {years ? <Text style={styles.years}>{years}</Text> : null}
              <View style={styles.divider} />
              <Text style={styles.coverHeading}>“{draft.heading}”</Text>
              {details.serviceDate || details.serviceLocation ? (
                <Text
                  style={[
                    styles.years,
                    { lineHeight: 1.5, marginBottom: 0, marginTop: 18 },
                  ]}
                >
                  {[details.serviceDate, details.serviceLocation]
                    .filter(Boolean)
                    .join("\n")}
                </Text>
              ) : null}
              <Text style={styles.printNote}>Front cover</Text>
            </View>
          </Page>
          <Page size="LETTER" orientation="landscape" style={styles.spreadPage}>
            <View style={styles.spreadPanel}>
              <View style={styles.foldGuide} />
              <Text style={styles.panelLabel}>Their story</Text>
              <Text style={styles.insideBody}>{draft.obituary}</Text>
              <Text style={styles.panelLabel}>A remembrance</Text>
              <Text
                style={[
                  styles.insideBody,
                  { fontFamily: "Times-Italic", fontSize: 10 },
                ]}
              >
                {draft.remembrance}
              </Text>
              {details.readingOrPoem ? (
                <>
                  <Text style={styles.panelLabel}>Reading</Text>
                  <Text
                    style={[
                      styles.insideBody,
                      { fontFamily: "Times-Italic", fontSize: 9 },
                    ]}
                  >
                    {details.readingOrPoem}
                  </Text>
                </>
              ) : null}
              <Text style={styles.printNote}>Inside left</Text>
            </View>
            <View style={styles.spreadPanel}>
              <Text style={styles.panelLabel}>Order of service</Text>
              <Text style={styles.insideTitle}>
                {details.serviceTitle || "Remembering together"}
              </Text>
              {serviceLines.map((line, index) => (
                <Text key={`${line}-${index}`} style={styles.serviceLine}>
                  {line}
                </Text>
              ))}
              {details.serviceDate || details.serviceLocation ? (
                <Text
                  style={[
                    styles.insideBody,
                    { marginTop: 16, textAlign: "center" },
                  ]}
                >
                  {[details.serviceDate, details.serviceLocation]
                    .filter(Boolean)
                    .join("\n")}
                </Text>
              ) : null}
              <Text style={styles.printNote}>Inside right</Text>
            </View>
          </Page>
        </>
      ) : (
        <Page size="LETTER" style={styles.page}>
          <View style={styles.rule} />
          <View style={styles.frame} />
          <Text style={styles.eyebrow}>In loving memory</Text>
          {photoDataUri ? (
            <Image
              src={photoDataUri}
              style={styles.portrait}
              aria-label={`Portrait of ${name}`}
            />
          ) : null}
          <Text style={[styles.title, { fontSize: sheetTitleSize(name) * scale }]}>
            {name}
          </Text>
          {years ? <Text style={styles.years}>{years}</Text> : null}
          <Text
            style={[styles.heading, { fontSize: sheetHeadingSize(draft.heading) * scale }]}
          >
            “{draft.heading}”
          </Text>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>Their story</Text>
          <Text style={[styles.body, sheetScale]}>{draft.obituary}</Text>
          <Text style={styles.sectionLabel}>A remembrance</Text>
          <Text
            style={[
              styles.body,
              sheetScale,
              {
                fontFamily: "Times-Italic",
                fontSize: sheetScale.fontSize + 0.5,
              },
            ]}
          >
            {draft.remembrance}
          </Text>
          <Text style={styles.closing}>{draft.closing}</Text>
          <Text style={styles.footer}>A life, beautifully remembered</Text>
        </Page>
      )}
      <Page size={[360, 504]} style={styles.cardPage}>
        <Text style={styles.cardEyebrow}>Remembering</Text>
        <Text style={[styles.cardTitle, { fontSize: cardTitleSize(name) * scale }]}>
          {name}
        </Text>
        <View
          style={{
            backgroundColor: theme.gold,
            height: 1,
            marginBottom: 30,
            width: 56,
          }}
        />
        <Text
          style={[styles.cardQuote, { fontSize: cardQuoteSize(draft.heading) * scale }]}
        >
          “{draft.heading}”
        </Text>
      </Page>
      <Page size={[360, 504]} style={styles.page}>
        <View style={styles.rule} />
        <View style={styles.frame} />
        <Text style={styles.eyebrow}>With heartfelt thanks</Text>
        <Text
          style={[styles.title, { fontSize: cardTitleSize(name) * 0.62 * scale }]}
        >
          From the family of {name}
        </Text>
        <View style={styles.divider} />
        <Text style={[styles.body, { fontSize: 13, textAlign: "center" }]}>
          Your kindness, presence, and support have meant more than words can
          say. Thank you for helping us honor and remember a life held so dear.
        </Text>
        <Text style={styles.footer}>Created with TributeReady</Text>
      </Page>
    </Document>
  );

  return renderToBuffer(document);
}

function countPages(pdf: Buffer) {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
}

// A bifold that is not exactly four pages cannot be folded, and a keepsake that
// runs to two sheets is no longer the single sheet we sold. Long names and long
// headings both push panels over, and they interact, so rather than guess at
// cutoffs we render, count, and tighten the type until it fits.
export async function createMemorialPdf(
  name: string,
  draft: MemorialDraft,
  details: MemorialDetails,
  photoDataUri?: string,
) {
  const expected = details.programFormat === "keepsake" ? 3 : 4;
  const scales = [1, 0.9, 0.8, 0.7, 0.6];

  let last: Buffer | undefined;
  for (const scale of scales) {
    last = await renderMemorial(name, draft, details, photoDataUri, scale);
    if (countPages(last) <= expected) return last;
  }
  // Delivering a slightly overset document beats delivering nothing.
  return last as Buffer;
}

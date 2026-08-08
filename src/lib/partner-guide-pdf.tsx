import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#fffdf8",
    color: "#173e35",
    fontFamily: "Helvetica",
    padding: 54,
  },
  eyebrow: {
    color: "#9c7b45",
    fontSize: 8,
    letterSpacing: 2,
    marginBottom: 18,
    textTransform: "uppercase",
  },
  title: { fontFamily: "Times-Bold", fontSize: 30, lineHeight: 1.08 },
  intro: { color: "#526762", fontSize: 11, lineHeight: 1.6, marginTop: 18 },
  section: { borderTopColor: "#dbe4df", borderTopWidth: 1, marginTop: 26, paddingTop: 20 },
  heading: { fontFamily: "Times-Bold", fontSize: 17, marginBottom: 10 },
  bullet: { color: "#526762", fontSize: 10, lineHeight: 1.6, marginBottom: 7 },
  callout: {
    backgroundColor: "#e8efeb",
    borderRadius: 10,
    marginTop: 24,
    padding: 18,
  },
  calloutText: { fontFamily: "Times-Bold", fontSize: 14, lineHeight: 1.4 },
  footer: {
    bottom: 30,
    color: "#71817c",
    fontSize: 8,
    left: 54,
    position: "absolute",
    right: 54,
  },
});

export function createPartnerGuidePdf() {
  return renderToBuffer(
    <Document
      title="TributeReady family resource guide"
      author="TributeReady"
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.eyebrow}>TributeReady · Family resource guide</Text>
        <Text style={styles.title}>
          A thoughtful handoff for families who need memorial writing and
          print-ready files.
        </Text>
        <Text style={styles.intro}>
          TributeReady turns confirmed family memories into an editable
          obituary, four-panel program, memorial card, thank-you card, and
          private memorial page. The family previews the tribute before making
          a one-time $34.99 purchase.
        </Text>

        <View style={styles.section}>
          <Text style={styles.heading}>What families receive</Text>
          <Text style={styles.bullet}>• Fact-safe writing shaped only from details the family supplies</Text>
          <Text style={styles.bullet}>• A printable US Letter bifold program with an order of service</Text>
          <Text style={styles.bullet}>• Coordinated memorial and thank-you cards</Text>
          <Text style={styles.bullet}>• A private memorial link and downloadable QR code</Text>
          <Text style={styles.bullet}>• Immediate automated delivery and practical printing guidance</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>What your organization needs to do</Text>
          <Text style={styles.bullet}>1. Share tributeready.org when the resource is relevant.</Text>
          <Text style={styles.bullet}>2. The family creates and reviews its own tribute.</Text>
          <Text style={styles.bullet}>3. TributeReady handles checkout, digital delivery, and product support.</Text>
        </View>

        <View style={styles.callout}>
          <Text style={styles.calloutText}>
            No account, contract, inventory, or training. No automatic
            publishing. No recurring family charge.
          </Text>
        </View>

        <Text style={styles.footer}>
          tributeready.org/partners · care@tributeready.org · TributeReady is a
          digital memorial-design service, not a funeral home or professional
          funeral provider.
        </Text>
      </Page>
    </Document>,
  );
}

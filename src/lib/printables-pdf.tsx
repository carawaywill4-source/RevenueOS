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
    paddingBottom: 56,
    paddingHorizontal: 50,
    paddingTop: 46,
  },
  eyebrow: {
    color: "#9c7b45",
    fontSize: 7.5,
    letterSpacing: 2,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  title: { fontFamily: "Times-Bold", fontSize: 25, lineHeight: 1.1 },
  intro: { color: "#526762", fontSize: 9.5, lineHeight: 1.55, marginTop: 12 },
  section: {
    borderTopColor: "#dbe4df",
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 14,
  },
  heading: { fontFamily: "Times-Bold", fontSize: 14, marginBottom: 4 },
  subheading: {
    color: "#71817c",
    fontSize: 8.5,
    lineHeight: 1.5,
    marginBottom: 10,
  },
  fieldRow: { flexDirection: "row", gap: 14, marginBottom: 11 },
  field: { flexGrow: 1, flexBasis: 0 },
  label: {
    color: "#71817c",
    fontSize: 7.5,
    letterSpacing: 0.6,
    marginBottom: 9,
    textTransform: "uppercase",
  },
  rule: { borderBottomColor: "#c3d2cb", borderBottomWidth: 0.8 },
  ruleTall: {
    borderBottomColor: "#c3d2cb",
    borderBottomWidth: 0.8,
    marginBottom: 13,
  },
  promptText: { color: "#3c574f", fontSize: 9, lineHeight: 1.5, marginBottom: 9 },
  note: {
    backgroundColor: "#e8efeb",
    borderRadius: 8,
    marginTop: 16,
    padding: 13,
  },
  noteText: { color: "#2c463f", fontSize: 8.5, lineHeight: 1.5 },
  step: { color: "#3c574f", fontSize: 9, lineHeight: 1.55, marginBottom: 6 },
  panelGrid: { flexDirection: "row", gap: 12, marginTop: 4 },
  panel: {
    borderColor: "#c3d2cb",
    borderRadius: 8,
    borderWidth: 0.8,
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 132,
    padding: 11,
  },
  panelTitle: { fontFamily: "Times-Bold", fontSize: 10, marginBottom: 5 },
  panelHint: { color: "#71817c", fontSize: 7.5, lineHeight: 1.45 },
  footer: {
    bottom: 26,
    color: "#8b9995",
    fontSize: 7.5,
    left: 50,
    position: "absolute",
    right: 50,
    textAlign: "center",
  },
});

function Line() {
  return <View style={styles.ruleTall} />;
}

function Field({ label, width }: { label: string; width?: number }) {
  return (
    <View style={[styles.field, width ? { flexGrow: width } : {}]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.rule} />
    </View>
  );
}

function Footer() {
  return (
    <Text style={styles.footer} fixed>
      Free to print, copy, and share, with or without credit · tributeready.org
    </Text>
  );
}

export function createObituaryWorksheetPdf() {
  return renderToBuffer(
    <Document
      title="Obituary worksheet and fill-in template"
      author="TributeReady"
      subject="A free printable worksheet for gathering obituary details"
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.eyebrow}>Free printable · TributeReady</Text>
        <Text style={styles.title}>Obituary worksheet</Text>
        <Text style={styles.intro}>
          Fill this in before you try to write anything. Separating the
          fact-gathering from the writing is the single thing that makes an
          obituary easier, and it keeps a date or a spelling from being missed
          when several relatives are contributing. Ask one person to confirm the
          finished sheet.
        </Text>

        <View style={styles.section}>
          <Text style={styles.heading}>The facts</Text>
          <Text style={styles.subheading}>
            Everything a newspaper or funeral home will ask you for.
          </Text>
          <View style={styles.fieldRow}>
            <Field label="Full name, including maiden name" width={2} />
            <Field label="Name they were called" />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Age" />
            <Field label="City and state" width={2} />
            <Field label="Date of death" />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Date of birth" />
            <Field label="Place of birth" width={2} />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Parents' names" width={2} />
            <Field label="Spouse and marriage date" width={2} />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Education, training, or military service" />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Work, trade, or business, and for how long" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>The person</Text>
          <Text style={styles.subheading}>
            This is the part readers actually remember. Be specific and small.
            One true habit beats five adjectives.
          </Text>
          <Text style={styles.promptText}>
            What did they do on an ordinary Sunday?
          </Text>
          <Line />
          <Line />
          <Text style={styles.promptText}>
            What did they always say, or always keep, or refuse to do?
          </Text>
          <Line />
          <Line />
          <Text style={styles.promptText}>
            What were they better at than anyone else in the family?
          </Text>
          <Line />
          <Line />
          <Text style={styles.promptText}>
            Faith community, clubs, volunteering, teams, or causes
          </Text>
          <Line />
        </View>

        <Footer />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.heading}>Family</Text>
          <Text style={styles.subheading}>
            Confirm every spelling with one relative. Misspelled names are the
            single most-regretted error in a published obituary.
          </Text>
          <Text style={styles.promptText}>
            Survived by — spouse, then children with their spouses, then
            grandchildren, then siblings
          </Text>
          <Line />
          <Line />
          <Line />
          <Text style={styles.promptText}>
            Number of grandchildren and great-grandchildren
          </Text>
          <Line />
          <Text style={styles.promptText}>
            Preceded in death by — include a child or grandchild who died
            earlier, which matters to surviving siblings
          </Text>
          <Line />
          <Line />
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Service details</Text>
          <View style={styles.fieldRow}>
            <Field label="Service type" />
            <Field label="Date and time" />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Location" width={2} />
            <Field label="Officiant" />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Visitation details" width={2} />
            <Field label="Reception location" width={2} />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Donations in lieu of flowers — exact organization name" />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Funeral home and its phone number" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Fill-in-the-blank draft</Text>
          <Text style={styles.subheading}>
            Copy the sheet above into this shape. Delete anything that does not
            apply. Nothing here is required.
          </Text>
          <Text style={styles.step}>
            1. [Full name], [age], of [city, state], died on [date]. [Optional:
            at home / after a long illness / unexpectedly.]
          </Text>
          <Text style={styles.step}>
            2. [He/She/They] was born on [date] in [place] to [parents]. [School,
            military service, or training.] [Work, and for how long.]
          </Text>
          <Text style={styles.step}>
            3. [Married [name] on [date]. They were married [number] years.]
          </Text>
          <Text style={styles.step}>
            4. [One paragraph of the specific things from page one. This is the
            paragraph people will read twice.]
          </Text>
          <Text style={styles.step}>
            5. [He/She/They] is survived by [family]. Preceded in death by
            [names].
          </Text>
          <Text style={styles.step}>
            6. A [service type] will be held on [date] at [time] at [location].
            In lieu of flowers, donations may be made to [organization].
          </Text>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            Before publishing: cause of death is always optional. Consider
            leaving out an exact birth date printed alongside a mother&apos;s
            maiden name, and avoid naming an address that will be empty during
            the service. Newspapers charge by the line, so ask for the word
            limit before you write to length. More templates and completed
            examples at tributeready.org/obituary-templates
          </Text>
        </View>

        <Footer />
      </Page>
    </Document>,
  );
}

export function createProgramPlannerPdf() {
  return renderToBuffer(
    <Document
      title="Funeral program planning worksheet"
      author="TributeReady"
      subject="A free printable worksheet for planning a funeral program and order of service"
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.eyebrow}>Free printable · TributeReady</Text>
        <Text style={styles.title}>Funeral program planner</Text>
        <Text style={styles.intro}>
          A funeral program is one sheet of paper folded once, which gives you
          four panels and no more. Deciding what goes on each panel before you
          open a design tool is what keeps the finished program from feeling
          crowded. Work through this sheet, then lay it out.
        </Text>

        <View style={styles.section}>
          <Text style={styles.heading}>The four panels</Text>
          <Text style={styles.subheading}>
            Sketch or note what belongs in each. Resist adding a fifth idea.
          </Text>
          <View style={styles.panelGrid}>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Front cover</Text>
              <Text style={styles.panelHint}>
                Photograph, full name, birth and death dates, service location
                and date. One photograph only, and one that looks like them.
              </Text>
            </View>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Inside left</Text>
              <Text style={styles.panelHint}>
                Order of service, with the name of each reader, musician, and
                speaker beside their part.
              </Text>
            </View>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Inside right</Text>
              <Text style={styles.panelHint}>
                Obituary or life summary. Usually 150 to 350 words once a
                photograph shares the panel.
              </Text>
            </View>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Back cover</Text>
              <Text style={styles.panelHint}>
                Pallbearers, the family&apos;s acknowledgement, reception
                details, donation information, and a closing verse.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Service details</Text>
          <View style={styles.fieldRow}>
            <Field label="Full name as it should appear" width={2} />
            <Field label="Birth and death dates" />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Service type" />
            <Field label="Date and time" />
            <Field label="Officiant" />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Venue" width={2} />
            <Field label="Committal or graveside location" width={2} />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Reception location and time" width={2} />
            <Field label="Estimated attendance" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Order of service</Text>
          <Text style={styles.subheading}>
            Write the part on the left and the person on the right. If a line
            has no name beside it, it is not confirmed.
          </Text>
          {Array.from({ length: 9 }).map((_, index) => (
            <View key={index} style={styles.fieldRow}>
              <Field label={index === 0 ? "Part of the service" : " "} width={2} />
              <Field label={index === 0 ? "Who is doing it" : " "} />
            </View>
          ))}
        </View>

        <Footer />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.heading}>People to name in print</Text>
          <Text style={styles.subheading}>
            Confirm spellings with one person. Someone left out of this list
            will notice, and will remember.
          </Text>
          <View style={styles.fieldRow}>
            <Field label="Pallbearers" width={2} />
            <Field label="Honorary pallbearers" width={2} />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Readers" />
            <Field label="Musicians and soloists" />
            <Field label="Speakers" />
          </View>
          <Text style={styles.promptText}>
            Acknowledgement from the family — who cared for them, who traveled,
            who fed everyone
          </Text>
          <Line />
          <Line />
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Readings and music</Text>
          <Text style={styles.subheading}>
            Check the copyright before printing the text of a poem or song
            lyric. Reading a work aloud and reprinting it are different acts.
          </Text>
          <View style={styles.fieldRow}>
            <Field label="Opening music" width={2} />
            <Field label="Reading and who reads it" width={2} />
          </View>
          <View style={styles.fieldRow}>
            <Field label="Hymn or special music" width={2} />
            <Field label="Closing music" width={2} />
          </View>
          <View style={styles.note}>
            <Text style={styles.noteText}>
              Verified public-domain poems and scripture, printed in full with
              their copyright status stated, are at
              tributeready.org/funeral-readings. Complete order-of-service
              outlines by tradition, including Catholic, Baptist, military,
              graveside, memorial, and celebration of life, are at
              tributeready.org/order-of-service-templates
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Printing checklist</Text>
          <Text style={styles.step}>
            Print quantity: roughly two-thirds of expected attendance, plus
            twenty-five. Families almost always print too few.
          </Text>
          <Text style={styles.step}>
            Paper: 28 lb text or heavier reads as a keepsake. Standard 20 lb
            copier paper does not.
          </Text>
          <Text style={styles.step}>
            Layout: US Letter, printed double-sided, flipped on the short edge,
            folded once to 8.5 x 5.5 inches.
          </Text>
          <Text style={styles.step}>
            Photographs: at least 300 dpi. A photo that looks sharp on a phone
            will often look soft in print.
          </Text>
          <Text style={styles.step}>
            Proof: print one copy, fold it, and have someone who was not
            involved read it before you print the rest.
          </Text>
          <Text style={styles.step}>
            Timing: confirm the print shop&apos;s turnaround the day you book
            the service, not the day before it.
          </Text>
          <Text style={styles.step}>
            Extras: set aside ten unfolded copies. Families are asked for them
            for years afterward.
          </Text>
        </View>

        <Footer />
      </Page>
    </Document>,
  );
}

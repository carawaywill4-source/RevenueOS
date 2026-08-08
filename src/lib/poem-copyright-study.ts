export const STUDY_DATE = "2026-08-07";

export const studyMethod = {
  runAt: "2026-08-07T17:00Z",
  queries: ["funeral poems", "funeral poems and readings"],
  engine: "Brave Search",
  sample: "Top 10 organic web results per query, unioned and deduplicated by registrable domain.",
  hostsFound: 15,
  analyzed: 13,
  excluded: 2,
};

// Engines that refused automated access on the run date. Recorded because the
// choice of engine determines the sample, and an unnamed engine is unverifiable.
export const enginesUnavailable = [
  {
    engine: "Google",
    reason: "Served an 'unusual traffic' CAPTCHA. Not defeated.",
  },
  {
    engine: "DuckDuckGo",
    reason: "Served an anti-bot challenge on both the full and Lite endpoints.",
  },
  {
    engine: "Startpage",
    reason: "Returned an anti-bot interstitial with no organic results.",
  },
  {
    engine: "Bing",
    reason:
      "Wrapped every organic result in a redirect, so destination domains were not recoverable.",
  },
];

export const studyFindings = [
  {
    stat: "11 of 13",
    label:
      "pages reproduced at least one identifying line of a work that is in copyright or of disputed status",
  },
  {
    stat: "8 of 13",
    label:
      "reproduced at least 70 percent of the lines of at least one such work",
  },
  {
    stat: "1 of 13",
    label: "stated the public-domain status of any poem it published",
  },
  {
    stat: "0 of 13",
    label:
      "showed a visible permission or licence statement beside a reproduced modern poem",
  },
];

// The full sample, published so that anyone can repeat the measurement.
export const studyDomains = [
  "dignityfunerals.co.uk",
  "familytreeceremonies.co.uk",
  "panmacmillan.com",
  "tharpfuneralhome.com",
  "poets.org",
  "humanist.org.uk",
  "gupton-jones.edu",
  "stoneletters.com",
  "humanists.uk",
  "amandalouisefuneralservices.co.uk",
  "wvfuneralboard.com",
  "theinspiredfuneral.com",
  "eulogyexpert.com",
];

export const studyExcluded = [
  {
    domain: "dignitymemorial.com",
    reason: "Returned HTTP 403 to automated access. Publishing practice unknown.",
  },
  {
    domain: "reddit.com",
    reason:
      "Returned only 198 characters of server-rendered text, so the page content could not be verified.",
  },
];

export const studyWorks = [
  {
    title: "Do Not Stand at My Grave and Weep",
    author: "Attributed to Mary Elizabeth Frye, c. 1932",
    pages: 9,
    fullText: 5,
    status:
      "Disputed. Authorship was contested for decades and the copyright position has never been conclusively settled.",
  },
  {
    title: "She Is Gone (also published as He Is Gone)",
    author: "David Harkins, 1981",
    pages: 7,
    fullText: 6,
    status:
      "In copyright. Widely misattributed to an anonymous author, which is likely why it is reproduced so freely.",
  },
  {
    title: "Afterglow",
    author: "Helen Lowrie Marshall, 1958",
    pages: 6,
    fullText: 6,
    status: "In copyright. Frequently published with no author credit at all.",
  },
  {
    title: "Miss Me But Let Me Go",
    author: "Anonymous, disputed",
    pages: 5,
    fullText: 2,
    status:
      "Disputed. No settled authorship, which leaves its status unresolved rather than clear.",
  },
  {
    title: "Funeral Blues (Stop all the clocks)",
    author: "W. H. Auden, 1938",
    pages: 4,
    fullText: 3,
    status:
      "In copyright in the United States and most other countries. Demand rose sharply after its use in film.",
  },
  {
    title: "When Great Trees Fall",
    author: "Maya Angelou, 1990",
    pages: 3,
    fullText: 1,
    status: "In copyright.",
  },
  {
    title: "To Those Whom I Love",
    author: "Isla Paschal Richardson",
    pages: 3,
    fullText: 3,
    status: "In copyright.",
  },
  {
    title: "The Dash",
    author: "Linda Ellis, 1996",
    pages: 2,
    fullText: 2,
    status:
      "In copyright and actively licensed. The rights holder has historically pursued unlicensed reproductions, including by individuals and small businesses.",
  },
  {
    title: "Turn Again to Life",
    author: "Mary Lee Hall",
    pages: 2,
    fullText: 1,
    status: "Uncertain. Attribution and first publication are both unclear.",
  },
  {
    title: "God Saw You Getting Tired",
    author: "Anonymous, disputed",
    pages: 1,
    fullText: 1,
    status: "Disputed authorship and unresolved status.",
  },
  {
    title: "The Broken Chain",
    author: "Ron Tranmer",
    pages: 0,
    fullText: 0,
    status:
      "In copyright, but not counted on any page in this sample. The lines most often used to detect it are traditional floating stanzas that also appear inside other, differently credited poems.",
  },
];

// Named deliberately. A study that only reports failures misrepresents the field,
// and this page is the clearest evidence that careful publishing is achievable.
export const carefulPublisher = {
  domain: "wvfuneralboard.com",
  detail:
    "It marks public-domain works as such, and beside Maya Angelou it prints 'Copyrighted. Available in Angelou's published collections. Do not reproduce — description only.' For the Harkins poem it prints no text at all, only a pointer to where the poem can be found. It is the one page in the sample that states copyright status, and an earlier version of our own detection rule would have wrongly scored it as a reproducer because the title of several of these works is also their opening line.",
};

export const studyLimitations = [
  "This is a count from one named, dated sample, not a property of 'the top-ranking pages' in general. Search results are personalised and change daily, so a repeat run will return a different domain list.",
  "Google, DuckDuckGo, Startpage and Bing all refused automated access on the run date, so Brave Search was used. A different engine indexes different pages, and this sample came back heavily weighted toward United Kingdom publishers even though the requests originated from a United States address. That weighting directly affects which poems appear.",
  "Thirteen pages is a small sample. A single page moves any proportion by roughly eight percentage points.",
  "Reproduction was detected by matching identifying lines and measuring coverage across all of a work's lines. Bare title mentions and pointers telling readers where to find a poem are not counted as reproduction. Partial quotation of a few lines may be defensible in some jurisdictions.",
  "The eleven works are a fixed list, so the study measures how often those particular poems are reproduced, not how common copyright-risky publishing is overall. One page in the sample reproduced none of the eleven yet published other plainly in-copyright poems in full.",
  "A publisher may hold a licence that is not visible on the page. The zero figure measures disclosure, not conduct, and one of the pages reproducing a modern poem in full is that poem's own trade publisher.",
  "Copyright status was assigned from author death dates and publication history. No page was checked against any rights holder's actual licence records.",
  "Two domains in the sample, humanist.org.uk and humanists.uk, are separate domains belonging to the same organisation. Deduplicating by organisation instead of by domain would reduce the sample to twelve.",
  "This is a description of publishing practice, not legal advice, and it is not an accusation against any individual publisher.",
];

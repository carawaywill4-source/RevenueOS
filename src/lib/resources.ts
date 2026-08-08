export const RESOURCE_UPDATED = "2026-08-07";

export type ResourceSection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  example?: {
    label: string;
    text: string[];
  };
  note?: string;
};

export type ResourceGuide = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  eyebrow: string;
  readTime: string;
  intro: string[];
  sections: ResourceSection[];
  related: string[];
  cta: {
    title: string;
    copy: string;
    href: string;
    label: string;
  };
};

export const resourceGuides = [
  {
    slug: "how-to-write-an-obituary",
    title: "How to Write an Obituary: A Thoughtful Step-by-Step Guide",
    shortTitle: "How to write an obituary",
    description:
      "Learn how to write a warm, accurate obituary, from gathering facts and choosing a structure to revising the final tribute.",
    eyebrow: "Obituary writing guide",
    readTime: "9 minute read",
    intro: [
      "An obituary has two jobs: it shares the news of a death and gives readers a recognizable sense of the person who lived. The strongest obituaries do both plainly. They include the facts people need, then make room for the habits, relationships, values, and stories that made one life distinct.",
      "You do not need to sound formal or literary. Write in the voice your family naturally uses, verify details with another person, and aim for a truthful portrait rather than a complete biography.",
    ],
    sections: [
      {
        id: "gather-details",
        heading: "1. Gather the facts before drafting",
        paragraphs: [
          "Start with a private fact sheet. This separates research from writing and reduces the chance that a date, spelling, or relationship is missed. Ask one family member to confirm the final list, especially when several relatives are contributing.",
        ],
        bullets: [
          "Full name, including a maiden name or familiar nickname when appropriate",
          "Age, date of death, and place of residence",
          "Birth date and birthplace",
          "Education, service, work, faith, community roles, and meaningful interests",
          "Names and relationships of close surviving and predeceased family",
          "Service details, donation requests, and the funeral home's preferred contact information",
        ],
        note: "Before publishing a home address, exact birth date, or other sensitive detail, consider whether the information is truly needed.",
      },
      {
        id: "choose-shape",
        heading: "2. Choose a simple structure",
        paragraphs: [
          "A dependable order is announcement, life story, relationships, service information, and closing. That sequence helps readers understand what happened before moving into remembrance. It also makes a long draft easier to shorten if a newspaper has a word limit.",
          "Open directly: name the person, their age, where they lived, and when they died. A cause of death is optional. Families may name it, use a broad phrase such as “after a brief illness,” or omit it entirely.",
        ],
      },
      {
        id: "make-specific",
        heading: "3. Replace praise with specific detail",
        paragraphs: [
          "Words such as kind, devoted, and generous are meaningful, but a small detail lets the reader feel those qualities. Instead of listing every achievement, select two or three threads that connect the person's life.",
          "You might mention the garden seedlings they gave to neighbors, the Sunday pancakes everyone expected, the careful notes tucked into birthday cards, or the way former students still stopped to say hello. Specificity turns a summary into a portrait.",
        ],
        example: {
          label: "Fictional example",
          text: [
            "Elena made hospitality feel effortless. There was always another chair at her table, coffee already warming, and a container of lemon cookies ready to travel home with a visitor.",
          ],
        },
      },
      {
        id: "family-service",
        heading: "4. Name family and service details carefully",
        paragraphs: [
          "Families can be described in many ways. Use the names and relationships people use for themselves, and do not force a complicated family into a rigid formula. If a list would be very long, grouping relatives by relationship can be more gracious than accidentally leaving someone out.",
          "For a public service, include date, time, venue, city, and instructions for flowers or memorial gifts. For a private gathering, say so without publishing details. Confirm all service information after the venue is finalized.",
        ],
      },
      {
        id: "revise",
        heading: "5. Read it aloud and verify every proper noun",
        paragraphs: [
          "Set the draft aside briefly, then read it aloud. Listen for repeated phrases, abrupt transitions, and sentences that sound unlike your family. Check the spelling of every person, school, employer, organization, and place.",
          "Finally, ask a trusted reader two questions: “Does this sound like them?” and “Is anything important or sensitive incorrect?” A good obituary is not the longest one. It is accurate, recognizable, and written with care.",
        ],
      },
    ],
    related: ["obituary-family-order", "obituary-examples", "funeral-thank-you-wording"],
    cta: {
      title: "Start with memories, not a blank page",
      copy: "TributeReady gently organizes the details you share into an editable obituary and coordinated memorial materials.",
      href: "/obituary-writer",
      label: "Try the obituary writer",
    },
  },
  {
    slug: "obituary-family-order",
    title: "What Order Do Family Members Go in an Obituary?",
    shortTitle: "Obituary family order",
    description:
      "A clear guide to listing surviving and predeceased family in an obituary, with worked examples for spouses, children, siblings, and blended families.",
    eyebrow: "Obituary wording",
    readTime: "8 minute read",
    intro: [
      "The family list is the part of an obituary most likely to cause hurt feelings. There is no single legal order that every newspaper requires, but there is a widely understood courtesy order that most families recognize: spouse or partner first, then children, grandchildren, parents, siblings, and then other relatives the family wants to name.",
      "Use the names and relationships people actually use for themselves. If two relatives disagree about wording, pause and agree the list before anything is submitted. A short, accurate list is better than a long one with a missing name.",
    ],
    sections: [
      {
        id: "usual-order",
        heading: "The usual courtesy order",
        paragraphs: [
          "Newspapers and funeral homes often follow a pattern close to this. It is custom, not law, and families may rearrange it when their lives do not fit the pattern.",
        ],
        bullets: [
          "Spouse or partner",
          "Children (and their spouses or partners, if named)",
          "Grandchildren, then great-grandchildren (often by count rather than every name)",
          "Parents, if still living",
          "Siblings",
          "Other relatives the family chooses to include — nieces, nephews, cousins, in-laws",
          "Close friends only when the family truly wants them in the published list",
        ],
        note: "Pets are sometimes mentioned in the life story. Putting an animal in the surviving-family sentence usually reads as a joke, even when the affection is real.",
      },
      {
        id: "surviving",
        heading: "How to write the surviving-family sentence",
        paragraphs: [
          "Open with “is survived by” or “leaves.” Name the closest relationships first. Put a relationship label beside each name when readers would otherwise guess incorrectly. Married children’s partners can appear in parentheses after the child’s name, which keeps the list readable.",
        ],
        example: {
          label: "Fictional example",
          text: [
            "She is survived by her husband of forty-one years, David; children Rachel (Tom) and Ben; four grandchildren; her sister, Claire; and her brother, Mark.",
          ],
        },
      },
      {
        id: "predeceased",
        heading: "How to list people who died earlier",
        paragraphs: [
          "Use “was preceded in death by” or “was predeceased by.” Parents, a spouse, children, and siblings are the relatives most often named here. You do not need a complete genealogy. Name the people whose absence would feel wrong if left out.",
        ],
        example: {
          label: "Fictional example",
          text: [
            "He was preceded in death by his wife, Helen; his parents, Arthur and June; and his brother, Paul.",
          ],
        },
      },
      {
        id: "blended",
        heading: "Blended families, step-relations, and chosen family",
        paragraphs: [
          "Write the relationship the way the family lived it. “Stepson,” “partner,” “former spouse,” and “dear friend” are all legitimate when they are true. Do not invent a hierarchy to make a complicated family look simple.",
          "If adult children from different marriages should appear together, say so plainly rather than forcing a ranking that will be argued over later. When in doubt, ask the people being named how they want to be described.",
        ],
        example: {
          label: "Fictional example",
          text: [
            "She is survived by her partner, Morgan; children Avery and Sam; stepchildren Jordan and Riley; and her former husband, Chris, who remained a close friend.",
          ],
        },
      },
      {
        id: "counts-vs-names",
        heading: "When to count instead of naming everyone",
        paragraphs: [
          "Large families often list grandchildren and great-grandchildren by number: “eight grandchildren and three great-grandchildren.” That avoids a long roll call and reduces the risk of omitting someone. Name individuals only when the family is small or when a particular person should be singled out.",
          "Newspapers that charge by the line make counting even more practical. A paid notice can use counts while a longer memorial page or program names people in full.",
        ],
      },
      {
        id: "mistakes",
        heading: "Mistakes that cause the most pain",
        bullets: [
          "Publishing before every branch of the family has seen the list",
          "Using a legal name someone never went by, or ignoring a chosen name",
          "Leaving out a child, sibling, or current partner",
          "Including an estranged relative the rest of the family did not agree to name",
          "Copying an old template that still lists someone who has since died",
        ],
        note: "If an error reaches print, correct it on the funeral-home or memorial page immediately and, when the newspaper allows, submit a correction. Do not pretend the mistake did not happen.",
      },
      {
        id: "checklist",
        heading: "A short checklist before you submit",
        bullets: [
          "One person owns the draft; others review it",
          "Every living person named has been checked for spelling and relationship label",
          "Predeceased names are current",
          "Counts of grandchildren match what the family expects to see",
          "Service and donation lines are separate from the family list",
        ],
      },
    ],
    related: ["how-to-write-an-obituary", "obituary-examples", "memorial-card-wording"],
    cta: {
      title: "Write the obituary with the family list included",
      copy: "Share the names you want included. The draft will not invent relatives you did not provide, and you can edit the list before anything is paid for.",
      href: "/obituary-writer",
      label: "Open the obituary writer",
    },
  },
  {
    slug: "obituary-examples",
    title: "Obituary Examples for Different Lives and Services",
    shortTitle: "Obituary examples",
    description:
      "Read original obituary examples for a parent, partner, private service, and short newspaper notice, with notes on what each does well.",
    eyebrow: "Obituary examples",
    readTime: "10 minute read",
    intro: [
      "Examples are most useful as structures, not scripts. Borrow an order, transition, or level of detail, then replace every generic phrase with language that belongs to the person you are remembering.",
      "All names, people, events, and identifying details below are fictional. They are provided only as writing models.",
    ],
    sections: [
      {
        id: "parent",
        heading: "Example: a warm obituary for a parent",
        example: {
          label: "Fictional example",
          text: [
            "Marisol Vega, 78, of Cedar Falls, died peacefully on May 12, surrounded by her family.",
            "Born in Santa Fe to Lucia and Tomas Romero, Marisol built a life around curiosity, service, and a table that was never too full. She taught fourth grade for 31 years, where generations of students learned that careful questions mattered as much as correct answers. At home, she tended unruly roses, listened to baseball on the radio, and made cinnamon bread for every new neighbor.",
            "Marisol is survived by her husband of 54 years, Daniel; children Sofia (Aaron) and Miguel (Ren); four grandchildren; and her sister, Inez. She was preceded in death by her parents and brother, Rafael.",
            "A celebration of Marisol's life will be held Saturday, May 25, at 11 a.m. at the Cedar Falls Community Hall. In lieu of flowers, the family welcomes gifts to the library's children's reading program.",
          ],
        },
        paragraphs: [
          "Why it works: the opening gives essential facts, the middle follows two clear themes—teaching and hospitality—and the final paragraphs handle family and service information without interrupting the portrait.",
        ],
      },
      {
        id: "partner",
        heading: "Example: a personal obituary for a spouse or partner",
        example: {
          label: "Fictional example",
          text: [
            "Theo Bennett died on October 3 at age 66, leaving behind a life made rich by music, friendship, and 38 years beside his husband, James.",
            "Theo repaired instruments by trade and played them for joy. He could coax a clean note from a battered trumpet, identify a song within three seconds, and persuade almost anyone to stay for one more record. He and James spent their best afternoons searching small shops for vinyl they did not need and cooking dinners that started late.",
            "He is deeply missed by James; his daughters, Camille and Nora; his brother, Peter; and a wide circle of musicians, customers, and friends. A private gathering will be held this fall. Those wishing to remember Theo are invited to play a favorite album all the way through.",
          ],
        },
        paragraphs: [
          "Why it works: the language is intimate without requiring private details. The closing request feels connected to Theo, giving readers a simple and personal way to remember him.",
        ],
      },
      {
        id: "short",
        heading: "Example: a short newspaper obituary",
        example: {
          label: "Fictional example",
          text: [
            "Priya Nair, 91, of Brookhaven, died June 8. A gifted seamstress and longtime volunteer at the Brookhaven Food Pantry, Priya will be remembered for her quick humor and steadfast care for others. She is survived by two sons, Arun and Dev; five grandchildren; and seven great-grandchildren. A memorial service will be held June 18 at 2 p.m. at North Chapel. Memorial gifts may be made to the Brookhaven Food Pantry.",
          ],
        },
        paragraphs: [
          "Why it works: every sentence earns its place. It preserves one vocational detail, one community contribution, and one character note while still covering family, service, and donations.",
        ],
      },
      {
        id: "private",
        heading: "Example: an obituary when the service is private",
        example: {
          label: "Fictional example",
          text: [
            "Jordan Ellis, 52, died at home on February 14 after living with cancer for three years. Jordan approached both ordinary days and difficult ones with honesty, dry humor, and fierce love for family.",
            "A landscape designer, devoted aunt, and patient keeper of an elderly beagle named Moss, Jordan noticed what other people hurried past. She is survived by her mother, Denise; siblings, Alex and Morgan; and six nieces and nephews. The family will gather privately. In Jordan's memory, take a slow walk somewhere green.",
          ],
        },
        paragraphs: [
          "Why it works: it acknowledges the illness without making it the center of the life, clearly states that arrangements are private, and closes with an invitation that does not reveal private service details.",
        ],
      },
      {
        id: "adapt",
        heading: "How to adapt an example without sounding generic",
        bullets: [
          "Underline the facts the example includes, then gather your own version of each fact.",
          "Circle the vivid details and replace them with memories only your family would recognize.",
          "Remove any section that does not fit; cause of death, career history, and donation requests are all optional.",
          "Read the result aloud and replace phrases you would never naturally say.",
          "Label sample text as fictional wherever it appears in public-facing memorial materials.",
        ],
      },
    ],
    related: ["how-to-write-an-obituary", "obituary-family-order", "memorial-card-wording"],
    cta: {
      title: "Turn your notes into a first draft",
      copy: "Share a few memories and facts, then review an obituary draft you can edit until it sounds right.",
      href: "/obituary-writer",
      label: "Create an obituary draft",
    },
  },
  {
    slug: "funeral-program-order-of-service",
    title: "Funeral Program Order of Service: Templates and Planning Guide",
    shortTitle: "Funeral program order of service",
    description:
      "Plan a clear funeral or memorial order of service with adaptable templates for traditional, religious, and celebration-of-life gatherings.",
    eyebrow: "Program planning",
    readTime: "8 minute read",
    intro: [
      "An order of service is both a roadmap for guests and a working plan for the people leading the gathering. It does not need to record every movement. It should name the moments that help guests follow along: music, welcome, readings, tributes, reflection, and closing.",
      "Customs vary across faiths, cultures, venues, and families. Confirm the sequence with your officiant or service leader before printing, especially when a liturgy has required language or placement.",
    ],
    sections: [
      {
        id: "standard",
        heading: "A flexible memorial service order",
        bullets: [
          "Prelude or gathering music",
          "Welcome and opening words",
          "Reading, prayer, or poem",
          "Obituary or life story",
          "Family and friend tributes",
          "Music or quiet reflection",
          "Message, homily, or words of comfort",
          "Closing words and invitation to reception",
          "Postlude or recessional",
        ],
        paragraphs: [
          "This sequence works because it welcomes people, establishes the tone, tells the story of the life, creates room for response, and closes with clear direction. A 45- to 60-minute service often includes two readings, two or three tributes, and one musical reflection.",
        ],
      },
      {
        id: "traditional",
        heading: "Traditional funeral template",
        example: {
          label: "Adaptable sample order",
          text: [
            "Processional • Opening prayer • Hymn • Scripture reading • Obituary • Eulogy • Musical selection • Sermon or homily • Commendation • Closing prayer • Recessional",
          ],
        },
        paragraphs: [
          "Use the terminology preferred by the faith community leading the service. Some traditions place the eulogy, communion, incense, or final commendation in a specific order. The program should reflect the confirmed liturgy rather than a generic online template.",
        ],
      },
      {
        id: "celebration",
        heading: "Celebration-of-life template",
        example: {
          label: "Adaptable sample order",
          text: [
            "Doors open with a favorite playlist • Welcome • Photo montage • The story of Avery's life • Memories from family • Open sharing • Favorite song • Closing toast • Reception",
          ],
        },
        paragraphs: [
          "A celebration of life can be less formal, but it still benefits from a clear beginning and ending. If guests may speak spontaneously, set a time limit and choose a facilitator who can gently guide transitions.",
        ],
        note: "Avery and all details in this sample are fictional.",
      },
      {
        id: "timing",
        heading: "Plan timing before you finalize the program",
        paragraphs: [
          "Readings usually take two to four minutes. Prepared tributes often take five to seven. Music can take three to five minutes per selection, while a photo montage may run six to ten. Add transition time, particularly if speakers approach from the audience.",
          "Ask every speaker to send their final title and preferred name by a firm deadline. If the order changes after printing, the service leader can announce the adjustment; the gathering does not need to pause while programs are corrected.",
        ],
      },
      {
        id: "format",
        heading: "How to format the printed order",
        bullets: [
          "Use the heading “Order of Service” or “Celebration of Life.”",
          "List items in sequence with short, parallel labels.",
          "Add participant names only after spelling and roles are confirmed.",
          "Print full song lyrics or readings only when permission and space allow.",
          "Keep production notes, cues, and private timing instructions on a separate leader copy.",
        ],
      },
    ],
    related: ["what-to-include-in-a-funeral-program", "how-to-print-a-funeral-program", "celebration-of-life-program-examples"],
    cta: {
      title: "Create a coordinated service program",
      copy: "Build an editable, print-ready program with the obituary, order of service, and matching memorial pieces in one guided flow.",
      href: "/funeral-program-maker",
      label: "Make a funeral program",
    },
  },
  {
    slug: "what-to-include-in-a-funeral-program",
    title: "What to Include in a Funeral Program",
    shortTitle: "What to include in a funeral program",
    description:
      "Use this practical checklist to decide what belongs in a funeral program, from the cover and order of service to acknowledgments.",
    eyebrow: "Funeral program checklist",
    readTime: "8 minute read",
    intro: [
      "A funeral program helps guests recognize the person being honored and understand what will happen during the service. It can also become a keepsake, but it does not have to contain every photograph, memory, or family name.",
      "Begin with the information guests need. Add personal material only after the service details are confirmed and there is enough room to keep the text readable.",
    ],
    sections: [
      {
        id: "cover",
        heading: "The cover: identity and essential service details",
        bullets: [
          "Full name and, if meaningful, a familiar name",
          "Birth and death years or full dates",
          "A clear, high-resolution photograph",
          "Service date, time, venue, and city",
          "A short title such as “In Loving Memory” or “A Celebration of Life”",
        ],
        paragraphs: [
          "Choose one strong image rather than a crowded collage for the cover. Make sure the name remains the most prominent text and that the service information can be read without unfolding the program.",
        ],
      },
      {
        id: "inside",
        heading: "Inside: the order, participants, and shared words",
        paragraphs: [
          "The central spread usually contains the order of service. Depending on the gathering, it may also include names of speakers, celebrants, musicians, pallbearers, or honorary pallbearers.",
        ],
        bullets: [
          "Order of service in the final confirmed sequence",
          "Titles and authors of readings, poems, and music",
          "Names and roles of participants",
          "Congregational responses, prayers, or lyrics guests will use",
          "A brief obituary or life reflection",
        ],
        note: "Confirm whether copyrighted poems, lyrics, and readings may be reproduced. Naming a work and author is often safer than printing it in full.",
      },
      {
        id: "back",
        heading: "Back page: thanks and next steps",
        paragraphs: [
          "The back page is a natural place for a family acknowledgment, reception invitation, donation information, or a final quotation. Keep logistics specific: name the reception location and whether it begins immediately after the service.",
        ],
        example: {
          label: "Fictional wording example",
          text: [
            "The family of Ruth Amari is grateful for your presence, messages, and many acts of care. Please join us in the garden room immediately following the service to share refreshments and memories.",
          ],
        },
      },
      {
        id: "optional",
        heading: "Optional personal touches",
        bullets: [
          "A short timeline of meaningful places or milestones",
          "One or two additional photographs with brief captions",
          "A recipe, saying, song title, or tradition associated with the person",
          "A QR code linking to a memorial page, only if that page is intended for invited guests",
          "Instructions for memorial donations or a family-chosen act of remembrance",
        ],
        paragraphs: [
          "Personal touches are strongest when they support the story rather than fill space. A single handwritten phrase or familiar recipe title can carry more meaning than a page of generic quotations.",
        ],
      },
      {
        id: "omit",
        heading: "What to leave out",
        paragraphs: [
          "Avoid unconfirmed service details, private contact information, low-resolution images, and text too small to read. You can also omit sensitive family relationships or cause-of-death information. A program is a public handout; include only what the family is comfortable sharing beyond the room.",
        ],
      },
    ],
    related: ["funeral-program-order-of-service", "how-to-print-a-funeral-program", "memorial-card-wording"],
    cta: {
      title: "Keep every program detail together",
      copy: "Use a gentle guided process to organize photos, wording, service details, and an editable order of service.",
      href: "/funeral-program-maker",
      label: "Build your program",
    },
  },
  {
    slug: "how-to-print-a-funeral-program",
    title: "How to Print a Funeral Program Without Last-Minute Surprises",
    shortTitle: "How to print a funeral program",
    description:
      "Prepare, proof, and print a funeral program at home or through a local printer with practical guidance on paper, folds, and quantities.",
    eyebrow: "Printing guide",
    readTime: "9 minute read",
    intro: [
      "Printing goes smoothly when three decisions are made early: finished size, paper, and who will produce it. Before ordering a large quantity, print one complete copy at actual size, fold it, and ask someone else to proof it.",
      "This guide focuses on a common letter-size sheet folded in half to create a four-page program, but the same checks apply to trifold and booklet formats.",
    ],
    sections: [
      {
        id: "prepare",
        heading: "1. Prepare a print-ready file",
        bullets: [
          "Export as a high-quality PDF with fonts embedded.",
          "Use images near 300 pixels per inch at their printed size.",
          "Keep important text at least 0.25 inch from folds and trimmed edges.",
          "If color reaches the edge, ask the printer for its bleed and crop-mark requirements.",
          "Confirm page order by printing and folding a single test copy.",
        ],
        paragraphs: [
          "A PDF preserves the intended type, spacing, and image placement more reliably than an editable document. Do not assume the screen preview is enough: home and commercial printers can shift margins or scale files unless settings are checked.",
        ],
      },
      {
        id: "paper",
        heading: "2. Choose paper that folds cleanly",
        paragraphs: [
          "For a folded program, a smooth text or light cover stock often feels substantial without cracking. Home printers vary, so check the maximum supported weight in the printer manual. Very heavy card may jam or split along the fold.",
          "Bright white produces crisp photographs; warm white or natural stock creates a softer appearance. Matte or uncoated paper is easier to read under varied lighting and can be signed by guests.",
        ],
      },
      {
        id: "home",
        heading: "3. Printing at home",
        bullets: [
          "Select “actual size” or 100% scale, not “fit to page,” unless the design requires it.",
          "Choose the correct paper type and highest appropriate quality.",
          "For duplex printing, test whether the printer uses long-edge or short-edge binding.",
          "Print in small batches and let ink dry before stacking or folding.",
          "Use a scoring board or bone folder for a clean center fold.",
        ],
        note: "If the second side appears upside down, change the duplex binding edge and print another single test—not the full batch.",
      },
      {
        id: "professional",
        heading: "4. Working with a local or online printer",
        paragraphs: [
          "Tell the printer the finished size, page count, quantity, color requirements, paper preference, fold, and deadline. Ask whether the quoted service includes scoring, folding, and a physical or digital proof.",
          "A local shop can be especially helpful on a short timeline because staff can inspect image resolution and folding before the run. Request one assembled proof whenever timing permits, then approve it only after names, dates, page order, and color have been checked. If a stationery quote is hard to read, the funeral program cost guide separates design cost from printing cost without inventing retail prices.",
        ],
      },
      {
        id: "quantity",
        heading: "5. Estimate quantity and complete a final proof",
        paragraphs: [
          "Start with the expected attendance, then add copies for officiants, speakers, musicians, family members who cannot attend, and keepsakes. A buffer of roughly 10 to 15 percent is practical when attendance is uncertain.",
        ],
        bullets: [
          "Verify every name, date, time, address, and phone number.",
          "Check that no text is clipped and photographs are clear.",
          "Confirm inside pages are right-side up after folding.",
          "Read the printed copy in ordinary room light.",
          "Store finished programs flat and transport them in a rigid box.",
        ],
      },
    ],
    related: ["what-to-include-in-a-funeral-program", "funeral-program-order-of-service", "celebration-of-life-program-examples"],
    cta: {
      title: "Begin with a print-ready design",
      copy: "TributeReady creates coordinated memorial files designed to move from review to printing with less rework.",
      href: "/funeral-program-maker",
      label: "Create a print-ready program",
    },
  },
  {
    slug: "celebration-of-life-program-examples",
    title: "Celebration-of-Life Program Examples and Ideas",
    shortTitle: "Celebration-of-life program examples",
    description:
      "Explore original celebration-of-life program examples for garden, community, and intimate gatherings, plus ideas for personal details.",
    eyebrow: "Celebration-of-life examples",
    readTime: "9 minute read",
    intro: [
      "A celebration-of-life program can be relaxed, colorful, and highly personal while still giving guests a clear sense of what comes next. The format should match the gathering: a short card may suit an open-house reception, while a folded program helps with readings, speakers, and music.",
      "The sample names, people, venues, and events in this guide are entirely fictional.",
    ],
    sections: [
      {
        id: "garden",
        heading: "Example: an informal garden gathering",
        example: {
          label: "Fictional program copy",
          text: [
            "Celebrating June Park • 1948–2026",
            "Welcome in the rose garden • “Here Comes the Sun” • Memories from Mina and David • Guests are invited to share a short story • Planting of June's maple • Lemon cake and tea",
            "Please take a packet of calendula seeds and plant a little brightness in June's memory.",
          ],
        },
        paragraphs: [
          "Why it works: the order is brief enough for an outdoor gathering, and the seed-packet invitation extends a familiar part of June's life beyond the event.",
        ],
      },
      {
        id: "community",
        heading: "Example: a community-centered celebration",
        example: {
          label: "Fictional program copy",
          text: [
            "Remembering Malcolm Reed • Coach, neighbor, friend",
            "Opening welcome • Team photo montage • Reflections from former players • “Lean on Me” performed by the Eastside Youth Choir • Family memories • Community scholarship announcement • Closing whistle and reception",
            "Malcolm believed every young person deserved someone in the stands. Thank you for standing with us today.",
          ],
        },
        paragraphs: [
          "Why it works: each element supports one central theme—Malcolm's care for young people. The program feels cohesive because it does not try to represent every part of his life equally.",
        ],
      },
      {
        id: "intimate",
        heading: "Example: a small family remembrance",
        example: {
          label: "Fictional program copy",
          text: [
            "For Eli • An evening of stories and supper",
            "Candles and gathering music • Welcome from Sam • Reading from Mary Oliver • Around-the-table memories • Eli's Sunday supper • A final toast",
            "There is no formal ending. Stay, eat, and tell another story.",
          ],
        },
        paragraphs: [
          "Why it works: the wording sets expectations for a gathering that is intimate rather than ceremonial. The final line gives guests permission to remain and connect.",
        ],
      },
      {
        id: "personalize",
        heading: "Ways to make the program feel personal",
        bullets: [
          "Build the visual palette from a garden, landscape, garment, or room the person loved.",
          "Use short captions to explain why a photograph or object matters.",
          "Name songs and readings that genuinely belonged to the person's life.",
          "Offer a simple participatory act: write a note, tie a ribbon, plant a seed, or add a song to a shared list.",
          "Carry one recurring detail—such as maps, recipes, birds, or handwritten notes—through the cover, order, and closing.",
        ],
      },
      {
        id: "clarity",
        heading: "Keep creative programs easy to use",
        paragraphs: [
          "Even an unconventional event needs practical clarity. Include the person's full name, date and location, order of major moments, and reception or accessibility information. Use readable type and strong contrast; a keepsake should not make guests work to understand the schedule.",
          "If plans are fluid, print only the broad sequence. A host can introduce individual speakers and explain changes without making the program feel incorrect.",
        ],
      },
    ],
    related: ["funeral-program-order-of-service", "what-to-include-in-a-funeral-program", "memorial-card-wording"],
    cta: {
      title: "Shape a program around their life",
      copy: "Create a coordinated celebration-of-life program, memorial cards, thank-you cards, and a private family page.",
      href: "/celebration-of-life-program",
      label: "Create a celebration program",
    },
  },
  {
    slug: "memorial-card-wording",
    title: "Memorial Card Wording: Meaningful Examples and Templates",
    shortTitle: "Memorial card wording",
    description:
      "Find concise, heartfelt memorial card wording for traditional, religious, and celebration-of-life keepsakes, with fictional examples.",
    eyebrow: "Wording guide",
    readTime: "8 minute read",
    intro: [
      "A memorial card has very little space, so its wording should do one thing well. It might offer a blessing, preserve a familiar phrase, name a quality, or give guests a small way to carry the person's memory forward.",
      "The best text sounds connected to the person. Start with a phrase your family already uses, then edit until it can be read comfortably at a clear type size.",
    ],
    sections: [
      {
        id: "essentials",
        heading: "What usually appears on a memorial card",
        bullets: [
          "Full name and familiar name, if desired",
          "Birth and death dates or years",
          "One clear photograph",
          "A short poem, prayer, quotation, or original remembrance",
          "Optional service date or memorial donation information",
        ],
        paragraphs: [
          "Not every item is required. Some families choose only a name, dates, portrait, and one sentence. If the card will be kept long after the service, timeless wording is often more useful than event logistics.",
        ],
      },
      {
        id: "short",
        heading: "Short memorial card messages",
        example: {
          label: "Original fictional examples",
          text: [
            "Your steady love remains in every life you shaped.",
            "May we remember Nina whenever the windows are open and music fills the room.",
            "Loved deeply. Missed daily. Carried with us always.",
            "In memory of Thomas Bell, whose kindness made ordinary days feel generous.",
          ],
        },
        note: "Nina, Thomas Bell, and all associated details are fictional.",
      },
      {
        id: "religious",
        heading: "Faith-centered wording",
        paragraphs: [
          "Use language consistent with the person's beliefs and the family's tradition. A brief line from scripture or a familiar prayer may be more meaningful than a long passage. Verify the translation, citation, and reproduction permissions before printing.",
        ],
        example: {
          label: "Original wording examples",
          text: [
            "Held in God's love, now and always.",
            "May perpetual light shine upon her, and may the love she gave continue through us.",
            "We give thanks for his life, entrust him to eternal peace, and carry his lessons forward.",
          ],
        },
      },
      {
        id: "celebration",
        heading: "Celebration-of-life wording",
        example: {
          label: "Original wording examples",
          text: [
            "Tell the good story. Order dessert. Stay for one more song.",
            "For Lila, joy was something to practice. Let us keep practicing.",
            "Plant something, welcome someone, and laugh without holding back.",
          ],
        },
        paragraphs: [
          "A favorite saying can work beautifully if guests will recognize it. If the phrase needs explanation, add a short second line rather than squeezing a full story onto the card.",
        ],
        note: "Lila is a fictional name used for illustration.",
      },
      {
        id: "write-own",
        heading: "A simple formula for writing your own",
        paragraphs: [
          "Try combining memory, quality, and continuation: “We remember [specific detail], give thanks for [quality], and will carry it forward by [small action].” Then remove the labels and make the sentence natural.",
        ],
        example: {
          label: "Fictional example",
          text: [
            "We remember Ada's patient hands and generous table. We will carry her welcome forward by always making room for one more.",
          ],
        },
      },
    ],
    related: ["funeral-thank-you-wording", "celebration-of-life-program-examples", "obituary-examples"],
    cta: {
      title: "Coordinate every word and keepsake",
      copy: "Create memorial cards that share the same story and visual style as the service program and obituary.",
      href: "/celebration-of-life-program",
      label: "Create memorial keepsakes",
    },
  },
  {
    slug: "funeral-thank-you-wording",
    title: "Funeral Thank-You Wording for Cards and Messages",
    shortTitle: "Funeral thank-you wording",
    description:
      "Write sincere funeral thank-you cards with adaptable wording for flowers, meals, donations, attendance, officiants, and pallbearers.",
    eyebrow: "Thank-you wording guide",
    readTime: "8 minute read",
    intro: [
      "A funeral thank-you does not need to be long or perfectly composed. Its purpose is simply to acknowledge a specific kindness and say what it meant during a difficult time.",
      "It is acceptable to send notes gradually, divide the list among relatives, or use a printed message with one handwritten sentence. There is no universal deadline; thoughtful and manageable is better than rushed.",
    ],
    sections: [
      {
        id: "formula",
        heading: "A dependable three-part structure",
        bullets: [
          "Name the gift, action, or presence you are acknowledging.",
          "Say how it helped or what it meant to the family.",
          "Close with warm, simple thanks.",
        ],
        example: {
          label: "Adaptable template",
          text: [
            "Thank you for [specific kindness]. It brought us [comfort/help/encouragement] as we remembered [name]. We are deeply grateful for your thoughtfulness.",
          ],
        },
      },
      {
        id: "flowers-food",
        heading: "For flowers, food, and practical help",
        example: {
          label: "Fictional wording examples",
          text: [
            "Thank you for the beautiful white tulips you sent in memory of Grace. They brought such softness to the service, and we were touched by your care.",
            "The soup and bread you brought made a difficult week gentler. Thank you for noticing what we needed before we knew how to ask.",
            "Thank you for caring for the children during the visitation. Knowing they were safe and comfortable gave us room to be fully present.",
          ],
        },
        note: "Grace and all circumstances in these samples are fictional.",
      },
      {
        id: "donations",
        heading: "For memorial donations",
        example: {
          label: "Fictional wording example",
          text: [
            "Thank you for your gift to the Northside Literacy Project in Samuel's memory. Reading with young people mattered greatly to him, and your generosity is a meaningful way to honor that part of his life.",
          ],
        },
        paragraphs: [
          "Mention the organization when appropriate, but not the amount. If the charity notified the family without sharing details, thank the giver for the memorial gift rather than guessing what was donated.",
        ],
      },
      {
        id: "service",
        heading: "For an officiant, musician, speaker, or pallbearer",
        example: {
          label: "Original wording examples",
          text: [
            "Your words captured Dad's quiet humor and made everyone in the room feel included. Thank you for preparing such a personal tribute.",
            "Thank you for playing Mae's favorite hymn with such care. Hearing it in that moment gave our family real comfort.",
            "We are grateful that you served as a pallbearer for Anthony. Your steady presence honored him and supported all of us.",
          ],
        },
        note: "Mae, Anthony, and the people described are fictional.",
      },
      {
        id: "attendance",
        heading: "For attendance, messages, or general support",
        example: {
          label: "Adaptable wording examples",
          text: [
            "Thank you for being with us as we celebrated Leona's life. Your presence and the story you shared meant more than we can say.",
            "Your note arrived on a hard day and reminded us how widely Omar was loved. Thank you for remembering him with us.",
            "Our family is deeply grateful for the calls, visits, meals, and messages we received. Your kindness has carried us through these first weeks.",
          ],
        },
        note: "Leona and Omar are fictional names.",
      },
      {
        id: "signing",
        heading: "How to close and sign the note",
        paragraphs: [
          "Closings such as “With gratitude,” “With heartfelt thanks,” or “Warmly” are all appropriate. Sign from the person or group who received the kindness: “Mara and family,” “The Chen family,” or individual names.",
          "If writing each note feels overwhelming, choose one printed family message and add the recipient's name plus a short handwritten detail. Sincerity is not measured by length.",
        ],
      },
    ],
    related: ["memorial-card-wording", "how-to-write-an-obituary", "what-to-include-in-a-funeral-program"],
    cta: {
      title: "Create coordinated thank-you cards",
      copy: "Carry the same thoughtful wording and design from the memorial program into cards you can send afterward.",
      href: "/celebration-of-life-program",
      label: "Create thank-you cards",
    },
  },
] as const satisfies readonly ResourceGuide[];

export type ResourceSlug = (typeof resourceGuides)[number]["slug"];

export function getResource(slug: string): ResourceGuide | undefined {
  return resourceGuides.find((resource) => resource.slug === slug);
}

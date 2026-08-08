export type ServiceStep = {
  name: string;
  detail: string;
  minutes?: string;
};

export type OrderOfServiceTemplate = {
  slug: string;
  title: string;
  shortTitle: string;
  label: string;
  description: string;
  intro: string[];
  duration: string;
  steps: ServiceStep[];
  wording: {
    heading: string;
    lines: { label: string; text: string }[];
  };
  panels: string[];
  notes: string[];
  faqs: { question: string; answer: string }[];
  related: string[];
};

export const orderOfServiceTemplates: OrderOfServiceTemplate[] = [
  {
    slug: "catholic-funeral-mass",
    label: "Catholic",
    title: "Catholic Funeral Mass Order of Service Template",
    shortTitle: "Catholic funeral Mass",
    description:
      "A free Catholic funeral Mass order of service template with the standard sequence, sample program wording, timing, and guidance on readings and music.",
    duration: "Typically 60 to 75 minutes with Mass; 30 to 40 minutes without",
    intro: [
      "A Catholic funeral Mass follows a fixed liturgical structure, which is good news when you are printing a program: the sequence is known in advance and your parish will confirm it. What varies is the selection of readings, psalm, hymns, and who carries out each role.",
      "The outline below reflects the Order of Christian Funerals as it is commonly celebrated in United States parishes. Bring it to your parish office or funeral director and confirm the specific readings and music before printing anything.",
    ],
    steps: [
      {
        name: "Prelude music",
        detail:
          "Instrumental or choral music as people are seated. Often begins 15 to 20 minutes before the stated start time.",
        minutes: "15 min before",
      },
      {
        name: "Reception of the body and greeting",
        detail:
          "The priest greets the casket or urn at the church door, sprinkles it with holy water, and the pall is placed by family members.",
      },
      {
        name: "Entrance procession and hymn",
        detail:
          "The casket is brought forward accompanied by the entrance hymn. Common choices include \"Song of Farewell,\" \"Be Not Afraid,\" and \"Amazing Grace.\"",
      },
      {
        name: "Opening prayer",
        detail: "The collect, prayed by the priest.",
      },
      {
        name: "First reading",
        detail:
          "Usually from the Old Testament, or from Acts or Revelation during the Easter season. Read by a family member or friend.",
      },
      {
        name: "Responsorial psalm",
        detail:
          "Sung or recited. Psalm 23 (\"The Lord is my shepherd\") and Psalm 27 are the most frequently chosen.",
      },
      {
        name: "Second reading",
        detail:
          "From the New Testament letters. Romans 8 and 1 Corinthians 15 are common.",
      },
      {
        name: "Gospel acclamation and Gospel",
        detail:
          "Proclaimed by the priest or deacon. The congregation stands.",
      },
      {
        name: "Homily",
        detail: "A short reflection by the priest, not a eulogy.",
        minutes: "5 to 10 min",
      },
      {
        name: "General intercessions",
        detail:
          "Prayers of the faithful, often read by a family member, with the congregation responding.",
      },
      {
        name: "Liturgy of the Eucharist",
        detail:
          "Presentation of the gifts, Eucharistic prayer, the Lord's Prayer, sign of peace, and Communion. Communion hymns are sung during distribution.",
        minutes: "20 to 25 min",
      },
      {
        name: "Words of remembrance",
        detail:
          "One brief remembrance by a family member, if the parish permits it. Many parishes limit this to a single speaker and about three to five minutes, and some place it at the vigil instead.",
        minutes: "3 to 5 min",
      },
      {
        name: "Final commendation and song of farewell",
        detail:
          "Incensing and sprinkling of the casket, with the congregation singing the song of farewell.",
      },
      {
        name: "Recessional",
        detail:
          "The casket is accompanied out, followed by the family. The recessional hymn is often the most personal music choice of the service.",
      },
      {
        name: "Rite of committal",
        detail:
          "At the cemetery or columbarium, usually brief, with prayers and a final blessing.",
        minutes: "10 to 15 min",
      },
    ],
    wording: {
      heading: "Program wording you can copy",
      lines: [
        {
          label: "Cover",
          text: "In Loving Memory of\n[Full Name]\n[Birth date] – [Date of death]\n\nFuneral Mass\n[Parish name]\n[City, State]\n[Date] at [time]",
        },
        {
          label: "Celebrant line",
          text: "Celebrant: [Rev. Name]\nDeacon: [Name]\nMusic: [Organist and cantor names]",
        },
        {
          label: "Reading attribution",
          text: "First Reading — [Citation]\nread by [Name], [relationship]",
        },
        {
          label: "Pallbearer listing",
          text: "Pallbearers\n[Name] · [Name] · [Name]\n[Name] · [Name] · [Name]\n\nHonorary Pallbearers\n[Names]",
        },
        {
          label: "Reception and thanks",
          text: "The family invites you to join them for a luncheon in [hall name] immediately following the committal.\n\nThe family of [Name] wishes to thank you for your prayers and kindness during this time.",
        },
      ],
    },
    panels: [
      "Front cover: photograph, full name, birth and death dates, parish, and service date",
      "Inside left: the order of the Mass with readings, psalm, and hymn titles",
      "Inside right: obituary or life summary, and the family's acknowledgement",
      "Back cover: pallbearers, reception details, donation information, and a closing prayer",
    ],
    notes: [
      "Ask the parish whether eulogies are permitted at the Mass. Many restrict remembrances to the vigil or to a single short speaker before the final commendation.",
      "Hymn selections usually need approval from the parish music director. Secular songs are generally not permitted inside the Mass but are common at the vigil or reception.",
      "Confirm whether the Mass is a Funeral Mass or a Memorial Mass. A Memorial Mass takes place without the body present and omits the reception of the body.",
      "Print the readings by citation rather than in full unless your parish permits reproducing the text, which may involve copyright permissions.",
    ],
    faqs: [
      {
        question: "How long is a Catholic funeral Mass?",
        answer:
          "A full funeral Mass generally runs 60 to 75 minutes. A funeral liturgy outside of Mass, sometimes called a funeral service without Communion, usually runs 30 to 40 minutes. Add 10 to 15 minutes for the committal at the cemetery, plus travel time between locations.",
      },
      {
        question: "Can we have a eulogy at a Catholic funeral?",
        answer:
          "Practice varies by parish and diocese. Many allow one brief remembrance of three to five minutes before the final commendation, and many prefer that longer tributes take place at the vigil or the reception. Ask the parish directly, and ask early, because it affects your program layout.",
      },
      {
        question: "What readings are usually chosen?",
        answer:
          "Common selections include Wisdom 3:1-9 or Isaiah 25 for the first reading, Psalm 23 or Psalm 27 for the responsorial psalm, Romans 8 or 1 Corinthians 15 for the second reading, and John 14:1-6 or Matthew 11:25-30 for the Gospel. Your parish will have a booklet of approved options for families to choose from.",
      },
    ],
    related: ["baptist-funeral", "celebration-of-life", "graveside-service"],
  },
  {
    slug: "baptist-funeral",
    label: "Baptist",
    title: "Baptist Funeral Order of Service Template",
    shortTitle: "Baptist funeral service",
    description:
      "A free Baptist funeral order of service template with the usual sequence, hymn and scripture suggestions, sample program wording, and timing.",
    duration: "Typically 45 to 60 minutes",
    intro: [
      "Baptist funeral services are congregational and comparatively flexible. There is no fixed liturgy, so the pastor and family build the order together, and the shape varies noticeably between churches and regions.",
      "What is consistent is the emphasis: scripture, congregational singing, a message from the pastor, and time for the family to hear the person spoken of by name. The outline below is the arrangement most Baptist churches use, and it is straightforward to adapt.",
    ],
    steps: [
      {
        name: "Prelude",
        detail:
          "Piano or organ music as the congregation gathers, often hymns the family selected.",
        minutes: "15 min before",
      },
      {
        name: "Processional",
        detail:
          "The family is seated, usually after the congregation. Some churches seat the family before the service instead.",
      },
      {
        name: "Opening words and prayer",
        detail:
          "The pastor welcomes those gathered and offers the invocation.",
      },
      {
        name: "Congregational hymn",
        detail:
          "\"Amazing Grace,\" \"How Great Thou Art,\" and \"It Is Well with My Soul\" are the most frequently chosen.",
      },
      {
        name: "Scripture reading",
        detail:
          "Psalm 23, Psalm 121, John 14:1-6, and Revelation 21:1-4 are common. Often read by an associate pastor or family member.",
      },
      {
        name: "Prayer of comfort",
        detail: "A pastoral prayer for the family and those grieving.",
      },
      {
        name: "Obituary reading",
        detail:
          "The obituary is read aloud or, in many churches, read silently by the congregation while music plays.",
        minutes: "2 to 3 min",
      },
      {
        name: "Special music or solo",
        detail:
          "A soloist, family member, or church musician performs a hymn or gospel song the family chose.",
      },
      {
        name: "Words of remembrance",
        detail:
          "One to three family members or friends speak. Most churches ask each speaker to keep to three to five minutes.",
        minutes: "10 to 15 min",
      },
      {
        name: "Eulogy and message",
        detail:
          "The pastor's message, which typically combines remembrance with a scripture-based sermon.",
        minutes: "10 to 20 min",
      },
      {
        name: "Closing hymn",
        detail: "A final congregational hymn chosen by the family.",
      },
      {
        name: "Benediction",
        detail: "Closing prayer and blessing.",
      },
      {
        name: "Recessional and viewing",
        detail:
          "Pallbearers accompany the casket out. Some churches include a final viewing before the recessional; the funeral director will guide this.",
      },
      {
        name: "Committal at graveside",
        detail:
          "Brief scripture, prayer, and committal words at the cemetery.",
        minutes: "10 to 15 min",
      },
    ],
    wording: {
      heading: "Program wording you can copy",
      lines: [
        {
          label: "Cover",
          text: "Celebrating the Life of\n[Full Name]\n\nSunrise [Birth date] · Sunset [Date of death]\n\n[Church name]\n[City, State]\n[Date] · [Time]\n[Rev. Name], Officiating",
        },
        {
          label: "Order of service heading",
          text: "Order of Service\n\nProcessional\nInvocation ....................... [Rev. Name]\nHymn of Comfort ........... \"Amazing Grace\"\nScripture ....................... Psalm 23, read by [Name]\nPrayer ............................ [Name]\nObituary ........................ Read silently\nSelection ....................... [Song title], [Performer]\nReflections .................... Two minutes, please\nEulogy ........................... [Rev. Name]\nBenediction\nRecessional",
        },
        {
          label: "Reflections note",
          text: "Family and friends are invited to share brief reflections. In consideration of time, we ask that remarks be limited to two minutes.",
        },
        {
          label: "Acknowledgement",
          text: "Acknowledgement\n\nThe family of [Name] gratefully acknowledges the many acts of kindness, the prayers, the calls, and the food shared with us during this time. Your love has carried us. May God bless each of you.",
        },
        {
          label: "Repast",
          text: "The family invites you to join them for the repast in the [fellowship hall name] immediately following the interment.",
        },
      ],
    },
    panels: [
      "Front cover: photograph, name, dates, church, service date and time, and the officiating pastor",
      "Inside left: the order of service with names beside each part",
      "Inside right: obituary, followed by the survivor listing",
      "Back cover: pallbearers, acknowledgement, repast details, and often a poem or favorite scripture",
    ],
    notes: [
      "Ask the church whether reflections from the floor are open or invitation-only. Open microphones lengthen services unpredictably, and a printed two-minute request in the program is the most effective way to manage it.",
      "\"Sunrise\" and \"Sunset\" for birth and death dates is a widely used convention in many Baptist congregations and reads well on a cover.",
      "If the obituary will be read silently, print it in full inside the program, because that becomes the only place people encounter it.",
      "Confirm hymn selections with the church musician; some hymns have several tunes and arrangements.",
    ],
    faqs: [
      {
        question: "How long is a Baptist funeral service?",
        answer:
          "Most run 45 to 60 minutes, though services with several speakers and multiple musical selections often reach 90 minutes. The most reliable way to control length is to limit the number of people speaking from the floor and to print the time request in the program.",
      },
      {
        question: "What is a repast?",
        answer:
          "A repast is the meal shared after the burial, usually hosted in the church fellowship hall and often organized by a church ministry rather than by the family. Its location and timing are normally printed on the back panel of the program.",
      },
      {
        question: "Who reads the obituary?",
        answer:
          "Practice varies. In many churches the obituary is read silently by the congregation while a musician plays, which keeps the service moving and spares a family member from reading aloud. In others it is read by a pastor, church clerk, or family friend.",
      },
    ],
    related: [
      "catholic-funeral-mass",
      "celebration-of-life",
      "non-denominational",
    ],
  },
  {
    slug: "celebration-of-life",
    label: "Celebration of life",
    title: "Celebration of Life Order of Service Template",
    shortTitle: "Celebration of life",
    description:
      "A free celebration of life order of service template with a flexible sequence, sample wording, timing, and ideas for open sharing and music.",
    intro: [
      "A celebration of life has no required structure, which is exactly what makes it hard to plan. Without a liturgy to lean on, families have to decide the order, the length, and who speaks, usually within a few days.",
      "The outline below is the arrangement that works most reliably: a clear beginning, a defined middle where people speak, and an unmistakable ending. The single most important design decision is whether sharing is open to everyone or by invitation, because that determines whether you can predict the length.",
    ],
    duration: "Typically 45 to 75 minutes, plus a reception",
    steps: [
      {
        name: "Gathering music and photographs",
        detail:
          "A photo slideshow or display table while guests arrive. Music the person actually liked, not funeral music, sets the tone immediately.",
        minutes: "20 to 30 min before",
      },
      {
        name: "Welcome",
        detail:
          "A host, celebrant, or family friend opens. This person should not be immediate family; grief makes hosting very difficult.",
        minutes: "2 min",
      },
      {
        name: "Opening reading or poem",
        detail:
          "A short reading that sets the tone. Public-domain poems avoid permissions issues if you plan to print the text.",
      },
      {
        name: "Life story",
        detail:
          "One person walks through the life in five to eight minutes: where they came from, what they did, who they loved.",
        minutes: "5 to 8 min",
      },
      {
        name: "Music",
        detail:
          "A recorded song, live performance, or a piece the person played. A pause after the life story gives the room a moment.",
      },
      {
        name: "Tributes",
        detail:
          "Two to four invited speakers, each briefed on a time limit. Naming them in the program keeps everyone honest about length.",
        minutes: "12 to 20 min",
      },
      {
        name: "Open sharing",
        detail:
          "An invitation for anyone to speak, optionally with a stated limit. Have the host ready to close it gracefully after a set time.",
        minutes: "10 to 15 min",
      },
      {
        name: "Slideshow or video",
        detail:
          "Often the emotional center of the gathering. Keep it under six minutes; longer runs lose the room.",
        minutes: "4 to 6 min",
      },
      {
        name: "Closing words",
        detail:
          "The host returns, thanks everyone, names the family's gratitude, and gives the reception details clearly.",
        minutes: "3 min",
      },
      {
        name: "Closing music and reception",
        detail:
          "An upbeat closing song is common and effective. Announce food and drink specifically so people know it is fine to stay.",
      },
    ],
    wording: {
      heading: "Program wording you can copy",
      lines: [
        {
          label: "Cover",
          text: "A Celebration of the Life of\n[Full Name]\n[Birth year] – [Death year]\n\n[Venue]\n[City, State]\n[Date] at [time]",
        },
        {
          label: "Welcome text",
          text: "Thank you for being here.\n\nToday is not only about how we lost [Name]. It is about how much of [him/her/them] we still carry. Please share a story, stay for a meal, and take something of [him/her/them] home with you.",
        },
        {
          label: "Order of gathering",
          text: "Welcome ........................ [Name]\nReading ......................... [Title], read by [Name]\n[Name]'s Story .............. [Name]\nMusic ............................. [Song title]\nTributes ......................... [Name], [Name], [Name]\nOpen Sharing ................ All are welcome\nSlideshow\nClosing Words .............. [Name]",
        },
        {
          label: "Open sharing invitation",
          text: "If you would like to share a memory, please come forward when invited. We ask that you keep to about two minutes so that everyone who wishes to speak is able to.",
        },
        {
          label: "Reception and donations",
          text: "Please join us afterward at [location] for food and continued stories.\n\nIn place of flowers, the family asks that you consider a gift to [organization], which meant a great deal to [Name].",
        },
      ],
    },
    panels: [
      "Front cover: a photograph that looks like the person as people knew them, name, and years",
      "Inside left: the order of the gathering, with speakers named",
      "Inside right: the life story or a short tribute, often written in a warmer voice than a newspaper obituary",
      "Back cover: reception details, donation information, a favorite quotation, and the family's thanks",
    ],
    notes: [
      "Choose whether sharing is open or invitation-only before you print. It is the only structural decision that meaningfully changes the length of the gathering.",
      "Brief every named speaker with an explicit time limit. \"Three minutes\" is heard; \"keep it short\" is not.",
      "If you are printing the text of a poem or song lyric, check whether it is in the public domain. Works published in the United States before 1930 generally are; most modern song lyrics are not.",
      "A QR code linking to a photo album or memorial page works well on the back panel and gives guests something to do afterward.",
    ],
    faqs: [
      {
        question: "How is a celebration of life different from a funeral?",
        answer:
          "A funeral usually takes place within days, follows a religious or established form, and often has the body present. A celebration of life can happen weeks or months later, is typically less formal, and is organized around remembering the person rather than around a rite. Many families hold both: a small committal, then a larger celebration later.",
      },
      {
        question: "Do we need a program for a celebration of life?",
        answer:
          "It is not required, but it does two useful things. It tells guests what will happen so nobody is anxious about when to speak or when it ends, and it becomes the keepsake people take home. A single folded sheet is enough.",
      },
      {
        question: "Should we allow open sharing?",
        answer:
          "Open sharing produces the moments families remember, and it also makes the length unpredictable. The common compromise is two to four invited speakers followed by a bounded open period, with the host prepared to close it warmly after a set time.",
      },
    ],
    related: ["non-denominational", "memorial-service", "baptist-funeral"],
  },
  {
    slug: "non-denominational",
    label: "Non-denominational",
    title: "Non-Denominational Funeral Order of Service Template",
    shortTitle: "Non-denominational service",
    description:
      "A free non-denominational funeral order of service template with a secular-friendly sequence, inclusive wording, timing, and program layout guidance.",
    duration: "Typically 30 to 45 minutes",
    intro: [
      "A non-denominational service has to work for a room that may include devout believers, people of other faiths, and people of none. The usual mistake is trying to satisfy everyone at once, which produces a service that sounds like nobody.",
      "The approach that works is honesty about the person combined with hospitality toward the room. Say what they believed, if they believed something. Invite prayer without requiring it. The outline below is built to do that.",
    ],
    steps: [
      {
        name: "Gathering music",
        detail:
          "Recorded or live music as guests are seated. Choose what the person listened to rather than what sounds funereal.",
        minutes: "15 min before",
      },
      {
        name: "Welcome and framing",
        detail:
          "The officiant explains what will happen and how long it will take. In a mixed room, saying this out loud reduces everyone's anxiety.",
        minutes: "2 min",
      },
      {
        name: "Opening reading",
        detail:
          "A poem, passage, or piece of writing that the person valued. Public-domain poetry is a safe choice for printing in the program.",
      },
      {
        name: "The life story",
        detail:
          "A chronological account delivered by the officiant or a family member, drawn from a conversation with the family.",
        minutes: "6 to 10 min",
      },
      {
        name: "Tributes",
        detail:
          "Two or three speakers, briefed on time. Naming them in the program signals that the list is set.",
        minutes: "10 to 15 min",
      },
      {
        name: "Music or silence",
        detail:
          "A recorded song, or a deliberate minute of silence introduced as an invitation: \"for prayer, reflection, or simply for remembering.\"",
      },
      {
        name: "Optional prayer",
        detail:
          "If included, introduce it as optional. \"Those who wish to pray are invited to join me\" allows everyone to remain comfortable.",
      },
      {
        name: "Closing words",
        detail:
          "A short close naming what the family is grateful for, followed by clear practical instructions.",
        minutes: "3 min",
      },
      {
        name: "Recessional and reception",
        detail:
          "Closing music, then the reception. State the location and whether food will be served.",
      },
      {
        name: "Committal",
        detail:
          "Held separately at the graveside or crematorium, often for family only, and typically brief.",
        minutes: "10 min",
      },
    ],
    wording: {
      heading: "Inclusive wording you can copy",
      lines: [
        {
          label: "Cover",
          text: "In Memory of\n[Full Name]\n[Birth date] – [Date of death]\n\n[Venue]\n[City, State]\n[Date] at [time]",
        },
        {
          label: "Welcome",
          text: "We are here because [Name] mattered to each of us in a different way. Whatever you believe about what comes next, you are welcome here, and your grief belongs in this room.",
        },
        {
          label: "Introducing a moment of silence",
          text: "Let us take a minute together. You may use it to pray, to reflect, or simply to think about [Name].",
        },
        {
          label: "Introducing an optional prayer",
          text: "Those who wish to pray are invited to join me. Others are welcome to sit quietly.",
        },
        {
          label: "Closing",
          text: "We will not stop missing [Name]. We are not meant to. But we can carry [him/her/them] the way [he/she/they] carried us, and we can start by looking after each other. Thank you for being here.",
        },
      ],
    },
    panels: [
      "Front cover: photograph, name, and dates, with no religious imagery unless the family wants it",
      "Inside left: the order of the service, with readings and speakers named",
      "Inside right: the life story or obituary",
      "Back cover: the family's thanks, reception details, and donation information",
    ],
    notes: [
      "Decide in advance whether any prayer will be included, and tell the officiant. A prayer inserted spontaneously into a secular service is the most common source of family friction afterward.",
      "If the person held a specific belief, saying so plainly is more respectful than neutralizing it. \"She was a lifelong Quaker\" is a fact about her, not an imposition on the room.",
      "Celebrants and humanist officiants are widely available and are trained specifically for mixed-belief services. Funeral homes usually keep a list.",
      "Give an explicit end time in the welcome. Guests relax noticeably when they know how long a service will run.",
    ],
    faqs: [
      {
        question: "Who officiates a non-denominational funeral?",
        answer:
          "A civil celebrant, humanist officiant, funeral director, or a family member can all lead the service. Funeral homes typically maintain a list of local celebrants. If a family member leads, give them a printed script, because reading from a page is far easier than improvising while grieving.",
      },
      {
        question: "Can we include religious elements?",
        answer:
          "Yes. Many non-denominational services include a psalm, a hymn, or a prayer because those things mattered to the person or to part of the family. Framing them as invitations rather than instructions keeps the whole room comfortable.",
      },
      {
        question: "How long should a non-denominational service be?",
        answer:
          "Thirty to forty-five minutes is typical and works well. Without a liturgy setting the pace, services that run past an hour tend to lose energy, and the closing loses its effect.",
      },
    ],
    related: ["celebration-of-life", "memorial-service", "graveside-service"],
  },
  {
    slug: "military-honors",
    label: "Military",
    title: "Military Funeral Honors Order of Service Template",
    shortTitle: "Military funeral honors",
    description:
      "A free order of service template for a funeral with military honors, covering the honors sequence, flag presentation wording, timing, and program layout.",
    duration:
      "Service 30 to 60 minutes; military honors add 10 to 20 minutes at the committal",
    intro: [
      "Military funeral honors are rendered by the Department of Defense for eligible veterans, and the core elements are set: the folding and presentation of the United States flag and the sounding of Taps, performed by at least two uniformed service members, one from the veteran's branch.",
      "Because the honors sequence is fixed and the funeral director coordinates it, your job in the program is to tell guests what is about to happen. Many attendees have never seen honors rendered and do not know when to stand or what the flag presentation means.",
    ],
    steps: [
      {
        name: "Religious or memorial service",
        detail:
          "Held at a church, funeral home, or chapel according to the family's tradition. Honors are rendered separately at the committal.",
        minutes: "30 to 60 min",
      },
      {
        name: "Procession to the gravesite",
        detail:
          "The casket is escorted to the committal site. At national cemeteries, families are typically directed to a committal shelter rather than to the grave itself.",
      },
      {
        name: "Committal service",
        detail:
          "Brief remarks and prayer by the officiant or chaplain.",
        minutes: "5 to 10 min",
      },
      {
        name: "Rifle volley",
        detail:
          "When an honor guard is available, three volleys are fired. This is a salute and is distinct from a 21-gun salute, which is a separate ceremonial honor.",
      },
      {
        name: "Sounding of Taps",
        detail:
          "Played by a bugler when available, or by a ceremonial bugle. Attendees stand; those in uniform salute.",
        minutes: "1 min",
      },
      {
        name: "Folding of the flag",
        detail:
          "The flag is folded thirteen times into a triangle by the honor detail, deliberately and in silence.",
        minutes: "3 to 5 min",
      },
      {
        name: "Presentation of the flag",
        detail:
          "The flag is presented to the next of kin, kneeling, with the words of appreciation spoken quietly on behalf of the service branch and the nation.",
      },
      {
        name: "Closing and dismissal",
        detail:
          "A final word from the officiant, and the family is invited to remain or to move to the reception.",
      },
    ],
    wording: {
      heading: "Program wording you can copy",
      lines: [
        {
          label: "Cover",
          text: "In Loving Memory of\n[Rank] [Full Name], [Branch]\n[Birth date] – [Date of death]\n\n[Years of service] · [Conflict, unit, or station]\n\n[Venue]\n[Date] at [time]",
        },
        {
          label: "Service line",
          text: "Military Service\n[Full Name] served in the United States [Branch] from [year] to [year], [including service in [conflict, station, or unit]]. [He/She] was honorably discharged as [rank].",
        },
        {
          label: "Explaining the honors",
          text: "Military Funeral Honors\n\nFollowing the committal, military honors will be rendered by the United States [Branch]. Honors include the sounding of Taps and the folding and presentation of the United States flag to the family. Guests are invited to stand during the honors. Those who have served may render a hand salute.",
        },
        {
          label: "About Taps",
          text: "Taps was arranged in 1862 and has been sounded at military funerals since. It lasts less than a minute. The silence that follows it is part of the honor.",
        },
        {
          label: "Acknowledgement",
          text: "The family wishes to thank the [branch] honor guard, [VFW or American Legion post], and all who served alongside [Name].",
        },
      ],
    },
    panels: [
      "Front cover: photograph, rank and name, branch insignia if the family wishes, dates, and years of service",
      "Inside left: the order of the service, followed by the honors sequence",
      "Inside right: obituary, with a short paragraph devoted to service history",
      "Back cover: an explanation of the honors, thanks to the honor guard, and reception details",
    ],
    notes: [
      "Eligibility and arrangements are handled through the funeral director, who requests honors on the family's behalf. Have a copy of the DD-214 available, as it is the document normally used to establish eligibility.",
      "Verify rank, branch, dates, and any decorations against the DD-214 before printing. Veterans' organizations and fellow service members notice errors, and corrections after printing are not possible.",
      "A rifle volley requires an honor guard detail, often provided by a VFW or American Legion post, and is not guaranteed at every service. Confirm availability before describing it in the program.",
      "Burial in a national cemetery, a government headstone, and a burial flag are provided at no cost for eligible veterans. Ask the funeral director which benefits apply.",
    ],
    faqs: [
      {
        question: "Who is eligible for military funeral honors?",
        answer:
          "Eligibility generally extends to veterans who served in the active military and were discharged under conditions other than dishonorable, along with members and former members of the Selected Reserve. The funeral director requests honors on the family's behalf, and a DD-214 is the document typically used to confirm eligibility. Confirm the current requirements with the funeral home or the relevant service branch.",
      },
      {
        question: "What is said during the flag presentation?",
        answer:
          "The presenting service member kneels and speaks quietly to the next of kin, offering the flag on behalf of the President, the service branch, and a grateful nation as a token of appreciation for honorable and faithful service. The exact wording is set by each branch. It is spoken softly and is meant for the family, not the assembly.",
      },
      {
        question: "Is a 21-gun salute part of a military funeral?",
        answer:
          "No. What is rendered at a funeral is a three-volley rifle salute, usually by a detail of seven riflemen. A 21-gun salute is an artillery honor reserved for heads of state and certain senior officials. The two are frequently confused, and explaining the difference in the program is genuinely helpful to guests.",
      },
    ],
    related: [
      "graveside-service",
      "non-denominational",
      "catholic-funeral-mass",
    ],
  },
  {
    slug: "graveside-service",
    label: "Graveside",
    title: "Graveside Service Order of Service Template",
    shortTitle: "Graveside service",
    description:
      "A free graveside service order of service template with a short committal sequence, sample wording, timing, and practical guidance for outdoor services.",
    duration: "Typically 15 to 30 minutes",
    intro: [
      "A graveside service is short by design. People are standing, often outdoors, sometimes in weather, and frequently for the hardest part of the day. Fifteen to thirty minutes is the working range, and going long is felt physically by everyone present.",
      "Some families hold the graveside service alone, with no preceding service at all. That is a complete and increasingly common choice, and it usually calls for slightly more content than a committal that follows a full funeral.",
    ],
    steps: [
      {
        name: "Gathering",
        detail:
          "Guests assemble at the graveside. Seating is usually provided only for immediate family, so expect most people to stand.",
        minutes: "5 min",
      },
      {
        name: "Opening words",
        detail:
          "The officiant welcomes everyone in a few sentences. Outdoors, brevity matters more than at any indoor service.",
        minutes: "1 to 2 min",
      },
      {
        name: "Scripture or reading",
        detail:
          "Psalm 23 is the most frequently used. A short poem or passage works equally well for a secular service.",
      },
      {
        name: "Brief remarks",
        detail:
          "A short reflection or one memory. If this is the only service, allow five to eight minutes and one or two speakers.",
        minutes: "3 to 8 min",
      },
      {
        name: "Committal words",
        detail:
          "The formal committal, spoken as the casket or urn is lowered or placed. This is the moment the service exists for.",
      },
      {
        name: "Prayer or moment of silence",
        detail:
          "A closing prayer, or a silence introduced as an invitation for anyone to use as they wish.",
      },
      {
        name: "Flowers or earth",
        detail:
          "Guests are invited to place a flower, or a handful of earth, on the casket. This gives everyone something to do and is often what people remember.",
        minutes: "3 to 5 min",
      },
      {
        name: "Closing and reception",
        detail:
          "The officiant closes and states clearly where guests should go next, including the address.",
        minutes: "2 min",
      },
    ],
    wording: {
      heading: "Committal wording you can copy",
      lines: [
        {
          label: "Card or single-sheet cover",
          text: "Graveside Service for\n[Full Name]\n[Birth date] – [Date of death]\n\n[Cemetery name]\n[City, State]\n[Date] at [time]",
        },
        {
          label: "Traditional committal",
          text: "We commit the body of [Name] to the ground; earth to earth, ashes to ashes, dust to dust, in the sure and certain hope of the resurrection to eternal life.",
        },
        {
          label: "Secular committal",
          text: "We return [Name] to the earth, in gratitude for the life [he/she/they] lived and for the time we were given together. What [he/she/they] gave us does not end here.",
        },
        {
          label: "Committal for ashes",
          text: "We place the ashes of [Name] in this ground, and we leave behind nothing that matters. What mattered, we are taking with us.",
        },
        {
          label: "Invitation to place a flower",
          text: "You are invited to come forward and place a flower. Take as long as you need. When you are ready, please join us at [location] for [meal or reception].",
        },
      ],
    },
    panels: [
      "A single folded card is usually enough; a four-panel program is unnecessary for a graveside-only service",
      "Front: name, dates, cemetery, and date",
      "Inside: the short order of service and the reading or committal text",
      "Back: reception address and the family's thanks",
    ],
    notes: [
      "Print on heavier card stock. Single sheets are difficult to hold outdoors and become unreadable in light rain.",
      "Tell guests in advance about terrain, grass, and distance from parking. This matters enormously to older attendees and to anyone with mobility limits, and it is easily forgotten.",
      "Cemeteries usually have a firm schedule. Confirm your allotted window, because running long can genuinely affect the next family's service.",
      "If this is the only service, plan for slightly more content and arrange some seating and shade if the cemetery permits it.",
    ],
    faqs: [
      {
        question: "How long is a graveside service?",
        answer:
          "Fifteen to thirty minutes is standard. A committal following a full funeral is often closer to ten or fifteen minutes. A graveside-only service, where no other ceremony is held, typically runs closer to thirty.",
      },
      {
        question: "Do we need a program for a graveside service?",
        answer:
          "It is optional and many families skip it. A single folded card works well when there are readings guests may want to follow, when the family wants a keepsake, or when the graveside service is the only ceremony being held.",
      },
      {
        question: "What if the weather is bad?",
        answer:
          "Ask the cemetery about a committal shelter or tent, and confirm the plan the day before. Most cemeteries can shorten or relocate a service in severe weather, and funeral directors do this routinely. Tell guests directly if the service will be abbreviated so nobody is caught unprepared.",
      },
    ],
    related: ["military-honors", "memorial-service", "catholic-funeral-mass"],
  },
  {
    slug: "memorial-service",
    label: "Memorial service",
    title: "Memorial Service Order of Service Template",
    shortTitle: "Memorial service",
    description:
      "A free memorial service order of service template for a service held without the body present, with sequence, wording, timing, and planning notes.",
    duration: "Typically 40 to 60 minutes",
    intro: [
      "A memorial service is held without the body present, which changes both the logistics and the feeling. It can happen weeks or months after the death, in a place that meant something, with the people who could actually travel.",
      "That distance from the death is worth using. Families planning a memorial service usually have time to gather photographs, ask several people to speak, and think about what they want the gathering to be. The outline below assumes that time exists.",
    ],
    steps: [
      {
        name: "Gathering and display",
        detail:
          "Photographs, objects, and music as guests arrive. A memory table with a few of the person's belongings works better than flowers alone.",
        minutes: "20 to 30 min before",
      },
      {
        name: "Welcome",
        detail:
          "The officiant or host opens, acknowledges those who traveled, and outlines what will happen.",
        minutes: "2 to 3 min",
      },
      {
        name: "Opening music or reading",
        detail:
          "A hymn, song, or reading chosen by the family.",
      },
      {
        name: "Life story",
        detail:
          "The biography, delivered by the officiant or a family member. With more time available, this is often richer than at a funeral.",
        minutes: "8 to 12 min",
      },
      {
        name: "Tributes",
        detail:
          "Three or four invited speakers. Because a memorial service is planned in advance, speakers can actually prepare.",
        minutes: "15 to 20 min",
      },
      {
        name: "Music or slideshow",
        detail:
          "A photo or video presentation, usually four to six minutes.",
        minutes: "4 to 6 min",
      },
      {
        name: "Reflection, prayer, or silence",
        detail:
          "A prayer if the family wishes, or a shared silence introduced as an invitation.",
      },
      {
        name: "Family's thanks",
        detail:
          "A family member speaks briefly, or the officiant reads a message from the family.",
        minutes: "2 to 3 min",
      },
      {
        name: "Closing and reception",
        detail:
          "Closing words and clear directions to the reception.",
      },
      {
        name: "Optional interment of ashes",
        detail:
          "Some families hold a small private interment or scattering separately, either before or after the memorial service.",
      },
    ],
    wording: {
      heading: "Program wording you can copy",
      lines: [
        {
          label: "Cover",
          text: "A Memorial Service Celebrating\n[Full Name]\n[Birth date] – [Date of death]\n\n[Venue]\n[City, State]\n[Date] at [time]",
        },
        {
          label: "Welcome when time has passed",
          text: "[Name] died on [date]. We waited until today so that everyone who loved [him/her/them] could be in the same room. Thank you for traveling, for rearranging things, and for being here.",
        },
        {
          label: "Order of service",
          text: "Welcome ........................ [Name]\nOpening Music ............. [Title]\n[Name]'s Life ................ [Name]\nTributes ......................... [Name], [Name], [Name]\nSlideshow\nA Moment Together\nFrom the Family .......... [Name]\nClosing Words",
        },
        {
          label: "Memory table note",
          text: "The table near the entrance holds a few of [Name]'s things. Please look. Please pick them up. [He/She/They] would have handed them to you.",
        },
        {
          label: "Reception and donations",
          text: "Please stay for [meal or refreshments] at [location].\n\nIn lieu of flowers, the family asks that donations be made to [organization].",
        },
      ],
    },
    panels: [
      "Front cover: photograph, name, and dates",
      "Inside left: the order of the service with speakers named",
      "Inside right: the life story, often longer and warmer than a newspaper obituary",
      "Back cover: the family's thanks, reception details, donation information, and a QR code to a photo album if you have one",
    ],
    notes: [
      "Because the date is flexible, choose one that lets distant family attend. Weekends and holiday weekends are the usual choice for scattered families.",
      "Ask speakers weeks in advance and give them a specific time limit. Prepared remarks at a memorial service are noticeably better than improvised ones at a funeral.",
      "If ashes will be interred or scattered, decide whether that happens as part of the service, privately beforehand, or afterward, and say so in the program so nobody is confused.",
      "A shared photo album or memorial page linked by QR code on the back panel keeps the gathering going after people go home.",
    ],
    faqs: [
      {
        question: "What is the difference between a funeral and a memorial service?",
        answer:
          "A funeral takes place with the body present, usually within a week of the death. A memorial service takes place without the body and can be held at any time afterward. Everything else, including the location, the structure, and the tone, is up to the family.",
      },
      {
        question: "How long after a death can you hold a memorial service?",
        answer:
          "There is no limit. Services held one to three months later are common, and services held on a first anniversary are not unusual. Waiting allows distant family to attend and gives the people organizing it time to plan something considered rather than rushed.",
      },
      {
        question: "Should we still print a program?",
        answer:
          "Yes, and memorial service programs are often the most keepsake-like of all, because there is time to make them well. Guests who traveled tend to keep them, and they are frequently mailed afterward to people who could not attend.",
      },
    ],
    related: [
      "celebration-of-life",
      "non-denominational",
      "graveside-service",
    ],
  },
];

export function getOrderOfServiceTemplate(slug: string) {
  return orderOfServiceTemplates.find((template) => template.slug === slug);
}

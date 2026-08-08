export const TEMPLATE_UPDATED = "2026-08-07";

export type TemplateExample = {
  label: string;
  words: string;
  paragraphs: string[];
};

export type TemplateFaq = {
  question: string;
  answer: string;
};

export type ObituaryTemplate = {
  slug: string;
  relationship: string;
  title: string;
  shortTitle: string;
  description: string;
  intro: string[];
  include: string[];
  fillIn: string[];
  examples: TemplateExample[];
  wording: {
    heading: string;
    lines: string[];
  };
  pitfalls: string[];
  faqs: TemplateFaq[];
  related: string[];
};

export const obituaryTemplates: ObituaryTemplate[] = [
  {
    slug: "mother",
    relationship: "mother",
    title: "Obituary Template for a Mother (Free, Fill-in-the-Blank)",
    shortTitle: "Obituary template for a mother",
    description:
      "A free fill-in-the-blank obituary template for a mother, with a short newspaper version, a longer example, and wording help for family listings.",
    intro: [
      "Most obituaries for a mother fail in the same way: they list roles instead of showing a person. \"Loving mother of three\" is true of millions of people. The detail that makes readers recognize your mother is smaller and stranger than that — the way she answered the phone, the thing she always packed for a trip, the one dish she refused to make from a recipe.",
      "Use the template below as scaffolding. Fill it in plainly first, then replace one or two generic phrases with something only your family would know. That single substitution is usually the difference between a notice and a tribute.",
    ],
    include: [
      "Her full name, including her maiden name, and the name she was actually called",
      "Age, city of residence, and the date she died",
      "Birth date, birthplace, and her parents' names",
      "Marriage, if applicable, with the year and her spouse's name",
      "Work, study, faith community, volunteering, or the craft she was known for",
      "One or two concrete habits, phrases, or scenes that identify her",
      "Surviving family, generally spouse, then children, then grandchildren, then siblings",
      "Family who died before her",
      "Service details, and where donations may be sent",
    ],
    fillIn: [
      "[Full name, including maiden name], [age], of [city, state], died on [date of death] [optional: at home / after a long illness / peacefully, surrounded by family].",
      "She was born on [birth date] in [birthplace] to [parents' names]. [She attended / She graduated from] [school], and [worked as / spent her working life] [occupation or description] for [number] years.",
      "[She married [spouse's name] on [date]. They were married [number] years.] [Optional: He died in [year].]",
      "[Mother's first name] was known for [one specific habit, skill, or trait]. [Add one concrete scene: what she did on a normal Sunday, what she always said, what she kept on the counter.] [Optional: She was a member of [church, club, or organization], where she [role or contribution].]",
      "She is survived by her [children and their spouses], [number] grandchildren, [number] great-grandchildren, and her [siblings and their cities]. She was preceded in death by [names and relationships].",
      "A [funeral service / memorial service / celebration of life] will be held on [date] at [time] at [location]. [Visitation details.] In lieu of flowers, the family asks that donations be made to [organization] in her memory.",
    ],
    examples: [
      {
        label: "Short version for a newspaper",
        words: "About 85 words",
        paragraphs: [
          "Margaret Ellen Doyle (née Fahey), 83, of Belleview, died on March 4, 2026, at home.",
          "Born September 12, 1942, in Cleveland, Ohio, to Thomas and Alice Fahey, she worked as a school nurse for 29 years. She married Peter Doyle in 1965; he died in 2019.",
          "She is survived by her children, Anne (Mark) Reyes and Sean Doyle; six grandchildren; and her brother, Michael Fahey.",
          "A funeral Mass will be held March 11 at 10 a.m. at St. Brigid Church. Donations may be made to the Belleview Food Pantry.",
        ],
      },
      {
        label: "Longer version for a funeral home page or program",
        words: "About 220 words",
        paragraphs: [
          "Margaret Ellen Doyle (née Fahey), 83, of Belleview, died at home on March 4, 2026, with her children beside her.",
          "Margaret was born September 12, 1942, in Cleveland, Ohio, the second of five children of Thomas and Alice Fahey. She trained as a nurse at St. Vincent's and spent 29 years as a school nurse in the Belleview district, where she was known for keeping a tin of butterscotch candies in her desk drawer and for telling children, with complete seriousness, that they would live.",
          "She married Peter Doyle on June 19, 1965. They were married 54 years, and she never once let him carve the ham.",
          "Margaret gardened badly and enthusiastically. She grew tomatoes that split, roses that leaned, and a rhubarb patch that outlived nearly everything else in the yard. She sang in the choir at St. Brigid for four decades, and she answered the telephone by saying \"Well, hello,\" as though she had been hoping it was you.",
          "She is survived by her children, Anne (Mark) Reyes of Columbus and Sean Doyle of Belleview; six grandchildren; and her brother, Michael Fahey. She was preceded in death by her husband, Peter, and her sisters, Rose and Katherine.",
          "A funeral Mass will be celebrated at 10 a.m. on March 11 at St. Brigid Church, with visitation the evening before. In lieu of flowers, donations may be made to the Belleview Food Pantry.",
        ],
      },
    ],
    wording: {
      heading: "Wording for the parts families find hardest",
      lines: [
        "Cause of death is optional. \"Died at home,\" \"died after a long illness,\" or simply \"died\" are all complete and dignified.",
        "For stepchildren and children-in-law, name them the way your family names them. \"Her children, Anne, Sean, and Dana\" is appropriate if that is how she spoke of them.",
        "If a child died before her, listing them under \"preceded in death by\" is standard and is often important to surviving siblings.",
        "For grandchildren, either name each one or give a count. Counts are common when the list would run long; names are common when the family is small.",
        "Avoid \"lost her battle.\" It implies a failure that did not occur. \"Died of\" or \"died after living with\" is plainer and kinder.",
      ],
    },
    pitfalls: [
      "Publishing her exact birth date alongside her mother's maiden name, which is a common identity-theft combination",
      "Listing an unoccupied home address in the same notice as the service time",
      "Writing only about her relationships and leaving out her own work, study, or interests",
      "Letting several relatives edit the same draft without one person confirming names and spellings at the end",
    ],
    faqs: [
      {
        question: "How long should an obituary for a mother be?",
        answer:
          "Newspapers usually charge by the line, so print versions often run 75 to 200 words. Funeral home websites and memorial pages have no practical limit, and 300 to 500 words is common there. Many families write the longer version first, then cut it down for print.",
      },
      {
        question: "Should I include her maiden name?",
        answer:
          "Yes, in most cases. The maiden name is how extended family, childhood friends, and former colleagues will recognize her, and it matters for anyone researching family history later. It is usually written as \"Margaret Ellen Doyle (née Fahey)\" or \"Margaret Ellen (Fahey) Doyle.\"",
      },
      {
        question: "In what order should surviving family be listed?",
        answer:
          "The most common order is spouse, then children with their spouses in parentheses, then grandchildren and great-grandchildren, then siblings, then nieces and nephews. Families deviate from this constantly and no one objects. Consistency within your own notice matters more than following a rule.",
      },
    ],
    related: ["father", "grandmother", "wife"],
  },
  {
    slug: "father",
    relationship: "father",
    title: "Obituary Template for a Father (Free, Fill-in-the-Blank)",
    shortTitle: "Obituary template for a father",
    description:
      "A free fill-in-the-blank obituary template for a father, including short and long examples, military service wording, and family listing guidance.",
    intro: [
      "Obituaries for fathers tend to drift toward résumé. Job title, years of service, retirement date. That information belongs there, but it is rarely what people remember. What identifies a father in print is usually how he did ordinary things: what he fixed, what he refused to throw away, what he said when someone asked him for help.",
      "Fill in the template plainly, then add one line of that. If you are unsure whether a detail is too small to include, it is probably the right one.",
    ],
    include: [
      "His full name and any nickname people actually used",
      "Age, city of residence, and date of death",
      "Birth date, birthplace, and his parents' names",
      "Military service: branch, years, and conflict or station, if applicable",
      "Work, trade, or business, and what he was good at within it",
      "One concrete habit, saying, or scene",
      "Surviving family and family who died before him",
      "Service details and where donations may be sent",
    ],
    fillIn: [
      "[Full name], [age], of [city, state], died on [date of death] [optional circumstance].",
      "He was born on [birth date] in [birthplace] to [parents' names]. [He graduated from [school] in [year].] [He served in the [branch] from [year] to [year], including [station, conflict, or role].]",
      "[He married [spouse's name] on [date]; they were married [number] years.]",
      "[Father's first name] worked as [occupation] at [employer] for [number] years, where he [one specific thing he was known for doing well]. [Add a concrete detail: what he built, drove, repaired, coached, or kept in the garage.]",
      "He is survived by his [spouse], his children [names and spouses], [number] grandchildren, and his [siblings]. He was preceded in death by [names and relationships].",
      "[Service type] will be held on [date] at [time] at [location]. [Military honors will be provided by [unit or organization].] Memorial contributions may be made to [organization].",
    ],
    examples: [
      {
        label: "Short version for a newspaper",
        words: "About 90 words",
        paragraphs: [
          "Raymond Keith Alder, 79, of Cedar Falls, died January 22, 2026.",
          "Born April 3, 1946, in Waterloo to Harold and Doris Alder, he served in the U.S. Army from 1965 to 1968 and worked as a lineman for Black Hawk Electric for 34 years.",
          "He married Judith Vance in 1971. He is survived by Judith; his sons, Kevin (Tara) and Doug Alder; four grandchildren; and his sister, Lorraine Pike.",
          "Services will be held January 29 at 11 a.m. at Grace Lutheran Church, with military honors. Donations may be made to the Cedar Valley Hospice.",
        ],
      },
      {
        label: "Longer version for a funeral home page or program",
        words: "About 230 words",
        paragraphs: [
          "Raymond Keith Alder, 79, of Cedar Falls, died on January 22, 2026, after a short illness.",
          "Ray was born April 3, 1946, in Waterloo, Iowa, to Harold and Doris Alder. He served in the U.S. Army from 1965 to 1968 and afterward spent 34 years as a lineman for Black Hawk Electric. He worked in weather that sent everyone else indoors, and he came home from ice storms in a mood that his family learned to wait out with coffee.",
          "He married Judith Vance on August 14, 1971. They were married 54 years.",
          "Ray could fix nearly anything and was constitutionally unable to pay someone else to do it. He kept a coffee can of assorted screws that he genuinely believed was organized. He coached Little League for eleven seasons, mostly badly, and was beloved for it. He called his grandchildren \"chief,\" all of them, apparently to avoid choosing.",
          "He is survived by his wife, Judith; his sons, Kevin (Tara) Alder of Des Moines and Doug Alder of Cedar Falls; four grandchildren; and his sister, Lorraine Pike. He was preceded in death by his parents and his brother, Dale.",
          "A funeral service will be held at 11 a.m. on January 29 at Grace Lutheran Church, with military honors provided by the Cedar Falls VFW. Memorial contributions may be made to Cedar Valley Hospice.",
        ],
      },
    ],
    wording: {
      heading: "Wording for military service and work history",
      lines: [
        "Standard military phrasing: \"He served in the U.S. Navy from 1968 to 1972 aboard the USS Kitty Hawk.\" Rank at discharge may be included: \"He retired from the U.S. Air Force as a Master Sergeant after 22 years.\"",
        "If honors will be rendered at the service, say so plainly: \"Military honors will be provided by the [post or unit].\" Families and veterans' organizations both use this line to coordinate.",
        "For a long career, one sentence is enough. \"He spent 34 years as a lineman\" does more than a list of job titles.",
        "For a career that changed often, group it: \"He drove a truck, ran a small engine shop, and finished his working life teaching diesel mechanics at the community college.\"",
        "\"Retired\" is worth stating if it explains how he spent his last decades.",
      ],
    },
    pitfalls: [
      "Inflating rank, decorations, or deployments, which veterans' organizations frequently notice and correct",
      "Writing the entire notice as a job history with no personal detail",
      "Omitting a first marriage in a way that erases children from that marriage",
      "Publishing his full birth date next to his mother's maiden name",
    ],
    faqs: [
      {
        question: "Do I have to say how my father died?",
        answer:
          "No. Cause of death is entirely optional and many families omit it. If you want to acknowledge a long illness without detail, \"died after a long illness\" or \"died following a lengthy illness\" is widely used and understood.",
      },
      {
        question: "How do I mention military service correctly?",
        answer:
          "Name the branch, the years served, and one identifying detail such as a conflict, ship, unit, or station. If he was honorably discharged at a notable rank, you can include it. Verify dates and rank against his DD-214 if you have access to it, since these details are frequently misremembered.",
      },
      {
        question: "Should I include a previous marriage?",
        answer:
          "If children, stepchildren, or grandchildren come from that marriage, yes, because leaving it out reads as an erasure of those family members. A neutral construction works well: \"He was previously married to Karen Alder, with whom he had two children.\"",
      },
    ],
    related: ["mother", "grandfather", "husband"],
  },
  {
    slug: "grandmother",
    relationship: "grandmother",
    title: "Obituary Template for a Grandmother (Free, Fill-in-the-Blank)",
    shortTitle: "Obituary template for a grandmother",
    description:
      "A free obituary template for a grandmother, with fill-in-the-blank structure, short and long examples, and help listing large families.",
    intro: [
      "Obituaries for grandmothers usually have a scale problem. There are often four generations to name, a long marriage, decades of work, and a wide circle of church, neighborhood, and family history to fit into a few hundred words.",
      "The way through is to choose a single organizing thread — her house, her work, her faith, her garden, the thing everyone associates with her — and let the family list be a list. You do not have to characterize every relationship. You only have to make one person recognizable.",
    ],
    include: [
      "Her full name, maiden name, and the grandparent name her family used",
      "Age, city, and date of death",
      "Birth date, birthplace, and parents' names",
      "Marriage and, if he died first, the year",
      "Her own work, trade, service, or long-running volunteer role",
      "The detail everyone in the family associates with her",
      "Generations of survivors, usually by count once past grandchildren",
      "Service details and donation preference",
    ],
    fillIn: [
      "[Full name (née [maiden name])], [age], of [city, state], died on [date of death]. To her family she was [Grandma / Nana / Mimi / other name].",
      "She was born [birth date] in [birthplace] to [parents' names]. [She married [spouse's name] in [year]; they were married [number] years before his death in [year].]",
      "[She worked as [occupation] for [number] years] and [volunteered with / belonged to] [organization], where she [contribution].",
      "[Grandmother's name] was known for [the one thing everyone associates with her]. [Add one concrete scene involving grandchildren: what she kept for them, what she taught them, what she let them get away with.]",
      "She is survived by her children, [names and spouses]; [number] grandchildren; [number] great-grandchildren; and [siblings or other close relatives]. She was preceded in death by [names].",
      "[Service type] will be held [date, time, location]. In lieu of flowers, donations may be made to [organization].",
    ],
    examples: [
      {
        label: "Short version for a newspaper",
        words: "About 85 words",
        paragraphs: [
          "Rose Marie Vance (née Kowalski), 91, of Hammond, died February 8, 2026, at Pine Ridge Care Center.",
          "Born May 30, 1934, in Gary to Stanley and Irene Kowalski, she worked as a seamstress and later managed alterations at Baird's Department Store. She married Albert Vance in 1954; he died in 2007.",
          "She is survived by four children, 11 grandchildren, and 19 great-grandchildren.",
          "A memorial service will be held February 15 at 1 p.m. at Trinity Methodist. Donations may be made to Pine Ridge Care Center's activity fund.",
        ],
      },
      {
        label: "Longer version for a funeral home page or program",
        words: "About 215 words",
        paragraphs: [
          "Rose Marie Vance (née Kowalski), 91, of Hammond, died on February 8, 2026, at Pine Ridge Care Center. To four generations of her family, she was Busia.",
          "Rose was born May 30, 1934, in Gary, Indiana, to Stanley and Irene Kowalski. She left school at sixteen to help at home, learned to sew from her mother, and eventually ran the alterations counter at Baird's Department Store for 22 years. She could look at a hem and tell you the measurement, and she was right often enough that people stopped checking.",
          "She married Albert Vance on October 9, 1954. They were married 53 years before his death in 2007.",
          "Her kitchen was the center of the family. There were pierogi at Christmas, an argument every year about whether there were enough, and always more than enough. She kept a drawer of butterscotch candies that grandchildren were technically not supposed to open, and she never once locked it.",
          "She is survived by her children, Diane (Rick) Salas, Thomas Vance, Karen Boyd, and Michael (Jen) Vance; 11 grandchildren; and 19 great-grandchildren. She was preceded in death by her husband, Albert, and her son, Stephen.",
          "A memorial service will be held at 1 p.m. on February 15 at Trinity Methodist Church. In lieu of flowers, donations may be made to the Pine Ridge Care Center activity fund.",
        ],
      },
    ],
    wording: {
      heading: "Handling four generations without losing the reader",
      lines: [
        "Name children individually. Use counts for grandchildren and great-grandchildren once the list exceeds roughly eight names.",
        "A common compromise: \"She is survived by her children, [names]; 11 grandchildren; and 19 great-grandchildren, all of whom she could name in order.\"",
        "If a grandchild was raised by her, say so directly. \"She raised her grandson, Eli, from the age of four\" is a fact worth stating plainly.",
        "The grandparent name she was called is not a decoration. Busia, Nana, Mimi, Grammy — including it is how her grandchildren recognize the notice as being about her.",
        "If she outlived a child, listing that child under \"preceded in death by\" matters a great deal to surviving siblings.",
      ],
    },
    pitfalls: [
      "Listing so many names that the service details get buried at the bottom",
      "Describing her only through her grandchildren and omitting her own work or history",
      "Guessing at grandchild counts; confirm the number with one person before publishing",
      "Using an old photograph without checking whether other living people appear in it",
    ],
    faqs: [
      {
        question: "Should I name every grandchild?",
        answer:
          "Name them if the list is short enough to read comfortably, generally up to about eight. Beyond that, most families use a count. Some families name grandchildren and count great-grandchildren, which reads well and keeps the notice from becoming a directory.",
      },
      {
        question: "What if she had a nickname the whole family used?",
        answer:
          "Include it in the first or second sentence. A line like \"To four generations of her family, she was Busia\" does more recognition work than any adjective, and it is the phrase relatives will remember from the notice.",
      },
      {
        question: "How do I mention a grandchild who died before her?",
        answer:
          "List them by name in the preceded-in-death sentence alongside other family: \"She was preceded in death by her husband, Albert, and her grandson, Nathan.\" Naming the person is generally more comforting to the family than omitting the loss.",
      },
    ],
    related: ["grandfather", "mother", "wife"],
  },
  {
    slug: "grandfather",
    relationship: "grandfather",
    title: "Obituary Template for a Grandfather (Free, Fill-in-the-Blank)",
    shortTitle: "Obituary template for a grandfather",
    description:
      "A free obituary template for a grandfather, with fill-in-the-blank wording, examples, and guidance on trade, service, and multi-generation family lists.",
    intro: [
      "A grandfather's obituary usually has to carry a working life, a marriage, a war or a trade, and three or four generations of family. Families often respond by compressing everything into adjectives — hardworking, devoted, loving — which is exactly the material readers skim.",
      "Keep the facts tight and spend your remaining words on one specific thing he did repeatedly. A man who rebuilt the same lawnmower for thirty years is more recognizable than a man described as handy.",
    ],
    include: [
      "His full name and the grandparent name his family used",
      "Age, city, and date of death",
      "Birth date, birthplace, and parents' names",
      "Military service with branch and years, if applicable",
      "His trade, employer, farm, or business",
      "Marriage details and length",
      "One repeated habit, skill, or saying",
      "Survivors across generations, and those who died before him",
      "Service details, honors, and donation preference",
    ],
    fillIn: [
      "[Full name], [age], of [city, state], died on [date of death]. His grandchildren knew him as [Grandpa / Papa / Pop / other name].",
      "He was born [birth date] in [birthplace] to [parents' names]. [He served in the [branch] from [year] to [year].] [He married [spouse's name] on [date]; they were married [number] years.]",
      "He [worked as / farmed / ran] [occupation or business] for [number] years. [Add what he was specifically good at, or what he built, grew, drove, or maintained.]",
      "[Grandfather's name] spent his free time [activity], and [one repeated habit or phrase his family will recognize].",
      "He is survived by his [spouse]; his children, [names and spouses]; [number] grandchildren; and [number] great-grandchildren. He was preceded in death by [names].",
      "[Service type] will be held [date, time, location]. [Military honors will be provided by [organization].] Memorial gifts may be directed to [organization].",
    ],
    examples: [
      {
        label: "Short version for a newspaper",
        words: "About 85 words",
        paragraphs: [
          "Walter James Kroll, 88, of Ellsworth, died November 3, 2026, at home.",
          "Born June 18, 1938, in Marshfield to Emil and Hedwig Kroll, he served in the U.S. Navy from 1957 to 1961 and farmed 240 acres in Pierce County for 46 years. He married Eileen Barta in 1963.",
          "He is survived by Eileen; three children; nine grandchildren; and five great-grandchildren.",
          "Services will be held November 10 at 10:30 a.m. at St. Francis Catholic Church, with military honors. Memorials may be directed to the Pierce County 4-H.",
        ],
      },
      {
        label: "Longer version for a funeral home page or program",
        words: "About 220 words",
        paragraphs: [
          "Walter James Kroll, 88, of Ellsworth, died at home on November 3, 2026, with his family nearby. To nine grandchildren, he was Papa.",
          "Walt was born June 18, 1938, in Marshfield, Wisconsin, to Emil and Hedwig Kroll. He served in the U.S. Navy from 1957 to 1961, then came home and farmed 240 acres in Pierce County for 46 years. He married Eileen Barta on May 4, 1963. They were married 62 years.",
          "He was a careful man with machinery and an impatient one with paperwork. He kept the same 1968 tractor running long past the point of reason, largely out of stubbornness, and he taught four of his grandchildren to drive on it. He read the weather page before the front page. He answered nearly every question with \"we'll see,\" which the family eventually learned meant yes.",
          "Walt served on the parish council at St. Francis for two decades and hauled more folding tables than anyone has counted.",
          "He is survived by his wife, Eileen; his children, Mary (Doug) Sorenson, Paul (Lisa) Kroll, and Ann Kroll; nine grandchildren; and five great-grandchildren. He was preceded in death by his parents and his brother, Leonard.",
          "A funeral Mass will be celebrated at 10:30 a.m. on November 10 at St. Francis Catholic Church, with military honors. Memorials may be directed to the Pierce County 4-H.",
        ],
      },
    ],
    wording: {
      heading: "Wording for trade, farm, and service details",
      lines: [
        "Name the trade specifically. \"Pipefitter,\" \"long-haul driver,\" and \"dairy farmer\" carry more than \"worked in industry.\"",
        "For farming families, acreage, county, and years are the details other farmers read closely: \"He farmed 240 acres in Pierce County for 46 years.\"",
        "For service, branch and years are enough for most notices: \"He served in the U.S. Navy from 1957 to 1961.\" Add a ship, unit, or conflict only if it is accurate.",
        "If he continued working past retirement age, that is usually worth a clause. Many families consider it central to who he was.",
        "A single quoted phrase he repeated is often the most effective line in the entire notice.",
      ],
    },
    pitfalls: [
      "Overstating military rank or decorations",
      "Reducing a 40-year trade to the word \"worked\"",
      "Listing grandchildren inconsistently, naming some and counting others without a reason",
      "Forgetting to state who will provide military honors when the family has already arranged it",
    ],
    faqs: [
      {
        question: "How much detail should I give about his job?",
        answer:
          "One or two sentences. Name the trade, the employer or farm, and the number of years, then add one thing he was specifically known for doing well. Readers who worked alongside him will recognize him from that detail faster than from a job title.",
      },
      {
        question: "Is it appropriate to include humor?",
        answer:
          "Yes, if it is affectionate and true. Dry, specific humor reads well in obituaries for grandfathers and is frequently the part relatives quote later. Avoid jokes that require context the reader does not have, and avoid anything that would embarrass a living family member.",
      },
      {
        question: "What if he was estranged from part of the family?",
        answer:
          "Obituaries are not the place to document a rift. Most families either list survivors factually without characterization or omit characterization entirely. If listing someone would cause genuine harm, a neutral construction such as \"He is survived by his children\" without individual names is used, though it is worth agreeing on this as a family first.",
      },
    ],
    related: ["grandmother", "father", "husband"],
  },
  {
    slug: "husband",
    relationship: "husband",
    title: "Obituary Template for a Husband (Free, Fill-in-the-Blank)",
    shortTitle: "Obituary template for a husband",
    description:
      "A free obituary template for a husband, written for a spouse, with short and long examples and guidance on tone, privacy, and family listings.",
    intro: [
      "Writing your husband's obituary is different from writing anyone else's, because you are the person the notice is partly about. Everything you write about his marriage is also about you, and that makes it unusually hard to find a tone.",
      "The practical answer most spouses arrive at is restraint. State the marriage as a fact, give the reader one true detail about how you lived, and keep the rest private. A notice does not have to contain your grief to be honest about your loss.",
    ],
    include: [
      "His full name, nickname, age, city, and date of death",
      "Birth date, birthplace, and parents' names",
      "Your marriage: date, place, and number of years",
      "His work, service, and the things he did outside of it",
      "One specific, ordinary detail about your shared life",
      "Children, grandchildren, siblings, and others who survive him",
      "Family who died before him",
      "Service details, and where donations may go",
    ],
    fillIn: [
      "[Full name], [age], of [city, state], died on [date of death] [optional circumstance].",
      "He was born [birth date] in [birthplace] to [parents' names]. [He served in the [branch] from [year] to [year].] [He worked as [occupation] for [number] years.]",
      "We were married on [date] at [location]. [Number] years. [One sentence about the ordinary shape of your life together: a standing weekly habit, a shared project, a trip taken repeatedly.]",
      "[Husband's first name] loved [activity or interest], and was [one specific and true characterization].",
      "He is survived by his wife, [your name]; [children and their spouses]; [number] grandchildren; and [siblings]. He was preceded in death by [names].",
      "[Service type] will be held [date, time, location]. In lieu of flowers, donations may be made to [organization].",
    ],
    examples: [
      {
        label: "Short version for a newspaper",
        words: "About 80 words",
        paragraphs: [
          "Daniel Ruiz Ortiz, 68, of Santa Rosa, died on July 14, 2026, after a long illness.",
          "Born January 5, 1958, in Fresno to Manuel and Elena Ortiz, he taught high school mathematics for 31 years.",
          "He married Carmen Salcedo in 1984. He is survived by Carmen; his daughters, Sofia and Lucia Ortiz; two grandchildren; and his brother, Rafael.",
          "A memorial service will be held July 22 at 2 p.m. at Community Presbyterian Church. Donations may be made to the Sonoma County Library.",
        ],
      },
      {
        label: "Longer version for a funeral home page or program",
        words: "About 200 words",
        paragraphs: [
          "Daniel Ruiz Ortiz, 68, of Santa Rosa, died on July 14, 2026, at home, after a long illness.",
          "Daniel was born January 5, 1958, in Fresno, California, to Manuel and Elena Ortiz. He was the first in his family to finish college, and he taught high school mathematics for 31 years, most of them at Piner High School. Former students still write to say that he was the reason they stopped being afraid of numbers.",
          "We were married on September 8, 1984, at Community Presbyterian Church. Forty-one years. For most of them, we walked the same loop around Spring Lake on Sunday mornings and argued amiably about whether to go clockwise.",
          "Daniel read constantly and slowly. He made coffee too strong. He was the calmest person in every room he entered, which was occasionally infuriating and always useful.",
          "He is survived by his wife, Carmen; his daughters, Sofia Ortiz and Lucia (Ben) Ortiz-Hale; two grandchildren; and his brother, Rafael Ortiz. He was preceded in death by his parents.",
          "A memorial service will be held at 2 p.m. on July 22 at Community Presbyterian Church. In lieu of flowers, donations may be made to the Sonoma County Library.",
        ],
      },
    ],
    wording: {
      heading: "Choosing between first person and third person",
      lines: [
        "Third person is the default and the safest: \"He is survived by his wife, Carmen.\" Newspapers expect it, and it reads well aloud.",
        "First person can be used sparingly and to great effect for one sentence about the marriage: \"We were married on September 8, 1984. Forty-one years.\"",
        "Mixing the two intentionally is acceptable. Mixing them accidentally is the most common error in spouse-written obituaries, so read the finished draft aloud once to catch it.",
        "You are not required to describe your marriage as happy, difficult, or anything else. Stating its length is a complete statement.",
        "If you want a private line included, put it in the funeral program rather than the public obituary. The program reaches the people it is meant for.",
      ],
    },
    pitfalls: [
      "Publishing your own home address in a notice that also announces when the house will be empty",
      "Writing the notice alone in the first 48 hours and publishing it without a second reader",
      "Including a private detail that a child or grandchild has not agreed to make public",
      "Feeling obligated to name a cause of death; it is always optional",
    ],
    faqs: [
      {
        question: "Is it acceptable to write the obituary myself as his wife?",
        answer:
          "Yes, and it is common. Funeral homes will edit for length and format if needed, but the text is normally the family's. Ask one other person to check names, dates, and spellings before it is submitted, because it is very difficult to proofread your own writing under grief.",
      },
      {
        question: "Should I mention his illness?",
        answer:
          "Only if you want to. \"After a long illness\" acknowledges it without detail. Some families name the illness deliberately to direct donations toward research, which is a legitimate and common reason to include it.",
      },
      {
        question: "How do I write about a second marriage respectfully?",
        answer:
          "State it plainly and name children from earlier marriages among the survivors. A construction such as \"He is survived by his wife, Carmen, and his children from his marriage to the late Anne Ortiz\" is clear and treats everyone as family, which is what most readers are looking for.",
      },
    ],
    related: ["wife", "father", "mother"],
  },
  {
    slug: "wife",
    relationship: "wife",
    title: "Obituary Template for a Wife (Free, Fill-in-the-Blank)",
    shortTitle: "Obituary template for a wife",
    description:
      "A free obituary template for a wife, with fill-in-the-blank wording, short and long examples, and guidance on describing her own life and work.",
    intro: [
      "The most common failure in an obituary for a wife is that she disappears into the marriage. She is described as a devoted wife and mother, and the rest of the notice belongs to other people's relationships to her.",
      "A useful test: read your draft and ask whether it tells anyone what she did with her own days. If it does not, add that before adding anything else. Her work, her training, her opinions, and the thing she was better at than anyone else in the family all belong in the notice.",
    ],
    include: [
      "Her full name, maiden name, and age",
      "City, date of death, and birth details",
      "Her education, training, career, or business",
      "Marriage date and length",
      "Her own interests, service, faith community, or creative work",
      "One concrete scene that shows how she operated",
      "Survivors and those who died before her",
      "Service details and donation preference",
    ],
    fillIn: [
      "[Full name (née [maiden name])], [age], of [city, state], died on [date of death] [optional circumstance].",
      "She was born [birth date] in [birthplace] to [parents' names]. [She earned a [degree] from [school] in [year].] [She worked as [occupation] at [employer] for [number] years, where she [specific accomplishment or reputation].]",
      "We were married on [date] at [location]. [Number] years.",
      "[Wife's first name] [her own pursuit: what she made, ran, organized, grew, studied, or fought for]. [Add one concrete detail that shows her manner rather than describing it.]",
      "She is survived by her husband, [your name]; [children and spouses]; [number] grandchildren; and [siblings]. She was preceded in death by [names].",
      "[Service type] will be held [date, time, location]. Memorial contributions may be made to [organization].",
    ],
    examples: [
      {
        label: "Short version for a newspaper",
        words: "About 85 words",
        paragraphs: [
          "Helen Sofia Brandt (née Nowak), 71, of Ann Arbor, died on May 2, 2026.",
          "Born August 21, 1954, in Toledo to Josef and Maria Nowak, she earned a degree in civil engineering from Michigan State in 1976 and spent 33 years with the county water department, retiring as chief of operations.",
          "She married Thomas Brandt in 1979. She is survived by Thomas; her sons, Peter and Andrew Brandt; three grandchildren; and her sister, Ewa Lis.",
          "A memorial gathering will be held May 9 at 4 p.m. at the Matthaei Botanical Gardens.",
        ],
      },
      {
        label: "Longer version for a funeral home page or program",
        words: "About 210 words",
        paragraphs: [
          "Helen Sofia Brandt (née Nowak), 71, of Ann Arbor, died on May 2, 2026, at University Hospital.",
          "Helen was born August 21, 1954, in Toledo, Ohio, to Josef and Maria Nowak, who had arrived from Poland six years earlier. She earned a degree in civil engineering from Michigan State in 1976, one of four women in her graduating class, and spent 33 years with the Washtenaw County water department. She retired as chief of operations and spent the following decade explaining, to anyone who would listen, exactly how much infrastructure everyone was taking for granted.",
          "We were married on June 16, 1979. Forty-six years.",
          "Helen grew tomatoes seriously and roses reluctantly. She played piano well and refused to perform. She was direct in a way that startled people who had just met her and reassured everyone who knew her longer than a week. If you asked her opinion, you received it.",
          "She is survived by her husband, Thomas; her sons, Peter (Dana) Brandt and Andrew Brandt; three grandchildren; and her sister, Ewa Lis of Toledo. She was preceded in death by her parents and her brother, Marek.",
          "A memorial gathering will be held at 4 p.m. on May 9 at the Matthaei Botanical Gardens. In lieu of flowers, contributions may be made to the Society of Women Engineers.",
        ],
      },
    ],
    wording: {
      heading: "Making sure her own life is on the page",
      lines: [
        "Lead her second paragraph with her education, training, or work rather than with her marriage.",
        "Name the field, not just the employer. \"Civil engineer,\" \"labor and delivery nurse,\" and \"court reporter\" are recognizable to people who shared her profession.",
        "If she did unpaid work that occupied decades — raising children, caring for a parent, running a household through illness — name it as work rather than folding it into an adjective.",
        "Show manner instead of asserting it. \"If you asked her opinion, you received it\" says more than \"she was outspoken.\"",
        "Her maiden name belongs in the first line so that former classmates and colleagues recognize her.",
      ],
    },
    pitfalls: [
      "Describing her only in terms of her relationships to other people",
      "Skipping her career because she retired long ago",
      "Using \"she will be missed by all who knew her,\" which is true of everyone and identifies no one",
      "Publishing details about surviving children's addresses or employers",
    ],
    faqs: [
      {
        question: "How do I write about her if she did not work outside the home?",
        answer:
          "Describe what she actually did with specificity. Managing a household, raising children, caring for aging parents, running a farm's books, or organizing a parish's volunteers are all substantial work, and naming them concretely reads as respect rather than as a euphemism.",
      },
      {
        question: "Should I use her maiden name?",
        answer:
          "Yes. It is how her family of origin, classmates, and early colleagues will identify her, and it matters for genealogy. Standard formats are \"Helen Sofia Brandt (née Nowak)\" or \"Helen Sofia (Nowak) Brandt.\"",
      },
      {
        question: "Can I include something she said?",
        answer:
          "A single short quotation she repeated often works well, especially at the end of the notice. Keep it to one line, and choose something she genuinely said rather than a general saying attributed to her afterward.",
      },
    ],
    related: ["husband", "mother", "grandmother"],
  },
  {
    slug: "son",
    relationship: "son",
    title: "Obituary Template for a Son (Free, Fill-in-the-Blank)",
    shortTitle: "Obituary template for a son",
    description:
      "A free obituary template for a son, written with care for a shortened life, including examples, privacy guidance, and gentle wording options.",
    intro: [
      "There is no version of this that is not out of order. Obituaries for a son carry a difficulty the standard structure was never designed for: the life is shorter than the form expects, and the usual milestones may not be there.",
      "That is not a problem to solve with more adjectives. Write about what he was actually doing — the work, the studies, the friendships, the plans in progress — and let the notice be as short as it needs to be. A brief, exact obituary is not a lesser one.",
    ],
    include: [
      "His full name, nickname, age, city, and date of death",
      "Birth date, birthplace, and parents' names",
      "School, work, service, or training, whatever stage he had reached",
      "What he cared about and spent his time on",
      "One or two specific details that identify him to his friends",
      "Surviving family, including siblings, partner, and children if any",
      "Service details, and a donation direction if the family has one",
    ],
    fillIn: [
      "[Full name], [age], of [city, state], died on [date of death].",
      "He was born [birth date] in [birthplace] to [parents' names]. [He attended / He graduated from] [school], and [was studying / worked as / had recently begun] [pursuit].",
      "[Son's first name] [what he spent his time on and cared about]. [Add one specific detail his friends would recognize immediately.]",
      "He is survived by his parents, [names]; his [siblings and their cities]; [his partner / his children]; and his grandparents, [names]. [He was preceded in death by [names].]",
      "[Service type] will be held [date, time, location]. [The family invites friends to share memories at the gathering that follows.]",
      "[Optional: In lieu of flowers, donations may be made to [organization], which was important to him / which supported our family.]",
    ],
    examples: [
      {
        label: "Short version for a newspaper",
        words: "About 75 words",
        paragraphs: [
          "Isaac Daniel Whitfield, 24, of Missoula, died on April 6, 2026.",
          "Born October 11, 2001, in Bozeman to Grant and Teresa Whitfield, he graduated from the University of Montana in 2024 and worked as a wildland firefighter with the Lolo Hotshots.",
          "He is survived by his parents; his sister, Nora Whitfield; and his grandparents, Ruth Whitfield and Dennis and Pat Kimura.",
          "A memorial service will be held April 13 at 11 a.m. at Caras Park.",
        ],
      },
      {
        label: "Longer version for a funeral home page or program",
        words: "About 185 words",
        paragraphs: [
          "Isaac Daniel Whitfield, 24, of Missoula, died on April 6, 2026.",
          "Isaac was born October 11, 2001, in Bozeman, Montana, to Grant and Teresa Whitfield. He graduated from the University of Montana in 2024 with a degree in forestry and spent two seasons as a wildland firefighter with the Lolo Hotshots. He had just been accepted to a graduate program in fire ecology and had already started reading ahead, which surprised nobody.",
          "Isaac was the friend who answered the phone. He drove people to airports at unreasonable hours. He made a truly excellent breakfast and a genuinely terrible cup of coffee, and he served both with confidence. He kept a running list of trailheads he intended to reach and had crossed off fewer than half of them.",
          "He is survived by his parents, Grant and Teresa Whitfield of Bozeman; his sister, Nora Whitfield of Seattle; and his grandparents, Ruth Whitfield and Dennis and Pat Kimura.",
          "A memorial service will be held at 11 a.m. on April 13 at Caras Park, with a gathering afterward where friends are invited to share memories. Donations may be made to the Wildland Firefighter Foundation.",
        ],
      },
    ],
    wording: {
      heading: "Gentle wording when the death was sudden or difficult",
      lines: [
        "\"Died unexpectedly on [date]\" states what happened without inviting speculation.",
        "\"Died after a long struggle with [illness or condition]\" is used when the family wants the cause known.",
        "For an overdose or suicide, many families now name it deliberately to reduce stigma and direct donations. Others do not. Both are legitimate. If naming it, plain language such as \"died of an overdose\" or \"died by suicide\" is preferred over euphemism.",
        "\"The family asks for privacy regarding the circumstances\" is a clear, commonly used sentence that most readers respect.",
        "Avoid \"lost his battle\" and \"gained his wings.\" They are widely disliked by grieving families and say nothing about him.",
      ],
    },
    pitfalls: [
      "Publishing details about the circumstances that surviving siblings have not agreed to",
      "Writing a notice long enough to feel like compensation for a short life; length is not tribute",
      "Naming friends without asking them, particularly if the death involved others",
      "Publishing a photograph that includes other people who have not consented",
    ],
    faqs: [
      {
        question: "Do we have to say how he died?",
        answer:
          "No. There is no obligation, legal or social, to state a cause of death. \"Died unexpectedly\" and simply \"died\" are both complete. Decide as a family, and remember that anything published becomes permanently searchable.",
      },
      {
        question: "How long should the obituary be?",
        answer:
          "As long as it needs to be and no longer. Obituaries for younger people are frequently shorter, because the factual record is shorter, and that is appropriate. Two accurate paragraphs are better than five padded ones.",
      },
      {
        question: "Can we ask people to donate somewhere specific?",
        answer:
          "Yes, and many families find it helpful. Name the organization exactly and, if possible, give a direct link or address so that donations reach the right place. If the organization has a tribute or memorial giving page, that is the one to name.",
      },
    ],
    related: ["daughter", "brother", "mother"],
  },
  {
    slug: "daughter",
    relationship: "daughter",
    title: "Obituary Template for a Daughter (Free, Fill-in-the-Blank)",
    shortTitle: "Obituary template for a daughter",
    description:
      "A free obituary template for a daughter, with careful wording for a shortened life, fill-in-the-blank structure, examples, and privacy guidance.",
    intro: [
      "Writing an obituary for a daughter means working with a form built for long lives. There may be no career to summarize, no decades of marriage, no grandchildren to count. The absence is not something to write around; it is simply what the notice will look like.",
      "Write what was actually true: what she was studying or doing, who she was close to, what she was in the middle of. Specificity is the only thing that makes this kind of notice feel like her rather than like a form.",
    ],
    include: [
      "Her full name, nickname, age, city, and date of death",
      "Birth date, birthplace, and parents' names",
      "School, training, work, or whatever stage she had reached",
      "What she was interested in and spent her time on",
      "One or two details her friends would recognize instantly",
      "Surviving family, including siblings, partner, and children if any",
      "Service details and any donation direction",
    ],
    fillIn: [
      "[Full name], [age], of [city, state], died on [date of death].",
      "She was born [birth date] in [birthplace] to [parents' names]. [She attended / She graduated from] [school] and [was studying / worked as / had recently started] [pursuit].",
      "[Daughter's first name] [what she cared about and gave her time to]. [Add one specific, recognizable detail: what she made, collected, argued about, or never missed.]",
      "She is survived by her parents, [names]; her [siblings and cities]; [her partner / her children]; and her grandparents, [names]. [She was preceded in death by [names].]",
      "[Service type] will be held [date, time, location]. [Friends are invited to [gathering detail].]",
      "[Optional: In lieu of flowers, donations may be made to [organization].]",
    ],
    examples: [
      {
        label: "Short version for a newspaper",
        words: "About 75 words",
        paragraphs: [
          "Naomi Beatriz Reyes, 19, of Tucson, died on September 18, 2026.",
          "Born February 27, 2007, in Tucson to Marco and Diana Reyes, she graduated from Sahuaro High School in 2025 and was a first-year nursing student at Pima Community College.",
          "She is survived by her parents; her brothers, Elias and Mateo Reyes; and her grandmother, Josefina Reyes.",
          "A vigil will be held September 24 at 6 p.m. at St. Cyril of Alexandria, with a Mass the following morning.",
        ],
      },
      {
        label: "Longer version for a funeral home page or program",
        words: "About 190 words",
        paragraphs: [
          "Naomi Beatriz Reyes, 19, of Tucson, died on September 18, 2026.",
          "Naomi was born February 27, 2007, in Tucson to Marco and Diana Reyes. She graduated from Sahuaro High School in 2025, where she ran cross country badly and cheerfully for four years, and had just finished her first semester of nursing school at Pima Community College. She wanted to work in pediatrics. She had already decided this at fourteen and never revised it.",
          "Naomi took photographs of everything, mostly of other people, mostly without warning. She kept a shoebox of ticket stubs. She was the one who noticed when someone had gone quiet in a group, and she would text them separately, later, to ask.",
          "She is survived by her parents, Marco and Diana Reyes; her brothers, Elias and Mateo Reyes; her grandmother, Josefina Reyes; and a very large extended family. She was preceded in death by her grandfather, Hector Reyes.",
          "A vigil will be held at 6 p.m. on September 24 at St. Cyril of Alexandria Parish, with a funeral Mass at 10 a.m. the following morning. In lieu of flowers, the family asks that donations be made to the Pima Community College nursing scholarship fund.",
        ],
      },
    ],
    wording: {
      heading: "Wording that respects both honesty and privacy",
      lines: [
        "\"Died unexpectedly\" is the standard phrase when the family does not wish to state a cause.",
        "If the family chooses to name a cause in order to help others, plain language is now preferred over euphemism.",
        "\"The family asks for privacy regarding the circumstances\" is understood and respected by most readers and by most local newsrooms.",
        "If she was a caregiver, an older sibling, or the one who held a household together, say so directly. It is often the truest sentence available.",
        "Present tense sometimes appears in obituaries for young people — \"She is the one who noticed.\" Used once, deliberately, it reads as intentional rather than as an error.",
      ],
    },
    pitfalls: [
      "Publishing circumstances that siblings or a partner have not agreed to make public",
      "Adding length for the sake of length",
      "Naming a school or workplace in a way that draws attention to living minors",
      "Using stock condolence phrases in place of one real detail",
    ],
    faqs: [
      {
        question: "What if she was very young?",
        answer:
          "Obituaries for children and teenagers are typically short, and that is appropriate. Name her, her parents and siblings, the school or activity she was part of, one detail that was distinctly hers, and the service information. Nothing more is required.",
      },
      {
        question: "Should we mention a partner who is not a spouse?",
        answer:
          "Yes, if the relationship was significant and the partner consents to being named. \"She is survived by her partner, [name]\" is standard, widely used, and reads as ordinary to most readers.",
      },
      {
        question: "Can friends contribute to the obituary?",
        answer:
          "Often, yes, and it frequently improves the result. Ask two or three close friends for a single specific memory, then select one detail from what they send. Keep final editing with one family member so that names, dates, and tone stay consistent.",
      },
    ],
    related: ["son", "sister", "mother"],
  },
  {
    slug: "brother",
    relationship: "brother",
    title: "Obituary Template for a Brother (Free, Fill-in-the-Blank)",
    shortTitle: "Obituary template for a brother",
    description:
      "A free obituary template for a brother, with sibling-voice wording, short and long examples, and guidance on humor, honesty, and family listings.",
    intro: [
      "An obituary written by a sibling sounds different from one written by a parent or spouse, and it should. Siblings knew the version of him that existed before anyone was being careful — the arguments, the running jokes, the things he was ridiculous about.",
      "That knowledge is an advantage. A brother's obituary can carry dry humor and unvarnished detail in a way that other notices cannot, as long as the humor is affectionate and nothing in it embarrasses someone still living.",
    ],
    include: [
      "His full name, nickname, age, city, and date of death",
      "Birth date, birthplace, and parents' names",
      "Military service, trade, work, or business",
      "Marriage and children, if applicable",
      "What he did with his time and what he was known for",
      "One specific, recognizable detail only family would know",
      "Surviving siblings, parents, and other family",
      "Service details and donation preference",
    ],
    fillIn: [
      "[Full name], [age], of [city, state], died on [date of death] [optional circumstance].",
      "He was born [birth date] in [birthplace] to [parents' names], the [first / second / youngest] of [number] children. [He served in the [branch] from [year] to [year].] [He worked as [occupation] for [number] years.]",
      "[Brother's first name] was [one specific and true characterization, not an adjective]. [Add a concrete example: what he always did, said, drove, fixed, argued about, or refused to do.]",
      "[Optional: He married [spouse] in [year], and they had [children's names].]",
      "He is survived by his [siblings and their cities]; [parents, if living]; [spouse and children]; and [nieces and nephews]. He was preceded in death by [names].",
      "[Service type] will be held [date, time, location]. [Donations may be made to [organization].]",
    ],
    examples: [
      {
        label: "Short version for a newspaper",
        words: "About 80 words",
        paragraphs: [
          "Curtis Lane Bowman, 57, of Chattanooga, died on June 11, 2026.",
          "Born March 2, 1969, in Cleveland, Tennessee, to Roy and Betty Bowman, he was a diesel mechanic for 30 years, most recently with Harmon Freight.",
          "He is survived by his brothers, Dale Bowman and Roy Bowman Jr.; his sister, Tanya Ellis; and seven nieces and nephews. He was preceded in death by his parents.",
          "A graveside service will be held June 17 at 2 p.m. at Hamilton Memorial Gardens.",
        ],
      },
      {
        label: "Longer version for a funeral home page or program",
        words: "About 195 words",
        paragraphs: [
          "Curtis Lane Bowman, 57, of Chattanooga, died on June 11, 2026.",
          "Curt was born March 2, 1969, in Cleveland, Tennessee, to Roy and Betty Bowman, the third of four children and, by his own account, the only one raised correctly. He was a diesel mechanic for 30 years, the last eleven with Harmon Freight, and he was the person other mechanics called when they had run out of ideas.",
          "He owned three trucks in his life and spoke about all of them in the present tense. He fished without patience and hunted without success, and he considered both outings a complete win if coffee was involved. He never once arrived anywhere on time and never once apologized for it.",
          "He showed up, though. Every move, every breakdown, every funeral. If you called Curt at two in the morning, he answered, complained the entire drive, and fixed it.",
          "He is survived by his brothers, Dale Bowman of Chattanooga and Roy Bowman Jr. of Knoxville; his sister, Tanya Ellis of Dalton; and seven nieces and nephews who were the true beneficiaries of his poor judgment about candy. He was preceded in death by his parents, Roy and Betty.",
          "A graveside service will be held at 2 p.m. on June 17 at Hamilton Memorial Gardens.",
        ],
      },
    ],
    wording: {
      heading: "Using humor without misjudging it",
      lines: [
        "Humor works when it is affectionate and specific. \"He never once arrived anywhere on time\" is funny because it is true and harmless.",
        "Humor fails when it requires context the reader does not have, or when the joke is at the expense of someone still living.",
        "Read any humorous line aloud to one other family member before publishing. If they hesitate, cut it.",
        "A serious closing line after a humorous middle usually lands well: \"He showed up, though.\"",
        "If the family is divided about tone, the plain version is the safer default. Notices cannot be edited once printed.",
      ],
    },
    pitfalls: [
      "Publishing an inside joke that reads as mockery to strangers",
      "Referring to addiction, prison, or estrangement without agreement from the whole family",
      "Forgetting to name a sibling, which is remembered far longer than anything else in the notice",
      "Writing entirely in a sibling voice when parents are still living and expect a conventional notice",
    ],
    faqs: [
      {
        question: "Can an obituary for a brother be funny?",
        answer:
          "It can, and humorous obituaries written by siblings are often the ones people keep. The requirement is that the humor be true, affectionate, and safe for everyone still living. If a line would make his child uncomfortable at school, leave it out.",
      },
      {
        question: "How do I write about a brother I was estranged from?",
        answer:
          "Stay factual. Give his name, dates, work, and survivors without characterizing the relationship. An obituary is a public record, not a place to settle or explain a rift, and a plain notice is not disrespectful.",
      },
      {
        question: "Who should be listed first among survivors?",
        answer:
          "If he had a spouse and children, they are listed first, followed by parents if living, then siblings, then nieces and nephews. For an unmarried brother, parents or siblings usually come first. Consistency matters more than the exact order.",
      },
    ],
    related: ["sister", "son", "father"],
  },
  {
    slug: "sister",
    relationship: "sister",
    title: "Obituary Template for a Sister (Free, Fill-in-the-Blank)",
    shortTitle: "Obituary template for a sister",
    description:
      "A free obituary template for a sister, with fill-in-the-blank structure, short and long examples, and wording that captures a sibling relationship.",
    intro: [
      "Sisters are frequently the people who held a family's logistics together — the calls made, the appointments tracked, the birthdays remembered. That work is invisible in most obituaries because it does not resemble a job title.",
      "Name it anyway. A notice that says she was the one who organized every gathering for thirty years tells readers more than any list of qualities, and it is usually the sentence her family recognizes immediately.",
    ],
    include: [
      "Her full name, maiden name if applicable, nickname, and age",
      "City, date of death, birth date, birthplace, and parents' names",
      "Her work, training, or business",
      "Marriage and children, if applicable",
      "The role she played within the family",
      "One concrete, recognizable detail",
      "Surviving siblings, parents, spouse, children, and others",
      "Service details and donation preference",
    ],
    fillIn: [
      "[Full name (née [maiden name])], [age], of [city, state], died on [date of death] [optional circumstance].",
      "She was born [birth date] in [birthplace] to [parents' names], the [position] of [number] children. [She worked as [occupation] for [number] years.] [She married [spouse] in [year].]",
      "[Sister's first name] was the one who [the role she actually played in the family: organized, remembered, mediated, hosted, drove, called].",
      "[Add one concrete detail: what she made every year, what she never missed, what she kept, what she insisted on.]",
      "She is survived by her [siblings and cities]; [spouse and children]; [parents, if living]; and [nieces and nephews]. She was preceded in death by [names].",
      "[Service type] will be held [date, time, location]. In lieu of flowers, donations may be made to [organization].",
    ],
    examples: [
      {
        label: "Short version for a newspaper",
        words: "About 80 words",
        paragraphs: [
          "Adele Fontaine Marsh (née Fontaine), 64, of Portland, died on October 3, 2026, after a long illness.",
          "Born July 9, 1962, in Lewiston, Maine, to Paul and Yvette Fontaine, she was a hospice nurse for 28 years.",
          "She is survived by her husband, Greg Marsh; her daughter, Claire Marsh; her sisters, Denise Fontaine and Michelle Auger; and her brother, Paul Fontaine Jr.",
          "A celebration of life will be held October 11 at 3 p.m. at the Kennebec Grange Hall.",
        ],
      },
      {
        label: "Longer version for a funeral home page or program",
        words: "About 195 words",
        paragraphs: [
          "Adele Fontaine Marsh (née Fontaine), 64, of Portland, died on October 3, 2026, after a long illness.",
          "Adele was born July 9, 1962, in Lewiston, Maine, to Paul and Yvette Fontaine, the eldest of four. She was a hospice nurse for 28 years, which surprised no one who had watched her run a household at seventeen. She sat with a great many families on the worst night of their lives and never once described it as difficult.",
          "She was the one who called. Every birthday, every anniversary, every time someone had gone quiet for too long. She kept a paper calendar and refused all attempts to modernize her. She made too much food for every gathering, on purpose, and sent everyone home with containers she expected returned.",
          "She married Greg Marsh in 1989. They spent thirty-six years arguing gently about the thermostat.",
          "She is survived by her husband, Greg; her daughter, Claire Marsh of Boston; her sisters, Denise Fontaine of Lewiston and Michelle Auger of Auburn; her brother, Paul Fontaine Jr.; and nine nieces and nephews. She was preceded in death by her parents.",
          "A celebration of life will be held at 3 p.m. on October 11 at the Kennebec Grange Hall. In lieu of flowers, donations may be made to Hospice of Southern Maine.",
        ],
      },
    ],
    wording: {
      heading: "Naming the work that does not look like work",
      lines: [
        "\"She was the one who called\" is a complete characterization and requires no adjective after it.",
        "If she was a caregiver for a parent, say so with the number of years. It is often the largest fact of her adult life.",
        "For a career in a caring profession, one specific line about how she practiced is better than a list of employers.",
        "If she never married, do not construct the notice around that absence. Lead with her work, her friendships, and her role in the family.",
        "Nieces and nephews frequently belong high in the survivor list for an aunt who was central to them.",
      ],
    },
    pitfalls: [
      "Describing her only in relation to her siblings and omitting her own work",
      "Listing survivors in an order that unintentionally demotes a long-term partner",
      "Guessing at the number of nieces and nephews rather than confirming it",
      "Using \"she was always there for everyone,\" which reads as filler where a real example belongs",
    ],
    faqs: [
      {
        question: "How do I describe a sister who was also my closest friend?",
        answer:
          "Say it plainly and once. \"She was my sister and the person I called first\" is stronger than a paragraph of adjectives. If several siblings feel the same way, a single line covering all of them avoids implying a ranking.",
      },
      {
        question: "Should I mention her illness?",
        answer:
          "Only if the family wants to. \"After a long illness\" is sufficient. Naming a specific illness is common when the family wants to direct memorial donations toward research or toward the hospice or hospital that cared for her.",
      },
      {
        question: "What if she had no spouse or children?",
        answer:
          "Build the survivor list around siblings, parents, nieces and nephews, and close friends, and consider naming a lifelong friend explicitly. Many obituaries include a line such as \"and her friend of forty years, [name],\" which is accurate and meaningful.",
      },
    ],
    related: ["brother", "daughter", "mother"],
  },
];

export function getObituaryTemplate(slug: string) {
  return obituaryTemplates.find((template) => template.slug === slug);
}

export type Reading = {
  id: string;
  title: string;
  author: string;
  year: string;
  tone: "peace" | "faith" | "grief" | "gratitude";
  fits: string;
  lines: string[];
  rights: string;
  source: { label: string; url: string };
};

export const readingTones: { id: Reading["tone"]; label: string; blurb: string }[] =
  [
    {
      id: "peace",
      label: "Peace and release",
      blurb:
        "For a long life, an expected death, or a service where the family wants the room to exhale.",
    },
    {
      id: "faith",
      label: "Scripture and faith",
      blurb:
        "The passages read most often at Christian funerals, in the King James text.",
    },
    {
      id: "grief",
      label: "Grief and love",
      blurb:
        "For a death that was too early, or when the family does not want the service to rush past the loss.",
    },
    {
      id: "gratitude",
      label: "Gratitude and a life well lived",
      blurb:
        "For a celebration of life, or a service that is meant to end with something other than sorrow.",
    },
  ];

const GUTENBERG_ROSSETTI = {
  label: "Project Gutenberg, Poems (1866 American edition)",
  url: "https://www.gutenberg.org/files/19188/19188-h/19188-h.htm",
};

export const funeralReadings: Reading[] = [
  {
    id: "remember",
    title: "Remember",
    author: "Christina Rossetti",
    year: "Written 1849, published 1862",
    tone: "peace",
    fits:
      "The most frequently requested remembrance sonnet in English. It gives the living explicit permission to be happy again, which is often exactly what a grieving family needs said out loud by someone else.",
    lines: [
      "Remember me when I am gone away,",
      "  Gone far away into the silent land;",
      "  When you can no more hold me by the hand,",
      "Nor I half turn to go yet turning stay.",
      "Remember me when no more, day by day,",
      "  You tell me of our future that you planned:",
      "  Only remember me; you understand",
      "It will be late to counsel then or pray.",
      "Yet if you should forget me for a while",
      "  And afterwards remember, do not grieve:",
      "  For if the darkness and corruption leave",
      "  A vestige of the thoughts that once I had,",
      "Better by far you should forget and smile",
      "  Than that you should remember and be sad.",
    ],
    rights: "Public domain worldwide. Rossetti died in 1894.",
    source: GUTENBERG_ROSSETTI,
  },
  {
    id: "song",
    title: "Song (\"When I am dead, my dearest\")",
    author: "Christina Rossetti",
    year: "Published 1862",
    tone: "peace",
    fits:
      "Gentle and unsentimental. Often chosen for a woman, and well suited to a graveside service or a natural burial, because the imagery is grass, rain, and open air rather than monument and ceremony.",
    lines: [
      "When I am dead, my dearest,",
      "  Sing no sad songs for me;",
      "Plant thou no roses at my head,",
      "  Nor shady cypress-tree:",
      "Be the green grass above me",
      "  With showers and dewdrops wet;",
      "And if thou wilt, remember,",
      "  And if thou wilt, forget.",
      "",
      "I shall not see the shadows,",
      "  I shall not feel the rain;",
      "I shall not hear the nightingale",
      "  Sing on, as if in pain:",
      "And dreaming through the twilight",
      "  That doth not rise nor set,",
      "Haply I may remember,",
      "  And haply may forget.",
    ],
    rights: "Public domain worldwide. Rossetti died in 1894.",
    source: GUTENBERG_ROSSETTI,
  },
  {
    id: "requiem",
    title: "Requiem",
    author: "Robert Louis Stevenson",
    year: "Published 1887 in Underwoods",
    tone: "gratitude",
    fits:
      "Eight lines, and the shortest reading here that still feels complete. Stevenson wrote it as his own epitaph and it is carved on his tomb in Samoa. Frequently chosen for someone who traveled, sailed, hunted, or simply got what they wanted out of their life.",
    lines: [
      "Under the wide and starry sky,",
      "Dig the grave and let me lie.",
      "Glad did I live and gladly die,",
      "And I laid me down with a will.",
      "",
      "This be the verse you grave for me:",
      "Here he lies where he longed to be;",
      "Home is the sailor, home from sea,",
      "And the hunter home from the hill.",
    ],
    rights: "Public domain worldwide. Stevenson died in 1894.",
    source: {
      label: "Wikisource, Underwoods (1887)",
      url: "https://en.wikisource.org/wiki/Underwoods/Requiem",
    },
  },
  {
    id: "crossing-the-bar",
    title: "Crossing the Bar",
    author: "Alfred, Lord Tennyson",
    year: "Published 1889",
    tone: "peace",
    fits:
      "Tennyson asked that this be placed at the end of every edition of his poems. It is a favorite at services for sailors, veterans of the sea services, and anyone who lived near water, and it reads beautifully aloud.",
    lines: [
      "Sunset and evening star,",
      "  And one clear call for me!",
      "And may there be no moaning of the bar,",
      "  When I put out to sea,",
      "",
      "But such a tide as moving seems asleep,",
      "  Too full for sound and foam,",
      "When that which drew from out the boundless deep",
      "  Turns again home.",
      "",
      "Twilight and evening bell,",
      "  And after that the dark!",
      "And may there be no sadness of farewell,",
      "  When I embark;",
      "",
      "For tho' from out our bourne of Time and Place",
      "  The flood may bear me far,",
      "I hope to see my Pilot face to face",
      "  When I have crost the bar.",
    ],
    rights: "Public domain worldwide. Tennyson died in 1892.",
    source: {
      label: "Wikisource, Demeter and Other Poems (1889)",
      url: "https://en.wikisource.org/wiki/Demeter_and_other_poems/Crossing_the_Bar",
    },
  },
  {
    id: "death-be-not-proud",
    title: "Death, Be Not Proud (Holy Sonnet 10)",
    author: "John Donne",
    year: "Written c. 1609, published 1633",
    tone: "faith",
    fits:
      "Defiant rather than consoling. Chosen at Christian services when the family wants the reading to argue with death instead of accepting it. The spelling below has been modernized; Donne's original text differs.",
    lines: [
      "Death, be not proud, though some have callèd thee",
      "Mighty and dreadful, for thou art not so;",
      "For those whom thou think'st thou dost overthrow",
      "Die not, poor Death, nor yet canst thou kill me.",
      "From rest and sleep, which but thy pictures be,",
      "Much pleasure; then from thee much more must flow,",
      "And soonest our best men with thee do go,",
      "Rest of their bones, and soul's delivery.",
      "Thou art slave to fate, chance, kings, and desperate men,",
      "And dost with poison, war, and sickness dwell,",
      "And poppy or charms can make us sleep as well",
      "And better than thy stroke; why swell'st thou then?",
      "One short sleep past, we wake eternally,",
      "And death shall be no more; Death, thou shalt die.",
    ],
    rights: "Public domain worldwide. Donne died in 1631.",
    source: {
      label: "Wikisource, Holy Sonnets",
      url: "https://en.wikisource.org/wiki/Holy_Sonnets/Holy_Sonnet_10",
    },
  },
  {
    id: "psalm-23",
    title: "Psalm 23",
    author: "King James Version",
    year: "Published 1611",
    tone: "faith",
    fits:
      "The single most-read passage at funerals in the English-speaking world. Nearly everyone in the room will know it, and many will say it along with the reader, which is often the point.",
    lines: [
      "The LORD is my shepherd; I shall not want.",
      "He maketh me to lie down in green pastures: he leadeth me beside the still waters.",
      "He restoreth my soul: he leadeth me in the paths of righteousness for his name's sake.",
      "Yea, though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me; thy rod and thy staff they comfort me.",
      "Thou preparest a table before me in the presence of mine enemies: thou anointest my head with oil; my cup runneth over.",
      "Surely goodness and mercy shall follow me all the days of my life: and I will dwell in the house of the LORD for ever.",
    ],
    rights:
      "The King James Version is in the public domain in the United States. In the United Kingdom it remains under perpetual Crown letters patent, though reproduction for worship and funeral use is permitted.",
    source: {
      label: "King James Version, Psalm 23",
      url: "https://en.wikisource.org/wiki/Bible_(King_James)/Psalms",
    },
  },
  {
    id: "ecclesiastes-3",
    title: "Ecclesiastes 3:1-8",
    author: "King James Version",
    year: "Published 1611",
    tone: "faith",
    fits:
      "The \"a time to\" passage. It works at religious and secular services alike, because it frames a death as part of an order rather than as a rupture. Often read for someone who lived a long life.",
    lines: [
      "To every thing there is a season, and a time to every purpose under the heaven:",
      "A time to be born, and a time to die; a time to plant, and a time to pluck up that which is planted;",
      "A time to kill, and a time to heal; a time to break down, and a time to build up;",
      "A time to weep, and a time to laugh; a time to mourn, and a time to dance;",
      "A time to cast away stones, and a time to gather stones together; a time to embrace, and a time to refrain from embracing;",
      "A time to get, and a time to lose; a time to keep, and a time to cast away;",
      "A time to rend, and a time to sew; a time to keep silence, and a time to speak;",
      "A time to love, and a time to hate; a time of war, and a time of peace.",
    ],
    rights:
      "Public domain in the United States. Crown letters patent apply in the United Kingdom.",
    source: {
      label: "King James Version, Ecclesiastes 3",
      url: "https://en.wikisource.org/wiki/Bible_(King_James)/Ecclesiastes",
    },
  },
  {
    id: "john-14",
    title: "John 14:1-3",
    author: "King James Version",
    year: "Published 1611",
    tone: "faith",
    fits:
      "Short, and one of the most commonly selected Gospel readings at Christian funerals. Frequently paired with Psalm 23 when a service needs two readings.",
    lines: [
      "Let not your heart be troubled: ye believe in God, believe also in me.",
      "In my Father's house are many mansions: if it were not so, I would have told you. I go to prepare a place for you.",
      "And if I go and prepare a place for you, I will come again, and receive you unto myself; that where I am, there ye may be also.",
    ],
    rights:
      "Public domain in the United States. Crown letters patent apply in the United Kingdom.",
    source: {
      label: "King James Version, John 14",
      url: "https://en.wikisource.org/wiki/Bible_(King_James)/John",
    },
  },
  {
    id: "because-i-could-not-stop",
    title: "Because I Could Not Stop for Death",
    author: "Emily Dickinson",
    year: "Published 1890",
    tone: "grief",
    fits:
      "Quiet and strange rather than comforting, and a good choice when conventional readings would feel false. The version below is the 1890 edited text, which is the one in the public domain and the one most often read aloud.",
    lines: [
      "Because I could not stop for Death,",
      "He kindly stopped for me;",
      "The carriage held but just ourselves",
      "And Immortality.",
      "",
      "We slowly drove, he knew no haste,",
      "And I had put away",
      "My labor, and my leisure too,",
      "For his civility.",
      "",
      "We passed the school where children played,",
      "Their lessons scarcely done;",
      "We passed the fields of gazing grain,",
      "We passed the setting sun.",
      "",
      "We paused before a house that seemed",
      "A swelling of the ground;",
      "The roof was scarcely visible,",
      "The cornice but a mound.",
      "",
      "Since then 'tis centuries; but each",
      "Feels shorter than the day",
      "I first surmised the horses' heads",
      "Were toward eternity.",
    ],
    rights:
      "Public domain. First published in Poems by Emily Dickinson (1890), edited by Mabel Loomis Todd and T. W. Higginson.",
    source: {
      label: "Project Gutenberg, Poems by Emily Dickinson",
      url: "https://www.gutenberg.org/ebooks/12242",
    },
  },
  {
    id: "to-an-athlete",
    title: "To an Athlete Dying Young",
    author: "A. E. Housman",
    year: "Published 1896 in A Shropshire Lad",
    tone: "grief",
    fits:
      "Written for a young death, and honest about it rather than consoling. Read at services for athletes and for young people generally, though the family should read it through first, because it does not soften anything.",
    lines: [
      "The time you won your town the race",
      "We chaired you through the market-place;",
      "Man and boy stood cheering by,",
      "And home we brought you shoulder-high.",
      "",
      "To-day, the road all runners come,",
      "Shoulder-high we bring you home,",
      "And set you at your threshold down,",
      "Townsman of a stiller town.",
      "",
      "Smart lad, to slip betimes away",
      "From fields where glory does not stay,",
      "And early though the laurel grows",
      "It withers quicker than the rose.",
      "",
      "Eyes the shady night has shut",
      "Cannot see the record cut,",
      "And silence sounds no worse than cheers",
      "After earth has stopped the ears:",
      "",
      "Now you will not swell the rout",
      "Of lads that wore their honours out,",
      "Runners whom renown outran",
      "And the name died before the man.",
      "",
      "So set, before its echoes fade,",
      "The fleet foot on the sill of shade,",
      "And hold to the low lintel up",
      "The still-defended challenge-cup.",
      "",
      "And round that early-laurelled head",
      "Will flock to gaze the strengthless dead,",
      "And find unwithered on its curls",
      "The garland briefer than a girl's.",
    ],
    rights: "Public domain. A Shropshire Lad was published in 1896.",
    source: {
      label: "Wikisource, A Shropshire Lad",
      url: "https://en.wikisource.org/wiki/A_Shropshire_Lad/To_an_Athlete_Dying_Young",
    },
  },
  {
    id: "nothing-gold",
    title: "Nothing Gold Can Stay",
    author: "Robert Frost",
    year: "Published 1923",
    tone: "gratitude",
    fits:
      "Eight lines about impermanence that never mentions death. Works well as an opening reading, particularly at a celebration of life, and is short enough to print on a program panel without crowding the page.",
    lines: [
      "Nature's first green is gold,",
      "Her hardest hue to hold.",
      "Her early leaf's a flower;",
      "But only so an hour.",
      "Then leaf subsides to leaf.",
      "So Eden sank to grief,",
      "So dawn goes down to day.",
      "Nothing gold can stay.",
    ],
    rights:
      "Public domain in the United States. First published in 1923 in New Hampshire, so United States copyright has expired. Copyright terms differ in some other countries.",
    source: {
      label: "Wikisource, New Hampshire (1923)",
      url: "https://en.wikisource.org/wiki/New_Hampshire,_a_Poem_with_Notes_and_Grace_Notes/Nothing_Gold_Can_Stay",
    },
  },
  {
    id: "psalm-121",
    title: "Psalm 121:1-4",
    author: "King James Version",
    year: "Published 1611",
    tone: "peace",
    fits:
      "Short, and often chosen for someone who lived in or loved high country. Frequently used as a graveside reading, where brevity matters more than at any other point in the day.",
    lines: [
      "I will lift up mine eyes unto the hills, from whence cometh my help.",
      "My help cometh from the LORD, which made heaven and earth.",
      "He will not suffer thy foot to be moved: he that keepeth thee will not slumber.",
      "Behold, he that keepeth Israel shall neither slumber nor sleep.",
    ],
    rights:
      "Public domain in the United States. Crown letters patent apply in the United Kingdom.",
    source: {
      label: "King James Version, Psalm 121",
      url: "https://en.wikisource.org/wiki/Bible_(King_James)/Psalms",
    },
  },
];

export const permissionNeeded = [
  {
    title: "She Is Gone (also published as He Is Gone)",
    author: "David Harkins, 1981",
    status:
      "In copyright. It circulates almost everywhere credited to an anonymous author, and that missing credit is usually why people assume it is free to print. It is not. Of the twelve most visible funeral poem pages we reviewed, nine reproduced it.",
  },
  {
    title: "Do Not Stand at My Grave and Weep",
    author: "Attributed to Mary Elizabeth Frye, c. 1932",
    status:
      "Authorship was disputed for decades and the copyright position has never been fully settled. It is reproduced widely, including by funeral homes, but its status is not the same as a clearly expired copyright.",
  },
  {
    title: "The Dash",
    author: "Linda Ellis, 1996",
    status:
      "In copyright and actively licensed. The rights holder has historically pursued unlicensed reproductions, including by small businesses and individuals. Seek permission before printing it in a program.",
  },
  {
    title: "When Great Trees Fall",
    author: "Maya Angelou, 1990",
    status:
      "In copyright. Reading it aloud at a private service is a different matter from reproducing the text in a printed program, which requires permission from the publisher.",
  },
  {
    title: "Funeral Blues (\"Stop all the clocks\")",
    author: "W. H. Auden, 1936 and 1938",
    status:
      "In copyright in the United States and in most countries. Very frequently requested since its use in film, and very frequently reprinted without permission.",
  },
  {
    title: "Song lyrics of any kind",
    author: "Modern popular music",
    status:
      "Almost always in copyright. Playing a recording at a private service is generally acceptable; printing the lyrics in a program is a separate reproduction and normally requires a license.",
  },
];

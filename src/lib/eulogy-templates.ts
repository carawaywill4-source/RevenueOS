export type EulogyTemplate = {
  slug: string;
  relationship: string;
  title: string;
  shortTitle: string;
  description: string;
  intro: string[];
  openings: { label: string; text: string }[];
  example: {
    label: string;
    minutes: string;
    words: string;
    paragraphs: string[];
  };
  guidance: { heading: string; lines: string[] };
  faqs: { question: string; answer: string }[];
  related: string[];
};

export const EULOGY_STRUCTURE = [
  {
    part: "Say who you are",
    detail:
      "One sentence. \"I'm Dana, Ruth's youngest.\" Half the room does not know you, and they cannot follow the stories until they know where you stood.",
    seconds: "10 seconds",
  },
  {
    part: "Give the one line",
    detail:
      "The single sentence that captures them. Not a list of qualities. One claim you can then prove.",
    seconds: "15 seconds",
  },
  {
    part: "Prove it with two stories",
    detail:
      "Two specific scenes, forty to sixty seconds each. Concrete details do the work that adjectives cannot.",
    seconds: "2 minutes",
  },
  {
    part: "Say what they left behind",
    detail:
      "What the people in this room do differently because of them. Keep it to a few sentences.",
    seconds: "30 seconds",
  },
  {
    part: "Close by speaking to them",
    detail:
      "Turn from the room to the person. A short, direct farewell lands better than a summary.",
    seconds: "20 seconds",
  },
];

export const eulogyTemplates: EulogyTemplate[] = [
  {
    slug: "mother",
    relationship: "mother",
    title: "Eulogy for a Mother: Full Example and How to Write Yours",
    shortTitle: "Eulogy for a mother",
    description:
      "A complete example eulogy for a mother, plus opening lines, a five-part structure, and practical advice on writing and delivering it without falling apart.",
    intro: [
      "The hardest part of writing a eulogy for your mother is that you know too much. Fifty years of material, five minutes to use it, and every choice feels like leaving something out.",
      "You are not summarizing her life. You are giving the room one true version of her that they will carry out the door. Pick the smallest specific thing you can think of and build outward from there.",
    ],
    openings: [
      {
        label: "The habit that explains her",
        text: "My mother did not own a single recipe card. Every dish she made lived in her hands. If you asked how much of something to add, she looked at you and said \"enough.\" We are all still working out what enough means.",
      },
      {
        label: "The rule of the house",
        text: "My mother had one rule, and it was not negotiable: nobody leaves this house hungry. Neighbors, delivery drivers, a friend of a friend who turned up unannounced. She would find something.",
      },
      {
        label: "The thing she always said",
        text: "Every phone call with my mother ended the same way. \"Drive safe. Text me when you get there.\" I did not always text. She always waited.",
      },
      {
        label: "For a complicated relationship",
        text: "My mother and I spent a long time learning how to be in the same room. We got there. I am grateful we did not run out of time first.",
      },
    ],
    example: {
      label: "Full example eulogy for a mother, delivered by a daughter",
      minutes: "About 3 minutes",
      words: "About 380 words · fictional",
      paragraphs: [
        "Good morning. I'm Dana. I'm Ruth's youngest, which in our family meant I got the version of her that had already run out of patience for rules.",
        "My mother believed that the correct response to nearly any problem was to feed someone. Not to fix it. Not to discuss it. To feed the person, and then see how things looked afterward. She was, annoyingly, right most of the time.",
        "When my father lost his job in 1994, she did not sit us down for a talk. She made a pot roast on a Tuesday, which was unheard of, and we all understood that something serious was happening and that we would be all right. That was the whole conversation. We ate.",
        "She kept a drawer in the kitchen for the grandchildren. Candy, a small toy, and a five-dollar bill inside a card she had written before they arrived. Every visit. Nine grandchildren, thirty-some years. Nobody ever caught her preparing it. I have thought about that a great deal since she died, because it means she was doing it alone, at the kitchen table, thinking about each of them one at a time.",
        "She was not a saint, and she would object to being made into one. She burned things. She had a temper that arrived without warning and left without apology. She held a grudge against a neighbor for eleven years over a fence, and she was not sorry.",
        "But she noticed people. When she got sick, the first thing she said to me was not about her treatment. It was that somebody needed to keep taking dinner to Mrs. Patterson across the street. That was the first thing. Mrs. Patterson's dinner.",
        "What she left us is not complicated. My brother calls people back. My sister keeps a drawer for her nieces. I catch myself asking people if they have eaten, when what I mean is that I love them and I do not know how to say it directly either. She gave us all the same limited vocabulary and it turns out to be enough.",
        "Mom, thank you for the Tuesday pot roast. Thank you for the drawer. Thank you for eleven years of being right about that fence.",
        "Drive safe. We will text you when we get there.",
      ],
    },
    guidance: {
      heading: "Writing it, and getting through it",
      lines: [
        "Write it as a letter to her, then remove the parts the room cannot follow. That produces a warmer draft than writing a speech from the start.",
        "Three to five minutes is standard, which is roughly four hundred to seven hundred spoken words. Time yourself out loud rather than counting words.",
        "Print it in fourteen point on single sheets, not stapled, and number them. Do not read from a phone; screens dim and hands shake.",
        "Choose one flaw and include it. A eulogy with no flaw in it sounds like a stranger, and the room relaxes the moment they recognize her.",
        "Ask someone to sit in the front row holding a copy. If you cannot finish, they stand up and finish. Arrange this in advance and tell them it is genuinely fine.",
        "Crying is not failure. Stop, breathe, take a drink of water, and continue. Nobody in that room is judging your delivery.",
      ],
    },
    faqs: [
      {
        question: "How long should a eulogy for a mother be?",
        answer:
          "Three to five minutes, or about four hundred to seven hundred spoken words. Longer eulogies lose the room, and they are much harder to deliver while grieving. If several people are speaking, ask the officiant for your allotted time before you write.",
      },
      {
        question: "What if I cannot get through it?",
        answer:
          "Give a printed copy to someone in the front row before the service and agree that they will finish if you stop. This is common, officiants expect it, and knowing the safety net exists usually makes it less likely you will need it.",
      },
      {
        question: "Should I mention her faults?",
        answer:
          "One, briefly, and affectionately. A eulogy that describes a flawless person does not sound like anyone. Naming a real habit that everyone recognized is often the moment the room loosens and starts remembering her rather than listening to you.",
      },
    ],
    related: ["father", "grandmother", "sibling"],
  },
  {
    slug: "father",
    relationship: "father",
    title: "Eulogy for a Father: Full Example and How to Write Yours",
    shortTitle: "Eulogy for a father",
    description:
      "A complete example eulogy for a father, with opening lines, structure, delivery advice, and guidance on humor and a complicated relationship.",
    intro: [
      "Eulogies for fathers tend to arrive as a list of accomplishments, because that is often how fathers presented themselves. Job, service, years, retirement. The room already knows most of it.",
      "What they do not know is the small repeated thing he did that only his family saw. That is the eulogy. One habit, told plainly, will outlast any summary of his career.",
    ],
    openings: [
      {
        label: "Showing up as the whole point",
        text: "My dad showed love by showing up. He drove me to every tournament I ever played in, waited two hours in a parking lot, and never once mentioned it. That was the whole thing. He never needed the credit.",
      },
      {
        label: "The object that stands for him",
        text: "My father kept a coffee can of assorted screws that he sincerely believed was organized. He is not here to defend it. It was not organized. He found what he needed every single time.",
      },
      {
        label: "The phrase",
        text: "My father answered almost every question with \"we'll see.\" It took us most of our childhood to work out that \"we'll see\" meant yes.",
      },
      {
        label: "For a difficult father",
        text: "My father was not an easy man, and he would not want me pretending otherwise in a church. What he was, without fail, was there. When something broke, he came.",
      },
    ],
    example: {
      label: "Full example eulogy for a father, delivered by a son",
      minutes: "About 3 minutes",
      words: "About 410 words · fictional",
      paragraphs: [
        "I'm Kevin. Ray was my dad.",
        "My father spent thirty-four years as a lineman. That means that for thirty-four years, when the weather got bad enough that everyone else was told to stay home, he put on a coat and left. We used to watch the ice come down and know, without anyone saying it, that we would not see him that night.",
        "He never described this as brave. He described it as the job. If you had suggested it was brave, he would have looked at you the way he looked at anyone being unnecessary.",
        "He could fix nearly anything and was constitutionally unable to pay anyone else to do it. He rebuilt the same lawnmower for about twenty years. At a certain point it contained no original parts. He knew this. He considered it a victory.",
        "He coached Little League for eleven seasons. I want to be honest with you: he was not good at it. He did not know the rules well and he refused to learn them. But he never missed a practice, he learned every kid's name in the first week, and he called all of them \"chief,\" which we eventually understood was because he could not keep the names straight after all.",
        "He was not a talker. In my entire life, I do not think my father told me he loved me in those words more than twice, and both times somebody was in the hospital. What he did instead was change my oil. For twenty years, whenever I visited, he took my keys without asking and I would find the car done and the receipt for the filter on the seat. He never mentioned it. I never thanked him properly, because in our family that would have embarrassed us both.",
        "Two weeks ago I changed my own oil for the first time in twenty years, in the driveway, badly. I want to report that I now understand exactly what he was saying every single time.",
        "What he left behind is a family of people who show up. When somebody has a breakdown at two in the morning, one of us answers. We complain the entire drive, because that is also the inheritance. But we come.",
        "Dad, thank you for the parking lots. Thank you for the oil changes. Thank you for eleven seasons of getting the rules wrong on purpose so that everyone got to play.",
        "We've got it from here, chief.",
      ],
    },
    guidance: {
      heading: "Writing it, and getting through it",
      lines: [
        "Resist the résumé. Name the job in one sentence, then spend the rest on what he actually did with his hands and his time.",
        "Dry humor works at a father's funeral more reliably than at almost any other. Keep it affectionate and make sure nothing lands on someone still living.",
        "If he served, mention it once and get the branch and years right. Veterans in the room will notice an error, and it will be the only thing they remember.",
        "For a complicated relationship, one honest sentence is better than a performance of closeness. \"He was not an easy man\" earns you the rest of the eulogy.",
        "Print it large on unstapled numbered pages, and give a copy to someone in the front row who can finish it if you cannot.",
        "Practice the last line out loud until you can say it without stopping. The ending is the part people carry out of the room.",
      ],
    },
    faqs: [
      {
        question: "Can a eulogy for a father be funny?",
        answer:
          "Yes, and the funny ones are frequently the ones families keep. The test is whether the joke is affectionate, true, and safe for everyone still living. Read any humorous line to one other family member first; if they hesitate, cut it.",
      },
      {
        question: "How do I write a eulogy for a father I was not close to?",
        answer:
          "Do not perform a closeness that was not there, because the room will hear it. Say one honest sentence acknowledging the distance, then speak about what was genuinely true: what he provided, what he taught by accident, what you understand now that you did not then.",
      },
      {
        question: "Should I mention his military service?",
        answer:
          "One sentence, if it mattered to him, with the branch and years stated accurately. If honors are being rendered at the committal, the service will speak for itself and your eulogy does not need to carry it.",
      },
    ],
    related: ["mother", "grandfather", "sibling"],
  },
  {
    slug: "grandmother",
    relationship: "grandmother",
    title: "Eulogy for a Grandmother: Full Example and How to Write Yours",
    shortTitle: "Eulogy for a grandmother",
    description:
      "A complete example eulogy for a grandmother, with opening lines, structure, and advice on speaking for many cousins at once.",
    intro: [
      "A grandchild giving a eulogy is usually speaking on behalf of a group. There are cousins in the room who knew a different version of her, and an aunt or uncle who knew her far longer than you did.",
      "That is an advantage. You are allowed to speak as the generation she made, rather than as the authority on her life. Say what she was to all of you, and let her children keep their own version.",
    ],
    openings: [
      {
        label: "The house as the subject",
        text: "There were eleven of us grandchildren, and every single one believed we were her favorite. I have since compared notes with my cousins. She ran a remarkably sophisticated operation.",
      },
      {
        label: "The kitchen",
        text: "My grandmother's kitchen had a drawer of butterscotch candies we were technically not allowed to open. In sixty years she never once locked it.",
      },
      {
        label: "What she called you",
        text: "My grandmother called all of us \"lovey,\" which we assumed was affection until we got older and realized she had eleven grandchildren and a system.",
      },
      {
        label: "For a long decline",
        text: "For the last two years my grandmother did not always know which grandchild I was. She was always, without exception, delighted that one of us had come.",
      },
    ],
    example: {
      label: "Full example eulogy for a grandmother, delivered by a granddaughter",
      minutes: "About 3 minutes",
      words: "About 340 words · fictional",
      paragraphs: [
        "I'm Marisol. I'm one of Rose's eleven grandchildren, and I have been asked to speak for all of us, which is the most dangerous assignment in this family.",
        "Our grandmother left school at sixteen to help at home. She learned to sew from her mother and ran the alterations counter at Baird's for twenty-two years. She could look at a hem and tell you the measurement, out loud, correctly. People stopped checking. My cousin Danny tested her once with a tape measure. He was wrong and she was right and he has never fully recovered.",
        "The kitchen was the whole thing. Pierogi at Christmas, an argument every single year about whether there were enough, and always, obviously, more than enough. She cooked as though a bus might arrive.",
        "She had a drawer of butterscotch candies that we were not supposed to open. She never locked it. She never restocked it in front of us either, which for about thirty years allowed all eleven of us to believe we were getting away with something.",
        "Here is what I did not understand until I was an adult. She was not a soft woman. She was a woman who had decided, quite deliberately, that this family was going to be a soft place. Those are different things, and the second one is much harder work.",
        "She buried a husband and a son. She did it without ever once making the rest of us responsible for carrying it. When my mother tried to talk to her about it, she would say the same thing every time: \"I have you. Go eat something.\"",
        "So what she left us is a family that turns up with too much food and does not talk about feelings especially well, and honestly, it works. Eleven grandchildren, nineteen great-grandchildren, and every one of them has somewhere to go on a bad day. She built that. She built it out of pierogi and butterscotch and refusing to be a burden.",
        "Busia, we counted. There was always enough.",
      ],
    },
    guidance: {
      heading: "Writing it, and getting through it",
      lines: [
        "Ask the cousins for one memory each a few days beforehand. Use two. The others will hear their own family in what you chose.",
        "Use the name her grandchildren actually called her. It signals immediately whose voice this is.",
        "Do not try to cover her whole life. Her children may speak, and the obituary carries the record. Your job is one generation's version.",
        "If she had a long decline, you may name it briefly and then move past it. The last two years are not the story.",
        "Three to four minutes is right for a grandchild's eulogy, particularly when others are also speaking.",
        "Practice the closing line until it is automatic. That is the sentence that will break you if it is not.",
      ],
    },
    faqs: [
      {
        question: "Is it appropriate for a grandchild to give the eulogy?",
        answer:
          "Very. It is increasingly common, and grandchildren frequently give the warmest eulogy of the service because they are one step removed from the immediate grief. Coordinate with your parent and the officiant so that speakers do not overlap.",
      },
      {
        question: "How do I speak for all the grandchildren?",
        answer:
          "Say explicitly that you are, then gather one memory from each cousin and use two of them. Name the cousins whose memories you used. Everyone else will recognize the shared material and will not feel left out.",
      },
      {
        question: "What if I did not know her well?",
        answer:
          "Say so plainly and speak about what you did have. \"I saw her twice a year, and here is what those visits were like\" is honest and specific. A short true eulogy is better than a long one built from other people's memories.",
      },
    ],
    related: ["grandfather", "mother", "sibling"],
  },
  {
    slug: "grandfather",
    relationship: "grandfather",
    title: "Eulogy for a Grandfather: Full Example and How to Write Yours",
    shortTitle: "Eulogy for a grandfather",
    description:
      "A complete example eulogy for a grandfather, with opening lines, structure, delivery advice, and guidance on trade, service, and quiet men.",
    intro: [
      "Many grandfathers were not talkers, which makes the usual eulogy advice about capturing their voice difficult. There may not be a memorable phrase to quote.",
      "For a quiet man, the material is what he did repeatedly. The tool he kept, the route he drove, the thing he taught you without ever explaining it. Describe the action and the room will supply the feeling.",
    ],
    openings: [
      {
        label: "What he taught you sideways",
        text: "My grandfather taught four of us to drive on a tractor that was older than our parents. He never gave instructions. He got in the passenger seat and waited, which turns out to be a whole philosophy.",
      },
      {
        label: "The daily routine",
        text: "My grandfather read the weather page before the front page, every morning, for sixty years. He was a farmer. It was, I now understand, the news.",
      },
      {
        label: "The quiet man",
        text: "My grandfather was not a talker. If you wanted a conversation with him you had to go and do something alongside him, and then eventually, about forty minutes in, he would say something worth waiting for.",
      },
      {
        label: "For a veteran",
        text: "My grandfather served four years in the Navy and told us almost nothing about it. What he did instead was stand up, every year, the whole time, at the parade.",
      },
    ],
    example: {
      label: "Full example eulogy for a grandfather, delivered by a grandson",
      minutes: "About 3 minutes",
      words: "About 360 words · fictional",
      paragraphs: [
        "I'm Alex. Walt was my grandfather. To all nine of us, he was Papa.",
        "He served four years in the Navy and then came home and farmed two hundred and forty acres for forty-six years. Those are the facts, and they are the only two sentences he would have permitted about himself.",
        "My grandfather did not explain things. He demonstrated them and then waited to see whether you had been paying attention. He taught four of his grandchildren to drive on a 1968 tractor he kept running long past the point of reason, and his entire method was to sit in the passenger seat and say nothing while you figured it out. If you did it wrong he did not correct you. He let the tractor correct you.",
        "He answered almost every question with \"we'll see.\" It took our whole childhood to learn that \"we'll see\" meant yes and that an actual no came out as a longer silence.",
        "He was careful with machinery and impatient with paperwork. He hauled more folding tables for that parish than anyone has ever counted, for twenty years on the council, and to my knowledge he never once volunteered. He simply arrived early and was already carrying something by the time anyone thought to ask.",
        "Here is the part I did not understand until recently. My grandfather did not think of any of that as generosity. He thought a person was supposed to be useful, and that talking about being useful was slightly embarrassing, and that the correct response to almost anything was to get up and go handle it.",
        "He was married to my grandmother for sixty-two years. I never heard him say anything sentimental to her. Every single morning of those sixty-two years he brought her coffee before he went out. He did not consider that romantic. He considered it coffee.",
        "So there are nine of us now, and between us we have a lot of half-finished projects and an inability to sit still while other people are working. That is what he left. It is not a bad inheritance.",
        "Papa, the tractor's still running. We'll see about the rest.",
      ],
    },
    guidance: {
      heading: "Writing it, and getting through it",
      lines: [
        "For a quiet man, build the eulogy out of actions rather than quotations. Describe what he did every day and let the meaning arrive on its own.",
        "Name the trade specifically. Lineman, dairy farmer, pipefitter, long-haul driver. The people who did that work will hear it.",
        "Verify military details before you say them out loud. Branch, years, and rank get misremembered inside families more often than anyone expects.",
        "One object often carries an entire eulogy: the truck, the tools, the chair, the tractor. Choose it early and return to it at the end.",
        "Three to four minutes. Grandfather eulogies tend to work better short.",
        "Say the last line to yourself in the car beforehand until it is steady.",
      ],
    },
    faqs: [
      {
        question: "How do I write a eulogy for someone who never talked about himself?",
        answer:
          "Interview two people who worked alongside him rather than lived with him. Colleagues, fellow parishioners, neighbors, or fellow veterans usually hold the concrete stories that families never heard, and one of those stories is often the whole eulogy.",
      },
      {
        question: "Should I include his military service?",
        answer:
          "Yes, in one or two sentences, with accurate details. If he rarely spoke about it, that reticence is itself worth naming, because it will be familiar to many people in the room.",
      },
      {
        question: "How long should a grandchild speak?",
        answer:
          "Three to four minutes. At most services multiple people speak, and the officiant will usually give you a limit. Ask for it before you write rather than trimming a finished draft.",
      },
    ],
    related: ["grandmother", "father", "friend"],
  },
  {
    slug: "sibling",
    relationship: "sibling",
    title: "Eulogy for a Brother or Sister: Full Example and How to Write Yours",
    shortTitle: "Eulogy for a sibling",
    description:
      "A complete example eulogy for a brother or sister, with opening lines, structure, and guidance on humor, honesty, and speaking while your parents are in the room.",
    intro: [
      "A sibling eulogy carries something no other eulogy can: you knew them before anyone was being careful. You have the childhood, the arguments, the version of them that existed before the job and the marriage and the adult manners.",
      "The complication is that your parents are in the room, and they are burying a child. Say the true thing, and be gentle about which true thing you choose.",
    ],
    openings: [
      {
        label: "The sibling frame",
        text: "I'm Dale. Curt was my brother, which meant I spent thirty years being told he was the funny one, and about a week ago I realized that I never once disagreed.",
      },
      {
        label: "The running joke",
        text: "My brother was never on time for anything, ever, in his entire life, and he never apologized for it once. I want that on the record while he cannot argue.",
      },
      {
        label: "For a sister who held things together",
        text: "My sister was the one who called. Every birthday, every anniversary, every time one of us went quiet for too long. None of us ever asked her to do that. She just decided it was her job.",
      },
      {
        label: "For a young or sudden death",
        text: "I am not going to stand here and tell you this makes sense. It does not. What I can tell you is exactly who my sister was, and I would like to spend the next four minutes doing that.",
      },
    ],
    example: {
      label: "Full example eulogy for a brother, delivered by a sibling",
      minutes: "About 3 minutes",
      words: "About 380 words · fictional",
      paragraphs: [
        "I'm Dale. Curt was my brother. He was the third of four, and by his own account the only one of us raised correctly.",
        "He was a diesel mechanic for thirty years. He was the guy other mechanics called when they had run out of ideas. I have met three separate men this week who told me the same story with different trucks in it.",
        "He owned three vehicles in his life and spoke about all of them in the present tense, including the one that was crushed in 2009. He fished without patience and hunted without success and considered any trip a complete win if coffee was involved.",
        "He was never on time. Not once. Not for my wedding, not for our mother's birthday, not for anything. He was forty minutes late to a funeral in 2018. Our sister Tanya has requested I mention that he was late to a funeral.",
        "But he showed up. That is the thing I need you to understand about my brother, and it is the only part of this I actually rehearsed. Every move. Every breakdown. Every hospital. If you called Curt at two in the morning he answered, he complained about it the entire drive, and then he fixed it and refused to take gas money.",
        "He did that for me in 2011, when things were bad and I was not returning anyone's calls. He did not call. He drove four hours and sat in my kitchen and did not say very much and would not leave. He stayed three days. We never talked about it afterward, not once, because that was not how we did things. But I am talking about it now, because he is not here to tell me to stop.",
        "There are seven nieces and nephews here today who were the primary beneficiaries of his very poor judgment about candy. They all called him Uncle Curt in a way that made it sound like a job title. It was.",
        "Mom, Dad, I'm sorry. This is the wrong order and we all know it.",
        "Curt, you would have hated all of this attention. You are also forty minutes late for your own funeral, so honestly, this is on brand.",
        "Thanks for the four hours, brother. I never said it. I'm saying it.",
      ],
    },
    guidance: {
      heading: "Writing it, and getting through it",
      lines: [
        "Humor is more available to a sibling than to anyone else speaking, and it should still be affectionate. If a line would embarrass their child at school, take it out.",
        "Your parents are burying a child. One sentence acknowledging that is usually right, and more than one becomes a second eulogy about them.",
        "If there was estrangement or addiction, do not use the eulogy to explain it. A funeral is a public record and it cannot be edited afterward.",
        "The one thing a sibling can give the room that nobody else can is a childhood scene. Use exactly one.",
        "Name the nieces and nephews if there are few enough. They will remember it for the rest of their lives.",
        "Give a copy to someone in the front row. Sibling eulogies break down more often than any other kind.",
      ],
    },
    faqs: [
      {
        question: "Should a sibling or a child give the eulogy?",
        answer:
          "Both often do, and they are different speeches. A child speaks about what the person was to them; a sibling speaks about who the person was before they became a parent. If both are speaking, agree in advance on who covers the childhood so the stories do not collide.",
      },
      {
        question: "How do I write a eulogy for a sibling who died young?",
        answer:
          "Do not try to make it make sense, and do not reach for consolation that you do not feel. Say plainly that it is wrong, then spend the rest of your time on who they actually were. Specific and short is the correct shape here.",
      },
      {
        question: "Can I mention things our parents do not know about?",
        answer:
          "Assume everything you say becomes permanent family knowledge, because it does. If a story would be new information to your parents at a funeral, save it for afterward or leave it alone.",
      },
    ],
    related: ["mother", "father", "friend"],
  },
  {
    slug: "friend",
    relationship: "friend",
    title: "Eulogy for a Friend: Full Example and How to Write Yours",
    shortTitle: "Eulogy for a friend",
    description:
      "A complete example eulogy for a friend, with opening lines, structure, and guidance on speaking respectfully when the family is in the front row.",
    intro: [
      "Being asked to speak for a friend is a particular kind of honor, and a particular kind of trap. You knew a version of them the family may not have known, and the family is sitting in the front row.",
      "The approach that works is to be the person who gives the family something new. You saw them at work, on the road, at two in the morning, in the years they lived away. Give the family that person, carefully.",
    ],
    openings: [
      {
        label: "How you met",
        text: "I met Isaac in a parking lot at four in the morning because he had volunteered to drive someone he barely knew to an airport. That was the first thing he ever did in my presence and it turned out to be the representative sample.",
      },
      {
        label: "Speaking to the family",
        text: "To the Whitfield family: thank you for letting me do this. I want to tell you about the version of your son that lived four states away, because he was wonderful, and I do not think he ever told you any of this.",
      },
      {
        label: "The long friendship",
        text: "We were friends for thirty-one years. That is longer than either of our marriages, most of our jobs, and every car we ever owned.",
      },
      {
        label: "The honest opening",
        text: "I am not family, and I want to say clearly that the people in this front row have lost more than I have. What I have is about a thousand ordinary days with him, and I would like to give a few of them back.",
      },
    ],
    example: {
      label: "Full example eulogy for a friend",
      minutes: "About 3 minutes",
      words: "About 350 words · fictional",
      paragraphs: [
        "I'm Ben. Isaac and I met on a fire crew nine years ago, and I want to start by thanking Grant and Teresa for asking me to speak. I know what it costs to give this slot to someone who is not family.",
        "I met your son in a parking lot at four in the morning, because he had volunteered to drive a guy he had known for eleven days to the airport. He complained about it for the whole ride. He also arrived twenty minutes early.",
        "That was the pattern. Isaac was the person who answered the phone. Not in a saintly way. In an irritated, sighing, already-getting-his-keys way. He would tell you exactly how inconvenient you were being, and then he would be there before you had finished apologizing.",
        "He made an extremely good breakfast and a genuinely terrible cup of coffee, and he served both with total confidence. Nine years. I never told him about the coffee. I regret that slightly.",
        "He kept a list of trailheads he intended to reach. He had crossed off fewer than half of them, which he found funny rather than sad, because getting to the trailheads was never really the point. Six of us are going to finish the list. We are going to be slower than he would like and he would have a great deal to say about our packing.",
        "Here is the thing I most want his family to know. On a crew, you find out fast who a person is. Isaac was the one who noticed when someone had gone quiet. He would not say anything in front of the group. He would text them separately, later, and ask. He did that for me in a bad year and I do not know that I ever told him it mattered.",
        "He talked about you constantly, by the way. All of you. Nora, he told a story about you at least once a week and it was always the one about the canoe.",
        "Isaac, thanks for the airport. Thanks for the texts. We'll get the rest of the list.",
      ],
    },
    guidance: {
      heading: "Writing it, and getting through it",
      lines: [
        "Address the family directly in the first thirty seconds and acknowledge that their loss is larger. It settles the room and gives you permission for everything after.",
        "Give the family something they did not have. What their person was like at work, on the road, or in the years they lived elsewhere is the most valuable thing you can offer.",
        "Tell them what their person said about them. Families almost never know this, and it is frequently the line they remember for the rest of their lives.",
        "Leave out anything that would be new bad news to a parent. A funeral is not the place for a revelation, however affectionate.",
        "Three to four minutes. As a friend you will usually be one of several speakers.",
        "Say their family members' names correctly. Write the pronunciation on your page if you need to.",
      ],
    },
    faqs: [
      {
        question: "Is it appropriate for a friend to give a eulogy?",
        answer:
          "Yes, and it is common. Friends are often asked precisely because they can speak when the family cannot. Coordinate with the family beforehand on what you plan to cover so that you complement rather than duplicate a family member's remarks.",
      },
      {
        question: "What should I avoid saying?",
        answer:
          "Anything that would be new and painful information to the family, anything involving someone else's private life, and any inside joke that requires context the room does not have. When you are unsure about a story, ask a family member before the service rather than after.",
      },
      {
        question: "How do I handle it if I did not know the family?",
        answer:
          "Introduce yourself clearly, state how you knew their person and for how long, and thank the family for the opportunity. Learn the names of the immediate family and use them. That small effort reads as respect and it is always noticed.",
      },
    ],
    related: ["sibling", "father", "mother"],
  },
];

export function getEulogyTemplate(slug: string) {
  return eulogyTemplates.find((template) => template.slug === slug);
}

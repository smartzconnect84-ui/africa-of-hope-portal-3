import {
  Baby,
  Film,
  GraduationCap,
  Handshake,
  Heart,
  HeartHandshake,
  HeartPulse,
  Leaf,
  LifeBuoy,
  Lightbulb,
  Megaphone,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * AFRICA OF HOPE — organisation profile.
 *
 * The About page renders this file verbatim, so the wording here is the
 * owner's official copy (message "ABOUT AFRICA OF HOPE"). Keep it in one
 * place: edit text here only, never in the page component, so the public
 * page, footer summary and future brochure output stay identical.
 */

export interface AboutProse {
  id: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  paragraphs: string[];
}

export interface AboutCard {
  id: string;
  title: string;
  icon: LucideIcon;
  body: string[];
}

export const ABOUT_META = {
  eyebrow: "About us · Established 2021",
  headline: "Hope That Inspires. Action That Transforms.",
  tagline: "Empowering people. Strengthening communities. Building a better future.",
  intro:
    "AFRICA OF HOPE is a nonprofit organization established in 2021 with a vision of empowering individuals, strengthening communities, and creating opportunities for sustainable development across Africa and beyond.",
  stats: [
    { id: "founded", value: "2021", label: "Established" },
    { id: "impact", value: "8", label: "Areas of impact" },
    { id: "values", value: "7", label: "Core values" },
    { id: "approach", value: "4", label: "Guiding principles" },
  ],
} as const;

export const ABOUT_SUMMARY: AboutProse = {
  id: 'about-summary',
  eyebrow: 'Organization at a glance',
  title: 'Turning hope into the capacity to thrive.',
  subtitle: 'Nonprofit · Est. 2021 · Education, training and community empowerment.',
  paragraphs: [
    'AFRICA OF HOPE (est. 2021) is a nonprofit that turns hope into practical opportunity: professional training, education and community support that build self-reliance across Africa and beyond.',
    'We believe every person deserves dignity, opportunity, access to knowledge, and the chance to build a better future. Guided by this conviction, we pursue initiatives that respond to community needs, develop human potential, and contribute to meaningful social and economic progress.',
    'Our work spans education and professional training, healthcare initiatives, rehabilitation, agriculture, media and entertainment, advocacy, humanitarian outreach, and child welfare development.',
  ],
};

export const ABOUT_WHO: AboutProse = {
  id: "about-who",
  eyebrow: "Who we are",
  title: "A parent organization for many areas of work",
  paragraphs: [
    "We believe every person deserves dignity, opportunity, access to knowledge, and the chance to build a better future. Guided by this conviction, we pursue initiatives that respond to community needs, develop human potential, and contribute to meaningful social and economic progress.",
    "Our work spans education and professional training, healthcare initiatives, rehabilitation, agriculture, media and entertainment, advocacy, humanitarian outreach, and child welfare development.",
  ],
};

export const ABOUT_STORY: AboutProse = {
  id: "about-story",
  eyebrow: "Our story",
  title: "Founded on Hope. Driven by Purpose.",
  paragraphs: [
    "We recognize that many communities face interconnected challenges, including limited educational opportunities, barriers to healthcare, unemployment, social vulnerability, and restricted access to resources for personal and economic development.",
    "We believe these challenges require more than temporary assistance. They call for thoughtful, coordinated initiatives that equip people with knowledge, practical skills, opportunities, and the support needed to improve their circumstances.",
  ],
};

export const ABOUT_MISSION = [
  {
    id: "mission",
    eyebrow: "Our mission",
    title: "What we do",
    icon: TrendingUp,
    body: [
      "To empower individuals and transform communities through accessible education, professional development, healthcare initiatives, rehabilitation, sustainable agriculture, media and entertainment, advocacy, and humanitarian services.",
    ],
  },
  {
    id: "vision",
    eyebrow: "Our vision",
    title: "Where we are going",
    icon: Lightbulb,
    body: [
      "To build a society where every individual has the opportunity to live with dignity, develop their full potential, access essential support, and contribute to an inclusive, sustainable, and prosperous future.",
    ],
  },
  {
    id: "purpose",
    eyebrow: "Our purpose",
    title: "Why we exist",
    icon: Handshake,
    body: [
      "Our purpose is to bridge opportunity gaps, strengthen human capacity, support vulnerable populations, and encourage sustainable community development.",
      "We aim to create opportunities that help people move beyond immediate challenges toward greater independence, improved well-being, and meaningful participation in society.",
    ],
  },
] as const;

export const ABOUT_VALUES: AboutCard[] = [
  {
    id: "compassion",
    title: "Compassion",
    icon: Heart,
    body: [
      "We approach our work with empathy, kindness, and respect for the dignity and experiences of every person.",
    ],
  },
  {
    id: "integrity",
    title: "Integrity",
    icon: ShieldCheck,
    body: [
      "We strive to uphold honesty, transparency, accountability, and responsible stewardship in our activities and partnerships.",
    ],
  },
  {
    id: "empowerment",
    title: "Empowerment",
    icon: Zap,
    body: [
      "We believe in equipping individuals with the knowledge, skills, resources, and opportunities to shape their own futures.",
    ],
  },
  {
    id: "inclusion",
    title: "Inclusion",
    icon: Users,
    body: [
      "We value every individual and seek to promote fairness, participation, equal opportunity, and respect for human dignity.",
    ],
  },
  {
    id: "innovation",
    title: "Innovation",
    icon: Lightbulb,
    body: [
      "We embrace creativity, technology, and practical thinking to develop solutions that respond to changing community needs.",
    ],
  },
  {
    id: "sustainability",
    title: "Sustainability",
    icon: Leaf,
    body: [
      "We pursue initiatives designed to create lasting benefits, strengthen local capacity, and support future generations.",
    ],
  },
  {
    id: "collaboration",
    title: "Collaboration",
    icon: Handshake,
    body: [
      "We recognize the importance of working with communities, institutions, organizations, volunteers, and partners to achieve shared goals.",
    ],
  },
];

export const ABOUT_IMPACT: AboutCard[] = [
  {
    id: "education",
    title: "Education & Professional Training",
    icon: GraduationCap,
    body: [
      "We believe education is a powerful foundation for opportunity, independence, and social progress.",
      "Our educational focus includes accessible learning, professional development, practical skills training, certification opportunities, and lifelong learning. Through educational initiatives, we seek to help individuals develop their abilities, strengthen their knowledge, and prepare for personal and professional advancement.",
    ],
  },
  {
    id: "healthcare",
    title: "Healthcare & Medical Initiatives",
    icon: HeartPulse,
    body: [
      "Health and well-being are essential to individual dignity and community development.",
      "Our healthcare focus includes health awareness, community wellness initiatives, and efforts to support access to essential healthcare services. We recognize the importance of prevention, education, collaboration, and community participation in improving health outcomes.",
    ],
  },
  {
    id: "rehabilitation",
    title: "Rehabilitation & Reintegration",
    icon: HeartHandshake,
    body: [
      "We believe people deserve dignity, support, and opportunities to rebuild their lives.",
      "Our rehabilitation focus emphasizes recovery, personal development, social reintegration, and renewed opportunities for individuals facing significant life challenges.",
      "We seek to encourage environments in which people can develop confidence, acquire useful skills, strengthen their independence, and pursue constructive paths forward.",
    ],
  },
  {
    id: "agriculture",
    title: "Agriculture & Sustainable Livelihoods",
    icon: Sprout,
    body: [
      "Agriculture can contribute significantly to food security, employment, economic opportunity, and community resilience.",
      "Our agricultural focus includes promoting sustainable farming practices, agricultural knowledge, practical skills, food security, and livelihood development.",
    ],
  },
  {
    id: "media",
    title: "Media & Entertainment",
    icon: Film,
    body: [
      "We harness the power of media, creativity, and entertainment to educate, inform, inspire, and connect communities.",
      "Through television, digital media, creative arts, entertainment productions, storytelling, and public engagement, AFRICA OF HOPE seeks to promote positive values, showcase talent, amplify community voices, and create opportunities for creative expression and development.",
      "Our aim is to encourage responsible communication, celebrate creativity, and use compelling stories and engaging content to contribute to a more informed and connected society.",
    ],
  },
  {
    id: "advocacy",
    title: "Advocacy & Community Development",
    icon: Megaphone,
    body: [
      "Strong communities are built when people have a voice, understand their rights and responsibilities, and have opportunities to participate in decisions affecting their lives.",
      "Our advocacy and community development focus includes awareness, inclusion, community participation, human dignity, and constructive responses to social challenges.",
      "We seek to encourage dialogue, promote positive values, amplify important issues, and support initiatives that contribute to stronger and more resilient communities.",
    ],
  },
  {
    id: "humanitarian",
    title: "Humanitarian Outreach & Social Support",
    icon: LifeBuoy,
    body: [
      "We believe compassion should translate into practical support for people experiencing vulnerability and hardship.",
      "Our humanitarian focus includes community-centered assistance, partnerships, outreach initiatives, and efforts to improve opportunities for individuals and families in need.",
    ],
  },
  {
    id: "child-welfare",
    title: "Orphanage & Child Welfare Development",
    icon: Baby,
    body: [
      "Every child deserves safety, care, dignity, education, and the opportunity to develop to their full potential.",
      "Our child welfare vision includes pursuing initiatives that support vulnerable children, promote their well-being, and encourage access to safe and supportive environments.",
    ],
  },
];

export const ABOUT_APPROACH: AboutCard[] = [
  {
    id: "people-first",
    title: "People First",
    icon: Users,
    body: ["We recognize the dignity, experiences, needs, and potential of the individuals and communities we serve."],
  },
  {
    id: "opportunity",
    title: "Opportunity Through Empowerment",
    icon: TrendingUp,
    body: [
      "We seek to help people build knowledge, skills, confidence, and capacity so they can take meaningful steps toward improving their lives.",
    ],
  },
  {
    id: "partnership",
    title: "Partnership for Progress",
    icon: Handshake,
    body: [
      "We value cooperation with communities, institutions, nonprofit organizations, businesses, volunteers, and other partners whose expertise and resources can contribute to shared goals.",
    ],
  },
  {
    id: "sustainable",
    title: "Sustainable Impact",
    icon: Leaf,
    body: [
      "We encourage initiatives that strengthen local capacity, address underlying challenges, and create benefits that can extend beyond immediate assistance.",
    ],
  },
];

export const ABOUT_APPROACH_INTRO: AboutProse = {
  id: "about-approach",
  eyebrow: "Our approach",
  title: "How we work toward community transformation",
  paragraphs: [
    "We believe meaningful and sustainable change requires more than good intentions. It requires practical action, collaboration, responsible planning, and a genuine understanding of people's needs.",
  ],
};

export const ABOUT_FUTURE: AboutProse = {
  id: "about-future",
  eyebrow: "Our commitment",
  title: "Our commitment to the future",
  paragraphs: [
    "We are committed to exploring innovative solutions, building responsible partnerships, and developing initiatives that respond to emerging needs and opportunities.",
    "We understand that sustainable progress requires dedication, learning, accountability, and collaboration. As our work develops, we aim to strengthen our capacity to serve, expand opportunities for participation, and contribute to positive change across the communities we reach.",
  ],
};

export const ABOUT_WHY: { id: string; title: string; body: string }[] = [
  {
    id: "holistic",
    title: "A Holistic Vision",
    body: "We recognize the connections between education, health, livelihoods, creativity, social support, and community development.",
  },
  {
    id: "dignity",
    title: "A Commitment to Human Dignity",
    body: "We believe every individual deserves respect and opportunities to develop their potential.",
  },
  {
    id: "empowerment",
    title: "An Empowerment-Driven Approach",
    body: "We seek to help people build capacity and pursue greater independence rather than focusing solely on immediate needs.",
  },
  {
    id: "collaboration",
    title: "A Culture of Collaboration",
    body: "We believe lasting progress is strengthened through partnerships, shared responsibility, and community participation.",
  },
  {
    id: "sustainable",
    title: "A Vision for Sustainable Change",
    body: "We seek to support initiatives that contribute to stronger individuals, more resilient communities, and a better future.",
  },
];

export const ABOUT_JOIN = {
  id: "about-join",
  eyebrow: "Be part of the hope",
  title: "Together, we can make a difference",
  paragraphs: [
    "Whether you are an individual who wants to volunteer, an organization interested in partnership, a supporter who shares our vision, or a community member seeking to learn more about our work, there are opportunities to connect with our mission.",
  ],
  signoff: "",
} as const;

export const ABOUT_PROMISE = {
  eyebrow: "Our promise",
  quote:
    "",
  body: "We understand that meaningful change is a shared journey, and we welcome those who wish to contribute to a future filled with greater dignity, opportunity, and hope.",
  signature: "Empowering People. Transforming Communities. Inspiring Hope.",
  footnote:
    "Hope is more than a feeling. It is the beginning of action, the foundation of opportunity, and the inspiration for a better tomorrow.",
} as const;

/** Quick-jump labels for the About page's section chips. */
export const ABOUT_NAV = [
  { id: "about-who", label: "Who we are" },
  { id: "about-story", label: "Our story" },
  { id: "about-mission", label: "Mission & vision" },
  { id: "about-values", label: "Core values" },
  { id: "about-impact", label: "Areas of impact" },
  { id: "about-approach", label: "Our approach" },
  { id: "about-future", label: "Commitment" },
  { id: "about-why", label: "Why us" },
  { id: "about-join", label: "Get involved" },
] as const;
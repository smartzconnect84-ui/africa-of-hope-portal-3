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
  subtitle: 'A people-centered vision. A connected approach. A commitment to lasting change.',
  paragraphs: [
    'Established in 2021, AFRICA OF HOPE is a nonprofit parent organization with a vision of expanding opportunity, protecting human dignity and strengthening communities across Africa and beyond. Its central conviction is that people need more than temporary assistance: they need access to knowledge, practical skills, essential support and the confidence to shape their own futures.',
    'The organization brings eight interconnected areas of work under one purpose: education and professional training; healthcare and medical initiatives; rehabilitation and reintegration; agriculture and sustainable livelihoods; media and entertainment; advocacy and community development; humanitarian outreach and social support; and orphanage and child welfare development. Together, these areas form a holistic response to the barriers that can limit well-being, independence and participation in society.',
    'AFRICA OF HOPE’s approach places people first, builds opportunity through empowerment, advances progress through partnership and pursues sustainable impact. Compassion, integrity, empowerment, inclusion, innovation, sustainability and collaboration guide its decisions. Through responsible planning, community participation and shared action, it seeks to turn hope into practical pathways toward self-reliance, resilience and a more inclusive future—not simply support people through today’s challenges, but help them build the capacity to thrive beyond them.',
  ],
};

export const ABOUT_WHO: AboutProse = {
  id: "about-who",
  eyebrow: "Who we are",
  title: "A parent organization for many areas of work",
  paragraphs: [
    "We believe every person deserves dignity, opportunity, access to knowledge, and the chance to build a better future. Guided by this conviction, we pursue initiatives that respond to community needs, develop human potential, and contribute to meaningful social and economic progress.",
    "Our work spans education and professional training, healthcare initiatives, rehabilitation, agriculture, media and entertainment, advocacy, humanitarian outreach, and child welfare development.",
    "As a parent organization, AFRICA OF HOPE brings these diverse areas of work together under a shared purpose: transforming hope into practical action and creating opportunities that enable individuals and communities to thrive.",
    "We are committed to a people-centered approach that values compassion, integrity, inclusion, innovation, accountability, and sustainability. Through programs, partnerships, and community-focused initiatives, we seek to build pathways toward self-reliance, personal growth, and lasting positive change.",
  ],
};

export const ABOUT_STORY: AboutProse = {
  id: "about-story",
  eyebrow: "Our story",
  title: "Founded on Hope. Driven by Purpose.",
  paragraphs: [
    "AFRICA OF HOPE was established in 2021 with a commitment to making hope a foundation for meaningful change.",
    "We recognize that many communities face interconnected challenges, including limited educational opportunities, barriers to healthcare, unemployment, social vulnerability, and restricted access to resources for personal and economic development.",
    "We believe these challenges require more than temporary assistance. They call for thoughtful, coordinated initiatives that equip people with knowledge, practical skills, opportunities, and the support needed to improve their circumstances.",
    "This understanding shapes our broad approach to community development. By bringing education, health, rehabilitation, agriculture, media, advocacy, and humanitarian initiatives together under one organizational vision, AFRICA OF HOPE seeks to address different dimensions of human need while encouraging dignity, resilience, and self-reliance.",
    "Our journey is guided by the belief that when people receive the right opportunities and support, they can become active contributors to their own development and the progress of their communities.",
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
      "We believe lasting transformation happens when compassion is combined with practical solutions, collaboration, and a commitment to empowering people.",
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
      "Our vision includes creating pathways through which learners can acquire relevant skills and apply their knowledge to real-world opportunities.",
    ],
  },
  {
    id: "healthcare",
    title: "Healthcare & Medical Initiatives",
    icon: HeartPulse,
    body: [
      "Health and well-being are essential to individual dignity and community development.",
      "Our healthcare focus includes health awareness, community wellness initiatives, and efforts to support access to essential healthcare services. We recognize the importance of prevention, education, collaboration, and community participation in improving health outcomes.",
      "Through appropriate initiatives and partnerships, we seek to contribute to healthier individuals, stronger families, and more informed communities.",
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
      "We seek to encourage initiatives that help communities strengthen their productive capacity, make effective use of available resources, and develop more sustainable economic opportunities.",
    ],
  },
  {
    id: "media",
    title: "Media & Entertainment",
    icon: Film,
    body: [
      "We harness the power of media, creativity, and entertainment to educate, inform, inspire, and connect communities.",
      "Through television, digital media, creative arts, entertainment productions, storytelling, and public engagement, AFRICA OF HOPE seeks to promote positive values, showcase talent, amplify community voices, and create opportunities for creative expression and development.",
      "We believe media and entertainment can be powerful tools for education, cultural expression, social awareness, talent development, and positive social transformation.",
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
      "We seek to encourage solidarity, strengthen community support systems, and promote approaches that respect the dignity of those receiving assistance.",
    ],
  },
  {
    id: "child-welfare",
    title: "Orphanage & Child Welfare Development",
    icon: Baby,
    body: [
      "Every child deserves safety, care, dignity, education, and the opportunity to develop to their full potential.",
      "Our child welfare vision includes pursuing initiatives that support vulnerable children, promote their well-being, and encourage access to safe and supportive environments.",
      "Through appropriate planning, partnerships, and development efforts, we aim to advance opportunities for children to grow, learn, and build brighter futures.",
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
    "AFRICA OF HOPE envisions a future in which more people can access education, improve their well-being, develop practical skills, express their creativity, and participate meaningfully in community development.",
    "We are committed to exploring innovative solutions, building responsible partnerships, and developing initiatives that respond to emerging needs and opportunities.",
    "We understand that sustainable progress requires dedication, learning, accountability, and collaboration. As our work develops, we aim to strengthen our capacity to serve, expand opportunities for participation, and contribute to positive change across the communities we reach.",
    "Our future is rooted in a simple belief: when people are empowered, communities become stronger, and hope becomes a foundation for progress.",
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
    "Every meaningful transformation begins with people who believe change is possible.",
    "At AFRICA OF HOPE, we believe unity, compassion, creativity, and collective action can create opportunities, strengthen communities, and inspire a brighter future.",
    "Whether you are an individual who wants to volunteer, an organization interested in partnership, a supporter who shares our vision, or a community member seeking to learn more about our work, there are opportunities to connect with our mission.",
    "Your time, ideas, skills, resources, and collaboration can help turn shared aspirations into meaningful action.",
  ],
  signoff:
    "Your support can inspire hope. Your partnership can empower people. Together, we can work toward lasting change.",
} as const;

export const ABOUT_PROMISE = {
  eyebrow: "Our promise",
  quote:
    "We remain committed to pursuing our mission with compassion, integrity, and a belief in the potential of people and communities.",
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
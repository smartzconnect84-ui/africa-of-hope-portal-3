/** Curated free / freemium online training modules staff can import into training_materials. */

export interface TrainingRecommendation {
  id: string;
  title: string;
  provider: string;
  level: string;
  duration: string;
  format: string;
  url: string;
  cost: string;
  bestFor: string;
  description: string;
}

export const RECOMMENDED_MODULES: TrainingRecommendation[] = [
  {
    id: "google-digital-skills", title: "Fundamentals of Digital Marketing", provider: "Google Digital Skills for Africa",
    level: "Beginner", duration: "40 hours", format: "Video + quizzes", url: "https://learndigital.withgoogle.com/digitalskills",
    cost: "Free + free certificate", bestFor: "Digital Marketing, Entrepreneurship",
    description: "Google's flagship free course — ideal companion for marketing and business programmes. Certificate included.",
  },
  {
    id: "hp-life", title: "HP LIFE Business & IT Courses", provider: "HP LIFE / HP Foundation",
    level: "Beginner–Intermediate", duration: "30+ mini-courses", format: "Interactive online", url: "https://www.life-global.org/",
    cost: "Free + certificate", bestFor: "Entrepreneurship, Finance, IT basics",
    description: "Free interactive courses on business, finance, marketing and basic IT — perfect offline-friendly supplements.",
  },
  {
    id: "alison-diploma", title: "Diploma-level Workplace Courses", provider: "Alison",
    level: "Beginner–Advanced", duration: "6–15 hours each", format: "Video + assessment", url: "https://alison.com/",
    cost: "Free to learn", bestFor: "All certificate tracks",
    description: "Thousands of free diploma courses (project management, HR, hospitality, IT). Link as extension reading per module.",
  },
  {
    id: "khan-computing", title: "Computing & Computer Science", provider: "Khan Academy",
    level: "Beginner", duration: "Self-paced", format: "Video + practice", url: "https://www.khanacademy.org/computing",
    cost: "Free", bestFor: "ICT foundation, Computer Studies",
    description: "Gentle intro to computers, internet safety and programming — great bridging content for foundation cohorts.",
  },
  {
    id: "freecodecamp", title: "Responsive Web Design + JavaScript", provider: "freeCodeCamp",
    level: "Beginner–Intermediate", duration: "300 hours each", format: "Hands-on coding", url: "https://www.freecodecamp.org/",
    cost: "Free + verified certs", bestFor: "Web Development, Software tracks",
    description: "World-class hands-on coding curriculum with verified certificates. Import as the practical lab spine.",
  },
  {
    id: "cisco-netacad", title: "Intro to Networks & Cybersecurity", provider: "Cisco Networking Academy",
    level: "Beginner", duration: "20–70 hours", format: "Online + packet tracer", url: "https://www.netacad.com/",
    cost: "Free intro courses", bestFor: "Networking, ICT Support",
    description: "Industry-recognised intro networking and cybersecurity badges employers respect.",
  },
  {
    id: "coursera-gRows", title: "Grow with Google / Meta Social", provider: "Coursera (audit mode)",
    level: "Beginner–Intermediate", duration: "3–6 months", format: "Video + labs", url: "https://www.coursera.org/",
    cost: "Free to audit", bestFor: "Data, UX, Marketing advanced",
    description: "Audit premium professional certificates free. Use syllabi as the template for advanced programme modules.",
  },
  {
    id: "saylor", title: "Saylor Academy Degree-level Courses", provider: "Saylor Academy",
    level: "Intermediate–Advanced", duration: "Self-paced", format: "Text + exams", url: "https://learn.saylor.org/",
    cost: "Free + low-cost credit exam", bestFor: "Business Admin, Accounting",
    description: "Free university-level business and management courses with proctored exams — strong depth for diploma tracks.",
  },
];

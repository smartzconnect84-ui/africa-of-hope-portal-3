/** Editable public editorial copy; stored in system_settings.website_settings. */
export const DEFAULT_PUBLIC_COPY: Record<string, string> = {
  "blog.eyebrow": "Latest from our blog",
  "blog.title": "Stories, news and updates.",
  "blog.link": "Visit the blog",
  "blog.emptyTitle": "New stories are on the way.",
  "blog.emptyBody": "Check back soon for news from the academy.",
  "footer.apply": "Apply online",
  "footer.portal": "Student portal",
  "footer.explore": "Explore",
  "footer.programmes": "Programmes",
  "footer.started": "Get started",
  "footer.all": "View all",
  "admissions.requirements": "What you need",
  "admissions.ready": "Ready when you are.",
  "admissions.readyBody": "Apply online. Our admissions team reviews every application.",
};

export const DEFAULT_SUPPORT = {
  enabled: true,
  eyebrow: "Give · Serve · Partner · Join",
  title: "Help keep this training free.",
  description: "Support learners, share your skills, partner with us or express your interest in joining our staff. Choose an option below to contact the school office.",
  responseNote: "Our office will contact you after reviewing your request. Donation forms record a pledge, not a payment.",
  cards: [
    { id: "donation", label: "Donate", blurb: "Help fund learning resources, mentors and access to training.", cta: "Make a pledge" },
    { id: "volunteer", label: "Volunteer", blurb: "Teach, mentor or support our community with your time and skills.", cta: "Volunteer with us" },
    { id: "partner", label: "Partner", blurb: "Explore internships, employment opportunities or training partnerships.", cta: "Start a partnership" },
    { id: "staff", label: "Join our staff", blurb: "Tell us about your experience and the role you would like to contribute to.", cta: "Express staff interest" },
  ],
};

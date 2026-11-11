import * as approved from './aboutContent';
import type { LucideIcon } from 'lucide-react';
import { resolveIcon } from '@/components/home/icons';

export interface PublicBlock {
  id: string; eyebrow: string; title: string; subtitle: string; body: string;
  icon: string; image: string;
  cards: { id: string; title: string; eyebrow: string; body: string; icon: string }[];
}
export interface AboutContent {
  eyebrow: string; title: string; tagline: string; intro: string;
  stats: { id: string; value: string; label: string }[];
  ctas: { id: string; label: string; href: string; icon: string }[];
  sections: PublicBlock[];
}
const iconName = (icon?: LucideIcon) => icon?.displayName || 'Sparkles';
const prose = (p: approved.AboutProse): PublicBlock => ({ id: p.id, eyebrow: p.eyebrow || '', title: p.title, subtitle: p.subtitle || '', body: p.paragraphs.join('\n\n'), icon: 'Sparkles', image: '', cards: [] });
const cards = (id: string, eyebrow: string, title: string, items: readonly { id: string; title: string; icon?: LucideIcon; body: readonly string[]; eyebrow?: string }[]): PublicBlock => ({ id, eyebrow, title, subtitle: '', body: '', image: '', icon: 'Sparkles', cards: items.map(item => ({ id: item.id, title: item.title, eyebrow: item.eyebrow || '', body: item.body.join('\n\n'), icon: iconName(item.icon) })) });
export const DEFAULT_ABOUT: AboutContent = {
  eyebrow: approved.ABOUT_META.eyebrow, title: approved.ABOUT_META.headline,
  tagline: approved.ABOUT_META.tagline, intro: approved.ABOUT_META.intro,
  stats: approved.ABOUT_META.stats.map(s => ({ ...s })),
  ctas: [
    { id: 'programmes', label: 'Explore our programmes', href: '#programmes', icon: 'GraduationCap' },
    { id: 'support', label: 'Partner or volunteer with us', href: '#support', icon: 'Handshake' },
    { id: 'contact', label: 'Contact us', href: '#contact', icon: 'Mail' },
  ],
  sections: [
    prose(approved.ABOUT_SUMMARY),
    prose(approved.ABOUT_WHO),
    cards('about-mission', 'What drives us', 'Mission, vision and purpose', approved.ABOUT_MISSION),
    prose(approved.ABOUT_STORY),
    cards('about-impact', 'Our areas of impact', 'Interconnected areas of service, empowerment and development', approved.ABOUT_IMPACT),
    cards('about-values', 'Our core values', 'Values that guide every decision', approved.ABOUT_VALUES),
    { ...cards('about-approach', approved.ABOUT_APPROACH_INTRO.eyebrow || '', approved.ABOUT_APPROACH_INTRO.title, approved.ABOUT_APPROACH), body: approved.ABOUT_APPROACH_INTRO.paragraphs.join('\n\n') },
    prose(approved.ABOUT_FUTURE),
    cards('about-why', 'Why AFRICA OF HOPE', 'What sets our work apart', approved.ABOUT_WHY.map(item => ({ ...item, body: [item.body] }))),
    { ...prose({ ...approved.ABOUT_JOIN, paragraphs: [...approved.ABOUT_JOIN.paragraphs, approved.ABOUT_JOIN.signoff] }), icon: 'Handshake' },
    { ...prose({ id: 'about-promise', eyebrow: approved.ABOUT_PROMISE.eyebrow, title: approved.ABOUT_PROMISE.signature, paragraphs: [approved.ABOUT_PROMISE.quote, approved.ABOUT_PROMISE.body, approved.ABOUT_PROMISE.footnote] }), icon: 'Heart' },
  ],
};
export const DEFAULT_PRESENTATION = { font: 'manrope', iconWeight: 'normal' };
export const DEFAULT_PWA = {
  name: 'AFRICA OF HOPE', shortName: 'AFRICA OF HOPE',
  description: 'Education, professional training and community empowerment.',
  icon192: '/icons/icon-192.png', icon512: '/icons/icon-512.png',
  maskable: '/icons/maskable-512.png', touchIcon: '/icons/apple-touch-icon.png',
  splashImage: '/logo/aoh-logo.png', splashText: 'AFRICA OF HOPE',
  themeColor: '#16803C', backgroundColor: '#FFFFFF',
  display: 'standalone' as 'standalone' | 'minimal-ui' | 'browser' | 'fullscreen',
  orientation: 'any' as 'any' | 'portrait' | 'landscape',
};
export interface CampusGalleryItem { id: string; caption: string; tag: string; image: string }
export interface CampusEventItem { id: string; title: string; date: string; venue: string; note: string }
export interface CampusJobItem { id: string; title: string; org: string; type: string; pay: string; applyNote: string }
export interface CampusSpotlight { id: string; name: string; role: string; text: string }
export interface CampusAidItem { id: string; title: string; cover: string; who: string }
export interface CampusResourceItem { id: string; title: string; meta: string; href: string }
export interface CampusFeePlan { id: string; title: string; amount: string; note: string }
export interface CampusLifeSettings {
  enabled: boolean;
  eyebrow: string; title: string; subtitle: string; body: string;
  galleryTitle: string; galleryNote: string;
  gallery: CampusGalleryItem[];
  events: CampusEventItem[];
  jobs: CampusJobItem[];
  spotlights: CampusSpotlight[];
  aid: CampusAidItem[];
  resources: CampusResourceItem[];
  feePlans: CampusFeePlan[];
  /** Editable intro copy per tab, keyed by tab id. Public viewers see only this published copy. */
  sectionTitles: Record<string, string>;
  sectionBodies: Record<string, string>;
  /** Internship target hours + guide text shown above the logbook. */
  internshipTarget: number;
  feesNote: string;
  transcriptNote: string;
  tabs: Record<string, boolean>;
}
export const CAMPUS_TABS = [
  { id: 'gallery', label: 'Gallery' },
  { id: 'events', label: 'Events' },
  { id: 'careers', label: 'Alumni & Jobs' },
  { id: 'internship', label: 'Internship' },
  { id: 'scholarships', label: 'Scholarships' },
  { id: 'transcripts', label: 'Transcripts' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'library', label: 'Library' },
  { id: 'fees', label: 'Fees & Pay' },
  { id: 'vacancies', label: 'Vacancies' },
  { id: 'businesses', label: 'Businesses' },
  { id: 'reference-letters', label: 'Reference letters' },
  { id: 'prep-pack', label: 'Entrance prep' },
  { id: 'yearbook', label: 'Yearbook' },
];
export const DEFAULT_CAMPUS_LIFE: CampusLifeSettings = {
  enabled: true,
  eyebrow: 'Campus life',
  title: 'Life at Africa of Hope',
  subtitle: 'Study, community and careers in one place.',
  body: 'Explore the gallery, join events, meet alumni, track internships, apply for scholarships and support, request transcripts and reference letters, prepare for entrance interviews, share feedback, use the library and pay fees — all from one hub.',
  galleryTitle: 'Campus gallery',
  galleryNote: 'Tap any photo to view it larger.',
  gallery: [],
  events: [
    { id: 'open-day', title: 'Open Day & Campus Tour', date: '2026-12-12T10:00:00', venue: 'Main campus, Monrovia', note: 'Meet lecturers, tour labs, on-the-spot admission guidance.' },
    { id: 'orientation', title: 'New Intake Orientation', date: '2027-01-12T09:00:00', venue: 'Main hall', note: 'Strictly online learners join live; onsite learners attend in person.' },
    { id: 'career-fair', title: 'Careers & Internship Fair', date: '2027-02-20T10:00:00', venue: 'Main campus', note: 'Employers, alumni panels and logbook clinics.' },
    { id: 'graduation', title: 'Graduation & Awards', date: '2027-03-27T10:00:00', venue: 'Main hall', note: 'Certificates issued to completers; family welcome.' },
  ],
  jobs: [
    { id: 'job-1', title: 'Junior ICT Support Assistant', org: 'Partner school, Monrovia', type: 'Internship → contract', pay: 'Stipend + transport', applyNote: 'To apply, message admissions with the job title + your student ID. Placement team confirms within 3 working days.' },
    { id: 'job-2', title: 'Community Health Volunteer', org: 'County clinic partner', type: 'Volunteer', pay: 'Certificate + reference', applyNote: 'To apply, message admissions with the job title + your student ID. Placement team confirms within 3 working days.' },
    { id: 'job-3', title: 'Business Admin Intern', org: 'Local enterprise partner', type: '3-month internship', pay: 'Monthly stipend', applyNote: 'To apply, message admissions with the job title + your student ID. Placement team confirms within 3 working days.' },
    { id: 'job-4', title: 'Media & Comms Assistant', org: 'AFRICA OF HOPE', type: 'Part-time', pay: 'Project-based', applyNote: 'To apply, message admissions with the job title + your student ID. Placement team confirms within 3 working days.' },
  ],
  spotlights: [
    { id: 'spot-1', name: "Alumni cohort '25", role: 'Now: Admin Officer', text: 'The practical logbook got me my first interview — I showed real tasks, not just grades.' },
  ],
  aid: [
    { id: 'merit', title: 'Merit Scholarship', cover: 'Up to 50% tuition', who: 'New applicants with strong entrance results; continuing students with GPA 3.5+.' },
    { id: 'need', title: 'Hope Bursary (need-based)', cover: 'Up to 70% tuition', who: 'Learners with demonstrated financial need + community service record.' },
    { id: 'sponsor', title: 'Sponsor-a-Student', cover: 'Full or partial, by donors', who: 'Donors pick a programme; school matches a vetted learner and reports progress.' },
  ],
  resources: [
    { id: 'res-brochure', title: 'ENA programme brochure', meta: 'Programme guide · JPG', href: '' },
    { id: 'res-cert', title: 'Certificate of Completion sample', meta: 'Sample certificate · PNG', href: '' },
  ],
  feePlans: [
    { id: 'plan-full', title: 'Pay in full', amount: 'Save 5%', note: 'One payment at registration. Receipt issued instantly with reference.' },
    { id: 'plan-two', title: 'Two instalments', amount: '50% + 50%', note: 'Half at registration, balance before mid-term. Both must total exactly.' },
    { id: 'plan-three', title: 'Three instalments', amount: '40% + 30% + 30%', note: 'For continuing learners in good standing. Instalments must total exactly.' },
  ],
  sectionTitles: {
    gallery: 'Campus gallery',
    events: 'Open events',
    careers: 'Jobs & internships board',
    internship: 'Log practical hours',
    scholarships: 'Scholarships & sponsors',
    transcripts: 'Request a document',
    feedback: 'Course feedback',
    library: 'Library & downloads',
    fees: 'Fees & payment plans',
    vacancies: 'Staff vacancies',
    businesses: 'Alumni businesses',
    'reference-letters': 'Reference letters',
    'prep-pack': 'Entrance prep',
    yearbook: 'Graduation yearbook',
  },
  sectionBodies: {
    events: 'RSVP below and we will remind you before the event. Attendance is marked at the gate.',
    careers: 'Save a role, then message admissions with the job title + your student ID.',
    internship: 'Log each week with hours, tasks and supervisor. Entries stay on this device until signed.',
    scholarships: 'Apply for aid below. Sponsors read every note.',
    transcripts: 'Transcripts, reference letters, duplicate certificates. Ready in 5 working days; pickup or delivery.',
    feedback: 'Rate a course and tell us what to improve. Averages update live.',
    library: 'Programme guides and sample certificates. Tap to open or download.',
    fees: 'Plan your instalments — splits must total exactly. A receipt with reference is issued per payment.',
    vacancies: 'Open teaching and support roles. Shortlisted applicants are contacted within 7 days.',
    businesses: 'Alumni-owned ventures — customers find and support you here.',
    'reference-letters': 'Graduates request employer reference letters; staff approve them in one queue.',
    'prep-pack': 'Sample questions and tips to prepare for admission interviews.',
    yearbook: 'Each finished cohort publishes a photo wall with graduate names and thank-you notes.',
  },
  internshipTarget: 240,
  feesNote: 'Mobile Money / card mock. Instalment splits must total exactly.',
  transcriptNote: 'Ready in 5 working days; pickup or delivery.',
  tabs: { gallery: true, events: true, careers: true, internship: true, scholarships: true, transcripts: true, feedback: true, library: true, fees: true, vacancies: true, businesses: true, 'reference-letters': true, 'prep-pack': true, yearbook: true },
};
export const DEFAULT_LAYOUT = ['summary', 'programmes', 'about', 'features', 'impact', 'team', 'blog', 'support', 'admissions', 'faq', 'verify', 'newsletter', 'contact', 'cta'];
export function paragraphText(text: string) { return text.split(/\n\s*\n/).filter(Boolean); }

/** Sentences the owner removed via visual edits. Published CMS bodies may still
 *  contain them (Supabase website settings), so filter them at render time.
 *  Matching is substring-based to survive curly/straight apostrophe differences. */
export const REMOVED_ABOUT_PHRASES = [
  'As a parent organization, AFRICA OF HOPE brings these diverse areas',
  'We are committed to a people-centered approach',
  'lasting transformation happens when compassion',
  'approach places people first',
  'builds opp',
  'shapes our broad approach to community',
  'guided by the belief that when people rece',
  'School of Professional Studies offers both online',
  'require more than temporary',
  'creating pathways through which',
  'appropriate initiatives and partnerships',
  'encourage initiatives that help communities',
  'television, digital media, creative arts',
  'envisions a future in which more people',
  'Our future is rooted in a simple belief',
  'Every meaningful transformation begins with people',
  'Your time, ideas, skills, resources',
  'Your support can inspire hope',
  'we believe unity, compassion',
  'We remain committed to pursuing our mission with compassi',
  'was established in 2021 with a commitment',
  'A people-centered vision',
  'A connected approach',
];
export const REPLACEMENT_ORG_PARAGRAPH =
  'We believe every person deserves dignity, opportunity, access to knowledge, and the chance to build a better future. Guided by this conviction, we pursue initiatives that respond to community needs, develop human potential, and contribute to meaningful social and economic progress.\n\nOur work spans education and professional training, healthcare initiatives, rehabilitation, agriculture, media and entertainment, advocacy, humanitarian outreach, and child welfare development.';
export function cleanAboutBody(body: string) {
  return paragraphText(body || '')
    .map((p) =>
      p.includes('brings eight') || p.includes('organization brings eight') || p.includes('organisation brings eight')
        ? REPLACEMENT_ORG_PARAGRAPH
        : p,
    )
    .filter((p) => !REMOVED_ABOUT_PHRASES.some((s) => p.includes(s)))
    .join('\n\n');
}
export function cleanAboutParagraphs(body: string) {
  return paragraphText(cleanAboutBody(body));
}
export { resolveIcon };

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
export interface CampusLifeSettings {
  enabled: boolean;
  eyebrow: string; title: string; subtitle: string; body: string;
  galleryTitle: string; galleryNote: string;
  gallery: CampusGalleryItem[];
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
  tabs: { gallery: true, events: true, careers: true, internship: true, scholarships: true, transcripts: true, feedback: true, library: true, fees: true, vacancies: true, businesses: true, 'reference-letters': true, 'prep-pack': true },
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
];
export function cleanAboutBody(body: string) {
  return paragraphText(body || '')
    .filter((p) => !REMOVED_ABOUT_PHRASES.some((s) => p.includes(s)))
    .join('\n\n');
}
export function cleanAboutParagraphs(body: string) {
  return paragraphText(cleanAboutBody(body));
}
export { resolveIcon };

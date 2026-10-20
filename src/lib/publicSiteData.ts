import type { WebsiteSettings } from '@/types';

// Exact legacy demo entries only. Edited/approved CMS entries are retained.
const demoStats: Record<string, [string, string]> = {
  'stat-1': ['96%', 'Completion rate'], 'stat-2': ['18', 'Partner employers'],
  'stat-3': ['12', 'Certificate programmes'], 'stat-4': ['400+', 'Graduates placed'],
  'auth-stat-1': ['30+', 'Programmes'], 'auth-stat-2': ['400+', 'Graduates placed'],
  'auth-stat-3': ['96%', 'Completion rate'],
};
const demoPartners = [
  'Monrovia Tech & Fintech Employers', 'Liberia Solar & Energy Installers',
  'Margibi Agro-Processing Firms', 'Bong County Health Network',
  'Liberian Banks & Microfinance', 'Buchanan Logistics & Trade',
];
export function removeDemoPublicData(settings: WebsiteSettings): WebsiteSettings {
  const keepStat = (s: WebsiteSettings['stats'][number]) => {
    const demo = demoStats[s.id];
    return !demo || s.value !== demo[0] || s.label !== demo[1];
  };
  return {
    ...settings,
    stats: settings.stats.filter(keepStat),
    auth: { ...settings.auth, stats: settings.auth.stats.filter(keepStat) },
    partners: settings.partners.filter(p => !demoPartners.some((name, index) => p.id === `partner-${index + 1}` && p.name === name && !p.logo && !p.description)),
  };
}

/** Support schema variants without treating absent legacy flags as drafts. */
export function programIsPublished(row: Record<string, unknown>): boolean {
  if ([row.published, row.is_published, row.active, row.is_active].some(flag => flag === false)) return false;
  if (typeof row.status === 'string' && row.status.trim()) {
    return ['published', 'active', 'open'].includes(row.status.toLowerCase().trim());
  }
  return true;
}

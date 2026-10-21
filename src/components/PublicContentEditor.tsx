import type { WebsiteSettings } from '@/types';
import { DEFAULT_ABOUT, DEFAULT_LAYOUT, DEFAULT_PRESENTATION } from '@/data/publicPresentation';
import type { PublicSettingsErrors } from '@/lib/publicSettingsValidation';
import { Area, Field, ImageBox, ListEditor, genId } from './CmsPrimitives';
import { PUBLIC_PAGE_IMAGE_PAGES } from './public/PageImage';
import { ICON_NAMES } from './home/icons';

function IconPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="block text-xs font-semibold text-slate-600">Icon<select className="mt-1 block min-h-11 w-full rounded-lg border bg-white px-3 text-sm" value={value} onChange={e => onChange(e.target.value)}>{[...new Set([value, ...ICON_NAMES])].map(name => <option key={name}>{name}</option>)}</select></label>;
}
export default function PublicContentEditor({ draft, patch, errors = {} }: { draft: WebsiteSettings; patch: (value: Partial<WebsiteSettings>) => void; errors?: PublicSettingsErrors }) {
  const about = draft.aboutPage || DEFAULT_ABOUT;
  const presentation = draft.presentation || DEFAULT_PRESENTATION;
  const update = (value: Partial<typeof about>) => patch({ aboutPage: { ...about, ...value } });
  const order = [...new Set([...(draft.publicLayout || DEFAULT_LAYOUT), ...DEFAULT_LAYOUT])].filter(id => DEFAULT_LAYOUT.includes(id));
  const move = (index: number, delta: number) => { const next = [...order]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; patch({ publicLayout: next }); };
  return <div className="space-y-6">
    <div className="grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-slate-700">Public font<select className="mt-2 block min-h-11 w-full rounded-lg border bg-white px-3" value={presentation.font} onChange={e => patch({ presentation: { ...presentation, font: e.target.value } })}>{[['manrope', 'Manrope'], ['sans', 'DM Sans'], ['serif', 'Georgia'], ['system', 'Device system font']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Icon stroke<select className="mt-2 block min-h-11 w-full rounded-lg border bg-white px-3" value={presentation.iconWeight} onChange={e => patch({ presentation: { ...presentation, iconWeight: e.target.value } })}>{['light', 'normal', 'bold'].map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <details className="rounded-2xl border bg-white p-5" open><summary className="cursor-pointer font-semibold">Complete homepage section order</summary><p className="my-3 text-sm text-slate-500">Hero stays first. Arrange the remaining sections here. Control section visibility in Homepage sections.</p>
      <ol className="space-y-2">{order.map((id, index) => <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><span className="text-sm font-semibold capitalize">{index + 1}. {id}</span><span className="flex gap-2"><button type="button" disabled={index === 0} aria-label={`Move ${id} up`} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-40" onClick={() => move(index, -1)}>Move up</button><button type="button" disabled={index === order.length - 1} aria-label={`Move ${id} down`} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-40" onClick={() => move(index, 1)}>Move down</button></span></li>)}</ol>
      <button type="button" className="mt-3 min-h-11 rounded-lg border px-4 text-sm" onClick={() => patch({ publicLayout: [...DEFAULT_LAYOUT] })}>Use recommended homepage order</button>
    </details>
    <div className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="font-semibold">Page header images</h2><p className="text-sm text-slate-500">Upload one banner photo per public page. Empty pages simply show no banner. Click Publish changes to make uploads live; every image opens click-to-view on the site.</p>
      <div className="grid gap-5 sm:grid-cols-2">{PUBLIC_PAGE_IMAGE_PAGES.map(page => <ImageBox key={page.key} label={page.label} folder={`pages/${page.key}`} value={draft.pageImages?.[page.key] || ''} onChange={value => patch({ pageImages: { ...(draft.pageImages || {}), [page.key]: value } })} />)}</div>
    </div>
    <div className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="font-semibold">About page and shared organization profile</h2><p className="text-sm text-slate-500">Approved copy is the starting content. Edit text, facts, icons, buttons and sections below. Separate paragraphs with a blank line. Move sections with their arrow controls; reading order and jump links follow the same order.</p>
      <Field label="About title" value={about.title} maxLength={240} error={errors['aboutPage.title']} onChange={title => update({ title })} />
      {(['eyebrow', 'tagline', 'intro'] as const).map(key => <Area key={key} label={`About ${key}`} value={about[key]} onChange={value => update({ [key]: value })} rows={2} />)}
      <ListEditor title="About statistic" items={about.stats} onChange={stats => update({ stats })} addLabel="Add statistic" newItem={() => ({ id: genId('fact'), value: '', label: '' })} renderItem={(item, change) => <><Field label="Value (verified information only)" value={item.value} onChange={value => change({ value })} /><Field label="Label" value={item.label} onChange={label => change({ label })} /></>} />
      <ListEditor title="About button" items={about.ctas} onChange={ctas => update({ ctas })} addLabel="Add button" newItem={() => ({ id: genId('cta'), label: '', href: '#support', icon: 'Handshake' })} renderItem={(item, change) => { const index = about.ctas.findIndex(cta => cta.id === item.id); return <><Field label={`Button ${index + 1} label`} maxLength={120} error={errors[`aboutPage.ctas.${index}.label`]} value={item.label} onChange={label => change({ label })} /><Field label={`Button ${index + 1} destination (#page, /path or HTTPS URL)`} error={errors[`aboutPage.ctas.${index}.href`]} value={item.href} onChange={href => change({ href })} /><IconPicker value={item.icon} onChange={icon => change({ icon })} /></>; }} />
      <ListEditor title="About section" items={about.sections} onChange={sections => update({ sections })} addLabel="Add section" newItem={() => ({ id: genId('about'), eyebrow: '', title: 'New section', subtitle: '', body: '', icon: 'Sparkles', image: '', cards: [] })} renderItem={(section, change) => { const index = about.sections.findIndex(item => item.id === section.id); return <>
        <Field label="Eyebrow / jump label" value={section.eyebrow} onChange={eyebrow => change({ eyebrow })} /><Field label={`Section ${index + 1} heading`} maxLength={240} error={errors[`aboutPage.sections.${index}.title`]} value={section.title} onChange={title => change({ title })} /><Field label="Subtitle" value={section.subtitle} onChange={subtitle => change({ subtitle })} /><IconPicker value={section.icon} onChange={icon => change({ icon })} /><Area label="Body paragraphs" rows={6} value={section.body} onChange={body => change({ body })} /><ImageBox label="Section image" folder="about" value={section.image} onChange={image => change({ image })} />
        <ListEditor title="Content card" items={section.cards} onChange={cards => change({ cards })} addLabel="Add content card" newItem={() => ({ id: genId('card'), title: '', eyebrow: '', body: '', icon: 'Heart' })} renderItem={(card, edit) => <><Field label="Card eyebrow" value={card.eyebrow} onChange={eyebrow => edit({ eyebrow })} /><Field label="Card title" value={card.title} onChange={title => edit({ title })} /><IconPicker value={card.icon} onChange={icon => edit({ icon })} /><Area label="Card body" rows={4} value={card.body} onChange={body => edit({ body })} /></>} />
      </>; }} />
    </div>
  </div>;
}

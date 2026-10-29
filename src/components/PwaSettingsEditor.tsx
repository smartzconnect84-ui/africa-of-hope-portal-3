import { useRef, useState } from 'react';
import type { WebsiteSettings } from '@/types';
import { DEFAULT_PWA } from '@/data/publicPresentation';
import type { PublicSettingsErrors } from '@/lib/publicSettingsValidation';
import { uploadSiteAsset, validateFile, IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/storage';
import { Area, Field, ImageBox } from './CmsPrimitives';

type Pwa = typeof DEFAULT_PWA;
async function iconFile(image: HTMLImageElement, size: number, maskable = false): Promise<File> {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image preparation unavailable.');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
  const limit = size * (maskable ? 0.56 : 0.9);
  const ratio = Math.min(limit / image.naturalWidth, limit / image.naturalHeight);
  const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio;
  ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image preparation unavailable.')), 'image/png'));
  return new File([blob], `aoh-${maskable ? 'maskable-' : ''}${size}.png`, { type: 'image/png' });
}
export default function PwaSettingsEditor({ draft, patch, errors = {} }: { draft: WebsiteSettings; patch: (value: Partial<WebsiteSettings>) => void; errors?: PublicSettingsErrors }) {
  const pwa = draft.pwa || DEFAULT_PWA;
  const latest = useRef(pwa); latest.current = pwa;
  const change = (value: Partial<Pwa>) => patch({ pwa: { ...latest.current, ...value } });
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const upload = async (file?: File) => {
    if (!file || busy) return;
    setError('');
    const invalid = validateFile(file, IMAGE_TYPES, MAX_IMAGE_BYTES);
    if (invalid) { setError(invalid); if (input.current) input.current.value = ''; return; }
    setBusy(true);
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Unreadable image.')); image.src = objectUrl; });
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Image too large.');
      const generated: Partial<Pwa> = {};
      for (const [key, size, maskable] of [['icon192', 192, false], ['icon512', 512, false], ['maskable', 512, true], ['touchIcon', 180, false]] as const) {
        generated[key] = await uploadSiteAsset(`pwa/${key}`, await iconFile(image, size, maskable));
      }
      // Merge into the latest draft, retaining text edited during upload.
      change(generated);
    } catch { setError('Icons could not be prepared or uploaded. Your previous icons are unchanged. Choose a readable image under 40 megapixels and check your connection and storage access before trying again.'); }
    finally { URL.revokeObjectURL(objectUrl); setBusy(false); if (input.current) input.current.value = ''; }
  };
  return <div className="space-y-5 rounded-2xl border bg-white p-5">
    <h2 className="text-lg font-semibold text-slate-900">PWA identity and launch screen</h2>
    <p className="text-sm text-slate-600">Upload once to prepare contained 192px, 512px, safe maskable and Apple icons. Wait for preparation to finish, then publish. Browser-controlled install screens may retain an old icon until the app is reinstalled. HTTPS and the active service worker are required for the published manifest.</p>
    {error && <p id="pwa-upload-error" role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
    <div className="flex flex-wrap items-center gap-4"><img src={pwa.icon192} alt="Current PWA icon" className="h-24 w-24 rounded-2xl border object-contain" /><button type="button" disabled={busy} onClick={() => input.current?.click()} className="min-h-11 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Preparing and uploading icons…' : 'Upload PWA icon'}</button><input ref={input} type="file" accept={IMAGE_TYPES.join(',')} aria-label="PWA icon image" aria-invalid={!!error} aria-describedby={error ? 'pwa-upload-error' : undefined} className="sr-only" onChange={event => void upload(event.target.files?.[0])} /></div>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Application name" maxLength={120} error={errors['pwa.name']} value={pwa.name} onChange={name => change({ name })} /><Field label="Short name" maxLength={40} error={errors['pwa.shortName']} value={pwa.shortName} onChange={shortName => change({ shortName })} /></div>
    <Area label="Application description (up to 1000 characters)" maxLength={1000} error={errors['pwa.description']} value={pwa.description} onChange={description => change({ description })} />
    <Field label="Launch screen text" maxLength={120} error={errors['pwa.splashText']} value={pwa.splashText} onChange={splashText => change({ splashText })} />
    <ImageBox label="Launch screen image" error={errors['pwa.splashImage']} folder="pwa/splash" value={pwa.splashImage} onChange={splashImage => change({ splashImage })} />
    <p className="text-xs text-slate-500">Launch branding is remembered on this device for the next startup. A first visit uses the bundled official logo until published settings load. The operating system creates its own native splash from the install icon.</p>
  </div>;
}

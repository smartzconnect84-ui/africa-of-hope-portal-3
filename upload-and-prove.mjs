import https from 'https';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const projectRef = 'gatnzfjpuokopqyksqoy';
const serviceKey = '40dca7c306a75b43117d11edcedff29ac08a0dee88c742fa4f9adedf5083c1b3';
const file = path.resolve('/workspace/chats/d32d3ea8c42935167e9cce5b/test-video.mp4');
const buffer = fs.readFileSync(file);
const name = path.basename(file);
const ext = name.split('.').pop() || 'mp4';
const objectName = `policy-proof/${Date.now()}.${ext}`;
const uploadUrl = new URL(`https://${projectRef}.supabase.co/storage/v1/object/upload?bucket=site-videos&object=${encodeURIComponent(objectName)}`);

console.log('PUT', uploadUrl.href);

const req = https.request(uploadUrl, { method: 'PUT', headers: {
  'Authorization': `Bearer ${serviceKey}`,
  'Content-Type': 'video/mp4',
  'x-supabase-api-version': '2024-06-04',
  'Content-Length': buffer.length,
}}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('upload status:', res.statusCode);
    console.log('upload body:', body);
    if (res.statusCode >= 300) { console.error('UPLOAD FAILED'); process.exit(3); }

    const publicUrl = `https://${projectRef}.supabase.co/storage/v1/object/public/site-videos/${encodeURIComponent(objectName)}`;
    console.log('public url:', publicUrl);
    https.get(publicUrl, anonRes => {
      let anonBody = '';
      anonRes.on('data', chunk => anonBody += chunk);
      anonRes.on('end', () => {
        console.log('ANON GET status:', anonRes.statusCode);
        console.log('ANON GET bytes:', anonBody.length);
        const same = buffer.toString('base64') === Buffer.from(anonBody).toString('base64');
        console.log('byte-identical to local file:', same);
        if (!same) { console.error('MISMATCH'); process.exit(4); }
        console.log('PROOF OK: anonymous GET returned the exact uploaded object');
      });
    }).on('error', e => { console.error('anon get error', e.message); process.exit(5); });
  });
});
req.on('error', e => { console.error('upload request error', e.message); process.exit(6); });
req.write(buffer);
req.end();

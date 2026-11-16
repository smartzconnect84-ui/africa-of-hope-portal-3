/**
 * Supplied chat assets (November 2026) — every photo the owner shared,
 * published as permanent public URLs. Seeds for the Campus Life hub so all
 * twelve images are visible on the live site immediately, without depending
 * on CMS uploads or Supabase copies.
 */
export const SUPPLIED_PHOTOS = [
  {
    id: "photo-apr-2026",
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/1owwaae5m6/WhatsApp_Image_2026-04-04_at_1.19.06_AM.jpeg",
    caption: "Evening study fellowship — April 2026",
    tag: "Community",
  },
  {
    id: "photo-cohort",
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/fv5rcs5la1/510461551_122129164802719913_2757284354210772276_n.jpg",
    caption: "Cohort gathering on campus",
    tag: "Cohort",
  },
  {
    id: "photo-field",
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/i2r3ncrsxq/FB_IMG_1778958801347.jpg",
    caption: "Field outreach with learners",
    tag: "Outreach",
  },
  {
    id: "photo-nov-2025",
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/pvuf81yahp/IMG-20251120-WA0017.jpg",
    caption: "Practical training session",
    tag: "Training",
  },
  {
    id: "photo-oct-2026",
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/yzpy89g3ye/WhatsApp_Image_2026-10-03_at_12.44.29_PM.jpeg",
    caption: "New intake welcome — October 2026",
    tag: "Welcome",
  },
] as const;

export const SUPPLIED_DOCS = {
  brochure: {
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/pp335627jl/ENA_Brochure.jpg",
    label: "ENA programme brochure (JPG)",
  },
  certificateSample: {
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/aalnvhtsz9/Africa_of_Hope_Certificate_of_Completion.png",
    label: "Certificate of Completion sample (PNG)",
  },
} as const;

/** Brand/artwork variations supplied alongside the photos — shown as a row, never cropped as logos. */
export const SUPPLIED_ARTWORK = [
  {
    id: "art-94",
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/sczxaz2gix/file_0000000009d471fdb2483f23fe455e94.png",
    caption: "Brand artwork I",
  },
  {
    id: "art-95a",
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/cd6mq1yuax/file_0000000009d471fdb2483f23fe455e95.png",
    caption: "Brand artwork II",
  },
  {
    id: "art-95b",
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/8gnc2n2zi0/file_0000000009d471fdb2483f23fe455e95.png",
    caption: "Brand artwork III",
  },
  {
    id: "art-95c",
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/jdo1hlptc9/file_0000000009d471fdb2483f23fe455e95.png",
    caption: "Brand artwork IV",
  },
  {
    id: "art-aa7",
    src: "https://files.monstarx.app/54c3deukza/public/uploads/chat/mo35wdme29/file_000000009acc81f4a3b11508f1c06aa7.png",
    caption: "Brand artwork V",
  },
] as const;

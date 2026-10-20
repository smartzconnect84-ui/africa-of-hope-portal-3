import { supabase } from '@/integrations/supabase/client';
import { validateFile, MAX_DOCUMENT_BYTES } from './storage';

export const REPORT_CATEGORIES = ['Registration papers', 'Audited accounts', 'Annual reports'] as const;
export type ReportCategory = typeof REPORT_CATEGORIES[number];
export interface TransparencyReport {
  id: string;
  title: string;
  category: ReportCategory;
  reporting_year: number;
  summary: string;
  file_path: string;
  published: boolean;
  created_at: string;
}
export type ReportInput = Pick<TransparencyReport, 'title' | 'category' | 'reporting_year' | 'summary'>;
const bucket = 'transparency-reports';
export async function listReports(manage = false): Promise<TransparencyReport[]> {
  let query = supabase.from('transparency_reports').select('*').order('reporting_year', { ascending: false }).order('created_at', { ascending: false });
  if (!manage) query = query.eq('published', true);
  const { data, error } = await query;
  if (error) throw new Error(`Reports could not load: ${error.message}`);
  return data as TransparencyReport[];
}
export async function createReport(input: ReportInput, file: File): Promise<void> {
  const invalid = validateFile(file, ['application/pdf'], MAX_DOCUMENT_BYTES);
  if (invalid) throw new Error(invalid);
  const signature = await file.slice(0, 5).text();
  if (signature !== '%PDF-') throw new Error('Please choose a genuine PDF document.');
  const id = crypto.randomUUID();
  const path = `${id}.pdf`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { error } = await supabase.from('transparency_reports').insert({ ...input, id, file_path: path, published: false });
  if (error) {
    await supabase.storage.from(bucket).remove([path]);
    throw new Error(error.message);
  }
}
export async function updateReport(id: string, input: Partial<ReportInput> & { published?: boolean }): Promise<void> {
  const { data, error } = await supabase.from('transparency_reports').update(input).eq('id', id).select('id').single();
  if (error || !data) throw new Error(error?.message || 'Report was not updated. Check your permissions.');
}
export async function downloadReport(report: TransparencyReport): Promise<void> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(report.file_path, 60);
  if (error || !data) throw new Error(error?.message || 'The document is unavailable.');
  const response = await fetch(data.signedUrl);
  if (!response.ok) throw new Error('The document could not be downloaded. Please retry.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.title.replace(/[^a-z0-9 -]/gi, '').slice(0, 120) || 'report'}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

import { supabase } from "@/integrations/supabase/client";
import { MAX_DOCUMENT_BYTES, validateFile } from "./storage";

/** Plain text returned by the `extract-pdf-text` Edge Function. */
export interface ExtractedPdfText {
  text: string;
  characters: number;
  truncated: boolean;
}

/** ApyHub reads the text layer only, so a scan comes back empty and needs OCR. */
export const EMPTY_PDF_MESSAGE =
  "No text could be extracted from this PDF. If it is a scan, it needs OCR first.";

async function serverMessage(error: unknown): Promise<string | null> {
  const context = (error as { context?: Response } | null)?.context;
  if (!context || typeof context.json !== "function") return null;
  try {
    const body = (await context.json()) as { error?: unknown };
    return typeof body?.error === "string" && body.error.trim() ? body.error.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Uploads a PDF to the `extract-pdf-text` Edge Function and returns its text.
 * The ApyHub token stays on the server; the extracted text is document content,
 * so render it as text — never as HTML.
 */
export async function extractPdfText(file: File): Promise<ExtractedPdfText> {
  const invalid = validateFile(file, ["application/pdf"], MAX_DOCUMENT_BYTES);
  if (invalid) throw new Error(invalid);
  const signature = await file.slice(0, 5).text();
  if (signature !== "%PDF-") throw new Error("Please choose a genuine PDF document.");

  const body = new FormData();
  body.append("file", file, file.name || "document.pdf");
  const { data, error } = await supabase.functions.invoke("extract-pdf-text", { body });
  if (error) {
    throw new Error(
      (await serverMessage(error)) || "The PDF service is unavailable. Try again shortly.",
    );
  }
  const payload = data as Partial<ExtractedPdfText> | null;
  if (!payload || typeof payload.text !== "string" || !payload.text.trim()) {
    throw new Error(EMPTY_PDF_MESSAGE);
  }
  return {
    text: payload.text,
    characters: payload.characters ?? payload.text.length,
    truncated: Boolean(payload.truncated),
  };
}

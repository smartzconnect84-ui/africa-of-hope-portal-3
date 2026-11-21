/**
 * ApyHub "Extract Text from PDF" client.
 * Docs: https://apyhub.com/apyhub/service/extract-text-from-pdf
 *
 * ApyHub reads the text layer of a PDF, so a scanned document comes back empty;
 * that is reported as `empty_document` and needs an OCR service instead.
 *
 * Nothing here reads Deno globals: the caller passes the apy-token in, so the
 * same code runs inside the Edge Function and in the node tests. Extracted text
 * is untrusted document content — callers must never render it as HTML.
 */

export const APYHUB_PDF_ENDPOINT =
  "https://api.eu.apyhub.com/apyhub/extract-text-from-pdf/file";
export const APYHUB_PDF_FIELD = "file";
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_CHARS = 200_000;

const TIMEOUT_MS = 45_000;
const PDF_MAGIC = "%PDF-";

export type PdfTextErrorCode =
  | "not_configured"
  | "empty_upload"
  | "unsupported_type"
  | "too_large"
  | "not_a_pdf"
  | "empty_document"
  | "upstream_auth"
  | "upstream_rejected"
  | "rate_limited"
  | "upstream_error"
  | "timeout";

/** A failure callers can turn straight into an HTTP status and a safe message. */
export class PdfTextError extends Error {
  readonly code: PdfTextErrorCode;
  readonly status: number;

  constructor(code: PdfTextErrorCode, status: number, message: string) {
    super(message);
    this.name = "PdfTextError";
    this.code = code;
    this.status = status;
  }
}

export interface PdfUploadLike {
  name?: string;
  type?: string;
  size: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Checks what the browser told us before a byte reaches ApyHub. Mirrors
 * `validateFile` in src/lib/storage.ts so the client and the function agree,
 * but it is re-run server-side because a browser check can be skipped.
 */
export function validatePdfUpload(file: PdfUploadLike): PdfTextError | null {
  const name = typeof file.name === "string" ? file.name.trim() : "";
  const type = typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
  const claimsPdf = type === "application/pdf" || /\.pdf$/i.test(name);
  const otherType = type && type !== "application/pdf" && type !== "application/octet-stream";
  if (!claimsPdf || otherType) {
    return new PdfTextError(
      "unsupported_type",
      415,
      `"${name || "File"}" is not a supported file type. Upload a PDF.`,
    );
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return new PdfTextError("empty_upload", 400, "The uploaded file is empty.");
  }
  if (file.size > MAX_PDF_BYTES) {
    return new PdfTextError(
      "too_large",
      413,
      `"${name || "The PDF"}" is larger than ${formatBytes(MAX_PDF_BYTES)}.`,
    );
  }
  return null;
}

/** A genuine PDF starts with `%PDF-`; an extension or MIME type alone proves nothing. */
export function isPdfSignature(head: Uint8Array): boolean {
  if (head.length < PDF_MAGIC.length) return false;
  let signature = "";
  for (let i = 0; i < PDF_MAGIC.length; i++) signature += String.fromCharCode(head[i]);
  return signature === PDF_MAGIC;
}

/** Drops control bytes (keeping tabs and newlines) that would break JSON consumers. */
function stripControlCharacters(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const printable = code === 9 || code === 10 || code === 12 || code === 13 || (code >= 32 && code !== 127);
    if (printable) out += char;
  }
  return out;
}

/**
 * Normalises ApyHub's output: CRLF to LF, drops control bytes, trims
 * surrounding whitespace and caps the size the portal stores.
 */
export function cleanExtractedText(
  raw: string,
  maxChars: number = MAX_EXTRACTED_CHARS,
): { text: string; truncated: boolean } {
  const normalized = stripControlCharacters(raw.replace(/\r\n?/g, "\n"))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const truncated = normalized.length > maxChars;
  return {
    text: truncated ? normalized.slice(0, maxChars).trimEnd() : normalized,
    truncated,
  };
}

function upstreamFailure(status: number): PdfTextError {
  if (status === 401 || status === 403) {
    return new PdfTextError(
      "upstream_auth",
      502,
      "PDF text extraction is not configured correctly on the server.",
    );
  }
  if (status === 402 || status === 429) {
    return new PdfTextError(
      "rate_limited",
      429,
      "The PDF service is busy right now. Try again in a minute.",
    );
  }
  if (status === 413) {
    return new PdfTextError("too_large", 413, "This PDF is too large for the extraction service.");
  }
  if (status >= 400 && status < 500) {
    return new PdfTextError(
      "upstream_rejected",
      422,
      "The PDF could not be read. Check that it is a valid, unencrypted PDF and try again.",
    );
  }
  return new PdfTextError(
    "upstream_error",
    502,
    "The PDF service did not answer. Try again shortly.",
  );
}

export interface ExtractPdfTextOptions {
  file: Blob;
  fileName?: string;
  /** Server-only ApyHub token (`APY_TOKEN`). Never send this to the browser. */
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxChars?: number;
}

export interface ExtractedPdfText {
  text: string;
  characters: number;
  truncated: boolean;
}

/**
 * Uploads one PDF to `POST /apyhub/extract-text-from-pdf/file` as multipart
 * `file` and returns the `data` string ApyHub answers with.
 */
export async function extractPdfTextFromApyhub(
  options: ExtractPdfTextOptions,
): Promise<ExtractedPdfText> {
  const token = (options.token ?? "").trim();
  if (!token) {
    throw new PdfTextError(
      "not_configured",
      503,
      "PDF text extraction is not configured on the server.",
    );
  }

  const form = new FormData();
  form.append(APYHUB_PDF_FIELD, options.file, options.fileName?.trim() || "document.pdf");

  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  let response: Response;
  try {
    response = await doFetch(APYHUB_PDF_ENDPOINT, {
      method: "POST",
      headers: { "apy-token": token, accept: "application/json" },
      body: form,
      signal: controller.signal,
    });
  } catch {
    throw controller.signal.aborted
      ? new PdfTextError(
          "timeout",
          504,
          "The PDF service took too long to answer. Try a shorter document.",
        )
      : new PdfTextError(
          "upstream_error",
          502,
          "The PDF service could not be reached. Try again shortly.",
        );
  } finally {
    clearTimeout(timer);
  }

  let raw: string;
  try {
    raw = await response.text();
  } catch {
    throw new PdfTextError("upstream_error", 502, "The PDF service did not answer. Try again shortly.");
  }

  if (!response.ok) throw upstreamFailure(response.status);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new PdfTextError("upstream_error", 502, "The PDF service returned an unreadable answer.");
  }
  const data = payload && typeof payload === "object" ? (payload as { data?: unknown }).data : undefined;
  if (typeof data !== "string") {
    throw new PdfTextError("upstream_error", 502, "The PDF service returned an unreadable answer.");
  }

  const { text, truncated } = cleanExtractedText(data, options.maxChars);
  if (!text) {
    throw new PdfTextError(
      "empty_document",
      422,
      "No text could be extracted from this PDF. A scanned PDF is images of text and needs OCR, which this service does not do.",
    );
  }
  return { text, characters: text.length, truncated };
}

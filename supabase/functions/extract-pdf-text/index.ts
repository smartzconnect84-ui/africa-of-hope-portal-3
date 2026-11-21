import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- ApyHub "Extract Text from PDF" client (inlined from _shared/apyhubPdf.ts) ----
// The _shared/ files are the tested library source (see tests/apyhubPdf.test.ts);
// this entry point is self-contained because the Supabase deploy tool cannot
// resolve ../_shared/ imports that sit outside the function's own directory.

const APYHUB_PDF_ENDPOINT =
  "https://api.eu.apyhub.com/apyhub/extract-text-from-pdf/file";
const APYHUB_PDF_FIELD = "file";
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 200_000;

const TIMEOUT_MS = 45_000;
const PDF_MAGIC = "%PDF-";

class PdfTextError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "PdfTextError";
    this.code = code;
    this.status = status;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validatePdfUpload(
  file: { name?: string; type?: string; size: number },
): PdfTextError | null {
  const name = typeof file.name === "string" ? file.name.trim() : "";
  const type =
    typeof file.type === "string" ? file.type.trim().toLowerCase() : "";
  const claimsPdf = type === "application/pdf" || /\.pdf$/i.test(name);
  const otherType =
    type && type !== "application/pdf" && type !== "application/octet-stream";
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

function isPdfSignature(head: Uint8Array): boolean {
  if (head.length < 5) return false;
  let signature = "";
  for (let i = 0; i < 5; i++) signature += String.fromCharCode(head[i]);
  return signature === "%PDF-";
}

function stripControlCharacters(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const printable =
      code === 9 ||
      code === 10 ||
      code === 12 ||
      code === 13 ||
      (code >= 32 && code !== 127);
    if (printable) out += char;
  }
  return out;
}

function cleanExtractedText(
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
    return new PdfTextError(
      "too_large",
      413,
      "This PDF is too large for the extraction service.",
    );
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

interface ExtractPdfTextOptions {
  file: Blob;
  fileName?: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxChars?: number;
}

interface ExtractedPdfText {
  text: string;
  characters: number;
  truncated: boolean;
}

async function extractPdfTextFromApyhub(
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
  form.append(
    APYHUB_PDF_FIELD,
    options.file,
    options.fileName?.trim() || "document.pdf",
  );

  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? TIMEOUT_MS,
  );
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
    throw new PdfTextError(
      "upstream_error",
      502,
      "The PDF service did not answer. Try again shortly.",
    );
  }

  if (!response.ok) throw upstreamFailure(response.status);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new PdfTextError(
      "upstream_error",
      502,
      "The PDF service returned an unreadable answer.",
    );
  }
  const data = payload && typeof payload === "object"
    ? (payload as { data?: unknown }).data
    : undefined;
  if (typeof data !== "string") {
    throw new PdfTextError(
      "upstream_error",
      502,
      "The PDF service returned an unreadable answer.",
    );
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

// ---- HTTP handler (inlined from _shared/apyhubPdfHandler.ts) ----

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (
  body: unknown,
  status = 200,
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

function uploadName(entry: Blob): string {
  const name = (entry as Blob & { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name.trim() : "document.pdf";
}

interface ExtractPdfHandlerDeps {
  token?: string;
  verifyUser: (request: Request) => Promise<boolean>;
  fetchImpl?: typeof fetch;
  maxChars?: number;
}

function createExtractPdfHandler(deps: ExtractPdfHandlerDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === "OPTIONS")
      return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST")
      return json({ error: "Use POST with a PDF upload." }, 405);

    try {
      const token = (deps.token ?? "").trim();
      if (!token) {
        console.error("extract-pdf-text: APY_TOKEN is not set");
        return json(
          {
            error: "PDF text extraction is not configured on the server.",
            code: "not_configured",
          },
          503,
        );
      }

      let signedIn = false;
      try {
        signedIn = await deps.verifyUser(request);
      } catch {
        signedIn = false;
      }
      if (!signedIn) {
        return json(
          {
            error: "Sign in to extract text from a document.",
            code: "unauthorized",
          },
          401,
        );
      }

      const declaredLength =
        Number(request.headers.get("content-length") ?? "");
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > MAX_PDF_BYTES + MULTIPART_OVERHEAD_BYTES
      ) {
        return json(
          { error: "PDFs must be 10 MB or smaller.", code: "too_large" },
          413,
        );
      }

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return json(
          {
            error:
              'Send the PDF as multipart/form-data with the file in the "file" field.',
            code: "invalid_body",
          },
          400,
        );
      }

      const entry = form.get("file");
      if (!(entry instanceof Blob) || entry.size === 0) {
        return json(
          { error: 'Attach a PDF in the "file" field.', code: "missing_file" },
          400,
        );
      }

      const name = uploadName(entry);
      const invalid = validatePdfUpload({
        name,
        type: entry.type,
        size: entry.size,
      });
      if (invalid)
        return json({ error: invalid.message, code: invalid.code }, invalid.status);

      const head = new Uint8Array(await entry.slice(0, 5).arrayBuffer());
      if (!isPdfSignature(head)) {
        return json(
          {
            error: "Please choose a genuine PDF document.",
            code: "not_a_pdf",
          },
          415,
        );
      }

      const pdf =
        entry.type === "application/pdf"
          ? entry
          : new Blob([entry], { type: "application/pdf" });
      const result = await extractPdfTextFromApyhub({
        file: pdf,
        fileName: name,
        token,
        fetchImpl: deps.fetchImpl,
        maxChars: deps.maxChars,
      });
      return json(result);
    } catch (error) {
      if (error instanceof PdfTextError) {
        console.error(`extract-pdf-text: ${error.code}`);
        return json(
          { error: error.message, code: error.code },
          error.status,
        );
      }
      console.error("extract-pdf-text: unexpected failure");
      return json(
        { error: "The PDF could not be read. Try again shortly.", code: "unexpected" },
        500,
      );
    }
  };
}

// ---- Entry point (from index.ts) ----

async function verifyUser(request: Request): Promise<boolean> {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const token = (
    request.headers.get("Authorization") ?? ""
  ).replace(/^Bearer\s+/i, "");
  if (!url || !anonKey || !token) return false;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  return !error && Boolean(data?.user);
}

Deno.serve(
  createExtractPdfHandler({
    token: Deno.env.get("APY_TOKEN"),
    verifyUser,
  }),
);

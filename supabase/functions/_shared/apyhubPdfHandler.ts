import {
  MAX_PDF_BYTES,
  PdfTextError,
  extractPdfTextFromApyhub,
  isPdfSignature,
  validatePdfUpload,
} from "./apyhubPdf.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Multipart framing is a few hundred bytes on top of the PDF itself. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

export interface ExtractPdfHandlerDeps {
  /** Server-only ApyHub token; undefined when the deployment has no secret set. */
  token?: string;
  /** Resolves true only for a signed-in member of this project. */
  verifyUser: (request: Request) => Promise<boolean>;
  fetchImpl?: typeof fetch;
  maxChars?: number;
}

function uploadName(entry: Blob): string {
  const name = (entry as Blob & { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name.trim() : "document.pdf";
}

/**
 * The HTTP layer of the `extract-pdf-text` Edge Function. It is separate from
 * index.ts so the node tests can drive every branch without Deno or a network:
 * the Deno entry supplies the real token and the Supabase session check.
 *
 * The response only ever carries the extracted text, never the token, the
 * upstream body or any other request state.
 */
export function createExtractPdfHandler(deps: ExtractPdfHandlerDeps) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (request.method !== "POST") return json({ error: "Use POST with a PDF upload." }, 405);

    try {
      const token = (deps.token ?? "").trim();
      if (!token) {
        console.error("extract-pdf-text: APY_TOKEN is not set");
        return json(
          { error: "PDF text extraction is not configured on the server.", code: "not_configured" },
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
          { error: "Sign in to extract text from a document.", code: "unauthorized" },
          401,
        );
      }

      const declaredLength = Number(request.headers.get("content-length") ?? "");
      if (Number.isFinite(declaredLength) && declaredLength > MAX_PDF_BYTES + MULTIPART_OVERHEAD_BYTES) {
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
            error: 'Send the PDF as multipart/form-data with the file in the "file" field.',
            code: "invalid_body",
          },
          400,
        );
      }

      const entry = form.get("file");
      if (!(entry instanceof Blob) || entry.size === 0) {
        return json({ error: 'Attach a PDF in the "file" field.', code: "missing_file" }, 400);
      }

      const name = uploadName(entry);
      const invalid = validatePdfUpload({ name, type: entry.type, size: entry.size });
      if (invalid) return json({ error: invalid.message, code: invalid.code }, invalid.status);

      const head = new Uint8Array(await entry.slice(0, 5).arrayBuffer());
      if (!isPdfSignature(head)) {
        return json(
          { error: "Please choose a genuine PDF document.", code: "not_a_pdf" },
          415,
        );
      }

      const pdf = entry.type === "application/pdf" ? entry : new Blob([entry], { type: "application/pdf" });
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
        return json({ error: error.message, code: error.code }, error.status);
      }
      console.error("extract-pdf-text: unexpected failure");
      return json(
        { error: "The PDF could not be read. Try again shortly.", code: "unexpected" },
        500,
      );
    }
  };
}

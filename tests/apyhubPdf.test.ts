import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APYHUB_PDF_ENDPOINT,
  MAX_PDF_BYTES,
  PdfTextError,
  cleanExtractedText,
  extractPdfTextFromApyhub,
  isPdfSignature,
  validatePdfUpload,
} from "../supabase/functions/_shared/apyhubPdf.ts";
import { createExtractPdfHandler } from "../supabase/functions/_shared/apyhubPdfHandler.ts";

const SAMPLE_TEXT = "AFRICA OF HOPE synthetic PDF text";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Builds a one-page PDF with a real text layer and correct xref offsets. */
function syntheticPdf(text: string): Uint8Array {
  const escaped = text.replace(/[\\()]/g, (c) => `\\${c}`);
  const content = `BT /F1 18 Tf 72 720 Td (${escaped}) Tj ET\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefAt = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return encoder.encode(pdf);
}

function pdfBlob(text = SAMPLE_TEXT, name = "synthetic.pdf"): File {
  return new File([syntheticPdf(text)], name, { type: "application/pdf" });
}

function apyhubAnswers(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function handlerDeps(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return {
    token: "test-apy-token",
    verifyUser: async () => true,
    fetchImpl,
    ...overrides,
  };
}

test("the synthetic PDF is a genuine PDF carrying its expected text", () => {
  const pdf = syntheticPdf(SAMPLE_TEXT);
  assert.ok(isPdfSignature(pdf.slice(0, 5)));
  assert.ok(decoder.decode(pdf).includes(SAMPLE_TEXT));
  assert.ok(decoder.decode(pdf).trimEnd().endsWith("%%EOF"));
});

test("uploads the documented multipart field to the documented ApyHub endpoint", async () => {
  const pdf = pdfBlob();
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(url);
    seenInit = init;
    return new Response(JSON.stringify({ data: SAMPLE_TEXT }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const result = await extractPdfTextFromApyhub({
    file: pdf,
    fileName: "synthetic.pdf",
    token: "test-apy-token",
    fetchImpl,
  });

  assert.equal(seenUrl, "https://api.eu.apyhub.com/apyhub/extract-text-from-pdf/file");
  assert.equal(seenUrl, APYHUB_PDF_ENDPOINT);
  assert.equal(seenInit?.method, "POST");
  assert.equal(new Headers(seenInit?.headers).get("apy-token"), "test-apy-token");
  const body = seenInit?.body as FormData;
  assert.ok(body instanceof FormData);
  assert.deepEqual([...body.keys()], ["file"]);
  const sent = body.get("file");
  assert.ok(sent instanceof Blob);
  assert.equal(sent.type, "application/pdf");
  assert.equal(decoder.decode(await sent.arrayBuffer()), decoder.decode(syntheticPdf(SAMPLE_TEXT)));
  assert.deepEqual(result, { text: SAMPLE_TEXT, characters: SAMPLE_TEXT.length, truncated: false });
});

test("an empty answer is reported as a scanned PDF, not as success", async () => {
  await assert.rejects(
    extractPdfTextFromApyhub({
      file: pdfBlob(),
      token: "test-apy-token",
      fetchImpl: apyhubAnswers({ data: "   \n\n" }),
    }),
    (error: unknown) => {
      assert.ok(error instanceof PdfTextError);
      assert.equal(error.code, "empty_document");
      assert.equal(error.status, 422);
      assert.match(error.message, /OCR/);
      return true;
    },
  );
});

test("upstream failures become safe errors without echoing the upstream body", async () => {
  const cases: Array<[number, string, number]> = [
    [401, "upstream_auth", 502],
    [403, "upstream_auth", 502],
    [429, "rate_limited", 429],
    [413, "too_large", 413],
    [400, "upstream_rejected", 422],
    [503, "upstream_error", 502],
  ];
  for (const [status, code, expectedStatus] of cases) {
    await assert.rejects(
      extractPdfTextFromApyhub({
        file: pdfBlob(),
        token: "test-apy-token",
        fetchImpl: apyhubAnswers({ message: "internal apyhub detail" }, status),
      }),
      (error: unknown) => {
        assert.ok(error instanceof PdfTextError);
        assert.equal(error.code, code);
        assert.equal(error.status, expectedStatus);
        assert.doesNotMatch(error.message, /internal apyhub detail/);
        return true;
      },
    );
  }
});

test("a non-JSON answer is rejected rather than passed through", async () => {
  await assert.rejects(
    extractPdfTextFromApyhub({
      file: pdfBlob(),
      token: "test-apy-token",
      fetchImpl: apyhubAnswers("<html>not json</html>"),
    }),
    (error: unknown) => error instanceof PdfTextError && error.code === "upstream_error",
  );
});

test("extracted text is cleaned as untrusted content", () => {
  const cleaned = cleanExtractedText("Line one\r\n\u0000Line\u0007 two\n\n\n\nEnd");
  assert.equal(cleaned.text, "Line one\nLine two\n\nEnd");
  assert.equal(cleaned.truncated, false);

  const capped = cleanExtractedText("abcdefghij", 4);
  assert.deepEqual(capped, { text: "abcd", truncated: true });
});

test("upload validation rejects the wrong type, an empty file and oversize PDFs", () => {
  assert.equal(validatePdfUpload({ name: "scan.pdf", type: "application/pdf", size: 10 }), null);
  assert.equal(validatePdfUpload({ name: "scan.pdf", type: "", size: 10 }), null);

  const wrongType = validatePdfUpload({ name: "notes.txt", type: "text/plain", size: 10 });
  assert.equal(wrongType?.code, "unsupported_type");
  assert.equal(wrongType?.status, 415);

  const empty = validatePdfUpload({ name: "scan.pdf", type: "application/pdf", size: 0 });
  assert.equal(empty?.code, "empty_upload");

  const big = validatePdfUpload({ name: "scan.pdf", type: "application/pdf", size: MAX_PDF_BYTES + 1 });
  assert.equal(big?.code, "too_large");
  assert.equal(big?.status, 413);
});

test("the handler refuses anonymous callers before spending an ApyHub call", async () => {
  let called = false;
  const handler = createExtractPdfHandler(
    handlerDeps((async () => {
      called = true;
      return apyhubAnswers({ data: SAMPLE_TEXT }) as unknown as Response;
    }) as typeof fetch, { verifyUser: async () => false }),
  );
  const body = new FormData();
  body.append("file", pdfBlob());
  const response = await handler(new Request("http://localhost/extract-pdf-text", { method: "POST", body }));
  assert.equal(response.status, 401);
  assert.equal(((await response.json()) as { code: string }).code, "unauthorized");
  assert.equal(called, false);
});

test("the handler reports a missing APY_TOKEN instead of calling ApyHub", async () => {
  let called = false;
  const handler = createExtractPdfHandler(
    handlerDeps((async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch, { token: undefined }),
  );
  const response = await handler(new Request("http://localhost/extract-pdf-text", { method: "POST" }));
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { code: string }).code, "not_configured");
  assert.equal(called, false);
});

test("the handler rejects the wrong method, a missing file and a fake PDF", async () => {
  const handler = createExtractPdfHandler(handlerDeps(apyhubAnswers({ data: SAMPLE_TEXT })));

  const wrongMethod = await handler(new Request("http://localhost/extract-pdf-text"));
  assert.equal(wrongMethod.status, 405);

  const noFile = new FormData();
  noFile.append("file", new Blob([]), "empty.pdf");
  const missing = await handler(new Request("http://localhost/extract-pdf-text", { method: "POST", body: noFile }));
  assert.equal(missing.status, 400);

  const fake = new FormData();
  fake.append("file", new File(["not a pdf at all"], "fake.pdf", { type: "application/pdf" }));
  const fakeResponse = await handler(new Request("http://localhost/extract-pdf-text", { method: "POST", body: fake }));
  assert.equal(fakeResponse.status, 415);
  assert.equal(((await fakeResponse.json()) as { code: string }).code, "not_a_pdf");

  const txt = new FormData();
  txt.append("file", new File(["hello"], "notes.txt", { type: "text/plain" }));
  const wrongType = await handler(new Request("http://localhost/extract-pdf-text", { method: "POST", body: txt }));
  assert.equal(wrongType.status, 415);
});

test("the handler returns the extracted text and never the token", async () => {
  const handler = createExtractPdfHandler(handlerDeps(apyhubAnswers({ data: SAMPLE_TEXT })));
  const body = new FormData();
  body.append("file", pdfBlob());
  const response = await handler(new Request("http://localhost/extract-pdf-text", { method: "POST", body }));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const raw = await response.text();
  assert.deepEqual(JSON.parse(raw), {
    text: SAMPLE_TEXT,
    characters: SAMPLE_TEXT.length,
    truncated: false,
  });
  assert.doesNotMatch(raw, /test-apy-token/);
});

/**
 * Opt-in live check: needs a real ApyHub token in the environment, because the
 * other tests mock the provider. It uploads the same synthetic PDF and asserts
 * ApyHub returns the text inside it. Skipped in normal runs.
 */
test(
  "live ApyHub extraction returns the synthetic PDF's text",
  { skip: !process.env.APY_TOKEN && "set APY_TOKEN to run the live ApyHub check" },
  async () => {
    const result = await extractPdfTextFromApyhub({
      file: pdfBlob(),
      fileName: "synthetic.pdf",
      token: process.env.APY_TOKEN ?? "",
    });
    assert.ok(
      result.text.includes(SAMPLE_TEXT),
      `expected the synthetic PDF text in the ApyHub answer, got: ${JSON.stringify(result.text.slice(0, 120))}`,
    );
  },
);

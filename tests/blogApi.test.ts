import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLOG_COVER_BUCKET,
  COVER_IMAGE_TYPES,
  MAX_COVER_BYTES,
  createBlogApi,
  explainBlogError,
  slugify,
  uniqueSlug,
} from "../src/lib/blog.ts";
import type { BlogApiClient } from "../src/lib/blog.ts";

type Response = { data: unknown; error: { message: string; code?: string } | null };

interface Config {
  selectResponse?: Response;
  insertResponse?: Response;
  updateResponse?: Response;
  deleteResponse?: Response;
  storageResponse?: { data: unknown; error: { message: string } | null };
}

function makeQuery(calls: Array<[string, ...unknown[]]>, config: Config) {
  let mode: "select" | "insert" | "update" | "delete" = "select";
  type MockRequest = {
    select: (...args: unknown[]) => MockRequest;
    insert: (...args: unknown[]) => MockRequest;
    update: (...args: unknown[]) => MockRequest;
    delete: (...args: unknown[]) => MockRequest;
    eq: (...args: unknown[]) => MockRequest;
    neq: (...args: unknown[]) => MockRequest;
    ilike: (...args: unknown[]) => MockRequest;
    or: (...args: unknown[]) => MockRequest;
    order: (...args: unknown[]) => MockRequest;
    limit: (...args: unknown[]) => MockRequest;
    single: () => Promise<Response>;
    then: (resolve: (value: Response) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown>;
  };
  const request = {} as MockRequest;
  function resolved(): Promise<Response> {
    const response =
      mode === "insert" ? config.insertResponse :
      mode === "update" ? config.updateResponse :
      mode === "delete" ? config.deleteResponse :
      config.selectResponse;
    return Promise.resolve(response ?? { data: [], error: null });
  }
  Object.assign(request, {
    select(...args: unknown[]) { calls.push(["select", ...args]); return request; },
    insert(...args: unknown[]) { calls.push(["insert", ...args]); mode = "insert"; return request; },
    update(...args: unknown[]) { calls.push(["update", ...args]); mode = "update"; return request; },
    delete(...args: unknown[]) { calls.push(["delete", ...args]); mode = "delete"; return request; },
    eq(...args: unknown[]) { calls.push(["eq", ...args]); return request; },
    neq(...args: unknown[]) { calls.push(["neq", ...args]); return request; },
    ilike(...args: unknown[]) { calls.push(["ilike", ...args]); return request; },
    or(...args: unknown[]) { calls.push(["or", ...args]); return request; },
    order(...args: unknown[]) { calls.push(["order", ...args]); return request; },
    limit(...args: unknown[]) { calls.push(["limit", ...args]); return request; },
    single() { calls.push(["single"]); return resolved(); },
    then(resolve: (value: Response) => unknown, reject: (reason: unknown) => unknown) {
      return resolved().then(resolve, reject);
    },
  });
  return request;
}

function mockClient(config: Config = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const client = {
    from(table: string) { calls.push(["from", table]); return makeQuery(calls, config); },
    storage: {
      from(bucket: string) {
        calls.push(["storage.from", bucket]);
        return {
          async upload(...args: unknown[]) { calls.push(["upload", ...args]); return config.storageResponse ?? { data: {}, error: null }; },
          async remove(...args: unknown[]) { calls.push(["remove", ...args]); return config.storageResponse ?? { data: {}, error: null }; },
          getPublicUrl(path: string) { calls.push(["getPublicUrl", path]); return { data: { publicUrl: `https://cdn.example/${bucket}/${path}` } }; },
        };
      },
    },
  };
  return { client: client as unknown as BlogApiClient, calls };
}

test("slugify lowercases, strips punctuation and hyphenates", () => {
  assert.equal(slugify("Road Safety Training!"), "road-safety-training");
  assert.equal(slugify("  Café  Ouvert  "), "cafe-ouvert");
  assert.equal(slugify("###"), "post");
});

test("uniqueSlug appends an incrementing suffix on collision", () => {
  assert.equal(uniqueSlug("road-safety-training", []), "road-safety-training");
  assert.equal(uniqueSlug("road-safety-training", ["road-safety-training"]), "road-safety-training-2");
  assert.equal(
    uniqueSlug("road-safety-training", ["road-safety-training", "road-safety-training-2"]),
    "road-safety-training-3",
  );
});

test("explainBlogError translates database/storage errors into actionable copy", () => {
  assert.match(explainBlogError({ message: "relation \"blog_posts\" does not exist" }) ?? "", /not set up yet/);
  assert.match(explainBlogError({ message: "duplicate key value violates unique constraint \"blog_posts_slug_key\"", code: "23505" }) ?? "", /already used/);
  assert.match(explainBlogError({ message: "new row violates row-level security policy" }) ?? "", /permission/);
  assert.equal(explainBlogError(null), null);
});

test("ensureUniqueSlug queries existing slugs and appends a suffix on collision", async () => {
  const { client, calls } = mockClient({ selectResponse: { data: [{ slug: "road-safety-training" }], error: null } });
  const api = createBlogApi(client);
  const slug = await api.ensureUniqueSlug("Road Safety Training");
  assert.equal(slug, "road-safety-training-2");
  assert.ok(calls.some(([name, ...args]) => name === "ilike" && args[1] === "road-safety-training%"));
});

test("create() with action 'schedule' sets status 'scheduled' and published_at to the chosen time", async () => {
  const { client, calls } = mockClient({
    selectResponse: { data: [], error: null },
    insertResponse: { data: { id: "post-1", slug: "road-safety-training", status: "scheduled", published_at: "2026-11-01T09:00:00.000Z", title: "x", excerpt: "", body: "", cover_image_url: null, cover_image_path: null, category: "News", tags: [], author_id: null, author_name: "", featured: false, created_at: "now", updated_at: "now" }, error: null },
  });
  const api = createBlogApi(client);
  const post = await api.create(
    { title: "Road Safety Training", excerpt: "", body: "", category: "News", tags: [] },
    "schedule",
    "2026-11-01T09:00",
  );
  assert.equal(post.status, "scheduled");
  assert.equal(post.publishedAt, "2026-11-01T09:00:00.000Z");
  const insertCall = calls.find(([name]) => name === "insert");
  const row = insertCall?.[1] as Record<string, unknown>;
  assert.equal(row.status, "scheduled");
  assert.equal(row.published_at, new Date("2026-11-01T09:00").toISOString());
});

test("create() with action 'publish' sets status 'published' and published_at to now", async () => {
  const fixedNow = new Date("2026-10-14T12:00:00.000Z").getTime();
  const { client } = mockClient({
    selectResponse: { data: [], error: null },
    insertResponse: { data: { id: "post-2", slug: "news-item", status: "published", published_at: "2026-10-14T12:00:00.000Z", title: "x", excerpt: "", body: "", cover_image_url: null, cover_image_path: null, category: "News", tags: [], author_id: null, author_name: "", featured: false, created_at: "now", updated_at: "now" }, error: null },
  });
  const api = createBlogApi(client, () => fixedNow);
  const post = await api.create({ title: "News item", excerpt: "", body: "", category: "News", tags: [] }, "publish");
  assert.equal(post.status, "published");
  assert.equal(post.publishedAt, "2026-10-14T12:00:00.000Z");
});

test("create() with action 'schedule' and no scheduledAt throws before touching the database", async () => {
  const { client, calls } = mockClient({ selectResponse: { data: [], error: null } });
  const api = createBlogApi(client);
  await assert.rejects(
    api.create({ title: "Draft idea", excerpt: "", body: "", category: "News", tags: [] }, "schedule"),
    /Choose a date and time/,
  );
  assert.ok(!calls.some(([name]) => name === "insert"));
});

test("uploadCover rejects files that are too large or not an accepted image type", async () => {
  const { client } = mockClient();
  const api = createBlogApi(client);
  const tooBig = { type: "image/png", size: MAX_COVER_BYTES + 1, name: "cover.png" } as unknown as File;
  await assert.rejects(api.uploadCover(tooBig, "post"), /5 MB/);
  const wrongType = { type: "application/pdf", size: 1024, name: "cover.pdf" } as unknown as File;
  await assert.rejects(api.uploadCover(wrongType, "post"), /JPEG, PNG, WEBP or GIF/);
  for (const type of COVER_IMAGE_TYPES) assert.ok(type.startsWith("image/"));
});

test("uploadCover uploads to the blog-covers bucket and returns a public URL + path", async () => {
  const { client, calls } = mockClient();
  const api = createBlogApi(client, () => 1700000000000);
  const file = { type: "image/jpeg", size: 1024, name: "cover.jpg" } as unknown as File;
  const result = await api.uploadCover(file, "Road Safety Training");
  assert.equal(result.path, "road-safety-training/1700000000000.jpg");
  assert.equal(result.url, `https://cdn.example/${BLOG_COVER_BUCKET}/road-safety-training/1700000000000.jpg`);
  assert.ok(calls.some(([name, bucket]) => name === "storage.from" && bucket === BLOG_COVER_BUCKET));
});

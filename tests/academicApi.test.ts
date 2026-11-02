import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  MAX_TRAINING_MATERIAL_BYTES,
  SUPPORTED_TRAINING_MATERIAL_MIME_TYPES,
  createAcademicApi,
  explainAcademicError,
  safeTrainingMaterialName,
  trainingMaterialPath,
} from "../src/lib/academicApiFactory.ts";
import type { AcademicApiClient } from "../src/lib/academicApiFactory.ts";

type Response = { data: unknown; error: { message: string; details?: string | null } | null };

function query(response: Response, calls: Array<[string, ...unknown[]]>) {
  type MockRequest = {
    select: (...args: unknown[]) => MockRequest;
    insert: (...args: unknown[]) => MockRequest;
    update: (...args: unknown[]) => MockRequest;
    eq: (...args: unknown[]) => MockRequest;
    in: (...args: unknown[]) => MockRequest;
    order: (...args: unknown[]) => MockRequest;
    limit: (...args: unknown[]) => MockRequest;
    or: (...args: unknown[]) => MockRequest;
    single: () => Promise<Response>;
    then: (resolve: (value: Response) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown>;
  };
  const request = {} as MockRequest;
  Object.assign(request, {
    select(...args: unknown[]) { calls.push(["select", ...args]); return request; },
    insert(...args: unknown[]) { calls.push(["insert", ...args]); return request; },
    update(...args: unknown[]) { calls.push(["update", ...args]); return request; },
    eq(...args: unknown[]) { calls.push(["eq", ...args]); return request; },
    in(...args: unknown[]) { calls.push(["in", ...args]); return request; },
    order(...args: unknown[]) { calls.push(["order", ...args]); return request; },
    limit(...args: unknown[]) { calls.push(["limit", ...args]); return request; },
    or(...args: unknown[]) { calls.push(["or", ...args]); return request; },
    single() { calls.push(["single"]); return Promise.resolve(response); },
    then(resolve: (value: Response) => unknown, reject: (reason: unknown) => unknown) {
      return Promise.resolve(response).then(resolve, reject);
    },
  });
  return request;
}

function mockClient(options: { response?: Response; rpcResponse?: Response; storageResponse?: Response } = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const response = options.response ?? { data: [], error: null };
  const rpcResponse = options.rpcResponse ?? { data: null, error: null };
  const storageResponse = options.storageResponse ?? { data: {}, error: null };
  const client = {
    from(table: string) { calls.push(["from", table]); return query(response, calls); },
    async rpc(name: string, args: unknown) { calls.push(["rpc", name, args]); return rpcResponse; },
    storage: {
      from(bucket: string) {
        calls.push(["storage.from", bucket]);
        return {
          async upload(...args: unknown[]) { calls.push(["upload", ...args]); return storageResponse; },
          async remove(...args: unknown[]) { calls.push(["remove", ...args]); return storageResponse; },
          async createSignedUrl(...args: unknown[]) { calls.push(["createSignedUrl", ...args]); return storageResponse; },
        };
      },
    },
  };
  return { client: client as unknown as AcademicApiClient, calls };
}

test("translates academic database errors into actionable messages", () => {
  assert.equal(explainAcademicError({ message: "relation does not exist" }), "Academic planning is not active yet. Apply the latest Supabase migration, then refresh this page.");
  assert.equal(explainAcademicError({ message: "decision_note_required" }), "Add a decision note for a rejection or revision request.");
  assert.equal(
    explainAcademicError({ message: "enrollment_not_allowed", details: JSON.stringify({ conflicts: ["Overlap"], warnings: ["Heavy workload"] }) }),
    "Overlap Heavy workload",
  );
  assert.equal(explainAcademicError({ message: "enrollment_not_allowed", details: "not-json" }), "This course cannot be added to your plan.");
});

test("uses the exact enrollment RPC contracts and null preview fallback", async () => {
  const { client, calls } = mockClient({ rpcResponse: { data: null, error: null } });
  const api = createAcademicApi(client);
  assert.deepEqual(await api.previewEnrollment("cohort-1"), { allowed: false, conflicts: [], warnings: [], weekly_hours: 0 });
  await api.submitEnrollment("cohort-1");
  assert.deepEqual(calls.filter(([name]) => name === "rpc"), [
    ["rpc", "preview_course_enrollment", { p_cohort_id: "cohort-1" }],
    ["rpc", "submit_course_enrollment", { p_cohort_id: "cohort-1" }],
  ]);
});

test("API methods reject with translated database errors", async () => {
  const { client } = mockClient({ rpcResponse: { data: null, error: { message: "class_session_schedule_conflict" } } });
  await assert.rejects(
    createAcademicApi(client).submit("class_session", "session-1"),
    /overlaps another approved session/,
  );
});

test("maps the complete lesson bundle payload to the atomic RPC", async () => {
  const { client, calls } = mockClient({ rpcResponse: { data: { id: "unit-1" }, error: null } });
  const api = createAcademicApi(client);
  await api.createUnitWithAssessments({
    program_id: "program-1", cohort_id: "cohort-1", course_plan_id: "plan-1", title: "Safety",
    summary: "Coverage", unit_type: "topic", position: 2, available_from: null, due_at: "2026-10-20T23:59:00.000Z",
  }, { classworkMinutes: 30, classworkWeight: 40, quizMinutes: 15, quizWeight: 60 });
  assert.deepEqual(calls.find(([name]) => name === "rpc"), ["rpc", "create_academic_lesson_bundle", {
    p_program_id: "program-1", p_cohort_id: "cohort-1", p_course_plan_id: "plan-1", p_title: "Safety",
    p_summary: "Coverage", p_unit_type: "topic", p_position: 2, p_due_at: "2026-10-20T23:59:00.000Z",
    p_classwork_minutes: 30, p_classwork_weight: 40, p_quiz_minutes: 15, p_quiz_weight: 60,
    p_available_from: null,
  }]);
});

test("forwards a non-null available_from on the lesson bundle RPC", async () => {
  const { client, calls } = mockClient({ rpcResponse: { data: { id: "unit-2" }, error: null } });
  const api = createAcademicApi(client);
  await api.createUnitWithAssessments({
    program_id: "program-1", cohort_id: "cohort-1", course_plan_id: "plan-1", title: "Safety",
    summary: "Coverage", unit_type: "topic", position: 2, available_from: "2026-10-18T00:00:00.000Z", due_at: "2026-10-20T23:59:00.000Z",
  }, { classworkMinutes: 30, classworkWeight: 40, quizMinutes: 15, quizWeight: 60 });
  const rpcCall = calls.find(([name]) => name === "rpc") as [string, string, Record<string, unknown>] | undefined;
  assert.equal(rpcCall?.[2].p_available_from, "2026-10-18T00:00:00.000Z");
});

test("submits and reviews through exact RPC argument names", async () => {
  const { client, calls } = mockClient();
  const api = createAcademicApi(client);
  await api.submit("course_plan", "plan-1");
  await api.review("course_plan", "plan-1", "revision_requested", "Add dates");
  assert.deepEqual(calls.filter(([name]) => name === "rpc"), [
    ["rpc", "submit_academic_item", { p_entity_type: "course_plan", p_entity_id: "plan-1" }],
    ["rpc", "review_academic_submission", { p_entity_type: "course_plan", p_entity_id: "plan-1", p_decision: "revision_requested", p_note: "Add dates" }],
  ]);
});

test("revision writes only the selected table and submittable statuses", async () => {
  const { client, calls } = mockClient({ response: { data: { id: "material-1" }, error: null } });
  await createAcademicApi(client).revise("training_material", "material-1", { description: "Updated" });
  assert.deepEqual(calls, [
    ["from", "training_materials"], ["update", { description: "Updated" }], ["eq", "id", "material-1"],
    ["in", "status", ["draft", "revision_requested"]], ["select"], ["single"],
  ]);
});

test("material upload accepts the 25 MB boundary and creates a private safe path", async () => {
  const { client, calls } = mockClient();
  const api = createAcademicApi(client, () => 1234);
  const file = new File([new Uint8Array(MAX_TRAINING_MATERIAL_BYTES)], "Lesson notes (final).pdf", { type: "application/pdf" });
  assert.deepEqual(await api.uploadMaterial(file, "cohort-1", "teacher-1"), {
    path: "cohort-1/teacher-1/1234-Lesson-notes-final-.pdf", mime: "application/pdf",
  });
  assert.deepEqual(calls.find(([name]) => name === "upload")?.slice(1, 2), ["cohort-1/teacher-1/1234-Lesson-notes-final-.pdf"]);
  assert.deepEqual(calls.find(([name]) => name === "upload")?.at(-1), { contentType: "application/pdf", upsert: false });
});

test("material upload rejects oversized and unsupported files before storage", async () => {
  const { client, calls } = mockClient();
  const api = createAcademicApi(client);
  await assert.rejects(api.uploadMaterial(new File([new Uint8Array(MAX_TRAINING_MATERIAL_BYTES + 1)], "large.pdf", { type: "application/pdf" }), "c", "t"), /25 MB or smaller/);
  await assert.rejects(api.uploadMaterial(new File(["x"], "script.exe", { type: "application/x-msdownload" }), "c", "t"), /format is not supported/);
  assert.equal(calls.length, 0);
});

test("material names normalize unsafe characters and stop at 100 characters", () => {
  assert.equal(safeTrainingMaterialName("a b/c?.pdf"), "a-b-c-.pdf");
  assert.equal(safeTrainingMaterialName("x".repeat(110)).length, 100);
  assert.equal(trainingMaterialPath("c", "t", "a b.pdf", 42), "c/t/42-a-b.pdf");
});

test("client material MIME types match the private storage bucket contract", () => {
  const migration = readFileSync(
    new URL("../supabase/migrations/20261014030000_academic_planning_enrollment.sql", import.meta.url),
    "utf8",
  );
  const bucketValues = migration.match(/'training-materials', 'training-materials', false, 26214400,\s*array\[(.*?)\]\s*\)/s)?.[1];
  assert.ok(bucketValues, "training-materials bucket MIME array is missing");
  const databaseTypes = new Set(Array.from(bucketValues.matchAll(/'([^']+)'/g), (match) => match[1]));
  assert.deepEqual(databaseTypes, SUPPORTED_TRAINING_MATERIAL_MIME_TYPES);
});

test("material rows start submitted with deterministic timestamps", async () => {
  const { client, calls } = mockClient({ response: { data: { id: "material-1" }, error: null } });
  const api = createAcademicApi(client, () => Date.parse("2026-10-14T12:00:00.000Z"));
  await api.createMaterial({
    program_id: "program-1", cohort_id: "cohort-1", learning_unit_id: null, created_by: "teacher-1",
    title: "Guide", description: "Guide", material_type: "link", file_path: null,
    external_url: "https://example.test/guide", mime_type: null,
  });
  assert.deepEqual(calls.find(([name]) => name === "insert")?.[1], {
    program_id: "program-1", cohort_id: "cohort-1", learning_unit_id: null, created_by: "teacher-1",
    title: "Guide", description: "Guide", material_type: "link", file_path: null,
    external_url: "https://example.test/guide", mime_type: null, status: "submitted", submitted_at: "2026-10-14T12:00:00.000Z",
  });
});

test("signed material URLs expire after ten minutes", async () => {
  const { client, calls } = mockClient({ storageResponse: { data: { signedUrl: "https://signed.test" }, error: null } });
  assert.equal(await createAcademicApi(client).materialUrl("cohort/file.pdf"), "https://signed.test");
  assert.deepEqual(calls.find(([name]) => name === "createSignedUrl"), ["createSignedUrl", "cohort/file.pdf", 600]);
});

test("translates the new learning path and classwork error codes", () => {
  assert.equal(explainAcademicError({ message: "course_window_closed" }), "This course's class schedule has ended. Progress and classwork can no longer be recorded.");
  assert.equal(explainAcademicError({ message: "unit_not_available" }), "This lesson isn't available yet. Check back once it opens.");
  assert.equal(explainAcademicError({ message: "classwork_already_submitted" }), "You already submitted this classwork.");
  assert.equal(explainAcademicError({ message: "classwork_empty" }), "Add a response or attach a file before you submit.");
  assert.equal(explainAcademicError({ message: "available_after_due" }), "\"Available from\" must be before the lesson's due date.");
});

test("starts and submits classwork through exact RPC argument names, with and without an attachment", async () => {
  const { client, calls } = mockClient({ rpcResponse: { data: { submission_id: "sub-1", status: "In Progress" }, error: null } });
  const api = createAcademicApi(client);
  await api.startClasswork("assignment-1");
  await api.submitClasswork("assignment-1", "My answer", "assignment-1/student-1/1-answer.pdf");
  await api.submitClasswork("assignment-1", "My answer", null);
  assert.deepEqual(calls.filter(([name]) => name === "rpc"), [
    ["rpc", "start_classwork", { p_assignment_id: "assignment-1" }],
    ["rpc", "submit_classwork", { p_assignment_id: "assignment-1", p_response_text: "My answer", p_attachment_path: "assignment-1/student-1/1-answer.pdf" }],
    ["rpc", "submit_classwork", { p_assignment_id: "assignment-1", p_response_text: "My answer", p_attachment_path: null }],
  ]);
});

test("classwork attachment upload accepts valid files and writes an assignment/student scoped path", async () => {
  const { client, calls } = mockClient();
  const api = createAcademicApi(client, () => 4321);
  const file = new File(["answer body"], "My Answer (v2).pdf", { type: "application/pdf" });
  assert.deepEqual(await api.uploadClassworkAttachment("assignment-1", "student-1", file), {
    path: "assignment-1/student-1/4321-My-Answer-v2-.pdf", mime: "application/pdf",
  });
  assert.deepEqual(calls.find(([name]) => name === "storage.from"), ["storage.from", "classwork-submissions"]);
  assert.deepEqual(calls.find(([name]) => name === "upload")?.slice(1, 2), ["assignment-1/student-1/4321-My-Answer-v2-.pdf"]);
});

test("classwork attachment upload rejects oversized and unsupported files before storage", async () => {
  const { client, calls } = mockClient();
  const api = createAcademicApi(client);
  await assert.rejects(api.uploadClassworkAttachment("a", "s", new File([new Uint8Array(MAX_TRAINING_MATERIAL_BYTES + 1)], "big.pdf", { type: "application/pdf" })), /25 MB or smaller/);
  await assert.rejects(api.uploadClassworkAttachment("a", "s", new File(["x"], "script.exe", { type: "application/x-msdownload" })), /format is not supported/);
  assert.equal(calls.length, 0);
});

test("records learning progress and reads my course status through exact RPC names", async () => {
  const { client, calls } = mockClient({ rpcResponse: { data: { progress_percent: 50, completion_status: "in_progress" }, error: null } });
  const api = createAcademicApi(client);
  await api.recordProgress("unit-1", "completed");
  await api.myCourseStatus();
  assert.deepEqual(calls.filter(([name]) => name === "rpc"), [
    ["rpc", "record_learning_progress", { p_unit_id: "unit-1", p_status: "completed" }],
    ["rpc", "my_course_status", undefined],
  ]);
});

test("my course status falls back to an empty array when the RPC returns null", async () => {
  const { client } = mockClient({ rpcResponse: { data: null, error: null } });
  assert.deepEqual(await createAcademicApi(client).myCourseStatus(), []);
});

test("myProgress reads the student's own progress rows, optionally scoped by cohort", async () => {
  const { client, calls } = mockClient();
  const api = createAcademicApi(client);
  await api.myProgress(["cohort-1", "cohort-2"]);
  assert.deepEqual(calls, [
    ["from", "student_learning_progress"], ["select", "*"], ["in", "cohort_id", ["cohort-1", "cohort-2"]],
  ]);
});

test("notification read updates only the selected row", async () => {
  const { client, calls } = mockClient({ response: { data: null, error: null } });
  const api = createAcademicApi(client, () => Date.parse("2026-10-14T12:30:00.000Z"));
  await api.markNotificationRead("notification-1");
  assert.deepEqual(calls, [
    ["from", "notifications"], ["update", { read_at: "2026-10-14T12:30:00.000Z" }], ["eq", "id", "notification-1"],
  ]);
});

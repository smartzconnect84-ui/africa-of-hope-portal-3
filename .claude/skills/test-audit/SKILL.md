---
name: test-audit
description: Read before writing, changing or reviewing a test. Keeps only tests that protect real behaviour; rejects duplicate or implementation-coupled tests and test-only code. Adapted from OpenClaw's test-audit skill (MIT).
---

# Test audit

Write a test only when it earns its place. A few tests that catch real bugs beat many that mirror the code.

## Before adding a test, answer
1. What behaviour that a user or caller can observe does it protect?
2. What realistic bug would make it fail?
3. Why does no existing test already catch that bug? Test each contract once, at the strongest boundary (the route, the hook, the function the app calls), and not again at every layer below.
4. Does it need an export, flag, wrapper or hook that only the test uses? Then test through the real entry point and drop the seam.

No good answer to 1 or 2: do not write the test.

## Never write
- Tests with no assertion, or that compare a value with itself.
- Expected values computed by the code under test.
- Copies of a list, config or export inventory from the source.
- Greps of the source, or checks of how a function was called instead of what it did.
- Mocks that supply the behaviour the test asserts.
- A new test for a small edit that repeats an existing case. Add a row to the existing table instead.
- Names that promise behaviour the assertions never check.

## Always keep
Tests guarding security and access rules, money and credits, migrations and stored data, public API or webhook contracts, and the regression test for a bug that really happened. Being slow is not a reason to delete a test. A failing test may be a real bug: fix the code, not the test.

## Fixing a bug
Write one regression test, where the bug lives. It fails before the fix for the right reason and passes after it.

## Removing tests
Remove tests only when asked, or when your change makes them obsolete. Before deleting a test, name the remaining test that still covers its contract. Delete production code that existed only for tests along with those tests.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseFlags } from "../src/slack/commands.js";

describe("parseFlags", () => {
  it("parses plain title", () => {
    const result = parseFlags("Fix the login bug");
    assert.equal(result.title, "Fix the login bug");
    assert.deepEqual(result.flags, {});
  });

  it("parses quoted title", () => {
    const result = parseFlags('"Fix the login bug"');
    assert.equal(result.title, "Fix the login bug");
  });

  it("parses single-quoted title", () => {
    const result = parseFlags("'Fix the login bug'");
    assert.equal(result.title, "Fix the login bug");
  });

  it("parses title with --assign flag", () => {
    const result = parseFlags('"Fix login bug" --assign CTO');
    assert.equal(result.title, "Fix login bug");
    assert.equal(result.flags.assign, "CTO");
  });

  it("parses title with quoted flag value", () => {
    const result = parseFlags('"Fix bug" --project "Website Redesign"');
    assert.equal(result.title, "Fix bug");
    assert.equal(result.flags.project, "Website Redesign");
  });

  it("parses multiple flags", () => {
    const result = parseFlags(
      '"Deploy pricing page" --assign CTO --project "Website"'
    );
    assert.equal(result.title, "Deploy pricing page");
    assert.equal(result.flags.assign, "CTO");
    assert.equal(result.flags.project, "Website");
  });

  it("handles flags before title text", () => {
    const result = parseFlags("--assign CTO Fix login bug");
    assert.equal(result.flags.assign, "CTO");
    assert.ok(result.title.includes("Fix login bug"));
  });

  it("returns empty title for empty input", () => {
    const result = parseFlags("");
    assert.equal(result.title, "");
    assert.deepEqual(result.flags, {});
  });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ICONES_CATEGORIA } from "../module/applications/actor/jj/skill-tree-map-2.mjs";

const root = new URL("../", import.meta.url);
const packaging = JSON.parse(readFileSync(new URL("foundryvtt.json", root), "utf8"));

test("all six category icons use portable ASCII paths that survive legacy ZIP extraction", () => {
  assert.equal(Object.keys(ICONES_CATEGORIA).length, 6);
  for (const [category, url] of Object.entries(ICONES_CATEGORIA)) {
    assert.match(url, /^systems\/jujutsu-system\/assets\/skill-tree\/[a-z0-9-]+\.webp$/, category);
  }
});

test("each category icon is an actual WebP inside the system distribution", () => {
  for (const [category, url] of Object.entries(ICONES_CATEGORIA)) {
    const relative = decodeURIComponent(url.replace(/^\/?systems\/jujutsu-system\//, ""));
    const data = readFileSync(new URL(relative, root));
    assert.equal(data.subarray(0, 4).toString(), "RIFF", category);
    assert.equal(data.subarray(8, 12).toString(), "WEBP", category);
    assert(packaging.includes.some(directory => relative.startsWith(directory)), `${category} must be packaged`);
  }
});

// Minimal smoke test: build must be present. Exercises the ported validator and
// the JSON-Schema-critical example plugins WITHOUT a live MCP client.
import { validateManifest, validateManifestJson } from "../dist/lib/validate.js";
import { EXAMPLE_PIHOLE_JSON, EXAMPLE_QBIT_JSON } from "../dist/data/spec.js";

let failures = 0;
function check(name, cond) {
  if (cond) { console.log(`  ok   ${name}`); }
  else { console.error(`  FAIL ${name}`); failures++; }
}

console.log("Dominion MCP smoke test");

// 1) Gold example (No-Code) validates.
const pi = validateManifestJson(EXAMPLE_PIHOLE_JSON, { hasAdapter: false });
check("pi-hole example valid (No-Code)", pi.ok);
check("pi-hole dataSource=api", pi.dataSource === "api");

// 2) qbittorrent manifest requires adapter (no api block).
const qbNoAdapter = validateManifestJson(EXAMPLE_QBIT_JSON, { hasAdapter: false });
check("qbittorrent WITHOUT adapter is rejected (no data source)", !qbNoAdapter.ok);
const qbWithAdapter = validateManifestJson(EXAMPLE_QBIT_JSON, { hasAdapter: true });
check("qbittorrent WITH adapter is valid", qbWithAdapter.ok);
check("qbittorrent dataSource=adapter.js", qbWithAdapter.dataSource === "adapter.js");

// 3) Negative cases.
const missingApiUrl = validateManifest({
  apiVersion: 2, id: "x", name: "X", version: "1.0.0", author: "a", description: "d",
  category: "Custom", icon: "x", color: "#112233",
  configFields: [{ key: "token", label: "T", type: "password" }],
  statOptions: [{ key: "s", label: "S" }], supportedSizes: ["1x1"],
  api: { stats: { path: "/" }, mappings: [{ key: "s", label: "S", path: "a" }] },
});
check("missing apiUrl field -> error", missingApiUrl.errors.some((e) => e.includes("apiUrl")));

const badVersion = validateManifest({ apiVersion: 1 });
check("apiVersion 1 -> error", badVersion.errors.some((e) => e.includes("apiVersion")));

const widget1x1 = validateManifest({
  apiVersion: 2, id: "x", name: "X", version: "1.0.0", author: "a", description: "d",
  category: "Custom", icon: "x", color: "#112233",
  configFields: [{ key: "apiUrl", label: "URL", type: "url" }],
  statOptions: [{ key: "s", label: "S" }], supportedSizes: ["1x1"],
  widgets: { "1x1": { type: "stats" } },
  api: { stats: { path: "/" }, mappings: [{ key: "s", label: "S", path: "a" }] },
});
check("widgets['1x1'] -> error", widget1x1.errors.some((e) => e.includes("1x1")));

const badMapping = validateManifest({
  apiVersion: 2, id: "x", name: "X", version: "1.0.0", author: "a", description: "d",
  category: "Custom", icon: "x", color: "#112233",
  configFields: [{ key: "apiUrl", label: "URL", type: "url" }],
  statOptions: [{ key: "s", label: "S" }], supportedSizes: ["1x1"],
  api: { stats: { path: "/" }, mappings: [{ key: "nope", label: "N", path: "a" }] },
});
check("mapping key with no statOption -> error", badMapping.errors.some((e) => e.includes("no matching statOption")));

console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);

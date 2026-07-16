// Code/README generators for scaffold_plugin. Kept as string arrays joined with
// "\n" so no template literals / backticks are needed in the emitted code.

const NL = "\n";

export function buildAdapterStub(auth: string, statKeys: string[], notifications: boolean): string {
  const items = statKeys
    .map((k) => '      { label: ' + JSON.stringify(k) + ', value: 0, icon: "activity" }, // TODO: map real value')
    .join(NL);

  const login =
    auth === "userpass"
      ? [
          "",
          "// TODO: implement the login/cookie flow (see get_examples -> qbittorrent).",
          "async function login(config) {",
          '  const res = await fetch(config.apiUrl.replace(/\\/+$/, "") + "/api/login", {',
          '    method: "POST",',
          '    headers: { "Content-Type": "application/x-www-form-urlencoded" },',
          '    body: "username=" + encodeURIComponent(config.username || "") +',
          '          "&password=" + encodeURIComponent(config.password || ""),',
          "  });",
          '  const cookie = res.headers.get("set-cookie");',
          '  if (!cookie) throw new Error("Login fehlgeschlagen.");',
          '  return cookie.split(";")[0];',
          "}",
          "",
        ].join(NL)
      : "";

  const notif = notifications
    ? [
        "",
        "exports.checkNotifications = async (config, current, previous) => {",
        "  const out = [];",
        "  // TODO: compare current vs previous widgetData, push PluginNotification objects.",
        '  // Each notification\'s "tag" MUST equal a notificationRules[].id in plugin.json.',
        "  return out;",
        "};",
      ].join(NL)
    : "";

  const apiKeyHeader = auth === "apikey" ? ', { headers: { "X-Api-Key": config.apiKey } }' : "";

  return [
    "// adapter.js — Sandbox (Dominion plugin v2).",
    "// Available: fetch (guarded, 10s), console, JSON, Math, Date, URL, URLSearchParams.",
    "// Forbidden: require, process, fs, Buffer, timers. Per-call timeout 15s.",
    login,
    "exports.fetchStats = async (config) => {",
    '  const base = config.apiUrl.replace(/\\/+$/, "");',
    "  // TODO: fetch from your service. Use await res.text() then JSON.parse, or await res.json().",
    '  // const res = await fetch(base + "/api/status"' + apiKeyHeader + ");",
    "  // const data = await res.json();",
    "  return {",
    '    status: "ok",',
    "    items: [",
    items,
    "    ],",
    '    widgetData: {}, // TODO: populate paths your widgets reference',
    "  };",
    "};",
    "",
    "exports.testConnection = async (config) => {",
    "  try {",
    "    // TODO: a cheap request that proves the connection/credentials work.",
    '    return { ok: true, message: "Verbindung erfolgreich." };',
    "  } catch (err) {",
    "    return { ok: false, message: err.message };",
    "  }",
    "};",
    notif,
    "",
  ].join(NL);
}

export function buildReadme(name: string, description: string, mode: string): string {
  const bt = String.fromCharCode(96); // backtick
  const lines = [
    "# " + name,
    "",
    description,
    "",
    "Dominion Enhanced App (plugin format v2, " +
      (mode === "adapter" ? "adapter.js sandbox" : "No-Code api block") + ").",
    "",
    "## Install",
    "Einstellungen > Community Apps > ZIP hochladen. Available immediately (runtime loader, no restart).",
    "",
    "## Files",
    "- " + bt + "plugin.json" + bt + " — manifest (metadata, config, stats" +
      (mode === "nocode" ? ", api, widgets" : ", widgets") + ")",
  ];
  if (mode === "adapter") {
    lines.push("- " + bt + "adapter.js" + bt + " — sandboxed data logic (fetchStats, testConnection)");
  }
  return lines.join("\n") + "\n";
}

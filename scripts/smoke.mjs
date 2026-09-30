// Boots `next start`, logs in as admin/employee, and asserts route behaviour.
import { spawn } from "node:child_process";
import fs from "node:fs";

const PORT = Number(process.env.SMOKE_PORT ?? 3100);
const BASE = `http://localhost:${PORT}`;
const PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe123!";

const ADMIN_ROUTES = [
  "/dashboard", "/assets", "/assets/new", "/labels", "/scan",
  "/inventory", "/inventory/new", "/inventory/transactions",
  "/inventory/receive", "/suppliers",
  "/transfers", "/transfers/new", "/assignments", "/assignments/clearance",
  "/maintenance", "/maintenance/new", "/reports", "/audit", "/notifications",
  "/employees", "/employees/new", "/settings/organization", "/settings/users",
  "/settings/organization/company", "/settings/organization/sites",
  "/settings/organization/locations", "/settings/organization/departments",
  "/settings/organization/catalog",
  "/settings/users/new", "/admin/diagnostics", "/my", "/search",
];
const EXPORT_ROUTES = [
  "/api/export/assets", "/api/export/inventory",
  "/api/export/transfers", "/api/export/assignments", "/api/export/maintenance",
  "/api/export/employees", "/api/export/audit", "/api/export/report?slug=asset-register",
];

const failures = [];
function check(name, ok, detail = "") {
  if (ok) console.log(`  ok   ${name}`);
  else {
    failures.push(`${name} ${detail}`);
    console.log(`  FAIL ${name} ${detail}`);
  }
}

async function waitForServer(timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (res.status === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not become ready");
}

function collectCookies(res, jar) {
  for (const header of res.headers.getSetCookie?.() ?? []) {
    const [pair] = header.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function login(email, { required = true } = {}) {
  const jar = new Map();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { redirect: "manual" });
  collectCookies(csrfRes, jar);
  const { csrfToken } = await csrfRes.json();
  const body = new URLSearchParams({
    csrfToken, email, password: PASSWORD, redirect: "false", json: "true",
  });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(jar),
    },
    body: body.toString(),
  });
  collectCookies(res, jar);
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: cookieHeader(jar) },
  });
  const session = await sessionRes.json();
  if (session?.user?.email !== email) {
    if (required) {
      failures.push(`login ${email} failed (got ${session?.user?.email ?? "none"})`);
      console.log(`  FAIL login ${email} -> ${session?.user?.email ?? "none"}`);
    } else {
      console.log(`  skip login ${email} (account not present)`);
    }
    return null;
  }
  console.log(`  ok   login ${email}`);
  return jar;
}

async function get(path, jar) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: jar ? { cookie: cookieHeader(jar) } : {},
  });
  return {
    status: res.status,
    location: res.headers.get("location"),
    type: res.headers.get("content-type") ?? "",
    body: await res.text(),
  };
}

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)],
  { stdio: ["ignore", "pipe", "pipe"] },
);
const logs = [];
server.stdout.on("data", (d) => logs.push(d.toString()));
server.stderr.on("data", (d) => logs.push(d.toString()));

try {
  await waitForServer();
  console.log("server ready");

  console.log("\nanonymous");
  const anonHome = await get("/", null);
  check("GET / redirects to login", [307, 308].includes(anonHome.status) && (anonHome.location ?? "").includes("/login"), `${anonHome.status} ${anonHome.location}`);
  const anonAsset = await get("/assets", null);
  check("GET /assets redirects to login", [307, 308].includes(anonAsset.status), `${anonAsset.status} ${anonAsset.location}`);

  console.log("\nadmin");
  const admin = await login("admin@mebs.local");
  let bad = 0;
  if (admin) {
    for (const route of ADMIN_ROUTES) {
      const res = await get(route, admin);
      if (res.status !== 200) { bad++; failures.push(`admin GET ${route} -> ${res.status}`); console.log(`  FAIL admin GET ${route} -> ${res.status} ${res.location ?? ""}`); }
    }
    check(`admin: ${ADMIN_ROUTES.length - bad}/${ADMIN_ROUTES.length} routes 200`, bad === 0);
    for (const route of EXPORT_ROUTES) {
      const res = await get(route, admin);
      check(`admin ${route} csv`, res.status === 200 && res.type.includes("text/csv"), `${res.status} ${res.type}`);
    }
  }

  console.log("\nemployee");
  const employee = await login("employee@mebs.local", { required: false });
  if (!employee) {
    console.log("  skip employee checks (demo account not seeded)");
  } else {
    const empDash = await get("/dashboard", employee);
    check("employee /dashboard -> /my", [307, 308].includes(empDash.status) && (empDash.location ?? "").includes("/my"), `${empDash.status} ${empDash.location}`);
    const empMy = await get("/my", employee);
    check("employee /my 200", empMy.status === 200, String(empMy.status));
    const empAssets = await get("/assets", employee);
    check("employee /assets redirects away", [302, 303, 307, 308].includes(empAssets.status), `${empAssets.status} ${empAssets.location}`);
    const empLogin = await get("/login", employee);
    check("employee /login redirects", [302, 303, 307, 308].includes(empLogin.status), `${empLogin.status} ${empLogin.location}`);
    const empSettings = await get("/settings/users", employee);
    check("employee /settings/users redirects away", [302, 303, 307, 308].includes(empSettings.status), `${empSettings.status} ${empSettings.location}`);
  }

  console.log("\nserver log errors");
  const errorLines = logs.join("").split(/\r?\n/).filter((l) => /⨯|Unhandled|Error:/.test(l));
  check("no server errors", errorLines.length === 0, errorLines.slice(0, 5).join(" | "));
  fs.writeFileSync("server.log", logs.join(""));
} finally {
  server.kill();
}

if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  for (const f of failures) console.log(" - " + f);
  process.exit(1);
}
console.log("\nall smoke checks passed");

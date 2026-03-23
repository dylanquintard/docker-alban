/* eslint-disable no-console */
const { URL } = require("node:url");

const siteBaseUrl = String(
  process.env.SMOKE_SITE_URL ||
    process.argv[2] ||
    (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : "")
).trim().replace(/\/+$/, "");
const apiBaseUrl = String(
  process.env.SMOKE_API_URL || process.argv[3] || ""
).trim().replace(/\/+$/, "");

if (!siteBaseUrl) {
  console.error("Missing site base URL. Use SMOKE_SITE_URL or pass it as the first argument.");
  process.exit(1);
}

const staticChecks = [
  { name: "Healthz", path: "/healthz", expectedStatus: 200, expectJson: true },
  { name: "Home", path: "/", expectedStatus: 200 },
  { name: "Gallery", path: "/gallery", expectedStatus: 200 },
  { name: "Menu", path: "/menu", expectedStatus: 200 },
  { name: "Planing", path: "/planing", expectedStatus: 200 },
  { name: "A propos", path: "/a-propos", expectedStatus: 200 },
  { name: "Contact", path: "/contact", expectedStatus: 200 },
  { name: "Blog", path: "/blog", expectedStatus: 200 },
  { name: "Mentions legales", path: "/mentions-legales", expectedStatus: 200 },
  { name: "Confidentialite", path: "/confidentialite", expectedStatus: 200 },
  { name: "Conditions generales", path: "/conditions-generales", expectedStatus: 200 },
  { name: "Thionville landing", path: "/pizza-thionville", expectedStatus: 200 },
  { name: "Moselle landing (new)", path: "/camion-pizza-moselle", expectedStatus: 200 },
  { name: "Moselle landing (legacy redirect)", path: "/food-truck-pizza-moselle", expectedStatus: 301 },
  { name: "Login", path: "/login", expectedStatus: 200 },
  { name: "Register", path: "/register", expectedStatus: 200 },
  { name: "Forgot password", path: "/forgot-password", expectedStatus: 200 },
  { name: "Verify email", path: "/verify-email", expectedStatus: 200 },
  { name: "Order route shell", path: "/order", expectedStatus: 200 },
  { name: "Profile route shell", path: "/profile", expectedStatus: 200 },
  { name: "User orders route shell", path: "/userorders", expectedStatus: 200 },
  { name: "Admin route shell", path: "/admin", expectedStatus: 200 },
  { name: "Admin blog route shell", path: "/admin/blog", expectedStatus: 200 },
  { name: "Manifest", path: "/manifest.json", expectedStatus: 200, contains: "\"name\"" },
  { name: "Webmanifest", path: "/site.webmanifest", expectedStatus: 200, contains: "\"name\"" },
  { name: "Unknown page", path: "/__smoke-not-found__", expectedStatus: 404, contains: "404" },
];

function decodeXmlEntities(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function extractSitemapUrls(xml) {
  const matches = [...String(xml || "").matchAll(/<loc>(.*?)<\/loc>/g)];
  return matches.map((match) => decodeXmlEntities(match[1]));
}

async function fetchResponse(url) {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: "text/html,application/json,application/xml,text/xml;q=0.9,*/*;q=0.8",
    },
  });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    text,
  };
}

async function runCheck(baseUrl, check) {
  const url = new URL(check.path, baseUrl).toString();
  const result = await fetchResponse(url);
  const contentType = String(result.headers.get("content-type") || "").toLowerCase();

  if (result.status !== check.expectedStatus) {
    throw new Error(`expected ${check.expectedStatus}, got ${result.status}`);
  }

  if (check.expectJson && !contentType.includes("application/json")) {
    throw new Error(`expected JSON response, got "${contentType || "unknown"}"`);
  }

  if (!check.expectJson && check.expectedStatus === 200 && check.path !== "/manifest.json" && check.path !== "/site.webmanifest") {
    if (!contentType.includes("text/html")) {
      throw new Error(`expected HTML response, got "${contentType || "unknown"}"`);
    }
  }

  if (check.contains && !String(result.text || "").includes(check.contains)) {
    throw new Error(`expected response to contain "${check.contains}"`);
  }

  return {
    name: check.name,
    status: result.status,
    path: check.path,
  };
}

async function loadDynamicChecks() {
  const dynamicChecks = [];
  if (!apiBaseUrl) return dynamicChecks;

  const sitemapUrl = new URL("/sitemap.xml", apiBaseUrl).toString();
  const sitemapResponse = await fetchResponse(sitemapUrl);
  if (sitemapResponse.status !== 200) {
    throw new Error(`Unable to load sitemap from ${sitemapUrl} (${sitemapResponse.status})`);
  }

  const siteHost = new URL(siteBaseUrl).host;
  const sitemapUrls = extractSitemapUrls(sitemapResponse.text)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      try {
        return new URL(value).host === siteHost;
      } catch (_error) {
        return false;
      }
    });

  for (const sitemapEntry of sitemapUrls) {
    const parsed = new URL(sitemapEntry);
    if (!parsed.pathname || parsed.pathname === "/") continue;
    dynamicChecks.push({
      name: `Sitemap ${parsed.pathname}`,
      path: parsed.pathname,
      expectedStatus: 200,
    });
  }

  if (dynamicChecks.length === 0) {
    console.warn(`No dynamic sitemap URLs found for host ${siteHost}.`);
  }

  return dynamicChecks;
}

async function main() {
  const checks = [...staticChecks];
  const dynamicChecks = await loadDynamicChecks();
  checks.push(...dynamicChecks);

  const dedupedChecks = [...new Map(checks.map((check) => [check.path, check])).values()];
  const results = [];
  let failures = 0;

  for (const check of dedupedChecks) {
    try {
      const result = await runCheck(siteBaseUrl, check);
      results.push({ ok: true, ...result });
    } catch (error) {
      failures += 1;
      results.push({
        ok: false,
        name: check.name,
        path: check.path,
        error: error.message,
      });
    }
  }

  console.log(`Site smoke check on ${siteBaseUrl}`);
  if (apiBaseUrl) {
    console.log(`Dynamic sitemap source: ${apiBaseUrl}`);
  }

  for (const result of results) {
    if (result.ok) {
      console.log(`PASS | ${String(result.status).padEnd(3)} | ${result.name} | ${result.path}`);
      continue;
    }
    console.log(`FAIL | --- | ${result.name} | ${result.path}`);
    console.log(`       ${result.error}`);
  }

  if (failures > 0) {
    console.error(`\n${failures} site check(s) failed.`);
    process.exit(1);
  }

  console.log(`\n${results.length}/${results.length} site checks passed.`);
}

main().catch((error) => {
  console.error(`Smoke check aborted: ${error.message}`);
  process.exit(1);
});

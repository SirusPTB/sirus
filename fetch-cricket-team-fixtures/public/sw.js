/*
  AUS Cricket Fixtures "API" (static) implemented via Service Worker.

  Endpoints (same-origin):
    GET /api/health
    GET /api/openapi.json
    GET /api/fixtures
    GET /api/fixtures.ics

  Query params for /api/fixtures:
    from=YYYY-MM-DD
    to=YYYY-MM-DD
    format=Test,ODI,T20I
    opponent=substring
    homeAway=home|away
    limit=number
    pretty=1

  Data source:
    /fixtures.json (static example)
*/

const API_PREFIX = "/api/";
const FIXTURES_URL = "/fixtures.json";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function jsonResponse(obj, { status = 200, pretty = false, headers = {} } = {}) {
  const body = pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  return new Response(body, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function textResponse(text, { status = 200, contentType = "text/plain; charset=utf-8", headers = {} } = {}) {
  return new Response(text, {
    status,
    headers: {
      "content-type": contentType,
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function parseYmd(ymd) {
  // YYYY-MM-DD -> Date at start of day UTC
  if (!ymd) return null;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = ymd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function toIcsDate(dt) {
  // DTSTART in UTC: YYYYMMDDTHHMMSSZ
  const pad = (n) => String(n).padStart(2, "0");
  return (
    dt.getUTCFullYear() +
    pad(dt.getUTCMonth() + 1) +
    pad(dt.getUTCDate()) +
    "T" +
    pad(dt.getUTCHours()) +
    pad(dt.getUTCMinutes()) +
    pad(dt.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcsText(s) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildIcs(fixtures) {
  const now = new Date();
  const lines = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//AUS Fixtures Free API//EN");
  lines.push("CALSCALE:GREGORIAN");

  for (const fx of fixtures) {
    const start = new Date(fx.startTime);
    if (Number.isNaN(start.getTime())) continue;

    const summary = `${fx.format}: Australia vs ${fx.opponent}`;
    const location = [fx.venue, fx.city, fx.country].filter(Boolean).join(", ");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcsText(fx.id)}@aus-fixtures`);
    lines.push(`DTSTAMP:${toIcsDate(now)}`);
    lines.push(`DTSTART:${toIcsDate(start)}`);
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (location) lines.push(`LOCATION:${escapeIcsText(location)}`);
    if (fx.competition) lines.push(`DESCRIPTION:${escapeIcsText(fx.competition)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

async function loadFixtures() {
  const res = await fetch(FIXTURES_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load fixtures dataset: ${res.status}`);
  }
  const data = await res.json();
  const fixtures = Array.isArray(data.fixtures) ? data.fixtures : [];
  return { meta: data, fixtures };
}

function normalizeFormatsParam(value) {
  if (!value) return null;
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

function filterFixtures(fixtures, params) {
  const from = parseYmd(params.get("from"));
  const to = parseYmd(params.get("to"));
  const formats = normalizeFormatsParam(params.get("format"));
  const opponent = (params.get("opponent") || "").trim().toLowerCase();
  const homeAway = (params.get("homeAway") || "").trim().toLowerCase();
  const limitRaw = params.get("limit");
  const limit = Math.min(500, Math.max(1, Number(limitRaw || 50)));

  let out = fixtures.slice();

  if (from) {
    out = out.filter((fx) => {
      const t = new Date(fx.startTime).getTime();
      return !Number.isNaN(t) && t >= from.getTime();
    });
  }

  if (to) {
    // inclusive end-of-day UTC
    const toEnd = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
    out = out.filter((fx) => {
      const t = new Date(fx.startTime).getTime();
      return !Number.isNaN(t) && t <= toEnd.getTime();
    });
  }

  if (formats && formats.length) {
    out = out.filter((fx) => formats.includes(String(fx.format || "").toLowerCase()));
  }

  if (opponent) {
    out = out.filter((fx) => String(fx.opponent || "").toLowerCase().includes(opponent));
  }

  if (homeAway === "home" || homeAway === "away") {
    out = out.filter((fx) => String(fx.homeAway || "").toLowerCase() === homeAway);
  }

  out.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return out.slice(0, limit);
}

function openApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Australia Cricket Fixtures (Free) - Static API",
      version: "1.0.0",
      description:
        "A tiny static API implemented with a Service Worker. Data comes from /fixtures.json. Update that file to publish fresh fixtures.",
    },
    servers: [{ url: "/" }],
    paths: {
      "/api/health": {
        get: {
          summary: "Health check",
          responses: {
            "200": { description: "OK" },
          },
        },
      },
      "/api/fixtures": {
        get: {
          summary: "List fixtures",
          parameters: [
            { name: "from", in: "query", schema: { type: "string", example: "2026-03-01" } },
            { name: "to", in: "query", schema: { type: "string", example: "2026-03-31" } },
            { name: "format", in: "query", schema: { type: "string", example: "Test,ODI,T20I" } },
            { name: "opponent", in: "query", schema: { type: "string", example: "india" } },
            { name: "homeAway", in: "query", schema: { type: "string", enum: ["home", "away"] } },
            { name: "limit", in: "query", schema: { type: "integer", example: 50, minimum: 1, maximum: 500 } },
          ],
          responses: {
            "200": {
              description: "Fixture list",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/api/fixtures.ics": {
        get: {
          summary: "iCalendar export",
          responses: {
            "200": { description: "ICS calendar" },
          },
        },
      },
    },
  };
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(API_PREFIX)) return;

  event.respondWith(
    (async () => {
      try {
        if (url.pathname === "/api/health") {
          return jsonResponse({ ok: true, name: "aus-fixtures-api", time: new Date().toISOString() }, { pretty: url.searchParams.get("pretty") === "1" });
        }

        if (url.pathname === "/api/openapi.json") {
          return jsonResponse(openApiSpec(), { pretty: true });
        }

        if (url.pathname === "/api/fixtures" || url.pathname === "/api/fixtures.ics") {
          const { meta, fixtures } = await loadFixtures();
          const filtered = filterFixtures(fixtures, url.searchParams);

          if (url.pathname.endsWith(".ics")) {
            const ics = buildIcs(filtered);
            return textResponse(ics, {
              contentType: "text/calendar; charset=utf-8",
              headers: {
                "content-disposition": "attachment; filename=aus-fixtures.ics",
              },
            });
          }

          const pretty = url.searchParams.get("pretty") === "1";
          return jsonResponse(
            {
              ok: true,
              dataset: {
                generatedAt: meta.generatedAt || null,
                source: meta.source || null,
                team: meta.team || null,
              },
              query: Object.fromEntries(url.searchParams.entries()),
              count: filtered.length,
              fixtures: filtered,
            },
            { pretty }
          );
        }

        return jsonResponse({ ok: false, error: "Not found" }, { status: 404 });
      } catch (err) {
        return jsonResponse(
          {
            ok: false,
            error: "API_ERROR",
            message: err && err.message ? err.message : String(err),
          },
          { status: 500, pretty: true }
        );
      }
    })()
  );
});

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

const SOURCES = {
  PHIVOLCS: {
    name: "PHIVOLCS",
    type: "OFFICIAL",
    official: true,
    earthquakeUrl: "https://earthquake.phivolcs.dost.gov.ph/",
    volcanoUrl: "https://volcano.phivolcs.dost.gov.ph/",
  },

  PAGASA: {
    name: "PAGASA",
    type: "OFFICIAL",
    official: true,
    weatherUrl: "https://bagong.pagasa.dost.gov.ph/",
  },

  NDRRMC: {
    name: "NDRRMC/OCD",
    type: "OFFICIAL",
    official: true,
    url: "https://ndrrmc.gov.ph/",
  },
};

function clean(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function stripHTML(value = "") {
  return clean(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
  );
}

function parseDate(value) {
  if (!value) return new Date().toISOString();

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function inferAlertType(text = "") {
  const value = text.toLowerCase();

  if (/earthquake|magnitude|seismic/.test(value))
    return "EARTHQUAKE";

  if (/tsunami/.test(value))
    return "TSUNAMI";

  if (/volcano|volcanic|alert level/.test(value))
    return "VOLCANIC_ACTIVITY";

  if (
    /typhoon|tropical cyclone|tropical depression|tropical storm|severe tropical storm/.test(
      value
    )
  )
    return "TROPICAL_CYCLONE";

  if (/rainfall|rain|thunderstorm|weather/.test(value))
    return "WEATHER";

  if (/flood/.test(value))
    return "FLOOD";

  if (/landslide/.test(value))
    return "LANDSLIDE";

  if (/fire/.test(value))
    return "FIRE";

  if (/road closure|road closed|road closing/.test(value))
    return "ROAD_CLOSURE";

  return "GENERAL";
}

function inferSeverity(text = "") {
  const value = text.toLowerCase();

  if (/\b(red|critical|danger|extreme)\b/.test(value))
    return "HIGH";

  if (/\b(orange|severe|warning)\b/.test(value))
    return "MODERATE";

  if (/\b(yellow|advisory|watch)\b/.test(value))
    return "LOW";

  return "INFORMATION";
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "LICAS-Information-System/1.0",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }

  return await response.text();
}

/* =========================================================
   PHIVOLCS
   ========================================================= */

async function fetchPHIVOLCS() {
  const html = await fetchText(SOURCES.PHIVOLCS.earthquakeUrl);

  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => {
      return [
        ...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi),
      ].map((cell) => stripHTML(cell[1]));
    })
    .filter((columns) => columns.length >= 6);

  const records = [];

  for (const columns of rows.slice(0, 50)) {
    const dateTime = columns[0];
    const latitude = columns[1];
    const longitude = columns[2];
    const depth = columns[3];
    const magnitude = columns[4];
    const location = columns.slice(5).join(" ");

    if (!dateTime || !/^\d+(\.\d+)?$/.test(magnitude)) {
      continue;
    }

    const issuedAt = parseDate(dateTime);

    records.push({
      source: "PHIVOLCS",
      source_type: "OFFICIAL",
      is_official: true,

      alert_type: "EARTHQUAKE",
      content_type: "EARTHQUAKE BULLETIN",

      title: `Magnitude ${magnitude} Earthquake — ${location}`,

      description:
        `PHIVOLCS reported a magnitude ${magnitude} earthquake ` +
        `at ${location}. Depth: ${depth} km. ` +
        `Coordinates: ${latitude}, ${longitude}.`,

      severity: "INFORMATION",

      location,

      issued_at: issuedAt,
      published_at: issuedAt,
      expires_at: null,

      source_url: SOURCES.PHIVOLCS.earthquakeUrl,

      status: "ACTIVE",
    });
  }

  return records;
}

/* =========================================================
   PHIVOLCS VOLCANO
   ========================================================= */

async function fetchPHIVOLCSVolcano() {
  const html = await fetchText(SOURCES.PHIVOLCS.volcanoUrl);

  const text = stripHTML(html);

  return [
    {
      source: "PHIVOLCS",
      source_type: "OFFICIAL",
      is_official: true,

      alert_type: "VOLCANIC_ACTIVITY",
      content_type: "VOLCANO STATUS",

      title: "PHIVOLCS Current Volcano Information",

      description:
        "PHIVOLCS publishes current monitoring and alert-level " +
        "information for Philippine volcanoes. Refer to the original " +
        "PHIVOLCS source for the latest volcano-specific status.",

      severity: inferSeverity(text),

      location: "Philippines",

      issued_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      expires_at: null,

      source_url: SOURCES.PHIVOLCS.volcanoUrl,

      status: "ACTIVE",
    },
  ];
}

/* =========================================================
   PAGASA
   ========================================================= */

async function fetchPAGASA() {
  const html = await fetchText(SOURCES.PAGASA.weatherUrl);

  const text = stripHTML(html);

  const title =
    /tropical cyclone|typhoon|tropical depression|tropical storm/i.test(
      text
    )
      ? "PAGASA Tropical Cyclone / Weather Information"
      : "PAGASA Current Weather Information";

  return [
    {
      source: "PAGASA",
      source_type: "OFFICIAL",
      is_official: true,

      alert_type: inferAlertType(text),
      content_type: "WEATHER INFORMATION",

      title,

      description:
        "PAGASA publishes current Philippine weather information, " +
        "forecasts, warnings, and tropical-cyclone information. " +
        "Refer to the original PAGASA source for complete details.",

      severity: inferSeverity(text),

      location: "Philippines",

      issued_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      expires_at: null,

      source_url: SOURCES.PAGASA.weatherUrl,

      status: "ACTIVE",
    },
  ];
}

/* =========================================================
   NDRRMC / OCD
   ========================================================= */

async function fetchNDRRMC() {
  const html = await fetchText(SOURCES.NDRRMC.url);

  const text = stripHTML(html);

  return [
    {
      source: "NDRRMC/OCD",
      source_type: "OFFICIAL",
      is_official: true,

      alert_type: inferAlertType(text),
      content_type: "DISASTER INFORMATION",

      title: "NDRRMC/OCD Disaster Information",

      description:
        "NDRRMC/OCD publishes disaster-related updates and " +
        "situational information. Refer to the original source " +
        "for the complete advisory or report.",

      severity: inferSeverity(text),

      location: "Philippines",

      issued_at: new Date().toISOString(),
      published_at: new Date().toISOString(),
      expires_at: null,

      source_url: SOURCES.NDRRMC.url,

      status: "ACTIVE",
    },
  ];
}

/* =========================================================
   DUPLICATE / UPDATE HANDLING
   ========================================================= */

async function saveRecord(record) {
  const { data: existing, error: findError } = await supabase
    .from("external_alerts")
    .select("id")
    .eq("source", record.source)
    .eq("title", record.title)
    .eq("location", record.location || "")
    .maybeSingle();

  if (findError) {
    throw findError;
  }

  if (existing) {
    const { error } = await supabase
      .from("external_alerts")
      .update({
        description: record.description,
        severity: record.severity,
        alert_type: record.alert_type,
        content_type: record.content_type,
        source_type: record.source_type,
        is_official: record.is_official,
        source_url: record.source_url,
        issued_at: record.issued_at,
        published_at: record.published_at,
        expires_at: record.expires_at,
        status: record.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw error;

    return "updated";
  }

  const { error } = await supabase
    .from("external_alerts")
    .insert({
      ...record,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  return "inserted";
}

/* =========================================================
   MAIN
   ========================================================= */

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const results = {};

    const jobs = [
      ["PHIVOLCS Earthquakes", fetchPHIVOLCS],
      ["PHIVOLCS Volcano", fetchPHIVOLCSVolcano],
      ["PAGASA", fetchPAGASA],
      ["NDRRMC/OCD", fetchNDRRMC],
    ];

    for (const [name, fetcher] of jobs) {
      try {
        const records = await fetcher();

        let inserted = 0;
        let updated = 0;

        for (const record of records) {
          const result = await saveRecord(record);

          if (result === "inserted") inserted++;
          if (result === "updated") updated++;
        }

        results[name] = {
          fetched: records.length,
          inserted,
          updated,
        };
      } catch (error) {
        results[name] = {
          error: error.message,
        };
      }
    }

    /*
      Expire records whose explicit expiration time has passed.
    */

    await supabase
      .from("external_alerts")
      .update({
        status: "EXPIRED",
        updated_at: new Date().toISOString(),
      })
      .lt("expires_at", new Date().toISOString())
      .eq("status", "ACTIVE");

    return res.status(200).json({
      ok: true,
      updated_at: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};

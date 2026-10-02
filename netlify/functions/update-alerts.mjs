import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_SERVER_URL,
  process.env.SUPABASE_SECRET_KEY
);

// =====================================================
// HELPERShatfot
// =====================================================

function decodeHtml(text = "") {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(text = "") {
  return decodeHtml(text)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSeverity(text = "") {
  const t = text.toLowerCase();

  if (
    t.includes("red alert") ||
    t.includes("critical") ||
    t.includes("extreme danger") ||
    t.includes("danger")
  ) {
    return "CRITICAL";
  }

  if (
    t.includes("warning") ||
    t.includes("high alert") ||
    t.includes("severe") ||
    t.includes("heavy rainfall") ||
    t.includes("heavy rain") ||
    t.includes("flash flood") ||
    t.includes("strong winds")
  ) {
    return "HIGH";
  }

  if (
    t.includes("advisory") ||
    t.includes("moderate") ||
    t.includes("thunderstorm") ||
    t.includes("rainshowers")
  ) {
    return "MODERATE";
  }

  return "LOW";
}

async function fetchPage(url) {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LICAS-Emergency-Alert-System/1.0)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    if (!html || html.length < 50) {
      throw new Error("Empty response");
    }

    return html;
  } catch (error) {
    console.error(`FETCH FAILED: ${url}`);
    console.error(error.message);
    return null;
  }
}

// =====================================================
// DATABASE
// =====================================================

async function saveAlert(alert) {
  const {
    source,
    alert_type,
    title,
    description,
    severity,
    issued_at,
    expires_at,
    source_url,
    content_type,
    source_type,
    location,
    published_at,
    is_official
  } = alert;

  const { data: existing, error: findError } = await supabase
    .from("external_alerts")
    .select("id")
    .eq("source", source)
    .eq("title", title)
    .eq("location", location || "")
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error(`DATABASE FIND ERROR [${source}]:`, findError.message);

    return {
      success: false,
      error: findError.message
    };
  }

  const payload = {
    source,
    alert_type,
    title,
    description,
    severity,
    issued_at,
    expires_at,
    source_url,
    content_type,
    source_type,
    location,
    published_at,
    is_official
  };

  if (existing) {
    const { error } = await supabase
      .from("external_alerts")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      console.error(`DATABASE UPDATE ERROR [${source}]:`, error.message);

      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      action: "updated"
    };
  }

  const { error } = await supabase
    .from("external_alerts")
    .insert(payload);

  if (error) {
    console.error(`DATABASE INSERT ERROR [${source}]:`, error.message);

    return {
      success: false,
      error: error.message
    };
  }

  return {
    success: true,
    action: "inserted"
  };
}

// =====================================================
// PAGASA NCR FORECAST EXTRACTION
// =====================================================

function extractPAGASANCR(html) {
  /*
   * PAGASA's NCR page contains a large amount of navigation.
   *
   * Instead of storing the entire page, we look for actual
   * forecast terminology and collect only nearby weather
   * information.
   */

  const text = cleanText(html);

  const weatherPatterns = [
    /partly cloudy/gi,
    /mostly cloudy/gi,
    /cloudy skies/gi,
    /cloudy/gi,
    /fair weather/gi,
    /isolated rainshowers/gi,
    /isolated thunderstorms/gi,
    /scattered rainshowers/gi,
    /scattered thunderstorms/gi,
    /rainshowers/gi,
    /thunderstorms/gi,
    /light rains/gi,
    /moderate rains/gi,
    /heavy rains/gi
  ];

  const matches = [];

  for (const pattern of weatherPatterns) {
    for (const match of text.matchAll(pattern)) {
      matches.push(match.index);
    }
  }

  if (matches.length === 0) {
    return null;
  }

  matches.sort((a, b) => a - b);

  /*
   * Take a reasonable window around actual weather terminology.
   * This prevents the giant navigation menu from being stored.
   */
  const sections = [];

  for (const index of matches.slice(0, 8)) {
    const start = Math.max(0, index - 250);
    const end = Math.min(text.length, index + 650);

    let section = text.substring(start, end);

    section = section
      .replace(
        /National Capital Region\s+National Capital Region/gi,
        "National Capital Region"
      )
      .replace(/\s+/g, " ")
      .trim();

    if (section.length > 30) {
      sections.push(section);
    }
  }

  /*
   * Remove duplicate/overlapping sections.
   */
  const unique = [];

  for (const section of sections) {
    const duplicate = unique.some(
      (existing) =>
        existing.includes(section) ||
        section.includes(existing)
    );

    if (!duplicate) {
      unique.push(section);
    }
  }

  /*
   * Prefer the most useful weather section.
   */
  let result = unique.join("\n\n");

  // Remove obvious navigation fragments.
  result = result
    .replace(
      /Regional Forecast\s+Northern Luzon[\s\S]*?National Capital Region/gi,
      ""
    )
    .replace(
      /National Capital Region\s+Southern Luzon\s+Visayas\s+Mindanao/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  return result.substring(0, 4000);
}

// =====================================================
// PAGASA
// =====================================================

async function updatePAGASA() {
  const url =
    "https://bagong.pagasa.dost.gov.ph/regional-forecast/ncrprsd";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error: "Unable to fetch PAGASA NCR forecast page"
    };
  }

  const forecast = extractPAGASANCR(html);

  if (!forecast) {
    return {
      success: false,
      error:
        "PAGASA page loaded, but the NCR forecast could not be extracted."
    };
  }

  return await saveAlert({
    source: "PAGASA",
    alert_type: "WEATHER",
    title: "PAGASA NCR Weather Forecast",
    description: forecast,
    severity: detectSeverity(forecast),
    issued_at: new Date().toISOString(),
    expires_at: null,
    source_url: url,
    content_type: "NCR_FORECAST",
    source_type: "OFFICIAL",
    location: "National Capital Region",
    published_at: new Date().toISOString(),
    is_official: true
  });
}

// =====================================================
// PHIVOLCS EARTHQUAKE
// =====================================================

function extractPHIVOLCS(html) {
  const text = cleanText(html);

  const earthquakePattern =
    /\d{2}\s+[A-Za-z]+\s+\d{4}\s*-\s*\d{2}:\d{2}\s*(?:AM|PM)?/gi;

  const matches = [...text.matchAll(earthquakePattern)];

  const rows = [];

  for (let i = 0; i < Math.min(matches.length, 10); i++) {
    const start = matches[i].index;

    const end =
      i + 1 < matches.length
        ? matches[i + 1].index
        : Math.min(start + 250, text.length);

    let row = text.substring(start, end);

    row = row.replace(/\s+/g, " ").trim();

    rows.push(row);
  }

  if (rows.length === 0) {
    return text.substring(0, 4000);
  }

  return rows.join("\n");
}

async function updatePHIVOLCS() {
  const url =
    "https://earthquake.phivolcs.dost.gov.ph/";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error:
        "Unable to fetch PHIVOLCS earthquake page"
    };
  }

  const description = extractPHIVOLCS(html);

  return await saveAlert({
    source: "PHIVOLCS",
    alert_type: "EARTHQUAKE",
    title:
      "Latest PHIVOLCS Earthquake Information",
    description,
    severity: detectSeverity(description),
    issued_at: new Date().toISOString(),
    expires_at: null,
    source_url: url,
    content_type: "EARTHQUAKE",
    source_type: "OFFICIAL",
    location: "Philippines",
    published_at: new Date().toISOString(),
    is_official: true
  });
}

// =====================================================
// PHIVOLCS VOLCANO
// =====================================================

function extractVolcano(html) {
  const text = cleanText(html);

  const keywords = [
    "Alert Level",
    "eruption",
    "volcanic",
    "volcano",
    "activity",
    "advisory"
  ];

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) =>
      keywords.some((keyword) =>
        sentence
          .toLowerCase()
          .includes(keyword.toLowerCase())
      )
    );

  if (sentences.length > 0) {
    return sentences.slice(0, 15).join(" ");
  }

  return text.substring(0, 4000);
}

async function updatePHIVOLCSVolcano() {
  const url =
    "https://volcano.phivolcs.dost.gov.ph/";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error:
        "Unable to fetch PHIVOLCS volcano page"
    };
  }

  const description = extractVolcano(html);

  return await saveAlert({
    source: "PHIVOLCS",
    alert_type: "VOLCANIC",
    title:
      "Latest PHIVOLCS Volcano Information",
    description,
    severity: detectSeverity(description),
    issued_at: new Date().toISOString(),
    expires_at: null,
    source_url: url,
    content_type: "VOLCANO",
    source_type: "OFFICIAL",
    location: "Philippines",
    published_at: new Date().toISOString(),
    is_official: true
  });
}

// =====================================================
// NDRRMC
// =====================================================

function extractNDRRMC(html) {
  const text = cleanText(html);

  const keywords = [
    "NDRRMC",
    "disaster",
    "incident",
    "warning",
    "advisory",
    "typhoon",
    "earthquake",
    "flood",
    "landslide"
  ];

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) =>
      keywords.some((keyword) =>
        sentence
          .toLowerCase()
          .includes(keyword.toLowerCase())
      )
    );

  if (sentences.length > 0) {
    return sentences.slice(0, 20).join(" ");
  }

  return text.substring(0, 4000);
}

async function updateNDRRMC() {
  const url =
    "https://ndrrmc.gov.ph/";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error:
        "Unable to fetch NDRRMC website"
    };
  }

  const description = extractNDRRMC(html);

  return await saveAlert({
    source: "NDRRMC",
    alert_type: "DISASTER",
    title:
      "Latest NDRRMC Disaster Information",
    description,
    severity: detectSeverity(description),
    issued_at: new Date().toISOString(),
    expires_at: null,
    source_url: url,
    content_type: "DISASTER",
    source_type: "OFFICIAL",
    location: "Philippines",
    published_at: new Date().toISOString(),
    is_official: true
  });
}

// =====================================================
// MAIN
// =====================================================

export default async () => {
  try {
    if (
      !process.env.SUPABASE_SERVER_URL ||
      !process.env.SUPABASE_SECRET_KEY
    ) {
      return new Response(
        JSON.stringify(
          {
            success: false,
            error:
              "Supabase environment variables are missing."
          },
          null,
          2
        ),
        {
          status: 500,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    const results = await Promise.all([
      updatePHIVOLCS(),
      updatePHIVOLCSVolcano(),
      updatePAGASA(),
      updateNDRRMC()
    ]);

    const sources = {
      PHIVOLCS_EARTHQUAKE: results[0],
      PHIVOLCS_VOLCANO: results[1],
      PAGASA_NCR: results[2],
      NDRRMC: results[3]
    };

    const allSuccessful = results.every(
      (result) =>
        result &&
        result.success === true
    );

    return new Response(
      JSON.stringify(
        {
          success: allSuccessful,
          message: allSuccessful
            ? "LICAS external alerts updated successfully."
            : "LICAS external alert update completed with source errors.",
          sources
        },
        null,
        2
      ),
      {
        status: allSuccessful ? 200 : 207,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error(
      "LICAS updater fatal error:",
      error
    );

    return new Response(
      JSON.stringify(
        {
          success: false,
          error: error.message
        },
        null,
        2
      ),
      {
        status: 500,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }
};

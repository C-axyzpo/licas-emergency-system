import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_SERVER_URL,
  process.env.SUPABASE_SECRET_KEY
);

// =====================================================
// GENERAL HELPERS
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
    t.includes("critical") ||
    t.includes("red alert") ||
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

    const timeout = setTimeout(() => {
      controller.abort();
    }, 20000);

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
// PHIVOLCS EARTHQUAKE
// =====================================================

function extractLatestEarthquakes(html) {
  /*
   * PHIVOLCS provides a table containing:
   *
   * Date - Time
   * Latitude
   * Longitude
   * Depth
   * Mag
   * Location
   *
   * We extract only the first several earthquake rows.
   */

  const tableMatch = html.match(
    /PHIVOLCS LATEST EARTHQUAKE INFORMATION([\s\S]*?)(?:PHIVOLCS Earthquake Intensity|$)/i
  );

  const section = tableMatch ? tableMatch[1] : html;

  const text = cleanText(section);

  const datePattern =
    /(\d{2}\s+[A-Za-z]+\s+\d{4}\s*-\s*\d{2}:\d{2}\s*(?:AM|PM)?)/gi;

  const matches = [...text.matchAll(datePattern)];

  const earthquakes = [];

  for (let i = 0; i < Math.min(matches.length, 10); i++) {
    const start = matches[i].index;
    const end =
      i + 1 < matches.length
        ? matches[i + 1].index
        : Math.min(start + 250, text.length);

    let row = text.substring(start, end).trim();

    row = row.replace(/\s+/g, " ");

    earthquakes.push(row);
  }

  if (earthquakes.length > 0) {
    return earthquakes.join("\n");
  }

  return text.substring(0, 4000);
}

async function updatePHIVOLCS() {
  const url = "https://earthquake.phivolcs.dost.gov.ph/";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error: "Unable to fetch PHIVOLCS earthquake page"
    };
  }

  const description = extractLatestEarthquakes(html);

  return await saveAlert({
    source: "PHIVOLCS",
    alert_type: "EARTHQUAKE",
    title: "Latest PHIVOLCS Earthquake Information",
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

function extractVolcanoInformation(html) {
  const text = cleanText(html);

  const keywords = [
    "Alert Level",
    "Volcanic",
    "eruption",
    "volcano",
    "activity",
    "advisory"
  ];

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) =>
      keywords.some((keyword) =>
        sentence.toLowerCase().includes(keyword.toLowerCase())
      )
    );

  if (sentences.length > 0) {
    return sentences.slice(0, 15).join(" ");
  }

  return text.substring(0, 4000);
}

async function updatePHIVOLCSVolcano() {
  const url = "https://volcano.phivolcs.dost.gov.ph/";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error: "Unable to fetch PHIVOLCS volcano page"
    };
  }

  const description = extractVolcanoInformation(html);

  return await saveAlert({
    source: "PHIVOLCS",
    alert_type: "VOLCANIC",
    title: "Latest PHIVOLCS Volcano Information",
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
// PAGASA NCR
// =====================================================

function extractNCRForecast(html) {
  /*
   * PAGASA's regional forecast page contains a large amount
   * of navigation text. We locate the NCR forecast content
   * using recognizable forecast labels.
   */

  const text = cleanText(html);

  const forecastMarkers = [
    "National Capital Region",
    "Weather Forecast",
    "Forecast",
    "Temperature",
    "Wind",
    "Forecast Issued"
  ];

  let start = -1;

  for (const marker of forecastMarkers) {
    const index = text.indexOf(marker);

    if (index >= 0) {
      start = index;
      break;
    }
  }

  if (start < 0) {
    return text.substring(0, 5000);
  }

  let result = text.substring(start);

  // Remove obvious navigation-heavy beginning.
  result = result.replace(
    /National Capital Region\s+National Capital Region\s+-->\s+Southern Luzon[\s\S]*?National Meteorological and Hydrological Services/i,
    ""
  );

  // Remove repeated site navigation if it remains.
  result = result
    .replace(
      /Regional Forecast\s+Northern Luzon\s+Northern Luzon\s+-->\s+National Capital Region/gi,
      ""
    )
    .replace(
      /Products and Services[\s\S]*?About Us/gi,
      ""
    )
    .replace(
      /Related Linkages[\s\S]*?Transparency Seal/gi,
      ""
    )
    .replace(
      /Privacy Notice[\s\S]*?Accessibility/gi,
      ""
    );

  result = result.replace(/\s+/g, " ").trim();

  /*
   * If the first extraction still contains obvious navigation,
   * locate the first actual forecast terminology.
   */

  const actualForecastMarkers = [
    "Partly cloudy",
    "Mostly cloudy",
    "Cloudy skies",
    "Cloudy",
    "Fair weather",
    "Isolated",
    "Scattered",
    "Thunderstorms",
    "Rainshowers",
    "Rain showers"
  ];

  let forecastStart = -1;

  for (const marker of actualForecastMarkers) {
    const index = result.toLowerCase().indexOf(marker.toLowerCase());

    if (index >= 0) {
      forecastStart = index;
      break;
    }
  }

  if (forecastStart >= 0) {
    result = result.substring(forecastStart);
  }

  return result.substring(0, 5000);
}

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

  const description = extractNCRForecast(html);

  return await saveAlert({
    source: "PAGASA",
    alert_type: "WEATHER",
    title: "PAGASA NCR Weather Forecast",
    description,
    severity: detectSeverity(description),
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
// NDRRMC
// =====================================================

function extractNDRRMCInformation(html) {
  const text = cleanText(html);

  const importantTerms = [
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
      importantTerms.some((term) =>
        sentence.toLowerCase().includes(term.toLowerCase())
      )
    );

  if (sentences.length > 0) {
    return sentences.slice(0, 20).join(" ");
  }

  return text.substring(0, 4000);
}

async function updateNDRRMC() {
  const url = "https://ndrrmc.gov.ph/";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error: "Unable to fetch NDRRMC website"
    };
  }

  const description = extractNDRRMCInformation(html);

  return await saveAlert({
    source: "NDRRMC",
    alert_type: "DISASTER",
    title: "Latest NDRRMC Disaster Information",
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
            error: "Supabase environment variables are missing."
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
      (result) => result && result.success === true
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
    console.error("LICAS updater fatal error:", error);

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

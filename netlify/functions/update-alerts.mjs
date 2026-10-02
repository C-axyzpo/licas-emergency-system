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
    .replace(/&gt;/gi, ">")
    .replace(/&deg;/gi, "°")
    .replace(/&#176;/gi, "°");
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
    t.includes("extreme danger")
  ) {
    return "CRITICAL";
  }

  if (
    t.includes("warning") ||
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

    const timeout = setTimeout(
      () => controller.abort(),
      20000
    );

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

  const { data: existing, error: findError } =
    await supabase
      .from("external_alerts")
      .select("id")
      .eq("source", source)
      .eq("title", title)
      .eq("location", location || "")
      .limit(1)
      .maybeSingle();

  if (findError) {
    console.error(
      `DATABASE FIND ERROR [${source}]:`,
      findError.message
    );

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
      console.error(
        `DATABASE UPDATE ERROR [${source}]:`,
        error.message
      );

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
    console.error(
      `DATABASE INSERT ERROR [${source}]:`,
      error.message
    );

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
// PAGASA
// =====================================================

function extractPAGASANCR(html) {
  const text = cleanText(html);

  const forecastMarker =
    "Regional Forecast Issued At:";

  const forecastStart =
    text.indexOf(forecastMarker);

  if (forecastStart === -1) {
    return null;
  }

  /*
   * Everything before the first weather phrase is mostly
   * PAGASA navigation/location labels.
   */
  const forecastSection = text.substring(
    forecastStart,
    Math.min(
      text.length,
      forecastStart + 5000
    )
  );

  const weatherPatterns = [
    "Partly cloudy to cloudy skies",
    "Mostly cloudy skies",
    "Cloudy skies",
    "Partly cloudy",
    "Mostly cloudy",
    "Fair weather",
    "Isolated rainshowers or thunderstorms",
    "Isolated rainshowers",
    "Isolated thunderstorms",
    "Scattered rainshowers",
    "Scattered thunderstorms",
    "Light rains",
    "Moderate rains",
    "Heavy rains"
  ];

  let weatherStart = -1;
  let matchedWeather = "";

  for (const pattern of weatherPatterns) {
    const index = forecastSection
      .toLowerCase()
      .indexOf(pattern.toLowerCase());

    if (
      index !== -1 &&
      (weatherStart === -1 ||
        index < weatherStart)
    ) {
      weatherStart = index;
      matchedWeather = pattern;
    }
  }

  if (weatherStart === -1) {
    return null;
  }

  /*
   * Start exactly at the weather condition.
   */
  let actual = forecastSection.substring(
    weatherStart
  );

  // Stop before the extended outlook.
  const outlookIndex = actual
    .toLowerCase()
    .indexOf("extended weather outlook");

  if (outlookIndex !== -1) {
    actual = actual.substring(
      0,
      outlookIndex
    );
  }

  actual = actual
    .replace(/\s+/g, " ")
    .trim();

  // ---------------------------------------------------
  // WEATHER CONDITION
  // ---------------------------------------------------

  let condition = matchedWeather;

  const conditionMatch = actual.match(
    /^(.*?)(?=\s+\d{2}°\s*\d{2}°|\s+\d{2}\s*°\s*\d{2}\s*°)/i
  );

  if (conditionMatch) {
    condition = conditionMatch[1].trim();
  }

  // ---------------------------------------------------
  // TEMPERATURE
  // ---------------------------------------------------

  const temperatureMatch = actual.match(
    /(\d{2})\s*°\s*(\d{2})\s*°/
  );

  const minTemperature = temperatureMatch
    ? temperatureMatch[1]
    : null;

  const maxTemperature = temperatureMatch
    ? temperatureMatch[2]
    : null;

  // ---------------------------------------------------
  // WIND
  // ---------------------------------------------------

  const windMatch = actual.match(
    /Wind Speed:\s*(.*?)\s+Direction:\s*(.*?)\s+Coastal Condition:\s*(.*?)(?=\s+(?:Partly cloudy|Mostly cloudy|Cloudy skies|Partly cloudy to cloudy|Extended Weather Outlook|$))/i
  );

  const windSpeed = windMatch
    ? windMatch[1].trim()
    : null;

  const windDirection = windMatch
    ? windMatch[2].trim()
    : null;

  const coastalCondition = windMatch
    ? windMatch[3].trim()
    : null;

  // ---------------------------------------------------
  // ISSUED DATE/TIME
  // ---------------------------------------------------

  const issuedMatch = text.match(
    /Regional Forecast Issued At:\s*(\d{2}:\d{2}\s*[AP]M),\s*(\d{1,2}\s+\w+,\s+\d{4})/i
  );

  const issuedText = issuedMatch
    ? `${issuedMatch[1]} ${issuedMatch[2]}`
    : "Latest PAGASA regional forecast";

  // ---------------------------------------------------
  // SECOND FORECAST BLOCK
  //
  // PAGASA's NCR page can contain another forecast
  // block for the same regional page. We intentionally
  // take only the first actual NCR forecast.
  // ---------------------------------------------------

  const result = [];

  result.push(
    `Regional Forecast — ${issuedText}`
  );

  if (condition) {
    result.push(
      `Condition: ${condition}`
    );
  }

  if (
    minTemperature &&
    maxTemperature
  ) {
    result.push(
      `Temperature: ${minTemperature}°C–${maxTemperature}°C`
    );
  }

  if (windSpeed) {
    result.push(
      `Wind: ${windSpeed}`
    );
  }

  if (windDirection) {
    result.push(
      `Wind Direction: ${windDirection}`
    );
  }

  if (coastalCondition) {
    result.push(
      `Coastal Condition: ${coastalCondition}`
    );
  }

  // ---------------------------------------------------
  // EXTENDED OUTLOOK
  // ---------------------------------------------------

  const outlookMarker =
    "Extended Weather Outlook";

  const outlookStart =
    text.indexOf(
      outlookMarker,
      forecastStart
    );

  if (outlookStart !== -1) {
    let outlook = text.substring(
      outlookStart,
      Math.min(
        text.length,
        outlookStart + 2200
      )
    );

    /*
     * Only keep actual outlook information.
     */
    outlook = outlook
      .replace(/\s+/g, " ")
      .trim();

    const dayNames = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday"
    ];

    const daysFound = [];

    for (const day of dayNames) {
      const regex = new RegExp(
        `${day}\\s+(\\d{2})°\\s*(\\d{2})°\\s+Wind Speed\\s+(.*?)\\s+Direction\\s+(.*?)\\s+Coastal Condition\\s+(.*?)(?=\\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\\s+\\d{2}°|$)`,
        "i"
      );

      const match = outlook.match(regex);

      if (match) {
        daysFound.push({
          day,
          min: match[1],
          max: match[2],
          wind: match[3].trim(),
          direction: match[4].trim(),
          coastal: match[5].trim()
        });
      }
    }

    if (daysFound.length > 0) {
      result.push("");
      result.push("Extended Outlook");

      for (const day of daysFound.slice(0, 4)) {
        result.push("");
        result.push(
          `${day.day}: ${day.min}°C–${day.max}°C`
        );
        result.push(
          `Wind: ${day.wind}`
        );
        result.push(
          `Direction: ${day.direction}`
        );
        result.push(
          `Coastal Condition: ${day.coastal}`
        );
      }
    }
  }

  return result.join("\n");
}

async function updatePAGASA() {
  const url =
    "https://bagong.pagasa.dost.gov.ph/regional-forecast/ncrprsd";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error:
        "Unable to fetch PAGASA NCR forecast page."
    };
  }

  const forecast =
    extractPAGASANCR(html);

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

  const matches = [
    ...text.matchAll(earthquakePattern)
  ];

  const rows = [];

  for (
    let i = 0;
    i < Math.min(matches.length, 10);
    i++
  ) {
    const start = matches[i].index;

    const end =
      i + 1 < matches.length
        ? matches[i + 1].index
        : Math.min(
            start + 250,
            text.length
          );

    let row = text.substring(
      start,
      end
    );

    row = row
      .replace(/\s+/g, " ")
      .trim();

    if (row.length > 20) {
      rows.push(row);
    }
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
        "Unable to fetch PHIVOLCS earthquake page."
    };
  }

  const description =
    extractPHIVOLCS(html);

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
          .includes(
            keyword.toLowerCase()
          )
      )
    );

  if (sentences.length > 0) {
    return sentences
      .slice(0, 15)
      .join(" ");
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
        "Unable to fetch PHIVOLCS volcano page."
    };
  }

  const description =
    extractVolcano(html);

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
          .includes(
            keyword.toLowerCase()
          )
      )
    );

  if (sentences.length > 0) {
    return sentences
      .slice(0, 20)
      .join(" ");
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
        "Unable to fetch NDRRMC website."
    };
  }

  const description =
    extractNDRRMC(html);

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
// MAIN NETLIFY FUNCTION
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
            "content-type":
              "application/json"
          }
        }
      );
    }

    const results =
      await Promise.all([
        updatePHIVOLCS(),
        updatePHIVOLCSVolcano(),
        updatePAGASA(),
        updateNDRRMC()
      ]);

    const sources = {
      PHIVOLCS_EARTHQUAKE:
        results[0],

      PHIVOLCS_VOLCANO:
        results[1],

      PAGASA_NCR:
        results[2],

      NDRRMC:
        results[3]
    };

    const allSuccessful =
      results.every(
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
        status: allSuccessful
          ? 200
          : 207,

        headers: {
          "content-type":
            "application/json"
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
          "content-type":
            "application/json"
        }
      }
    );
  }
};

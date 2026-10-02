import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_SERVER_URL,
  process.env.SUPABASE_SECRET_KEY
);

// =====================================================
// HELPERS
// =====================================================

function cleanText(text = "") {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
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
    t.includes("strong winds") ||
    t.includes("heavy rainfall") ||
    t.includes("heavy rain") ||
    t.includes("flash flood")
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
      throw new Error("Empty or invalid response");
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
    console.error(`DATABASE FIND ERROR [${source}]:`, findError);
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
      console.error(`DATABASE UPDATE ERROR [${source}]:`, error);

      return {
        success: false,
        error: error.message
      };
    }

    console.log(`UPDATED: ${source}`);

    return {
      success: true,
      action: "updated"
    };
  }

  const { error } = await supabase
    .from("external_alerts")
    .insert(payload);

  if (error) {
    console.error(`DATABASE INSERT ERROR [${source}]:`, error);

    return {
      success: false,
      error: error.message
    };
  }

  console.log(`INSERTED: ${source}`);

  return {
    success: true,
    action: "inserted"
  };
}

// =====================================================
// PHIVOLCS - EARTHQUAKE
// =====================================================

async function updatePHIVOLCS() {
  const url = "https://earthquake.phivolcs.dost.gov.ph/";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error: "Unable to fetch PHIVOLCS earthquake page"
    };
  }

  const text = cleanText(html);

  const description =
    text.substring(0, 5000) ||
    "PHIVOLCS latest earthquake information.";

  return await saveAlert({
    source: "PHIVOLCS",
    alert_type: "EARTHQUAKE",
    title: "Latest PHIVOLCS Earthquake Information",
    description,
    severity: detectSeverity(text),
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
// PHIVOLCS - VOLCANO
// =====================================================

async function updatePHIVOLCSVolcano() {
  const url = "https://volcano.phivolcs.dost.gov.ph/";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error: "Unable to fetch PHIVOLCS volcano page"
    };
  }

  const text = cleanText(html);

  const description =
    text.substring(0, 5000) ||
    "PHIVOLCS latest volcano information.";

  return await saveAlert({
    source: "PHIVOLCS",
    alert_type: "VOLCANIC",
    title: "Latest PHIVOLCS Volcano Information",
    description,
    severity: detectSeverity(text),
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
// PAGASA - NCR FORECAST
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

  const text = cleanText(html);

  // Try to isolate the useful NCR forecast portion.
  let description = text;

  const startIndex = text.indexOf("National Capital Region");

  if (startIndex >= 0) {
    description = text.substring(startIndex);
  }

  // Remove some repeated navigation/interface text.
  description = description
    .replace(
      /Select Image:[\s\S]*?Regional Forecast Issued At:/i,
      "Regional Forecast Issued At:"
    )
    .replace(
      /SPECIAL FORECAST FOR TAAL VOLCANO[\s\S]*$/i,
      ""
    )
    .replace(
      /Show Legend[\s\S]*$/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  // Keep database content manageable.
  description = description.substring(0, 7000);

  const severity = detectSeverity(description);

  return await saveAlert({
    source: "PAGASA",
    alert_type: "WEATHER",
    title: "PAGASA NCR Weather Forecast",
    description,
    severity,
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

async function updateNDRRMC() {
  const url = "https://ndrrmc.gov.ph/";

  const html = await fetchPage(url);

  if (!html) {
    return {
      success: false,
      error: "Unable to fetch NDRRMC website"
    };
  }

  const text = cleanText(html);

  const description =
    text.substring(0, 5000) ||
    "Latest NDRRMC disaster information.";

  return await saveAlert({
    source: "NDRRMC",
    alert_type: "DISASTER",
    title: "Latest NDRRMC Disaster Information",
    description,
    severity: detectSeverity(text),
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
// MAIN FUNCTION
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

    console.log("======================================");
    console.log("LICAS ALERT UPDATER STARTED");
    console.log("======================================");

    const results = await Promise.all([
      updatePHIVOLCS(),
      updatePHIVOLCSVolcano(),
      updatePAGASA(),
      updateNDRRMC()
    ]);

    const status = {
      PHIVOLCS_EARTHQUAKE: results[0],
      PHIVOLCS_VOLCANO: results[1],
      PAGASA_NCR: results[2],
      NDRRMC: results[3]
    };

    const allSuccessful = results.every(
      (result) => result && result.success === true
    );

    console.log("======================================");
    console.log("LICAS ALERT UPDATER FINISHED");
    console.log(JSON.stringify(status, null, 2));
    console.log("======================================");

    return new Response(
      JSON.stringify(
        {
          success: allSuccessful,
          message: allSuccessful
            ? "LICAS external alerts updated successfully."
            : "LICAS external alert update completed with source errors.",
          sources: status
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

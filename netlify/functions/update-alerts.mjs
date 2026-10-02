import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

function cleanText(text = "") {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSeverity(text = "") {
  const t = text.toLowerCase();

  if (
    t.includes("critical") ||
    t.includes("red alert") ||
    t.includes("danger")
  ) {
    return "CRITICAL";
  }

  if (
    t.includes("warning") ||
    t.includes("high alert") ||
    t.includes("significant")
  ) {
    return "HIGH";
  }

  if (
    t.includes("advisory") ||
    t.includes("moderate")
  ) {
    return "MODERATE";
  }

  return "LOW";
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "LICAS Emergency Alert System"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

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
    console.error("Find alert error:", findError);
    return;
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
      console.error("Update alert error:", error);
    }
  } else {
    const { error } = await supabase
      .from("external_alerts")
      .insert(payload);

    if (error) {
      console.error("Insert alert error:", error);
    }
  }
}

async function updatePHIVOLCS() {
  const url = "https://earthquake.phivolcs.dost.gov.ph/";
  const html = await fetchPage(url);

  if (!html) return;

  const text = cleanText(html);

  await saveAlert({
    source: "PHIVOLCS",
    alert_type: "EARTHQUAKE",
    title: "Latest PHIVOLCS Earthquake Information",
    description: text.substring(0, 3000),
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

async function updatePHIVOLCSVolcano() {
  const url = "https://volcano.phivolcs.dost.gov.ph/";
  const html = await fetchPage(url);

  if (!html) return;

  const text = cleanText(html);

  await saveAlert({
    source: "PHIVOLCS",
    alert_type: "VOLCANIC",
    title: "Latest PHIVOLCS Volcano Information",
    description: text.substring(0, 3000),
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

async function updatePAGASA() {
  const url = "https://bagong.pagasa.dost.gov.ph/";
  const html = await fetchPage(url);

  if (!html) return;

  const text = cleanText(html);

  await saveAlert({
    source: "PAGASA",
    alert_type: "WEATHER",
    title: "Latest PAGASA Weather Information",
    description: text.substring(0, 3000),
    severity: detectSeverity(text),
    issued_at: new Date().toISOString(),
    expires_at: null,
    source_url: url,
    content_type: "WEATHER",
    source_type: "OFFICIAL",
    location: "Philippines",
    published_at: new Date().toISOString(),
    is_official: true
  });
}

async function updateNDRRMC() {
  const url = "https://ndrrmc.gov.ph/";
  const html = await fetchPage(url);

  if (!html) return;

  const text = cleanText(html);

  await saveAlert({
    source: "NDRRMC",
    alert_type: "DISASTER",
    title: "Latest NDRRMC Disaster Information",
    description: text.substring(0, 3000),
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

export default async () => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Supabase environment variables are missing."
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }

    await Promise.all([
      updatePHIVOLCS(),
      updatePHIVOLCSVolcano(),
      updatePAGASA(),
      updateNDRRMC()
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        message: "LICAS external alerts updated."
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("LICAS updater error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "content-type": "application/json"
        }
      }
    );
  }
};

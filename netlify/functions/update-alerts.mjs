import { createClient } from "@supabase/supabase-js";

// =====================================================
// SUPABASE SERVER CONNECTION
// =====================================================

const supabase = createClient(
    process.env.SUPABASE_SERVER_URL,
    process.env.SUPABASE_SECRET_KEY
);

// =====================================================
// CONFIG
// =====================================================

const FETCH_TIMEOUT = 15000;

const SOURCES = {
    PHIVOLCS_EARTHQUAKE:
        "https://earthquake.phivolcs.dost.gov.ph/",

    PAGASA_NCR:
        "https://bagong.pagasa.dost.gov.ph/regional-forecast/ncrprsd",

    CALOOCAN_DRRMD:
        "https://www.facebook.com/CaloocanCityDRRMD"
};

// =====================================================
// BASIC HELPERS
// =====================================================

function decodeHtml(text) {
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#(\d+);/g, (_, code) =>
            String.fromCharCode(Number(code))
        );
}

function cleanText(text) {
    return decodeHtml(text)
        .replace(/\r/g, "")
        .replace(/\t/g, " ")
        .replace(/[ ]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function detectSeverity(text = "") {
    const value = text.toLowerCase();

    if (
        value.includes("critical") ||
        value.includes("red alert") ||
        value.includes("dangerous")
    ) {
        return "CRITICAL";
    }

    if (
        value.includes("warning") ||
        value.includes("severe") ||
        value.includes("orange")
    ) {
        return "HIGH";
    }

    if (
        value.includes("moderate") ||
        value.includes("yellow")
    ) {
        return "MODERATE";
    }

    return "LOW";
}

// =====================================================
// FETCH WEBSITE
// =====================================================

async function fetchPage(url) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
        controller.abort();
    }, FETCH_TIMEOUT);

    try {
        const response = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
                "Accept":
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        });

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status} ${response.statusText}`
            );
        }

        return await response.text();

    } finally {
        clearTimeout(timeout);
    }
}

// =====================================================
// SAVE ALERT
// =====================================================

async function saveAlert(alert) {

    const { error } = await supabase
        .from("external_alerts")
        .insert(alert);

    if (error) {
        throw new Error(error.message);
    }

    return true;
}

// =====================================================
// PAGASA NCR
// =====================================================

function extractPAGASANCR(html) {

    const text = cleanText(
        html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
    );

    const start =
        text.indexOf("Regional Forecast Issued At:");

    if (start === -1) {
        throw new Error(
            "PAGASA regional forecast section not found."
        );
    }

    let section = text.slice(start, start + 7000);

    const outlookIndex =
        section.indexOf("Extended Weather Outlook");

    let currentForecast = outlookIndex >= 0
        ? section.slice(0, outlookIndex)
        : section;

    currentForecast = currentForecast
        .replace(/\s+/g, " ")
        .trim();

    // Weather condition
    const conditionMatch =
        currentForecast.match(
            /(Partly cloudy to cloudy skies[^0-9]+?(?:thunderstorms|rainshowers|showers)[^0-9]*)/i
        );

    // Temperature
    const temperatureMatch =
        currentForecast.match(
            /(\d{1,2})\s*(?:°|&deg;)\s*(\d{1,2})/i
        );

    // Wind
    const windMatch =
        currentForecast.match(
            /Wind Speed:\s*([^]+?)\s*Direction:/i
        );

    const directionMatch =
        currentForecast.match(
            /Direction:\s*([^]+?)\s*Coastal Condition:/i
        );

    const coastalMatch =
        currentForecast.match(
            /Coastal Condition:\s*([^]+?)(?=Partly cloudy|$)/i
        );

    const condition =
        conditionMatch
            ? conditionMatch[1].trim()
            : "Weather forecast available";

    const temperature =
        temperatureMatch
            ? `${temperatureMatch[1]}°–${temperatureMatch[2]}°C`
            : "Not available";

    const wind =
        windMatch
            ? windMatch[1].trim()
            : "Not available";

    const direction =
        directionMatch
            ? directionMatch[1].trim()
            : "Not available";

    const coastal =
        coastalMatch
            ? coastalMatch[1].trim()
            : "Not available";

    // =================================================
    // EXTENDED OUTLOOK
    // =================================================

    let outlook = "";

    const outlookStart =
        text.indexOf("Extended Weather Outlook");

    if (outlookStart >= 0) {

        let outlookText =
            text.slice(outlookStart, outlookStart + 4000);

        outlookText =
            outlookText.replace(/\s+/g, " ").trim();

        const days = [
            "Friday",
            "Saturday",
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday"
        ];

        const found = [];

        for (const day of days) {

            const regex = new RegExp(
                `${day}\\s+(\\d{1,2})\\s*(?:°|&deg;)\\s*(\\d{1,2})\\s+Wind Speed\\s+([^]+?)\\s+Direction\\s+([^]+?)\\s+Coastal Condition\\s+([^]+?)(?=${days.join("|")}|$)`,
                "i"
            );

            const match = outlookText.match(regex);

            if (match) {

                found.push(
                    `${day}: ${match[1]}°–${match[2]}°C | Wind ${match[3].trim()} | ${match[4].trim()} | Coastal ${match[5].trim()}`
                );
            }
        }

        if (found.length) {
            outlook = found.slice(0, 4).join("\n");
        }
    }

    const description = [
        `Condition: ${condition}`,
        `Temperature: ${temperature}`,
        `Wind: ${wind}`,
        `Direction: ${direction}`,
        `Coastal Condition: ${coastal}`,
        outlook
            ? `\nExtended Outlook:\n${outlook}`
            : ""
    ]
        .filter(Boolean)
        .join("\n");

    return {
        title: "PAGASA NCR Weather Forecast",
        description,
        severity: detectSeverity(condition),
        location: "National Capital Region"
    };
}

// =====================================================
// UPDATE PAGASA
// =====================================================

async function updatePAGASA() {

    try {

        const html =
            await fetchPage(SOURCES.PAGASA_NCR);

        const data =
            extractPAGASANCR(html);

        await saveAlert({
            source: "PAGASA",
            alert_type: "WEATHER",
            title: data.title,
            description: data.description,
            severity: data.severity,
            issued_at: new Date().toISOString(),
            source_url: SOURCES.PAGASA_NCR,
            content_type: "WEATHER_FORECAST",
            source_type: "OFFICIAL",
            location: data.location,
            published_at: new Date().toISOString(),
            is_official: true
        });

        return {
            success: true,
            message: "PAGASA NCR updated."
        };

    } catch (error) {

        return {
            success: false,
            message: error.message
        };
    }
}

// =====================================================
// PHIVOLCS EARTHQUAKE
// =====================================================

function extractPHIVOLCS(html) {

    const text = cleanText(
        html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, "\n")
    );

    const lines = text
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    const earthquakeRows = [];

    for (const line of lines) {

        const match = line.match(
            /(\d{2}\s+\w+\s+\d{4}\s*-\s*\d{2}:\d{2}\s*(?:AM|PM))\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+([\d.]+)\s+(.+)/i
        );

        if (!match) continue;

        earthquakeRows.push({
            time: match[1],
            latitude: match[2],
            longitude: match[3],
            depth: match[4],
            magnitude: match[5],
            location: match[6]
        });
    }

    return earthquakeRows.slice(0, 10);
}

// =====================================================
// UPDATE PHIVOLCS
// =====================================================

async function updatePHIVOLCS() {

    try {

        const html =
            await fetchPage(SOURCES.PHIVOLCS_EARTHQUAKE);

        const earthquakes =
            extractPHIVOLCS(html);

        if (!earthquakes.length) {
            throw new Error(
                "No earthquake records detected."
            );
        }

        for (const quake of earthquakes) {

            await saveAlert({

                source: "PHIVOLCS",

                alert_type: "EARTHQUAKE",

                title:
                    `Magnitude ${quake.magnitude} Earthquake`,

                description:
                    `Time: ${quake.time}\n` +
                    `Depth: ${quake.depth} km\n` +
                    `Location: ${quake.location}\n` +
                    `Coordinates: ${quake.latitude}, ${quake.longitude}`,

                severity:
                    Number(quake.magnitude) >= 5
                        ? "HIGH"
                        : Number(quake.magnitude) >= 3
                            ? "MODERATE"
                            : "LOW",

                issued_at: new Date().toISOString(),

                source_url:
                    SOURCES.PHIVOLCS_EARTHQUAKE,

                content_type:
                    "EARTHQUAKE",

                source_type:
                    "OFFICIAL",

                location:
                    quake.location,

                published_at:
                    new Date().toISOString(),

                is_official:
                    true
            });
        }

        return {
            success: true,
            message:
                `${earthquakes.length} PHIVOLCS earthquake records updated.`
        };

    } catch (error) {

        return {
            success: false,
            message: error.message
        };
    }
}

// =====================================================
// CALOOCAN CITY DRRMD
// =====================================================

async function updateCaloocanDRRMD() {

    try {

        await saveAlert({

            source: "Caloocan City DRRMD",

            alert_type: "LOCAL_DRRMD",

            title:
                "Caloocan City DRRMD Updates",

            description:
                "Official local disaster-risk reduction and emergency information source for Caloocan City.\n\n" +
                "Latest public updates are available through the official Caloocan City DRRMD Facebook page.",

            severity: "LOW",

            issued_at:
                new Date().toISOString(),

            source_url:
                SOURCES.CALOOCAN_DRRMD,

            content_type:
                "LOCAL_SOURCE",

            source_type:
                "OFFICIAL",

            location:
                "Caloocan City",

            published_at:
                new Date().toISOString(),

            is_official:
                true
        });

        return {
            success: true,
            message:
                "Caloocan City DRRMD official source updated."
        };

    } catch (error) {

        return {
            success: false,
            message: error.message
        };
    }
}

// =====================================================
// MAIN HANDLER
// =====================================================

export default async function handler() {

    if (
        !process.env.SUPABASE_SERVER_URL ||
        !process.env.SUPABASE_SECRET_KEY
    ) {

        return new Response(
            JSON.stringify({
                success: false,
                message:
                    "Supabase server environment variables are missing."
            }),
            {
                status: 500,
                headers: {
                    "Content-Type":
                        "application/json"
                }
            }
        );
    }

    const results =
        await Promise.all([
            updatePHIVOLCS(),
            updatePAGASA(),
            updateCaloocanDRRMD()
        ]);

    return new Response(
        JSON.stringify({

            success:
                results.every(
                    result => result.success
                ),

            message:
                "LICAS external alerts updated.",

            updated_at:
                new Date().toISOString(),

            sources: {

                PHIVOLCS_EARTHQUAKE:
                    results[0],

                PAGASA_NCR:
                    results[1],

                CALOOCAN_CITY_DRRMD:
                    results[2]
            }

        }, null, 2),

        {
            status: 200,
            headers: {
                "Content-Type":
                    "application/json"
            }
        }
    );
}

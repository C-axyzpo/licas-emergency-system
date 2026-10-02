app.js
console.log("LICAS app.js loaded");


// =====================================================
// SUPABASE CONNECTION
// =====================================================

const SUPABASE_URL =
    "https://gqnyqaxwgfkdglkjuidc.supabase.co";

/*
   KEEP YOUR EXISTING SUPABASE PUBLISHABLE KEY HERE.
*/
const SUPABASE_KEY =
    "sb_publishable_Ld7RcE6is_Ln_iAcqMYVLg_MZw58l3c";

@@ -20,6 +16,17 @@ const supabaseClient = supabase.createClient(
);


// =====================================================
// CONFIGURATION
// =====================================================

// A unit is considered connected only if its ESP32
// has updated last_seen within this period.
//
// Adjust this if your ESP32 heartbeat interval changes.
const UNIT_ONLINE_WINDOW_MS = 60 * 1000;


// =====================================================
// HELPERS
// =====================================================
@@ -61,6 +68,52 @@ function formatDate(date) {
}


function formatRelativeTime(date) {

    if (!date) {
        return "Never";
    }

    const parsed = new Date(date);

    if (isNaN(parsed.getTime())) {
        return "Unknown";
    }

    const seconds =
        Math.floor(
            (Date.now() - parsed.getTime()) / 1000
        );

    if (seconds < 5) {
        return "Just now";
    }

    if (seconds < 60) {
        return `${seconds}s ago`;
    }

    const minutes =
        Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours =
        Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days =
        Math.floor(hours / 24);

    return `${days}d ago`;
}


function formatNumber(value, decimals = 1) {

    if (
@@ -81,6 +134,185 @@ function formatNumber(value, decimals = 1) {
}


function isUnitOnline(lastSeen) {

    if (!lastSeen) {
        return false;
    }

    const time =
        new Date(lastSeen).getTime();

    if (isNaN(time)) {
        return false;
    }

    return (
        Date.now() - time <=
        UNIT_ONLINE_WINDOW_MS
    );
}


function getUnitConnectionLabel(lastSeen) {

    return isUnitOnline(lastSeen)
        ? "Connected"
        : "Offline";
}


function getUnitConnectionClass(lastSeen) {

    return isUnitOnline(lastSeen)
        ? "online"
        : "offline";
}


function getAlertClassification(alert) {

    if (alert.classification) {
        return String(alert.classification);
    }

    const source =
        String(alert.source || "").toLowerCase();

    if (
        source.includes("student") ||
        source.includes("user") ||
        source.includes("community") ||
        source.includes("report")
    ) {
        return "Community Report";
    }

    if (
        source.includes("barangay") ||
        source.includes("caloocan") ||
        source.includes("mayor") ||
        source.includes("lgu")
    ) {
        return "Local Announcement";
    }

    return "Official Alert";
}


function getAlertSourceClass(alert) {

    const classification =
        getAlertClassification(alert)
            .toLowerCase();

    if (classification.includes("report")) {
        return "report";
    }

    if (classification.includes("local")) {
        return "local";
    }

    if (classification.includes("emergency")) {
        return "emergency";
    }

    return "official";
}


function getAlertIcon(alert) {

    const type =
        String(
            alert.alert_type ||
            ""
        ).toLowerCase();

    if (type.includes("earthquake")) {
        return "◉";
    }

    if (
        type.includes("rain") ||
        type.includes("weather") ||
        type.includes("typhoon") ||
        type.includes("flood")
    ) {
        return "☁";
    }

    if (
        type.includes("fire") ||
        type.includes("road")
    ) {
        return "⚠";
    }

    if (
        getAlertClassification(alert)
            .toLowerCase()
            .includes("report")
    ) {
        return "!";
    }

    return "●";
}


function getSeverityClass(severity) {

    const value =
        String(
            severity || ""
        ).toLowerCase();

    if (
        value.includes("critical") ||
        value.includes("high") ||
        value.includes("danger")
    ) {
        return "critical";
    }

    if (
        value.includes("moderate") ||
        value.includes("warning")
    ) {
        return "warning";
    }

    return "normal";
}


function getSourceLink(alert) {

    const url =
        alert.source_url ||
        alert.url ||
        alert.link;

    if (!url) {
        return "";
    }

    return `
        <a
            class="source-link"
            href="${escapeHTML(url)}"
            target="_blank"
            rel="noopener noreferrer"
        >
            View original source →
        </a>
    `;
}


// =====================================================
// DESKTOP PAGE NAVIGATION
// =====================================================
@@ -102,36 +334,31 @@ navButtons.forEach(button => {
        const targetPage =
            button.dataset.page;


        navButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        button.classList.add("active");


        pages.forEach(page => {
            page.classList.remove("active-page");
        });


        const target =
            document.getElementById(targetPage);

        if (target) {
            target.classList.add("active-page");
        }


        if (pageTitle) {
            pageTitle.textContent =
                button.textContent.trim();
        }


        /*
           Refresh page-specific information.
        */
        if (targetPage === "overview") {
            await loadDashboard();
        }

        if (targetPage === "reports") {
            await loadUserReports();
@@ -149,9 +376,7 @@ navButtons.forEach(button => {
            await loadUnits();
            await loadLatestSensorReadings();
        }

    });

});


@@ -168,10 +393,8 @@ function updateTime() {
        return;
    }

    const now = new Date();

    element.textContent =
        now.toLocaleTimeString(
        new Date().toLocaleTimeString(
            "en-PH",
            {
                hour: "2-digit",
@@ -182,116 +405,116 @@ function updateTime() {
}

setInterval(updateTime, 1000);

updateTime();


// =====================================================
// LOAD UNITS
// =====================================================

let cachedUnits = [];


async function loadUnits() {

    console.log("Loading LICAS units...");


    const { data, error } =
        await supabaseClient
            .from("units")
            .select("*")
            .order("id", { ascending: true });


    if (error) {

        console.error(
            "UNIT DATABASE ERROR:",
            error
        );

        return;
        return [];
    }


    console.log("Units found:", data);

    cachedUnits = data || [];

    const onlineCount =
        data.filter(
            unit =>
                String(unit.status).toLowerCase() ===
                "online"
        cachedUnits.filter(unit =>
            isUnitOnline(unit.last_seen)
        ).length;


    const onlineUnits =
        document.getElementById("onlineUnits");

    if (onlineUnits) {
        onlineUnits.textContent = onlineCount;
        onlineUnits.textContent =
            onlineCount;
    }


    const monitorUnits =
        document.getElementById("monitorUnits");

    if (monitorUnits) {
        monitorUnits.textContent = data.length;
        monitorUnits.textContent =
            cachedUnits.length;
    }

    const connectedUnits =
        document.getElementById(
            "overviewConnectedUnits"
        );

    if (connectedUnits) {
        connectedUnits.textContent =
            onlineCount;
    }

    const container =
        document.getElementById("unitsContainer");

        document.getElementById(
            "unitsContainer"
        );

    if (!container) {
        return;
        return cachedUnits;
    }


    if (!data.length) {
    if (!cachedUnits.length) {

        container.innerHTML = `
            <div class="empty-state panel-empty">
                No monitoring units found.
                <div class="empty-icon">◈</div>
                <strong>No monitoring units found</strong>
                <span>
                    LICAS has not received any registered monitoring units yet.
                </span>
            </div>
        `;

        return;
        return cachedUnits;
    }


    container.innerHTML =
        data.map(unit => {

            /*
               unit.id = database primary key
               unit.unit_id = human-readable LICAS ID
            */
        cachedUnits.map(unit => {

            const displayUnitID =
                unit.unit_id ||
                `Unit ${unit.id}`;


            const location =
                unit.location ||
                "Location not assigned";


            const floor =
                unit.floor ||
                "";


            const status =
                unit.status ||
                "offline";

            const online =
                isUnitOnline(
                    unit.last_seen
                );

            return `
                <div
                    class="unit-card"
                <article
                    class="unit-card ${online ? "unit-online" : "unit-offline"}"
                    data-unit-id="${escapeHTML(unit.id)}"
                >

@@ -304,101 +527,107 @@ async function loadUnits() {
                            </div>

                            <div class="unit-location">

                                ${escapeHTML(location)}

                                ${
                                    floor
                                    ? " · " +
                                      escapeHTML(floor)
                                    : ""
                                        ? " · " +
                                          escapeHTML(floor)
                                        : ""
                                }

                            </div>

                        </div>


                        <div class="unit-status">
                        <div
                            class="unit-status ${online ? "online" : "offline"}"
                        >

                            <span class="status-dot"></span>

                            ${escapeHTML(status)}
                            ${online ? "CONNECTED" : "OFFLINE"}

                        </div>

                    </div>


                    <div class="unit-details">

                        <div class="unit-detail">

                            <span>
                                Unit ID
                            </span>
                            <span>Unit ID</span>

                            <strong>
                                ${escapeHTML(displayUnitID)}
                            </strong>

                        </div>


                        <div class="unit-detail">

                            <span>
                                Database ID
                            </span>
                            <span>Database ID</span>

                            <strong>
                                ${escapeHTML(unit.id)}
                            </strong>

                        </div>

                        <div class="unit-detail">

                            <span>Last Seen</span>

                            <strong>
                                ${formatRelativeTime(
                                    unit.last_seen
                                )}
                            </strong>

                        </div>

                        <div class="unit-detail">

                            <span>
                                Last Seen
                            </span>
                            <span>Last Database Update</span>

                            <strong>
                                ${formatDate(unit.last_seen)}
                                ${formatDate(
                                    unit.last_seen
                                )}
                            </strong>

                        </div>

                    </div>


                    <div class="unit-sensors">

                        <div class="sensor-loading">
                            Loading sensor data...
                            Loading latest sensor data...
                        </div>

                    </div>

                </div>
                </article>
            `;

        }).join("");

    return cachedUnits;
}


// =====================================================
// LOAD LATEST SENSOR READINGS
// =====================================================

let cachedLatestReadings = {};


async function loadLatestSensorReadings() {

    console.log(
        "Loading latest LICAS sensor readings..."
    );


    const { data, error } =
        await supabaseClient
            .from("sensor_readings")
@@ -409,8 +638,7 @@ async function loadLatestSensorReadings() {
                    ascending: false
                }
            )
            .limit(100);

            .limit(200);

    if (error) {

@@ -422,335 +650,337 @@ async function loadLatestSensorReadings() {
        return;
    }


    if (!data || !data.length) {

        console.log(
            "No sensor readings found."
        );

        return;
    }


    /*
       The results are sorted newest first.

       Therefore, the first reading we encounter
       for each unit is its latest reading.
    */

    const latestByUnit = {};


    data.forEach(reading => {

        const unitID =
            String(reading.unit_id);


        if (!latestByUnit[unitID]) {

            latestByUnit[unitID] =
                reading;

        }

    });

    cachedLatestReadings =
        latestByUnit;

    console.log(
        "Latest sensor readings:",
        latestByUnit
    );

    Object.entries(latestByUnit)
        .forEach(
            ([unitId, reading]) => {

    /*
       Update each monitoring unit card.
    */
                const card =
                    document.querySelector(
                        `.unit-card[data-unit-id="${unitId}"]`
                    );

    Object.entries(latestByUnit).forEach(
        ([unitId, reading]) => {
                if (!card) {
                    return;
                }

            const card =
                document.querySelector(
                    `.unit-card[data-unit-id="${unitId}"]`
                );
                const sensorContainer =
                    card.querySelector(
                        ".unit-sensors"
                    );

                if (!sensorContainer) {
                    return;
                }

            if (!card) {
                return;
            }
                let humanStatus =
                    "Unavailable";

                if (
                    reading.human_presence === true
                ) {
                    humanStatus =
                        "Human detected";
                } else if (
                    reading.human_presence === false
                ) {
                    humanStatus =
                        "No presence detected";
                }

                const vibration =
                    formatNumber(
                        reading.vibration_level,
                        3
                    );

            const sensorContainer =
                card.querySelector(
                    ".unit-sensors"
                );
                let smokeStatus =
                    "Unavailable";

                if (
                    reading.smoke_level !== null &&
                    reading.smoke_level !== undefined
                ) {
                    smokeStatus =
                        String(
                            reading.smoke_level
                        );
                }

                const targetState =
                    reading.target_state ||
                    "None";

            if (!sensorContainer) {
                return;
            }
                let sensorStatus =
                    "Monitoring";

                if (
                    reading.human_presence === true
                ) {
                    sensorStatus =
                        "PRESENCE";
                }

            // -----------------------------------------
            // HUMAN PRESENCE
            // -----------------------------------------
                if (
                    reading.vibration_level !== null &&
                    Number(
                        reading.vibration_level
                    ) >= 0.20
                ) {
                    sensorStatus =
                        "MOVEMENT";
                }

            let humanStatus =
                "No presence detected";
                if (
                    reading.smoke_level !== null &&
                    reading.smoke_level !== undefined
                ) {
                    sensorStatus =
                        "SMOKE MONITORING";
                }

                sensorContainer.innerHTML = `

            if (reading.human_presence === true) {
                    <div class="unit-sensor-header">

                humanStatus =
                    "Human detected";
                        <strong>
                            Latest Sensor Reading
                        </strong>

            } else if (
                reading.human_presence === false
            ) {
                        <span class="sensor-status">
                            ${escapeHTML(sensorStatus)}
                        </span>

                humanStatus =
                    "No presence detected";
            }
                    </div>

                    <div class="sensor-grid">

            // -----------------------------------------
            // VIBRATION
            // -----------------------------------------
                        <div class="sensor-item">
                            <span>Temperature</span>
                            <strong>
                                ${
                                    reading.temperature !== null &&
                                    reading.temperature !== undefined
                                        ? formatNumber(
                                            reading.temperature,
                                            1
                                        ) + " °C"
                                        : "Unavailable"
                                }
                            </strong>
                        </div>

            const vibration =
                formatNumber(
                    reading.vibration_level,
                    3
                );
                        <div class="sensor-item">
                            <span>Humidity</span>
                            <strong>
                                ${
                                    reading.humidity !== null &&
                                    reading.humidity !== undefined
                                        ? formatNumber(
                                            reading.humidity,
                                            1
                                        ) + " %"
                                        : "Unavailable"
                                }
                            </strong>
                        </div>

                        <div class="sensor-item">
                            <span>Human Presence</span>
                            <strong>
                                ${escapeHTML(
                                    humanStatus
                                )}
                            </strong>
                        </div>

            // -----------------------------------------
            // SMOKE
            // -----------------------------------------
                        <div class="sensor-item">
                            <span>Vibration</span>
                            <strong>
                                ${escapeHTML(
                                    vibration
                                )} g
                            </strong>
                        </div>

            let smokeStatus =
                "Unavailable";
                        <div class="sensor-item">
                            <span>Target State</span>
                            <strong>
                                ${escapeHTML(
                                    targetState
                                )}
                            </strong>
                        </div>

                        <div class="sensor-item">
                            <span>Smoke Level</span>
                            <strong>
                                ${escapeHTML(
                                    smokeStatus
                                )}
                            </strong>
                        </div>

            if (
                reading.smoke_level !== null &&
                reading.smoke_level !== undefined
            ) {
                    </div>

                smokeStatus =
                    String(
                        reading.smoke_level
                    );
            }
                    <div class="sensor-last-reading">


            // -----------------------------------------
            // TARGET STATE
            // -----------------------------------------

            const targetState =
                reading.target_state ||
                "None";


            // -----------------------------------------
            // STATUS
            // -----------------------------------------

            let sensorStatus =
                "Monitoring";


            if (
                reading.human_presence === true
            ) {

                sensorStatus =
                    "MONITOR";

            } else if (
                reading.vibration_level !== null &&
                Number(reading.vibration_level) >= 0.20
            ) {

                sensorStatus =
                    "MONITOR";

            } else if (
                reading.smoke_level !== null
            ) {

                sensorStatus =
                    "MONITOR";
            }


            // -----------------------------------------
            // RENDER SENSOR DATA
            // -----------------------------------------

            sensorContainer.innerHTML = `

                <div class="unit-sensor-header">

                    <strong>
                        Live Sensor Data
                    </strong>

                    <span class="sensor-status">
                        ${escapeHTML(sensorStatus)}
                    </span>

                </div>


                <div class="sensor-grid">

                    <div class="sensor-item">

                        <span>
                            Temperature
                        </span>

                        <strong>
                            ${
                                reading.temperature !== null &&
                                reading.temperature !== undefined

                                ? formatNumber(
                                    reading.temperature,
                                    1
                                ) + " °C"

                                : "Unavailable"
                            }
                        </strong>

                    </div>


                    <div class="sensor-item">

                        <span>
                            Humidity
                        </span>
                        <span>
                            Recorded
                        </span>

                        <strong>
                            ${
                                reading.humidity !== null &&
                                reading.humidity !== undefined

                                ? formatNumber(
                                    reading.humidity,
                                    1
                                ) + " %"

                                : "Unavailable"
                            }
                        </strong>

                    </div>


                    <div class="sensor-item">

                        <span>
                            Human Presence
                        </span>

                        <strong>
                            ${escapeHTML(
                                humanStatus
                            ${formatDate(
                                reading.recorded_at
                            )}
                        </strong>

                    </div>
                `;
            }
        );

    updateOverviewSensorSummary();
}

                    <div class="sensor-item">

                        <span>
                            Vibration
                        </span>
// =====================================================
// OVERVIEW SENSOR SUMMARY
// =====================================================

                        <strong>
                            ${escapeHTML(
                                vibration
                            )} g
                        </strong>
function updateOverviewSensorSummary() {

                    </div>
    const container =
        document.getElementById(
            "overviewSensorSummary"
        );

    if (!container) {
        return;
    }

                    <div class="sensor-item">
    const readings =
        Object.values(
            cachedLatestReadings
        );

                        <span>
                            Target State
                        </span>
    if (!readings.length) {

                        <strong>
                            ${escapeHTML(
                                targetState
                            )}
                        </strong>
        container.innerHTML = `
            <div class="empty-state compact-empty">
                <strong>No sensor readings yet</strong>
                <span>
                    Latest ESP32 sensor values will appear here.
                </span>
            </div>
        `;

                    </div>
        return;
    }

    let presenceCount = 0;
    let movementCount = 0;
    let smokeAvailable = 0;

                    <div class="sensor-item">
    readings.forEach(reading => {

                        <span>
                            Smoke Level
                        </span>
        if (
            reading.human_presence === true
        ) {
            presenceCount++;
        }

                        <strong>
                            ${escapeHTML(
                                smokeStatus
                            )}
                        </strong>
        if (
            reading.vibration_level !== null &&
            Number(
                reading.vibration_level
            ) >= 0.20
        ) {
            movementCount++;
        }

                    </div>
        if (
            reading.smoke_level !== null &&
            reading.smoke_level !== undefined
        ) {
            smokeAvailable++;
        }
    });

                </div>
    container.innerHTML = `

        <div class="overview-mini-grid">

                <div class="sensor-last-reading">
            <div class="overview-mini-card">
                <span>Units Reporting</span>
                <strong>
                    ${readings.length}
                </strong>
            </div>

                    <span>
                        Last Sensor Reading
                    </span>
            <div class="overview-mini-card">
                <span>Presence Detected</span>
                <strong>
                    ${presenceCount}
                </strong>
            </div>

                    <strong>
                        ${formatDate(
                            reading.recorded_at
                        )}
                    </strong>
            <div class="overview-mini-card">
                <span>Movement Signals</span>
                <strong>
                    ${movementCount}
                </strong>
            </div>

                </div>
            <div class="overview-mini-card">
                <span>Smoke Data Available</span>
                <strong>
                    ${smokeAvailable}
                </strong>
            </div>

            `;
        }
    );
        </div>
    `;
}


// =====================================================
// LOAD EMERGENCY EVENTS
// =====================================================

async function loadEmergencyEvents() {
let cachedEmergencyEvents = [];

    const table =
        document.getElementById("emergencyTable");

async function loadEmergencyEvents() {

    if (!table) {
        return;
    }
    const table =
        document.getElementById(
            "emergencyTable"
        );

    const overview =
        document.getElementById(
            "overviewEmergency"
        );

    const { data, error } =
        await supabaseClient
@@ -765,9 +995,11 @@ async function loadEmergencyEvents() {
            `)
            .order(
                "detected_at",
                { ascending: false }
            );

                {
                    ascending: false
                }
            )
            .limit(100);

    if (error) {

@@ -779,115 +1011,235 @@ async function loadEmergencyEvents() {
        return;
    }

    cachedEmergencyEvents =
        data || [];

    const active =
        data.filter(event =>
            event.response_status !== "Resolved"
        cachedEmergencyEvents.filter(
            event =>
                String(
                    event.response_status || ""
                ).toLowerCase() !==
                "resolved"
        );


    const activeEmergencies =
        document.getElementById(
            "activeEmergencies"
        );


    if (activeEmergencies) {

        activeEmergencies.textContent =
            active.length;
    }

    if (table) {

        if (!cachedEmergencyEvents.length) {

            table.innerHTML = `
                <tr>
                    <td colspan="5" class="table-empty">
                        No emergency events recorded.
                    </td>
                </tr>
            `;

        } else {

            table.innerHTML =
                cachedEmergencyEvents
                    .map(event => {

                        const unit =
                            event.units?.unit_name ||
                            event.units?.unit_id ||
                            "Unknown";

                        return `
                            <tr>

                                <td>
                                    ${formatDate(
                                        event.detected_at
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(unit)}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        event.emergency_type ||
                                        "Emergency"
                                    )}
                                </td>

                                <td>
                                    <span class="
                                        table-badge
                                        ${getSeverityClass(
                                            event.severity
                                        )}
                                    ">
                                        ${escapeHTML(
                                            event.severity ||
                                            "Unknown"
                                        )}
                                    </span>
                                </td>

                                <td>
                                    ${escapeHTML(
                                        event.response_status ||
                                        "Pending"
                                    )}
                                </td>

                            </tr>
                        `;

                    }).join("");
        }
    }

    renderOverviewEmergencies(
        cachedEmergencyEvents
    );
}

    if (!data.length) {

        table.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="table-empty"
                >
                    No emergency events recorded.
                </td>
            </tr>
// =====================================================
// OVERVIEW EMERGENCIES
// =====================================================

function renderOverviewEmergencies(events) {

    const container =
        document.getElementById(
            "overviewEmergency"
        );

    if (!container) {
        return;
    }

    const active =
        events.filter(event =>
            String(
                event.response_status || ""
            ).toLowerCase() !==
            "resolved"
        );

    if (!active.length) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✓</div>
                <strong>No active emergencies</strong>
                <span>
                    No unresolved emergency events are currently recorded.
                </span>
            </div>
        `;

        return;
    }

    container.innerHTML =
        active
            .slice(0, 4)
            .map(event => {

    table.innerHTML =
        data.map(event => {
                const unit =
                    event.units?.unit_name ||
                    event.units?.unit_id ||
                    "Unknown unit";

            const unit =
                event.units?.unit_name ||
                event.units?.unit_id ||
                "Unknown";
                const location =
                    event.units?.location ||
                    "Location unavailable";

                return `
                    <div class="overview-emergency-row">

            return `
                <tr>
                        <div class="overview-emergency-icon">
                            🚨
                        </div>

                    <td>
                        ${formatDate(
                            event.detected_at
                        )}
                    </td>
                        <div class="overview-emergency-main">

                    <td>
                        ${escapeHTML(unit)}
                    </td>
                            <strong>
                                ${escapeHTML(
                                    event.emergency_type ||
                                    "Emergency"
                                )}
                            </strong>

                    <td>
                        ${escapeHTML(
                            event.emergency_type
                        )}
                    </td>
                            <span>
                                ${escapeHTML(unit)}
                                ·
                                ${escapeHTML(location)}
                            </span>

                    <td>
                        ${escapeHTML(
                            event.severity
                        )}
                    </td>
                        </div>

                    <td>
                        ${escapeHTML(
                            event.response_status
                        )}
                    </td>
                        <div class="overview-emergency-side">

                </tr>
            `;
                            <span class="
                                table-badge
                                ${getSeverityClass(
                                    event.severity
                                )}
                            ">
                                ${escapeHTML(
                                    event.severity ||
                                    "Unknown"
                                )}
                            </span>

        }).join("");
                            <small>
                                ${formatRelativeTime(
                                    event.detected_at
                                )}
                            </small>

                        </div>

                    </div>
                `;

            }).join("");
}


// =====================================================
// LOAD USER REPORTS
// =====================================================

async function loadUserReports() {

    const table =
        document.getElementById("reportsTable");
let cachedReports = [];


    if (!table) {
        return;
    }
async function loadUserReports() {

    const table =
        document.getElementById(
            "reportsTable"
        );

    const { data, error } =
        await supabaseClient
            .from("user_reports")
            .select("*")
            .order(
                "reported_at",
                { ascending: false }
            );

                {
                    ascending: false
                }
            )
            .limit(100);

    if (error) {

@@ -896,41 +1248,41 @@ async function loadUserReports() {
            error
        );

        table.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="table-empty"
                >
                    Unable to load user reports.
                </td>
            </tr>
        `;
        if (table) {
            table.innerHTML = `
                <tr>
                    <td colspan="5" class="table-empty">
                        Unable to load user reports.
                    </td>
                </tr>
            `;
        }

        return;
    }

    cachedReports =
        data || [];

    const userReports =
        document.getElementById(
            "userReports"
        );


    if (userReports) {
        userReports.textContent =
            data.length;
            cachedReports.length;
    }

    if (!table) {
        return;
    }

    if (!data.length) {
    if (!cachedReports.length) {

        table.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="table-empty"
                >
                <td colspan="5" class="table-empty">
                    No user reports received.
                </td>
            </tr>
@@ -939,55 +1291,65 @@ async function loadUserReports() {
        return;
    }


    table.innerHTML =
        data.map(report => {
        cachedReports
            .map(report => {

            return `
                <tr>
                return `
                    <tr>

                    <td>
                        ${formatDate(
                            report.reported_at
                        )}
                    </td>
                        <td>
                            ${formatDate(
                                report.reported_at
                            )}
                        </td>

                    <td>
                        ${escapeHTML(
                            report.emergency_type
                        )}
                    </td>
                        <td>
                            <span class="report-type-badge">
                                ${escapeHTML(
                                    report.emergency_type ||
                                    "Report"
                                )}
                            </span>
                        </td>

                    <td>
                        ${escapeHTML(
                            report.location
                        )}
                    </td>
                        <td>
                            ${escapeHTML(
                                report.location ||
                                "Unknown"
                            )}
                        </td>

                    <td>
                        ${escapeHTML(
                            report.description ||
                            "No description"
                        )}
                    </td>
                        <td class="description-cell">
                            ${escapeHTML(
                                report.description ||
                                "No description"
                            )}
                        </td>

                    <td>
                        ${escapeHTML(
                            report.status
                        )}
                    </td>
                        <td>
                            <span class="status-label">
                                ${escapeHTML(
                                    report.status ||
                                    "Pending"
                                )}
                            </span>
                        </td>

                </tr>
            `;
                    </tr>
                `;

        }).join("");
            }).join("");
}


// =====================================================
// LOAD OFFICIAL ALERTS
// LOAD OFFICIAL / EXTERNAL ALERTS
// =====================================================

let cachedAlerts = [];


async function loadOfficialAlerts() {

    const desktopContainer =
@@ -1000,16 +1362,17 @@ async function loadOfficialAlerts() {
            "mobileAlertsList"
        );


    const { data, error } =
        await supabaseClient
            .from("external_alerts")
            .select("*")
            .order(
                "issued_at",
                { ascending: false }
            );

                {
                    ascending: false
                }
            )
            .limit(100);

    if (error) {

@@ -1018,246 +1381,639 @@ async function loadOfficialAlerts() {
            error
        );

        const message = `
            <div class="empty-state panel-empty">
                <div class="empty-icon">!</div>
                <strong>Unable to load alerts</strong>
                <span>
                    Please check the system connection.
                </span>
            </div>
        `;

        if (desktopContainer) {
            desktopContainer.innerHTML =
                message;
        }

            desktopContainer.innerHTML = `
                <div class="empty-state panel-empty">
                    Unable to load official alerts.
                </div>
            `;

        if (mobileContainer) {
            mobileContainer.innerHTML =
                message;
        }

        return;
    }

        if (mobileContainer) {
    cachedAlerts =
        data || [];

            mobileContainer.innerHTML = `
                <div class="mobile-empty-alerts">
    const externalAlerts =
        document.getElementById(
            "externalAlerts"
        );

                    <div>!</div>
    if (externalAlerts) {
        externalAlerts.textContent =
            cachedAlerts.length;
    }

                    <strong>
                        Unable to load alerts
                    </strong>
    renderDesktopAlerts(
        desktopContainer,
        cachedAlerts
    );

                    <span>
                        Please check the system connection.
                    </span>
    renderMobileAlerts(
        mobileContainer,
        cachedAlerts
    );

    updateAlertPreview(
        cachedAlerts
    );
}


// =====================================================
// DESKTOP ALERT RENDER
// =====================================================

function renderDesktopAlerts(
    container,
    alerts
) {

    if (!container) {
        return;
    }

    if (!alerts.length) {

        container.innerHTML = `
            <div class="empty-state panel-empty">

                <div class="empty-icon">
                    ✓
                </div>

                <strong>
                    No alerts recorded
                </strong>

                <span>
                    External advisories and local announcements will appear here.
                </span>

            </div>
        `;

        return;
    }

    container.innerHTML =
        alerts.map(alert => {

            const classification =
                getAlertClassification(alert);

            const classificationClass =
                getAlertSourceClass(alert);

            const severityClass =
                getSeverityClass(
                    alert.severity
                );

            return `
                <article
                    class="
                        alert-card
                        ${classificationClass}
                    "
                >

                    <div class="alert-card-top">

                        <div class="alert-icon-box">
                            ${getAlertIcon(alert)}
                        </div>

                        <div class="alert-card-title">

                            <div class="alert-badges">

                                <span class="
                                    classification-badge
                                    ${classificationClass}
                                ">
                                    ${escapeHTML(
                                        classification
                                    )}
                                </span>

                                ${
                                    alert.severity
                                    ? `
                                        <span class="
                                            severity-badge
                                            ${severityClass}
                                        ">
                                            ${escapeHTML(
                                                alert.severity
                                            )}
                                        </span>
                                    `
                                    : ""
                                }

                            </div>

                            <h4>
                                ${escapeHTML(
                                    alert.title ||
                                    "Untitled alert"
                                )}
                            </h4>

                        </div>

                    </div>

                    <div class="alert-information">

                        <div class="alert-meta-grid">

                            <div>
                                <span>Source</span>
                                <strong>
                                    ${escapeHTML(
                                        alert.source ||
                                        "Unknown source"
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Type</span>
                                <strong>
                                    ${escapeHTML(
                                        alert.alert_type ||
                                        "Advisory"
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Location</span>
                                <strong>
                                    ${escapeHTML(
                                        alert.location ||
                                        "Not specified"
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>Issued</span>
                                <strong>
                                    ${formatDate(
                                        alert.issued_at
                                    )}
                                </strong>
                            </div>

                        </div>

                        <p class="alert-description">
                            ${escapeHTML(
                                alert.description ||
                                "No additional information."
                            )}
                        </p>

                    </div>

                    <div class="alert-card-footer">

                        <span>
                            ${classification === "Community Report"
                                ? "Reported through LICAS"
                                : "Information displayed from external source"}
                        </span>

                        ${getSourceLink(alert)}

                    </div>

                </article>
            `;

        }
        }).join("");
}


// =====================================================
// MOBILE ALERT RENDER
// =====================================================

function renderMobileAlerts(
    container,
    alerts
) {

    if (!container) {
        return;
    }

    if (!alerts.length) {

        container.innerHTML = `
            <div class="mobile-empty-alerts">

                <div>✓</div>

                <strong>
                    No alerts recorded
                </strong>

                <span>
                    Official advisories and local announcements will appear here.
                </span>

            </div>
        `;

        return;
    }

    container.innerHTML =
        alerts.map(alert => {

            const classification =
                getAlertClassification(alert);

            const classificationClass =
                getAlertSourceClass(alert);

            return `
                <article
                    class="
                        mobile-official-alert
                        ${classificationClass}
                    "
                >

                    <div class="mobile-alert-heading">

                        <div class="mobile-alert-icon">
                            ${getAlertIcon(alert)}
                        </div>

                        <div>

                            <div class="alert-badges">

                                <span class="
                                    classification-badge
                                    ${classificationClass}
                                ">
                                    ${escapeHTML(
                                        classification
                                    )}
                                </span>

                                ${
                                    alert.severity
                                    ? `
                                        <span class="
                                            severity-badge
                                            ${getSeverityClass(
                                                alert.severity
                                            )}
                                        ">
                                            ${escapeHTML(
                                                alert.severity
                                            )}
                                        </span>
                                    `
                                    : ""
                                }

                            </div>

                            <h3>
                                ${escapeHTML(
                                    alert.title ||
                                    "Untitled alert"
                                )}
                            </h3>

                        </div>

                    </div>

    const alertCount =
        data.length;
                    <p>
                        ${escapeHTML(
                            alert.description ||
                            "No additional information."
                        )}
                    </p>

                    <div class="mobile-alert-details">

                        <div>
                            <span>Source</span>
                            <strong>
                                ${escapeHTML(
                                    alert.source ||
                                    "Unknown"
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>Type</span>
                            <strong>
                                ${escapeHTML(
                                    alert.alert_type ||
                                    "Advisory"
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>Location</span>
                            <strong>
                                ${escapeHTML(
                                    alert.location ||
                                    "Not specified"
                                )}
                            </strong>
                        </div>

                    </div>

                    <div class="alert-meta">

                        <span>
                            ${formatDate(
                                alert.issued_at
                            )}
                        </span>

                        ${getSourceLink(alert)}

    const externalAlerts =
        document.getElementById(
            "externalAlerts"
        );
                    </div>

                </article>
            `;

    if (externalAlerts) {
        }).join("");
}

        externalAlerts.textContent =
            alertCount;

    }
// =====================================================
// ALERT PREVIEW
// =====================================================

function updateAlertPreview(alerts) {

    /*
       DESKTOP
    */
    const previewTitle =
        document.getElementById(
            "mobileAlertPreviewTitle"
        );

    if (desktopContainer) {
    const previewText =
        document.getElementById(
            "mobileAlertPreviewText"
        );

        if (!data.length) {
    if (!previewTitle || !previewText) {
        return;
    }

            desktopContainer.innerHTML = `
                <div class="empty-state panel-empty">
    if (!alerts.length) {

                    <div class="empty-icon">
                        ✓
                    </div>
        previewTitle.textContent =
            "No current alerts";

                    <strong>
                        No official alerts
                    </strong>
        previewText.textContent =
            "Official advisories and local announcements will appear here.";

                    <span>
                        No official advisories are currently recorded.
                    </span>
        return;
    }

                </div>
            `;
    const first =
        alerts[0];

        } else {
    previewTitle.textContent =
        first.title ||
        "New official information";

            desktopContainer.innerHTML =
                data.map(alert => {
    previewText.textContent =
        `${first.source || "External source"} · ${
            first.alert_type || "Advisory"
        }`;
}

                    return `
                        <div class="alert-card">

                            <h4>
                                ${escapeHTML(
                                    alert.title
                                )}
                            </h4>
// =====================================================
// OVERVIEW RECENT ACTIVITY
// =====================================================

                            <p>
async function loadOverviewActivity() {

                                <strong>
                                    ${escapeHTML(
                                        alert.source
                                    )}
                                </strong>
    const container =
        document.getElementById(
            "overviewActivity"
        );

                                ·
    if (!container) {
        return;
    }

                                ${escapeHTML(
                                    alert.alert_type
                                )}
    const emergency =
        cachedEmergencyEvents[0];

                            </p>
    const report =
        cachedReports[0];

                            <p>
                                ${escapeHTML(
                                    alert.description ||
                                    "No additional information."
                                )}
                            </p>
    const alert =
        cachedAlerts[0];

                            <p>
                                Issued:
                                ${formatDate(
                                    alert.issued_at
                                )}
                            </p>
    const activities = [];

                        </div>
                    `;
    if (emergency) {

                }).join("");
        }
        activities.push({
            type: "Emergency",
            title:
                emergency.emergency_type ||
                "Emergency event",
            description:
                "Monitoring unit detected an emergency event.",
            time:
                emergency.detected_at,
            icon: "🚨"
        });
    }

    if (report) {

        activities.push({
            type: "Report",
            title:
                report.emergency_type ||
                "Community report",
            description:
                report.location ||
                "Location provided by reporter.",
            time:
                report.reported_at,
            icon: "▤"
        });
    }

    /*
       MOBILE
    */

    if (mobileContainer) {

        if (!data.length) {
    if (alert) {

        activities.push({
            type:
                getAlertClassification(alert),
            title:
                alert.title ||
                "External alert",
            description:
                alert.source ||
                "External source",
            time:
                alert.issued_at,
            icon: "⚠"
        });
    }

            mobileContainer.innerHTML = `
                <div class="mobile-empty-alerts">
    activities.sort(
        (a, b) =>
            new Date(b.time) -
            new Date(a.time)
    );

                    <div>✓</div>
    if (!activities.length) {

                    <strong>
                        No active official alerts
                    </strong>
        container.innerHTML = `
            <div class="empty-state compact-empty">
                <strong>No recent activity</strong>
                <span>
                    New system activity will appear here.
                </span>
            </div>
        `;

                    <span>
                        Official PHIVOLCS and NDRRMC
                        advisories will appear here.
                    </span>
        return;
    }

                </div>
            `;
    container.innerHTML =
        activities
            .slice(0, 6)
            .map(activity => {

        } else {
                return `
                    <div class="activity-row">

            mobileContainer.innerHTML =
                data.map(alert => {
                        <div class="activity-icon">
                            ${activity.icon}
                        </div>

                    return `
                        <article
                            class="mobile-official-alert"
                        >
                        <div class="activity-content">

                            <h3>
                            <strong>
                                ${escapeHTML(
                                    alert.title
                                    activity.title
                                )}
                            </h3>
                            </strong>

                            <p>
                            <span>
                                ${escapeHTML(
                                    activity.type
                                )}
                                ·
                                ${escapeHTML(
                                    alert.description ||
                                    "No additional information."
                                    activity.description
                                )}
                            </p>
                            </span>

                            <div class="alert-meta">
                        </div>

                                <span>
                                    ${escapeHTML(
                                        alert.source
                                    )}
                                </span>
                        <small>
                            ${formatRelativeTime(
                                activity.time
                            )}
                        </small>

                                <span>
                                    ${formatDate(
                                        alert.issued_at
                                    )}
                                </span>
                    </div>
                `;

                            </div>
            }).join("");
}

                        </article>
                    `;

                }).join("");
        }
    }
// =====================================================
// DASHBOARD REFRESH
// =====================================================

async function loadDashboard() {

    /*
       HOME PREVIEW
    */
    console.log(
        "Refreshing LICAS dashboard..."
    );

    const previewTitle =
        document.getElementById(
            "mobileAlertPreviewTitle"
        );
    await Promise.all([
        loadUnits(),
        loadLatestSensorReadings(),
        loadEmergencyEvents(),
        loadUserReports(),
        loadOfficialAlerts()
    ]);

    const previewText =
    await loadOverviewActivity();

    const lastUpdate =
        document.getElementById(
            "mobileAlertPreviewText"
            "lastUpdate"
        );

    if (lastUpdate) {

    if (previewTitle && previewText) {
        lastUpdate.textContent =
            new Date().toLocaleTimeString(
                "en-PH",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                }
            );
    }

        if (!data.length) {
    updateMobileConnectionStatus();
}

            previewTitle.textContent =
                "No active official alerts";

            previewText.textContent =
                "PHIVOLCS / NDRRMC advisories will appear here.";
// =====================================================
// MOBILE CONNECTION STATUS
// =====================================================

        } else {
function updateMobileConnectionStatus() {

            previewTitle.textContent =
                `${data.length} official alert${
                    data.length === 1 ? "" : "s"
                } available`;
    const element =
        document.getElementById(
            "mobileConnectionStatus"
        );

            previewText.textContent =
                data[0].title;
        }
    if (!element) {
        return;
    }

    element.textContent =
        "Online";
}


@@ -1275,7 +2031,6 @@ function showMobilePage(
            ".mobile-page"
        );


    mobilePages.forEach(page => {

        page.classList.remove(
@@ -1284,33 +2039,25 @@ function showMobilePage(

    });


    const target =
        document.getElementById(pageId);


    if (target) {

        target.classList.add(
            "active-mobile-page"
        );

    }


    const navItems =
        document.querySelectorAll(
            ".mobile-nav-item"
        );


    navItems.forEach(item => {

        item.classList.remove("active");

    });


    if (navId) {

        const nav =
@@ -1319,26 +2066,21 @@ function showMobilePage(
        if (nav) {
            nav.classList.add("active");
        }

    }


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    if (pageId === "mobileAlertsPage") {

        loadOfficialAlerts();

    }
}


// =====================================================
// MOBILE HOME NAVIGATION
// MOBILE NAV EVENTS
// =====================================================

document
@@ -1356,10 +2098,6 @@ document
    );


// =====================================================
// MOBILE REPORT BUTTON
// =====================================================

document
    .getElementById("mobileReportButton")
    ?.addEventListener(
@@ -1375,10 +2113,6 @@ document
    );


// =====================================================
// MOBILE REPORT NAV
// =====================================================

document
    .getElementById("mobileReportNav")
    ?.addEventListener(
@@ -1394,10 +2128,6 @@ document
    );


// =====================================================
// MOBILE REPORT BACK
// =====================================================

document
    .getElementById("mobileReportBack")
    ?.addEventListener(
@@ -1413,10 +2143,6 @@ document
    );


// =====================================================
// MOBILE ALERT CARD
// =====================================================

document
    .getElementById("mobileAlertsButton")
    ?.addEventListener(
@@ -1432,10 +2158,6 @@ document
    );


// =====================================================
// MOBILE ALERT NAV
// =====================================================

document
    .getElementById("mobileAlertsNav")
    ?.addEventListener(
@@ -1451,10 +2173,6 @@ document
    );


// =====================================================
// MOBILE ALERT BACK
// =====================================================

document
    .getElementById("mobileAlertsBack")
    ?.addEventListener(
@@ -1479,7 +2197,6 @@ const mobileReportForm =
        "mobileReportForm"
    );


if (mobileReportForm) {

    mobileReportForm.addEventListener(
@@ -1488,7 +2205,6 @@ if (mobileReportForm) {

            event.preventDefault();


            const submitButton =
                document.getElementById(
                    "mobileSubmitReport"
@@ -1499,7 +2215,6 @@ if (mobileReportForm) {
                    "mobileReportResult"
                );


            const emergencyType =
                document.getElementById(
                    "mobileEmergencyType"
@@ -1525,27 +2240,21 @@ if (mobileReportForm) {
                    "mobileReporterName"
                ).value.trim();


            submitButton.disabled = true;

            submitButton.textContent =
                "SENDING REPORT...";


            result.hidden = true;

            result.className =
                "mobile-result";


            const { error } =
                await supabaseClient
                    .from("user_reports")
                    .insert([
                        {

                            reporter_name:
                                reporterName || null,
                                reporterName ||
                                null,

                            emergency_type:
                                emergencyType,
@@ -1554,23 +2263,21 @@ if (mobileReportForm) {
                                location,

                            description:
                                description || null,
                                description ||
                                null,

                            status:
                                "Pending"

                        }
                    ]);


            if (error) {

                console.error(
                    "REPORT SUBMISSION ERROR:",
                    error
                );


                result.hidden = false;

                result.className =
@@ -1579,7 +2286,6 @@ if (mobileReportForm) {
                result.textContent =
                    "Unable to send the emergency report. Please try again.";


                submitButton.disabled = false;

                submitButton.textContent =
@@ -1588,11 +2294,6 @@ if (mobileReportForm) {
                return;
            }


            /*
               SUCCESS
            */

            result.hidden = false;

            result.className =
@@ -1601,27 +2302,15 @@ if (mobileReportForm) {
            result.textContent =
                "Emergency report sent successfully. Administrators have been notified.";


            mobileReportForm.reset();


            submitButton.disabled = false;

            submitButton.textContent =
                "SEND EMERGENCY REPORT";


            /*
               Update admin report count.
            */

            await loadUserReports();


            /*
               Return to home after a short delay.
            */

            setTimeout(() => {

                showMobilePage(
@@ -1632,54 +2321,11 @@ if (mobileReportForm) {
                result.hidden = true;

            }, 2200);

        }
    );
}


// =====================================================
// DASHBOARD REFRESH
// =====================================================

async function loadDashboard() {

    console.log(
        "Refreshing LICAS dashboard..."
    );


    await Promise.all([

        loadUnits(),

        loadLatestSensorReadings(),

        loadEmergencyEvents(),

        loadUserReports(),

        loadOfficialAlerts()

    ]);


    const lastUpdate =
        document.getElementById(
            "lastUpdate"
        );


    if (lastUpdate) {

        lastUpdate.textContent =
            "Just now";

    }

}


// =====================================================
// REFRESH BUTTON
// =====================================================
@@ -1699,24 +2345,48 @@ document
loadDashboard();


console.log(
    "LICAS system initialized."
);


// =====================================================
// LIVE SENSOR REFRESH
// LIVE DATABASE REFRESH
// =====================================================
//
// Unit cards and latest readings refresh every 5 seconds.
// This means the dashboard can reflect new ESP32 data
// without requiring a manual browser refresh.
//

setInterval(
    async () => {

        console.log(
            "Live sensor refresh..."
            "Live LICAS database refresh..."
        );

        await loadUnits();
        await loadLatestSensorReadings();

    },
    5000
);


// Refresh broader information every 15 seconds.

setInterval(
    async () => {

        await Promise.all([
            loadEmergencyEvents(),
            loadUserReports(),
            loadOfficialAlerts()
        ]);

        await loadOverviewActivity();

    },
    15000
);


console.log(
    "LICAS system initialized."
);

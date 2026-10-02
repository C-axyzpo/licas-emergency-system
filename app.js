```javascript
console.log("LICAS app.js loaded");

// =====================================================
// SUPABASE CONNECTION
// =====================================================

const SUPABASE_URL =
    "https://gqnyqaxwgfkdglkjuidc.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_Ld7RcE6is_Ln_iAcqMYVLg_MZw58l3c";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// =====================================================
// CONFIGURATION
// =====================================================

const UNIT_ONLINE_WINDOW_MS = 60 * 1000;


// =====================================================
// HELPERS
// =====================================================

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatDate(date) {

    if (!date) {
        return "Unknown";
    }

    const parsed = new Date(date);

    if (isNaN(parsed.getTime())) {
        return "Unknown";
    }

    return parsed.toLocaleString(
        "en-PH",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );
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
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "Unavailable";
    }

    const number = Number(value);

    if (isNaN(number)) {
        return "Unavailable";
    }

    return number.toFixed(decimals);
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

const navButtons =
    document.querySelectorAll(".nav-button");

const pages =
    document.querySelectorAll(".page");

const pageTitle =
    document.getElementById("pageTitle");


navButtons.forEach(button => {

    button.addEventListener("click", async () => {

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

        if (targetPage === "overview") {
            await loadDashboard();
        }

        if (targetPage === "reports") {
            await loadUserReports();
        }

        if (targetPage === "alerts") {
            await loadOfficialAlerts();
        }

        if (targetPage === "emergencies") {
            await loadEmergencyEvents();
        }

        if (targetPage === "units") {
            await loadUnits();
            await loadLatestSensorReadings();
        }
    });
});


// =====================================================
// TIME
// =====================================================

function updateTime() {

    const element =
        document.getElementById("currentTime");

    if (!element) {
        return;
    }

    element.textContent =
        new Date().toLocaleTimeString(
            "en-PH",
            {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            }
        );
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

        return [];
    }

    cachedUnits = data || [];

    const onlineCount =
        cachedUnits.filter(unit =>
            isUnitOnline(unit.last_seen)
        ).length;

    const onlineUnits =
        document.getElementById("onlineUnits");

    if (onlineUnits) {
        onlineUnits.textContent =
            onlineCount;
    }

    const monitorUnits =
        document.getElementById("monitorUnits");

    if (monitorUnits) {
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
        document.getElementById(
            "unitsContainer"
        );

    if (!container) {
        return cachedUnits;
    }

    if (!cachedUnits.length) {

        container.innerHTML = `
            <div class="empty-state panel-empty">

                <div class="empty-icon">
                    ◈
                </div>

                <strong>
                    No monitoring units found
                </strong>

                <span>
                    LICAS has not received any registered monitoring units yet.
                </span>

            </div>
        `;

        return cachedUnits;
    }

    container.innerHTML =
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

            const online =
                isUnitOnline(
                    unit.last_seen
                );

            return `
                <article
                    class="unit-card ${
                        online
                            ? "unit-online"
                            : "unit-offline"
                    }"
                    data-unit-id="${escapeHTML(unit.id)}"
                >

                    <div class="unit-top">

                        <div>

                            <div class="unit-name">
                                ${escapeHTML(displayUnitID)}
                            </div>

                            <div class="unit-location">
                                ${escapeHTML(location)}
                                ${
                                    floor
                                        ? " · " +
                                          escapeHTML(floor)
                                        : ""
                                }
                            </div>

                        </div>

                        <div
                            class="unit-status ${
                                online
                                    ? "online"
                                    : "offline"
                            }"
                        >

                            <span class="status-dot"></span>

                            ${
                                online
                                    ? "CONNECTED"
                                    : "OFFLINE"
                            }

                        </div>

                    </div>

                    <div class="unit-details">

                        <div class="unit-detail">

                            <span>
                                Unit ID
                            </span>

                            <strong>
                                ${escapeHTML(displayUnitID)}
                            </strong>

                        </div>

                        <div class="unit-detail">

                            <span>
                                Database ID
                            </span>

                            <strong>
                                ${escapeHTML(unit.id)}
                            </strong>

                        </div>

                        <div class="unit-detail">

                            <span>
                                Last Seen
                            </span>

                            <strong>
                                ${formatRelativeTime(
                                    unit.last_seen
                                )}
                            </strong>

                        </div>

                        <div class="unit-detail">

                            <span>
                                Last Database Update
                            </span>

                            <strong>
                                ${formatDate(
                                    unit.last_seen
                                )}
                            </strong>

                        </div>

                    </div>

                    <div class="unit-sensors">

                        <div class="sensor-loading">
                            Loading latest sensor data...
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
            .select("*")
            .order(
                "recorded_at",
                {
                    ascending: false
                }
            )
            .limit(200);

    if (error) {

        console.error(
            "SENSOR READINGS DATABASE ERROR:",
            error
        );

        return;
    }

    if (!data || !data.length) {
        cachedLatestReadings = {};
        updateOverviewSensorSummary();
        return;
    }

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

    Object.entries(latestByUnit)
        .forEach(
            ([unitId, reading]) => {

                const card =
                    document.querySelector(
                        `.unit-card[data-unit-id="${unitId}"]`
                    );

                if (!card) {
                    return;
                }

                const sensorContainer =
                    card.querySelector(
                        ".unit-sensors"
                    );

                if (!sensorContainer) {
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

                let sensorStatus =
                    "Monitoring";

                if (
                    reading.human_presence === true
                ) {
                    sensorStatus =
                        "PRESENCE";
                }

                if (
                    reading.vibration_level !== null &&
                    Number(
                        reading.vibration_level
                    ) >= 0.20
                ) {
                    sensorStatus =
                        "MOVEMENT";
                }

                if (
                    reading.smoke_level !== null &&
                    reading.smoke_level !== undefined
                ) {
                    sensorStatus =
                        "SMOKE MONITORING";
                }

                sensorContainer.innerHTML = `

                    <div class="unit-sensor-header">

                        <strong>
                            Latest Sensor Reading
                        </strong>

                        <span class="sensor-status">
                            ${escapeHTML(
                                sensorStatus
                            )}
                        </span>

                    </div>

                    <div class="sensor-grid">

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

                        <div class="sensor-item">
                            <span>Vibration</span>

                            <strong>
                                ${escapeHTML(
                                    vibration
                                )} g
                            </strong>
                        </div>

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

                    </div>

                    <div class="sensor-last-reading">

                        <span>
                            Recorded
                        </span>

                        <strong>
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


// =====================================================
// OVERVIEW SENSOR SUMMARY
// =====================================================

function updateOverviewSensorSummary() {

    const container =
        document.getElementById(
            "overviewSensorSummary"
        );

    if (!container) {
        return;
    }

    const readings =
        Object.values(
            cachedLatestReadings
        );

    if (!readings.length) {

        container.innerHTML = `
            <div class="empty-state compact-empty">

                <strong>
                    No sensor readings yet
                </strong>

                <span>
                    Latest ESP32 sensor values will appear here.
                </span>

            </div>
        `;

        return;
    }

    let presenceCount = 0;
    let movementCount = 0;
    let smokeAvailable = 0;

    readings.forEach(reading => {

        if (
            reading.human_presence === true
        ) {
            presenceCount++;
        }

        if (
            reading.vibration_level !== null &&
            Number(
                reading.vibration_level
            ) >= 0.20
        ) {
            movementCount++;
        }

        if (
            reading.smoke_level !== null &&
            reading.smoke_level !== undefined
        ) {
            smokeAvailable++;
        }
    });

    container.innerHTML = `

        <div class="overview-mini-grid">

            <div class="overview-mini-card">
                <span>Units Reporting</span>
                <strong>
                    ${readings.length}
                </strong>
            </div>

            <div class="overview-mini-card">
                <span>Presence Detected</span>
                <strong>
                    ${presenceCount}
                </strong>
            </div>

            <div class="overview-mini-card">
                <span>Movement Signals</span>
                <strong>
                    ${movementCount}
                </strong>
            </div>

            <div class="overview-mini-card">
                <span>Smoke Data Available</span>
                <strong>
                    ${smokeAvailable}
                </strong>
            </div>

        </div>
    `;
}


// =====================================================
// LOAD EMERGENCY EVENTS
// =====================================================

let cachedEmergencyEvents = [];


async function loadEmergencyEvents() {

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
            .from("emergency_events")
            .select(`
                *,
                units (
                    unit_name,
                    unit_id,
                    location
                )
            `)
            .order(
                "detected_at",
                {
                    ascending: false
                }
            )
            .limit(100);

    if (error) {

        console.error(
            "EMERGENCY DATABASE ERROR:",
            error
        );

        return;
    }

    cachedEmergencyEvents =
        data || [];

    const active =
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
                    <td
                        colspan="5"
                        class="table-empty"
                    >
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

                <div class="empty-icon">
                    ✓
                </div>

                <strong>
                    No active emergencies
                </strong>

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

                const unit =
                    event.units?.unit_name ||
                    event.units?.unit_id ||
                    "Unknown unit";

                const location =
                    event.units?.location ||
                    "Location unavailable";

                return `
                    <div class="overview-emergency-row">

                        <div class="overview-emergency-icon">
                            🚨
                        </div>

                        <div class="overview-emergency-main">

                            <strong>
                                ${escapeHTML(
                                    event.emergency_type ||
                                    "Emergency"
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(unit)}
                                ·
                                ${escapeHTML(location)}
                            </span>

                        </div>

                        <div class="overview-emergency-side">

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

let cachedReports = [];


async function loadUserReports() {

    console.log("Loading LICAS user reports...");

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
                {
                    ascending: false
                }
            )
            .limit(100);

    if (error) {

        console.error(
            "USER REPORT DATABASE ERROR:",
            error
        );

        if (table) {

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
        }

        return;
    }

    cachedReports =
        data || [];

    updateUserReportCount();

    if (!table) {
        return;
    }

    if (!cachedReports.length) {

        table.innerHTML = `
            <tr>

                <td
                    colspan="5"
                    class="table-empty"
                >
                    No user reports received.
                </td>

            </tr>
        `;

        return;
    }

    table.innerHTML =
        cachedReports
            .map(report => {

                const reportStatus =
                    report.status ||
                    "Pending";

                return `
                    <tr>

                        <td>
                            ${formatDate(
                                report.reported_at
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
                                report.location ||
                                "Unknown"
                            )}
                        </td>

                        <td class="description-cell">

                            ${escapeHTML(
                                report.description ||
                                "No description"
                            )}

                        </td>

                        <td>

                            <span class="status-label">

                                ${escapeHTML(
                                    reportStatus
                                )}

                            </span>

                        </td>

                    </tr>
                `;

            }).join("");
}


function updateUserReportCount() {

    const userReports =
        document.getElementById(
            "userReports"
        );

    if (userReports) {

        userReports.textContent =
            cachedReports.length;
    }
}


// =====================================================
// MOBILE REPORT VALIDATION
// =====================================================

function getMobileReportFields() {

    return {
        emergencyType:
            document.getElementById(
                "mobileEmergencyType"
            ),

        location:
            document.getElementById(
                "mobileLocation"
            ),

        severity:
            document.getElementById(
                "mobileSeverity"
            ),

        description:
            document.getElementById(
                "mobileDescription"
            ),

        reporterName:
            document.getElementById(
                "mobileReporterName"
            )
    };
}


// =====================================================
// MOBILE REPORT SUBMISSION
// =====================================================

const mobileReportForm =
    document.getElementById(
        "mobileReportForm"
    );


if (mobileReportForm) {

    mobileReportForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const fields =
                getMobileReportFields();

            const submitButton =
                document.getElementById(
                    "mobileSubmitReport"
                );

            const result =
                document.getElementById(
                    "mobileReportResult"
                );


            // -----------------------------------------
            // SAFETY CHECK
            // -----------------------------------------

            if (
                !fields.emergencyType ||
                !fields.location ||
                !fields.severity ||
                !fields.description ||
                !fields.reporterName
            ) {

                console.error(
                    "LICAS report form fields are missing."
                );

                return;
            }


            // -----------------------------------------
            // READ VALUES
            // -----------------------------------------

            const emergencyType =
                fields.emergencyType.value;

            const location =
                fields.location.value;

            const severity =
                fields.severity.value;

            const description =
                fields.description.value.trim();

            const reporterName =
                fields.reporterName.value.trim();


            // -----------------------------------------
            // VALIDATION
            // -----------------------------------------

            if (!emergencyType) {

                showReportResult(
                    result,
                    "error",
                    "Please select the emergency type."
                );

                fields.emergencyType.focus();

                return;
            }


            if (!location) {

                showReportResult(
                    result,
                    "error",
                    "Please select the reporting location."
                );

                fields.location.focus();

                return;
            }


            if (!severity) {

                showReportResult(
                    result,
                    "error",
                    "Please select the severity."
                );

                fields.severity.focus();

                return;
            }


            if (!description) {

                showReportResult(
                    result,
                    "error",
                    "Please provide a short description of what happened."
                );

                fields.description.focus();

                return;
            }


            if (description.length < 5) {

                showReportResult(
                    result,
                    "error",
                    "Please provide a little more detail in the description."
                );

                fields.description.focus();

                return;
            }


            // -----------------------------------------
            // DISABLE BUTTON
            // -----------------------------------------

            submitButton.disabled = true;

            submitButton.textContent =
                "SENDING REPORT...";

            if (result) {
                result.hidden = true;
            }


            // -----------------------------------------
            // DATABASE INSERT
            // -----------------------------------------

            const reportData = {

                reporter_name:
                    reporterName ||
                    null,

                emergency_type:
                    emergencyType,

                location:
                    location,

                severity:
                    severity,

                description:
                    description,

                status:
                    "Pending",

                reported_at:
                    new Date().toISOString()
            };


            console.log(
                "Submitting LICAS report:",
                reportData
            );


            const { data, error } =
                await supabaseClient
                    .from("user_reports")
                    .insert([
                        reportData
                    ])
                    .select()
                    .single();


            // -----------------------------------------
            // DATABASE ERROR
            // -----------------------------------------

            if (error) {

                console.error(
                    "REPORT SUBMISSION ERROR:",
                    error
                );

                let errorMessage =
                    "Unable to send the emergency report. Please try again.";

                if (
                    error.code === "42501" ||
                    error.message
                        ?.toLowerCase()
                        .includes("row-level security")
                ) {

                    errorMessage =
                        "The report was blocked by the database security policy.";
                }

                if (
                    error.message
                        ?.toLowerCase()
                        .includes("column")
                ) {

                    errorMessage =
                        "The report could not be saved because the database fields do not match the form.";
                }

                showReportResult(
                    result,
                    "error",
                    errorMessage
                );

                submitButton.disabled =
                    false;

                submitButton.textContent =
                    "SEND EMERGENCY REPORT";

                return;
            }


            // -----------------------------------------
            // SUCCESS
            // -----------------------------------------

            console.log(
                "LICAS report submitted successfully:",
                data
            );


            showReportResult(
                result,
                "success",
                "Emergency report sent successfully. Administrators have been notified."
            );


            // Clear form
            mobileReportForm.reset();


            // Re-enable button
            submitButton.disabled =
                false;

            submitButton.textContent =
                "SEND EMERGENCY REPORT";


            // -----------------------------------------
            // UPDATE ADMIN DASHBOARD
            // -----------------------------------------

            await loadUserReports();

            await loadOverviewActivity();


            // -----------------------------------------
            // RETURN TO HOME
            // -----------------------------------------

            setTimeout(() => {

                showMobilePage(
                    "mobileHomePage",
                    "mobileHomeNav"
                );

                if (result) {
                    result.hidden = true;
                }

            }, 2200);

        }
    );
}


// =====================================================
// REPORT RESULT MESSAGE
// =====================================================

function showReportResult(
    result,
    type,
    message
) {

    if (!result) {
        return;
    }

    result.hidden = false;

    result.className =
        `mobile-result ${type}`;

    result.textContent =
        message;
}


// =====================================================
// LOAD OFFICIAL / EXTERNAL ALERTS
// =====================================================

let cachedAlerts = [];


async function loadOfficialAlerts() {

    const desktopContainer =
        document.getElementById(
            "alertsContainer"
        );

    const mobileContainer =
        document.getElementById(
            "mobileAlertsList"
        );

    const { data, error } =
        await supabaseClient
            .from("external_alerts")
            .select("*")
            .order(
                "issued_at",
                {
                    ascending: false
                }
            )
            .limit(100);

    if (error) {

        console.error(
            "OFFICIAL ALERT DATABASE ERROR:",
            error
        );

        const message = `
            <div class="empty-state panel-empty">

                <div class="empty-icon">
                    !
                </div>

                <strong>
                    Unable to load alerts
                </strong>

                <span>
                    Please check the system connection.
                </span>

            </div>
        `;

        if (desktopContainer) {
            desktopContainer.innerHTML =
                message;
        }

        if (mobileContainer) {
            mobileContainer.innerHTML =
                message;
        }

        return;
    }

    cachedAlerts =
        data || [];

    const externalAlerts =
        document.getElementById(
            "externalAlerts"
        );

    if (externalAlerts) {

        externalAlerts.textContent =
            cachedAlerts.length;
    }

    renderDesktopAlerts(
        desktopContainer,
        cachedAlerts
    );

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
                            ${
                                classification === "Community Report"
                                    ? "Reported through LICAS"
                                    : "Information displayed from external source"
                            }
                        </span>

                        ${getSourceLink(alert)}

                    </div>

                </article>
            `;

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

                <div>
                    ✓
                </div>

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

                    <p>
                        ${escapeHTML(
                            alert.description ||
                            "No additional information."
                        )}
                    </p>

                    <div class="mobile-alert-details">

                        <div>

                            <span>
                                Source
                            </span>

                            <strong>
                                ${escapeHTML(
                                    alert.source ||
                                    "Unknown"
                                )}
                            </strong>

                        </div>

                        <div>

                            <span>
                                Type
                            </span>

                            <strong>
                                ${escapeHTML(
                                    alert.alert_type ||
                                    "Advisory"
                                )}
                            </strong>

                        </div>

                        <div>

                            <span>
                                Location
                            </span>

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

                    </div>

                </article>
            `;

        }).join("");
}


// =====================================================
// ALERT PREVIEW
// =====================================================

function updateAlertPreview(alerts) {

    const previewTitle =
        document.getElementById(
            "mobileAlertPreviewTitle"
        );

    const previewText =
        document.getElementById(
            "mobileAlertPreviewText"
        );

    if (!previewTitle || !previewText) {
        return;
    }

    if (!alerts.length) {

        previewTitle.textContent =
            "No current alerts";

        previewText.textContent =
            "Official advisories and local announcements will appear here.";

        return;
    }

    const first =
        alerts[0];

    previewTitle.textContent =
        first.title ||
        "New official information";

    previewText.textContent =
        `${first.source || "External source"} · ${
            first.alert_type || "Advisory"
        }`;
}


// =====================================================
// OVERVIEW RECENT ACTIVITY
// =====================================================

async function loadOverviewActivity() {

    const container =
        document.getElementById(
            "overviewActivity"
        );

    if (!container) {
        return;
    }

    const activities = [];


    if (cachedEmergencyEvents.length) {

        const emergency =
            cachedEmergencyEvents[0];

        activities.push({
            type: "Emergency",

            title:
                emergency.emergency_type ||
                "Emergency event",

            description:
                "Monitoring unit detected an emergency event.",

            time:
                emergency.detected_at,

            icon:
                "🚨"
        });
    }


    if (cachedReports.length) {

        const report =
            cachedReports[0];

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

            icon:
                "▤"
        });
    }


    if (cachedAlerts.length) {

        const alert =
            cachedAlerts[0];

        activities.push({
            type:
                getAlertClassification(
                    alert
                ),

            title:
                alert.title ||
                "External alert",

            description:
                alert.source ||
                "External source",

            time:
                alert.issued_at,

            icon:
                "⚠"
        });
    }


    activities.sort(
        (a, b) =>
            new Date(b.time) -
            new Date(a.time)
    );


    if (!activities.length) {

        container.innerHTML = `
            <div class="empty-state compact-empty">

                <strong>
                    No recent activity
                </strong>

                <span>
                    New system activity will appear here.
                </span>

            </div>
        `;

        return;
    }


    container.innerHTML =
        activities
            .slice(0, 6)
            .map(activity => {

                return `
                    <div class="activity-row">

                        <div class="activity-icon">
                            ${activity.icon}
                        </div>

                        <div class="activity-content">

                            <strong>
                                ${escapeHTML(
                                    activity.title
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    activity.type
                                )}
                                ·
                                ${escapeHTML(
                                    activity.description
                                )}
                            </span>

                        </div>

                        <small>
                            ${formatRelativeTime(
                                activity.time
                            )}
                        </small>

                    </div>
                `;

            }).join("");
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

    await loadOverviewActivity();


    const lastUpdate =
        document.getElementById(
            "lastUpdate"
        );

    if (lastUpdate) {

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


    updateMobileConnectionStatus();
}


// =====================================================
// MOBILE CONNECTION STATUS
// =====================================================

function updateMobileConnectionStatus() {

    const element =
        document.getElementById(
            "mobileConnectionStatus"
        );

    if (!element) {
        return;
    }

    element.textContent =
        "Online";
}


// =====================================================
// MOBILE NAVIGATION
// =====================================================

function showMobilePage(
    pageId,
    navId
) {

    const mobilePages =
        document.querySelectorAll(
            ".mobile-page"
        );

    mobilePages.forEach(page => {

        page.classList.remove(
            "active-mobile-page"
        );

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
            document.getElementById(navId);

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
// MOBILE NAV EVENTS
// =====================================================

document
    .getElementById("mobileHomeNav")
    ?.addEventListener(
        "click",
        () => {

            showMobilePage(
                "mobileHomePage",
                "mobileHomeNav"
            );

        }
    );


document
    .getElementById("mobileReportButton")
    ?.addEventListener(
        "click",
        () => {

            showMobilePage(
                "mobileReportPage",
                "mobileReportNav"
            );

        }
    );


document
    .getElementById("mobileReportNav")
    ?.addEventListener(
        "click",
        () => {

            showMobilePage(
                "mobileReportPage",
                "mobileReportNav"
            );

        }
    );


document
    .getElementById("mobileReportBack")
    ?.addEventListener(
        "click",
        () => {

            showMobilePage(
                "mobileHomePage",
                "mobileHomeNav"
            );

        }
    );


document
    .getElementById("mobileAlertsButton")
    ?.addEventListener(
        "click",
        () => {

            showMobilePage(
                "mobileAlertsPage",
                "mobileAlertsNav"
            );

        }
    );


document
    .getElementById("mobileAlertsNav")
    ?.addEventListener(
        "click",
        () => {

            showMobilePage(
                "mobileAlertsPage",
                "mobileAlertsNav"
            );

        }
    );


document
    .getElementById("mobileAlertsBack")
    ?.addEventListener(
        "click",
        () => {

            showMobilePage(
                "mobileHomePage",
                "mobileHomeNav"
            );

        }
    );


// =====================================================
// REFRESH BUTTON
// =====================================================

document
    .getElementById("refreshDashboard")
    ?.addEventListener(
        "click",
        loadDashboard
    );


// =====================================================
// INITIAL LOAD
// =====================================================

loadDashboard();


// =====================================================
// LIVE DATABASE REFRESH
// =====================================================

// Unit cards and sensor readings every 5 seconds.

setInterval(
    async () => {

        console.log(
            "Live LICAS database refresh..."
        );

        await loadUnits();

        await loadLatestSensorReadings();

    },
    5000
);


// Broader information every 15 seconds.

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
```

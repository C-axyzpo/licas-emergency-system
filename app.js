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

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


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


        /*
           Refresh page-specific information.
        */

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

    const now = new Date();

    element.textContent =
        now.toLocaleTimeString(
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
    }


    console.log("Units found:", data);


    const onlineCount =
        data.filter(
            unit =>
                String(unit.status).toLowerCase() ===
                "online"
        ).length;


    const onlineUnits =
        document.getElementById("onlineUnits");

    if (onlineUnits) {
        onlineUnits.textContent = onlineCount;
    }


    const monitorUnits =
        document.getElementById("monitorUnits");

    if (monitorUnits) {
        monitorUnits.textContent = data.length;
    }


    const container =
        document.getElementById("unitsContainer");


    if (!container) {
        return;
    }


    if (!data.length) {

        container.innerHTML = `
            <div class="empty-state panel-empty">
                No monitoring units found.
            </div>
        `;

        return;
    }


    container.innerHTML =
        data.map(unit => {

            /*
               unit.id = database primary key
               unit.unit_id = human-readable LICAS ID
            */

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


            return `
                <div
                    class="unit-card"
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


                        <div class="unit-status">

                            <span class="status-dot"></span>

                            ${escapeHTML(status)}

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
                                ${formatDate(unit.last_seen)}
                            </strong>

                        </div>

                    </div>


                    <div class="unit-sensors">

                        <div class="sensor-loading">
                            Loading sensor data...
                        </div>

                    </div>

                </div>
            `;

        }).join("");
}


// =====================================================
// LOAD LATEST SENSOR READINGS
// =====================================================

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
            .limit(100);


    if (error) {

        console.error(
            "SENSOR READINGS DATABASE ERROR:",
            error
        );

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


    console.log(
        "Latest sensor readings:",
        latestByUnit
    );


    /*
       Update each monitoring unit card.
    */

    Object.entries(latestByUnit).forEach(
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


            // -----------------------------------------
            // HUMAN PRESENCE
            // -----------------------------------------

            let humanStatus =
                "No presence detected";


            if (reading.human_presence === true) {

                humanStatus =
                    "Human detected";

            } else if (
                reading.human_presence === false
            ) {

                humanStatus =
                    "No presence detected";
            }


            // -----------------------------------------
            // VIBRATION
            // -----------------------------------------

            const vibration =
                formatNumber(
                    reading.vibration_level,
                    3
                );


            // -----------------------------------------
            // SMOKE
            // -----------------------------------------

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
                            )}
                        </strong>

                    </div>


                    <div class="sensor-item">

                        <span>
                            Vibration
                        </span>

                        <strong>
                            ${escapeHTML(
                                vibration
                            )} g
                        </strong>

                    </div>


                    <div class="sensor-item">

                        <span>
                            Target State
                        </span>

                        <strong>
                            ${escapeHTML(
                                targetState
                            )}
                        </strong>

                    </div>


                    <div class="sensor-item">

                        <span>
                            Smoke Level
                        </span>

                        <strong>
                            ${escapeHTML(
                                smokeStatus
                            )}
                        </strong>

                    </div>

                </div>


                <div class="sensor-last-reading">

                    <span>
                        Last Sensor Reading
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
}


// =====================================================
// LOAD EMERGENCY EVENTS
// =====================================================

async function loadEmergencyEvents() {

    const table =
        document.getElementById("emergencyTable");


    if (!table) {
        return;
    }


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
                { ascending: false }
            );


    if (error) {

        console.error(
            "EMERGENCY DATABASE ERROR:",
            error
        );

        return;
    }


    const active =
        data.filter(event =>
            event.response_status !== "Resolved"
        );


    const activeEmergencies =
        document.getElementById(
            "activeEmergencies"
        );


    if (activeEmergencies) {

        activeEmergencies.textContent =
            active.length;

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
        `;

        return;
    }


    table.innerHTML =
        data.map(event => {

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
                            event.emergency_type
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            event.severity
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            event.response_status
                        )}
                    </td>

                </tr>
            `;

        }).join("");
}


// =====================================================
// LOAD USER REPORTS
// =====================================================

async function loadUserReports() {

    const table =
        document.getElementById("reportsTable");


    if (!table) {
        return;
    }


    const { data, error } =
        await supabaseClient
            .from("user_reports")
            .select("*")
            .order(
                "reported_at",
                { ascending: false }
            );


    if (error) {

        console.error(
            "USER REPORT DATABASE ERROR:",
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

        return;
    }


    const userReports =
        document.getElementById(
            "userReports"
        );


    if (userReports) {
        userReports.textContent =
            data.length;
    }


    if (!data.length) {

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
        data.map(report => {

            return `
                <tr>

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
                        ${escapeHTML(
                            report.location
                        )}
                    </td>

                    <td>
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

                </tr>
            `;

        }).join("");
}


// =====================================================
// LOAD OFFICIAL ALERTS
// =====================================================

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
                { ascending: false }
            );


    if (error) {

        console.error(
            "OFFICIAL ALERT DATABASE ERROR:",
            error
        );


        if (desktopContainer) {

            desktopContainer.innerHTML = `
                <div class="empty-state panel-empty">
                    Unable to load official alerts.
                </div>
            `;

        }


        if (mobileContainer) {

            mobileContainer.innerHTML = `
                <div class="mobile-empty-alerts">

                    <div>!</div>

                    <strong>
                        Unable to load alerts
                    </strong>

                    <span>
                        Please check the system connection.
                    </span>

                </div>
            `;

        }

        return;
    }


    const alertCount =
        data.length;


    const externalAlerts =
        document.getElementById(
            "externalAlerts"
        );


    if (externalAlerts) {

        externalAlerts.textContent =
            alertCount;

    }


    /*
       DESKTOP
    */

    if (desktopContainer) {

        if (!data.length) {

            desktopContainer.innerHTML = `
                <div class="empty-state panel-empty">

                    <div class="empty-icon">
                        ✓
                    </div>

                    <strong>
                        No official alerts
                    </strong>

                    <span>
                        No official advisories are currently recorded.
                    </span>

                </div>
            `;

        } else {

            desktopContainer.innerHTML =
                data.map(alert => {

                    return `
                        <div class="alert-card">

                            <h4>
                                ${escapeHTML(
                                    alert.title
                                )}
                            </h4>

                            <p>

                                <strong>
                                    ${escapeHTML(
                                        alert.source
                                    )}
                                </strong>

                                ·

                                ${escapeHTML(
                                    alert.alert_type
                                )}

                            </p>

                            <p>
                                ${escapeHTML(
                                    alert.description ||
                                    "No additional information."
                                )}
                            </p>

                            <p>
                                Issued:
                                ${formatDate(
                                    alert.issued_at
                                )}
                            </p>

                        </div>
                    `;

                }).join("");
        }
    }


    /*
       MOBILE
    */

    if (mobileContainer) {

        if (!data.length) {

            mobileContainer.innerHTML = `
                <div class="mobile-empty-alerts">

                    <div>✓</div>

                    <strong>
                        No active official alerts
                    </strong>

                    <span>
                        Official PHIVOLCS and NDRRMC
                        advisories will appear here.
                    </span>

                </div>
            `;

        } else {

            mobileContainer.innerHTML =
                data.map(alert => {

                    return `
                        <article
                            class="mobile-official-alert"
                        >

                            <h3>
                                ${escapeHTML(
                                    alert.title
                                )}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    alert.description ||
                                    "No additional information."
                                )}
                            </p>

                            <div class="alert-meta">

                                <span>
                                    ${escapeHTML(
                                        alert.source
                                    )}
                                </span>

                                <span>
                                    ${formatDate(
                                        alert.issued_at
                                    )}
                                </span>

                            </div>

                        </article>
                    `;

                }).join("");
        }
    }


    /*
       HOME PREVIEW
    */

    const previewTitle =
        document.getElementById(
            "mobileAlertPreviewTitle"
        );

    const previewText =
        document.getElementById(
            "mobileAlertPreviewText"
        );


    if (previewTitle && previewText) {

        if (!data.length) {

            previewTitle.textContent =
                "No active official alerts";

            previewText.textContent =
                "PHIVOLCS / NDRRMC advisories will appear here.";

        } else {

            previewTitle.textContent =
                `${data.length} official alert${
                    data.length === 1 ? "" : "s"
                } available`;

            previewText.textContent =
                data[0].title;
        }
    }
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
// MOBILE HOME NAVIGATION
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


// =====================================================
// MOBILE REPORT BUTTON
// =====================================================

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


// =====================================================
// MOBILE REPORT NAV
// =====================================================

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


// =====================================================
// MOBILE REPORT BACK
// =====================================================

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


// =====================================================
// MOBILE ALERT CARD
// =====================================================

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


// =====================================================
// MOBILE ALERT NAV
// =====================================================

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


// =====================================================
// MOBILE ALERT BACK
// =====================================================

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


            const submitButton =
                document.getElementById(
                    "mobileSubmitReport"
                );

            const result =
                document.getElementById(
                    "mobileReportResult"
                );


            const emergencyType =
                document.getElementById(
                    "mobileEmergencyType"
                ).value;

            const location =
                document.getElementById(
                    "mobileLocation"
                ).value;

            const severity =
                document.getElementById(
                    "mobileSeverity"
                ).value;

            const description =
                document.getElementById(
                    "mobileDescription"
                ).value.trim();

            const reporterName =
                document.getElementById(
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

                            emergency_type:
                                emergencyType,

                            location:
                                location,

                            description:
                                description || null,

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
                    "mobile-result error";

                result.textContent =
                    "Unable to send the emergency report. Please try again.";


                submitButton.disabled = false;

                submitButton.textContent =
                    "SEND EMERGENCY REPORT";

                return;
            }


            /*
               SUCCESS
            */

            result.hidden = false;

            result.className =
                "mobile-result success";

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
                    "mobileHomePage",
                    "mobileHomeNav"
                );

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


console.log(
    "LICAS system initialized."
);


// =====================================================
// LIVE SENSOR REFRESH
// =====================================================

setInterval(
    async () => {

        console.log(
            "Live sensor refresh..."
        );

        await loadLatestSensorReadings();

    },
    5000
);

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

    return new Date(date).toLocaleString(
        "en-PH",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );
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
            unit => unit.status === "online"
        ).length;


    document.getElementById("onlineUnits")
        .textContent = onlineCount;

    document.getElementById("monitorUnits")
        .textContent = onlineCount;


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

            return `
                <div class="unit-card">

                    <div class="unit-top">

                        <div>

                            <div class="unit-name">
                                ${escapeHTML(unit.unit_name)}
                            </div>

                            <div class="unit-location">
                                ${escapeHTML(unit.location)}
                                ${
                                    unit.floor
                                    ? " · " + escapeHTML(unit.floor)
                                    : ""
                                }
                            </div>

                        </div>

                        <div class="unit-status">

                            <span class="status-dot"></span>

                            ${escapeHTML(unit.status)}

                        </div>

                    </div>


                    <div class="unit-details">

                        <div class="unit-detail">

                            <span>
                                Unit ID
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

                </div>
            `;

        }).join("");
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


    document.getElementById(
        "activeEmergencies"
    ).textContent = active.length;


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
                event.units?.unit_name || "Unknown";

            return `
                <tr>

                    <td>
                        ${formatDate(event.detected_at)}
                    </td>

                    <td>
                        ${escapeHTML(unit)}
                    </td>

                    <td>
                        ${escapeHTML(event.emergency_type)}
                    </td>

                    <td>
                        ${escapeHTML(event.severity)}
                    </td>

                    <td>
                        ${escapeHTML(event.response_status)}
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


    document.getElementById("userReports")
        .textContent = data.length;


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
                        ${formatDate(report.reported_at)}
                    </td>

                    <td>
                        ${escapeHTML(report.emergency_type)}
                    </td>

                    <td>
                        ${escapeHTML(report.location)}
                    </td>

                    <td>
                        ${escapeHTML(
                            report.description || "No description"
                        )}
                    </td>

                    <td>
                        ${escapeHTML(report.status)}
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
                                ${escapeHTML(alert.title)}
                            </h4>

                            <p>
                                <strong>
                                    ${escapeHTML(alert.source)}
                                </strong>
                                ·
                                ${escapeHTML(alert.alert_type)}
                            </p>

                            <p>
                                ${escapeHTML(
                                    alert.description ||
                                    "No additional information."
                                )}
                            </p>

                            <p>
                                Issued:
                                ${formatDate(alert.issued_at)}
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
                                ${escapeHTML(alert.title)}
                            </h3>

                            <p>
                                ${escapeHTML(
                                    alert.description ||
                                    "No additional information."
                                )}
                            </p>

                            <div class="alert-meta">

                                <span>
                                    ${escapeHTML(alert.source)}
                                </span>

                                <span>
                                    ${formatDate(alert.issued_at)}
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


// HOME

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


// REPORT BUTTON

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


// REPORT NAV

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


// REPORT BACK

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


// ALERT CARD

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


// ALERT NAV

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


// ALERT BACK

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


// REFRESH BUTTON

document
    .getElementById("refreshDashboard")
    ?.addEventListener(
        "click",
        loadDashboard
    );


// =====================================================
// START
// =====================================================

loadDashboard();

console.log(
    "LICAS system initialized."
);

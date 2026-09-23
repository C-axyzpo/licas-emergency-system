console.log("LIKAS app.js loaded");


// ==============================
// SUPABASE CONNECTION
// ==============================

const SUPABASE_URL =
    "https://gqnyqaxwgfkdglkjuidc.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_Ld7RcE6is_Ln_iAcqMYVLg_MZw58l3c";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ==============================
// PAGE NAVIGATION
// ==============================

const navButtons = document.querySelectorAll(".nav-button");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("pageTitle");

navButtons.forEach(button => {

    button.addEventListener("click", () => {

        const targetPage = button.dataset.page;

        // Remove active navigation
        navButtons.forEach(btn => {
            btn.classList.remove("active");
        });

        // Activate clicked button
        button.classList.add("active");

        // Hide all pages
        pages.forEach(page => {
            page.classList.remove("active-page");
        });

        // Show selected page
        document
            .getElementById(targetPage)
            .classList.add("active-page");

        // Update title
        pageTitle.textContent =
            button.textContent.trim();
    });

});


// ==============================
// LOAD UNITS
// ==============================

async function loadUnits() {

    console.log("Loading LIKAS units...");

    const { data, error } = await supabaseClient
        .from("units")
        .select("*");

    if (error) {
        console.error("UNIT DATABASE ERROR:", error);
        return;
    }

    console.log("Units found:", data);

    // Count online units
    const onlineCount = data.filter(
        unit => unit.status === "online"
    ).length;

    // Update statistics
    document.getElementById("onlineUnits").textContent =
        onlineCount;

    document.getElementById("monitorUnits").textContent =
        onlineCount;


    // Build unit cards

    const container =
        document.getElementById("unitsContainer");

    if (data.length === 0) {

        container.innerHTML = `
            <div class="empty-state panel-empty">
                No monitoring units found.
            </div>
        `;

        return;
    }


    container.innerHTML = data.map(unit => {

        return `
            <div class="unit-card">

                <div class="unit-top">

                    <div>
                        <div class="unit-name">
                            ${unit.unit_name}
                        </div>

                        <div class="unit-location">
                            ${unit.location}
                            ${unit.floor ? " · " + unit.floor : ""}
                        </div>
                    </div>

                    <div class="unit-status">
                        <span class="status-dot"></span>
                        ${unit.status}
                    </div>

                </div>


                <div class="unit-details">

                    <div class="unit-detail">
                        <span>Unit ID</span>
                        <strong>${unit.id}</strong>
                    </div>

                    <div class="unit-detail">
                        <span>Last Seen</span>
                        <strong>
                            ${formatDate(unit.last_seen)}
                        </strong>
                    </div>

                </div>

            </div>
        `;

    }).join("");

}


// ==============================
// TIME
// ==============================

function updateTime() {

    const now = new Date();

    document.getElementById("currentTime")
        .textContent =
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


// ==============================
// DATE FORMAT
// ==============================

function formatDate(date) {

    if (!date) {
        return "Unknown";
    }

    return new Date(date)
        .toLocaleString("en-PH", {
            dateStyle: "short",
            timeStyle: "short"
        });
}


// ==============================
// DASHBOARD LOADER
// ==============================

async function loadDashboard() {

    console.log("Refreshing LIKAS dashboard...");

    await loadUnits();

    document.getElementById("lastUpdate")
        .textContent = "Just now";

}


// ==============================
// START SYSTEM
// ==============================

loadDashboard();

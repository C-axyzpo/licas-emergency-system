console.log("LIKAS app.js loaded");

const SUPABASE_URL = "https://gqnyqaxwgfkdglkjuidc.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ld7RcE6is_Ln_iAcqMYVLg_MZw58l3c";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// =========================
// LOAD UNITS
// =========================

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

    // Update dashboard number
    document.getElementById("onlineUnits").textContent = onlineCount;
}


// =========================
// START
// =========================

loadUnits();

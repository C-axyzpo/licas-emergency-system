console.log("LIKAS app.js loaded");

const SUPABASE_URL = "https://gqnyqaxwgfkdglkjuidc.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ld7RcE6is_Ln_iAcqMYVLg_MZw58l3c";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

async function testDatabase() {

    console.log("Testing LIKAS database...");

    const { data, error } = await supabaseClient
        .from("units")
        .select("*");

    if (error) {
        console.error("DATABASE ERROR:", error);
        return;
    }

    console.log("DATABASE CONNECTED!");
    console.log(data);
}

testDatabase();

const SUPABASE_URL = "https://gqnyqaxwgfkdglkjuidc.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ld7RcE6is_Ln_iAcqMYVLg_MZw58l3c";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

async function testConnection() {
    const { data, error } = await supabaseClient
        .from("units")
        .select("*");

    if (error) {
        console.error("Connection failed:", error);
        return;
    }

    console.log("Supabase connected!");
    console.log("Units:", data);
}

testConnection();

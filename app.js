console.log("Supabase library:", supabase);

const SUPABASE_URL = "https://gqnyqaxwgfkdglkjuidc.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ld7RcE6is_Ln_iAcqMYVLg_MZw58l3c";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

console.log("Supabase client created");

async function testConnection() {
    console.log("Testing database connection...");

    const { data, error } = await supabaseClient
        .from("units")
        .select("*");

    if (error) {
        console.error("DATABASE ERROR:", error);
        return;
    }

    console.log("DATABASE CONNECTED:", data);
}

testConnection();

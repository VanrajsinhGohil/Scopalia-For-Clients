// js/supabase-config.js

// Replace these with your actual Supabase project URL and anon key.
const SUPABASE_URL = 'https://qxtgbovelwogoixaiwzt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4dGdib3ZlbHdvZ29peGFpd3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxOTkwMTksImV4cCI6MjA5Nzc3NTAxOX0.NnQJ4aqHLR4F-PzSBtaIQ9FO2h37VEvq8r50XMIThjc';


if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
    console.warn("WARNING: Supabase URL and Anon Key are not set. Please update js/supabase-config.js");
}

// Initialize the Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


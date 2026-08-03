// Configuration Supabase — partagée par toutes les pages
const SUPABASE_URL = "https://chudgiyvesnjftggbpyx.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_QDQvVoRo42uwxTvH_vUAFA_0ay9nXqh";

// Client global réutilisé sur toutes les pages
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Add this line temporarily to check if it's reading properly
console.log("Supabase URL is:", supabaseUrl)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
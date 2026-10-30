import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Removed 'session' because we don't use it in this block
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    // Clear any bad tokens from local storage just to be safe
    localStorage.removeItem('supabase.auth.token')
    
    // Redirect to login if they aren't already there
    if (!window.location.pathname.includes('/admin/login')) {
      window.location.href = '/admin/login'
    }
  }
})
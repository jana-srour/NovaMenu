import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/*
 * NOVAMENU authentication storage
 *
 * Remember Me = true
 *   → localStorage
 *   → session survives browser restarts
 *
 * Remember Me = false
 *   → sessionStorage
 *   → session ends when the browser tab is closed
 *
 * The preference is stored separately so the same Supabase client
 * can dynamically use the correct storage mechanism.
 */

const REMEMBER_ME_KEY = 'novamenu_remember_me';

const authStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') {
      return null;
    }

    const rememberMe =
      window.localStorage.getItem(REMEMBER_ME_KEY) !== 'false';

    const storage = rememberMe
      ? window.localStorage
      : window.sessionStorage;

    return storage.getItem(key);
  },

  setItem(key: string, value: string) {
    if (typeof window === 'undefined') {
      return;
    }

    const rememberMe =
      window.localStorage.getItem(REMEMBER_ME_KEY) !== 'false';

    const storage = rememberMe
      ? window.localStorage
      : window.sessionStorage;

    storage.setItem(key, value);
  },

  removeItem(key: string) {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: authStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export { REMEMBER_ME_KEY };
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const REMEMBER_ME_KEY = "moveCircleRememberMe";

const authStorage = {
  getItem(key) {
    return (
      preferredStorage().getItem(key) ||
      window.localStorage.getItem(key) ||
      window.sessionStorage.getItem(key)
    );
  },
  setItem(key, value) {
    preferredStorage().setItem(key, value);
    otherStorage().removeItem(key);
  },
  removeItem(key) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

function preferredStorage() {
  return window.localStorage.getItem(REMEMBER_ME_KEY) === "false"
    ? window.sessionStorage
    : window.localStorage;
}

function otherStorage() {
  return preferredStorage() === window.localStorage
    ? window.sessionStorage
    : window.localStorage;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
  },
});

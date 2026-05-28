import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export async function getInitialSession() {
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInWithMagicLink(email: string) {
  if (!supabase) {
    return { error: new Error("Supabase is not configured.") };
  }

  return supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });
}

export async function signOut() {
  if (!supabase) {
    return;
  }

  await supabase.auth.signOut();
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  if (!supabase) {
    return () => undefined;
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
}

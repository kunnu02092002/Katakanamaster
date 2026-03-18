import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { ReviewHistoryEntry, StudyItem } from "../../domain/models";

type ReviewEvent = Pick<ReviewHistoryEntry, "itemId" | "quality" | "timestamp">;

interface CloudProgressRow {
  user_id: string;
  item_id: string;
  payload: StudyItem;
}

interface CloudReviewRow {
  user_id: string;
  item_id: string;
  quality: number;
  timestamp: string;
}

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

const supabaseUrl = firstNonEmpty(import.meta.env.VITE_SUPABASE_URL, import.meta.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = firstNonEmpty(
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
);

const cloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

function getClientOrThrow() {
  if (!supabase) {
    throw new Error("Cloud sync is not configured. Missing Supabase environment variables.");
  }
  return supabase;
}

export function isCloudSyncConfigured() {
  return cloudConfigured;
}

export async function getCloudSession() {
  if (!supabase) {
    return null;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
}

export function onCloudAuthStateChange(callback: (session: Session | null) => void) {
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

export async function signInWithEmailOtp(email: string) {
  const client = getClientOrThrow();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signInWithPhoneOtp(phone: string) {
  const client = getClientOrThrow();
  const { error } = await client.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) {
    throw error;
  }
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const client = getClientOrThrow();
  const { error } = await client.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    throw error;
  }
}

export async function signOutCloud() {
  if (!supabase) {
    return;
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function pullCloudStudyItems(userId: string) {
  const client = getClientOrThrow();

  const { data, error } = await client
    .from("user_progress")
    .select("item_id,payload")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data as CloudProgressRow[] | null)?.map((row) => ({ ...row.payload, id: row.item_id })) ?? [];
}

export async function pushCloudStudyItems(userId: string, items: StudyItem[]) {
  if (!items.length) {
    return;
  }

  const client = getClientOrThrow();
  const rows: CloudProgressRow[] = items.map((item) => ({
    user_id: userId,
    item_id: item.id,
    payload: item,
  }));

  const { error } = await client.from("user_progress").upsert(rows, { onConflict: "user_id,item_id" });
  if (error) {
    throw error;
  }
}

export async function pullCloudReviewEvents(userId: string) {
  const client = getClientOrThrow();

  const { data, error } = await client
    .from("user_review_events")
    .select("item_id,quality,timestamp")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data as CloudReviewRow[] | null)?.map((row) => ({
    itemId: row.item_id,
    quality: row.quality,
    timestamp: row.timestamp,
  })) ?? [];
}

export async function pushCloudReviewEvents(userId: string, entries: ReviewEvent[]) {
  if (!entries.length) {
    return;
  }

  const client = getClientOrThrow();
  const rows: CloudReviewRow[] = entries.map((entry) => ({
    user_id: userId,
    item_id: entry.itemId,
    quality: entry.quality,
    timestamp: entry.timestamp,
  }));

  const { error } = await client
    .from("user_review_events")
    .upsert(rows, { onConflict: "user_id,item_id,timestamp,quality" });

  if (error) {
    throw error;
  }
}

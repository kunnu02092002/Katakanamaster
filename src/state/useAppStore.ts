import { create } from "zustand";
import type { StudyItem } from "../domain/models";
import {
  applyReview,
  getAllStudyItems,
  getDueItems,
  getLetters,
  getReviewDaysSet,
  getWords,
  initializeData,
  upsertStudyItems,
} from "../data/db/studyItemsRepo";
import {
  getCloudSession,
  isCloudSyncConfigured,
  onCloudAuthStateChange,
  pullCloudStudyItems,
  pushCloudStudyItems,
  signInWithEmailOtp,
  signInWithPhoneOtp,
  signOutCloud,
  verifyPhoneOtp,
} from "../data/cloud/supabaseSync";

let cloudAuthListenerAttached = false;

type CloudSyncState = "idle" | "syncing" | "error";

interface AppState {
  initialized: boolean;
  activeTab: "letters" | "words" | "progress";
  mode: "list" | "flashcard";
  search: string;
  relatedLetter: string;
  cardFlipped: boolean;
  flashIndex: number;
  letters: StudyItem[];
  words: StudyItem[];
  dueCount: number;
  streak: number;
  selectedLetter: StudyItem | null;
  cloudConfigured: boolean;
  cloudConnected: boolean;
  cloudUserEmail: string | null;
  cloudUserPhone: string | null;
  cloudSyncState: CloudSyncState;
  cloudMessage: string | null;
  initialize: () => Promise<void>;
  initializeCloud: () => Promise<void>;
  setTab: (tab: "letters" | "words" | "progress") => void;
  setMode: (mode: "list" | "flashcard") => void;
  setSearch: (q: string) => void;
  setRelatedLetter: (letter: string) => void;
  setSelectedLetter: (letter: StudyItem | null) => void;
  toggleFlip: () => void;
  setFlashIndex: (index: number) => void;
  gradeCard: (quality: number) => Promise<void>;
  signInCloudEmail: (email: string) => Promise<void>;
  signInCloudPhone: (phone: string) => Promise<void>;
  verifyCloudPhoneOtp: (phone: string, code: string) => Promise<void>;
  signOutCloud: () => Promise<void>;
  syncCloudNow: () => Promise<void>;
  refresh: () => Promise<void>;
}

function itemFreshness(item: StudyItem) {
  const source = item.lastDate ?? item.nextDate;
  const timestamp = Date.parse(source);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function mergeStudyItems(localItems: StudyItem[], cloudItems: StudyItem[]) {
  const merged = new Map(localItems.map((item) => [item.id, item]));

  cloudItems.forEach((cloudItem) => {
    const local = merged.get(cloudItem.id);
    if (!local) {
      merged.set(cloudItem.id, cloudItem);
      return;
    }

    const cloudFreshness = itemFreshness(cloudItem);
    const localFreshness = itemFreshness(local);

    if (cloudFreshness > localFreshness) {
      merged.set(cloudItem.id, cloudItem);
      return;
    }

    if (cloudFreshness === localFreshness) {
      const cloudScore = cloudItem.reps + cloudItem.lapses;
      const localScore = local.reps + local.lapses;
      if (cloudScore > localScore) {
        merged.set(cloudItem.id, cloudItem);
      }
    }
  });

  return Array.from(merged.values());
}

function isTouchedItem(item: StudyItem) {
  return (
    item.reps > 0 ||
    item.lapses > 0 ||
    item.interval > 0 ||
    item.stepIndex > 0 ||
    item.leechCount > 0 ||
    item.lastDate !== null ||
    item.state !== "learning" ||
    Math.abs(item.ef - 2.5) > 1e-9
  );
}

function getTouchedItems(items: StudyItem[]) {
  return items.filter(isTouchedItem);
}

function getFilteredWords(state: Pick<AppState, "words" | "relatedLetter" | "search">) {
  return state.words.filter((item) => {
    if (state.relatedLetter && !item.front.includes(state.relatedLetter)) {
      return false;
    }
    if (!state.search.trim()) {
      return true;
    }
    const q = state.search.trim().toLowerCase();
    return `${item.front} ${item.back}`.toLowerCase().includes(q);
  });
}

function randomIndex(length: number, exclude?: number) {
  if (length <= 0) return 0;
  if (length === 1) return 0;

  let next = Math.floor(Math.random() * length);
  if (exclude === undefined) {
    return next;
  }

  while (next === exclude) {
    next = Math.floor(Math.random() * length);
  }
  return next;
}

function computeStreak(days: Set<string>) {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!days.has(key)) {
      break;
    }
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  activeTab: "letters",
  mode: "list",
  search: "",
  relatedLetter: "",
  cardFlipped: false,
  flashIndex: 0,
  letters: [],
  words: [],
  dueCount: 0,
  streak: 0,
  selectedLetter: null,
  cloudConfigured: false,
  cloudConnected: false,
  cloudUserEmail: null,
  cloudUserPhone: null,
  cloudSyncState: "idle",
  cloudMessage: null,

  initialize: async () => {
    await initializeData();
    await get().initializeCloud();
    await get().refresh();
    set({ initialized: true });
  },

  initializeCloud: async () => {
    const configured = isCloudSyncConfigured();
    if (!configured) {
      set({
        cloudConfigured: false,
        cloudConnected: false,
        cloudUserEmail: null,
        cloudUserPhone: null,
        cloudSyncState: "idle",
        cloudMessage: "Cloud sync not configured",
      });
      return;
    }

    set({ cloudConfigured: true, cloudMessage: "Cloud ready. Connect to sync." });

    if (!cloudAuthListenerAttached) {
      onCloudAuthStateChange((session) => {
        if (!session?.user) {
          set({
            cloudConnected: false,
            cloudUserEmail: null,
            cloudUserPhone: null,
            cloudSyncState: "idle",
            cloudMessage: "Signed out of cloud sync",
          });
          return;
        }

        set({
          cloudConnected: true,
          cloudUserEmail: session.user.email ?? null,
          cloudUserPhone: session.user.phone ?? null,
          cloudMessage: "Connected. Syncing...",
        });
        void get().syncCloudNow();
      });
      cloudAuthListenerAttached = true;
    }

    const session = await getCloudSession();
    if (session?.user) {
      set({
        cloudConnected: true,
        cloudUserEmail: session.user.email ?? null,
        cloudUserPhone: session.user.phone ?? null,
        cloudMessage: "Connected. Syncing...",
      });
      await get().syncCloudNow();
      return;
    }

    set({
      cloudConnected: false,
      cloudUserEmail: null,
      cloudUserPhone: null,
      cloudSyncState: "idle",
      cloudMessage: "Connect cloud sync to keep progress across devices",
    });
  },

  refresh: async () => {
    const [letters, words, due, days] = await Promise.all([
      getLetters(),
      getWords(),
      getDueItems(),
      getReviewDaysSet(),
    ]);

    set({ letters, words, dueCount: due.length, streak: computeStreak(days) });
  },

  setTab: (activeTab) => set({ activeTab }),
  setMode: (mode) => {
    const state = get();
    if (mode !== "flashcard") {
      set({ mode, cardFlipped: false });
      return;
    }

    const filtered = getFilteredWords(state);
    set({ mode, cardFlipped: false, flashIndex: randomIndex(filtered.length) });
  },
  setSearch: (search) => {
    const state = get();
    const nextBase = { ...state, search };
    const filtered = getFilteredWords(nextBase);
    set({ search, flashIndex: state.mode === "flashcard" ? randomIndex(filtered.length) : 0 });
  },
  setRelatedLetter: (relatedLetter) => {
    const state = get();
    const nextBase = { ...state, relatedLetter };
    const filtered = getFilteredWords(nextBase);
    set({ relatedLetter, flashIndex: state.mode === "flashcard" ? randomIndex(filtered.length) : 0 });
  },
  setSelectedLetter: (selectedLetter) => set({ selectedLetter }),
  toggleFlip: () => set((state) => ({ cardFlipped: !state.cardFlipped })),
  setFlashIndex: (flashIndex) => set({ flashIndex, cardFlipped: false }),

  signInCloudEmail: async (email) => {
    if (!isCloudSyncConfigured()) {
      set({ cloudMessage: "Cloud sync not configured" });
      return;
    }

    await signInWithEmailOtp(email);
    set({ cloudMessage: "Check your email for the sign-in link" });
  },

  signInCloudPhone: async (phone) => {
    if (!isCloudSyncConfigured()) {
      set({ cloudMessage: "Cloud sync not configured" });
      return;
    }

    await signInWithPhoneOtp(phone);
    set({ cloudMessage: "OTP sent by SMS. Enter the code to complete sign-in." });
  },

  verifyCloudPhoneOtp: async (phone, code) => {
    if (!isCloudSyncConfigured()) {
      set({ cloudMessage: "Cloud sync not configured" });
      return;
    }

    await verifyPhoneOtp(phone, code);
    set({ cloudMessage: "Phone verified. Syncing cloud progress..." });
  },

  signOutCloud: async () => {
    await signOutCloud();
    set({
      cloudConnected: false,
      cloudUserEmail: null,
      cloudUserPhone: null,
      cloudSyncState: "idle",
      cloudMessage: "Signed out of cloud sync",
    });
  },

  syncCloudNow: async () => {
    if (!isCloudSyncConfigured()) {
      set({ cloudConfigured: false, cloudMessage: "Cloud sync not configured" });
      return;
    }

    const session = await getCloudSession();
    const userId = session?.user?.id;

    if (!userId) {
      set({
        cloudConnected: false,
        cloudUserEmail: null,
        cloudUserPhone: null,
        cloudSyncState: "idle",
        cloudMessage: "Connect cloud sync first",
      });
      return;
    }

    set({
      cloudConnected: true,
      cloudUserEmail: session.user.email ?? null,
      cloudUserPhone: session.user.phone ?? null,
      cloudSyncState: "syncing",
      cloudMessage: "Syncing cloud progress...",
    });

    try {
      const [localItems, cloudItems] = await Promise.all([
        getAllStudyItems(),
        pullCloudStudyItems(userId),
      ]);

      const mergedItems = mergeStudyItems(localItems, cloudItems);

      await upsertStudyItems(mergedItems);
      await pushCloudStudyItems(userId, getTouchedItems(mergedItems));

      await get().refresh();
      set({
        cloudSyncState: "idle",
        cloudMessage: `Cloud synced at ${new Date().toLocaleTimeString()}`,
      });
    } catch (error) {
      console.error(error);
      set({
        cloudSyncState: "error",
        cloudMessage: "Cloud sync failed. Please retry.",
      });
    }
  },

  gradeCard: async (quality) => {
    const state = get();
    const filtered = getFilteredWords(state);

    if (!filtered.length) {
      return;
    }

    const item = filtered[state.flashIndex] ?? filtered[0];
    const { updated } = await applyReview(item, quality);

    if (state.cloudConfigured && state.cloudConnected) {
      try {
        const session = await getCloudSession();
        const userId = session?.user?.id;
        if (userId) {
          await pushCloudStudyItems(userId, [updated]);
          set({ cloudSyncState: "idle", cloudMessage: "Cloud synced" });
        }
      } catch (error) {
        console.error(error);
        set({
          cloudSyncState: "error",
          cloudMessage: "Saved locally. Cloud sync will retry on manual sync.",
        });
      }
    }

    await get().refresh();

    const refreshedState = get();
    const refreshedFiltered = getFilteredWords(refreshedState);
    set((s) => ({ flashIndex: randomIndex(refreshedFiltered.length, s.flashIndex), cardFlipped: false }));
  },
}));

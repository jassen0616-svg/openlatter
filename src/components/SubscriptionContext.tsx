"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode
} from "react";

type NoteState = "idle" | "success" | "error";

type SubscriptionContextValue = {
  email: string;
  note: string | null;
  noteState: NoteState;
  buttonLabel: string;
  isSubmitting: boolean;
  submitEmail: (email: string) => Promise<"success" | "invalid" | "error">;
};

const STORAGE_KEY = "openlatterSubscriber";

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
const storageListeners = new Set<() => void>();
let cachedStoredEmail: string | null = null;

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getServerStoredEmail() {
  return "";
}

function getStoredEmail() {
  if (typeof window === "undefined") return "";

  let stored = "";
  try {
    stored = window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    stored = "";
  }

  if (stored === cachedStoredEmail) {
    return cachedStoredEmail;
  }

  cachedStoredEmail = stored;
  return stored;
}

function subscribeToStoredEmail(listener: () => void) {
  storageListeners.add(listener);

  function handleStorage() {
    cachedStoredEmail = null;
    listener();
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    storageListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function notifyStoredEmailChanged() {
  cachedStoredEmail = null;
  storageListeners.forEach((listener) => listener());
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const storedEmail = useSyncExternalStore(
    subscribeToStoredEmail,
    getStoredEmail,
    getServerStoredEmail
  );
  const [volatileEmail, setVolatileEmail] = useState("");
  const [feedback, setFeedback] = useState<{ note: string | null; state: NoteState }>({
    note: null,
    state: "idle"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const email = storedEmail || volatileEmail;
  const note =
    feedback.note ??
    (email ? `已绑定 ${email}。下一封 openlatter 会在上午送达。` : null);
  const noteState: NoteState =
    feedback.state !== "idle" ? feedback.state : email ? "success" : "idle";

  const submitEmail = useCallback(async (value: string) => {
    const nextEmail = value.trim();
    const normalizedEmail = nextEmail.toLowerCase();

    if (!validEmail(normalizedEmail)) {
      setFeedback({ note: "请输入一个有效的邮箱地址。", state: "error" });
      return "invalid";
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: normalizedEmail })
      });

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        email?: string;
        message?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        setFeedback({
          note: result?.message || "暂时无法完成绑定，请稍后再试。",
          state: "error"
        });
        return "error";
      }
    } catch {
      setFeedback({ note: "暂时无法完成绑定，请稍后再试。", state: "error" });
      return "error";
    } finally {
      setIsSubmitting(false);
    }

    setVolatileEmail(normalizedEmail);
    try {
      window.localStorage.setItem(STORAGE_KEY, normalizedEmail);
      notifyStoredEmailChanged();
    } catch {
      // Keep the visible success state even when storage is unavailable.
    }

    setFeedback({
      note: `已绑定 ${normalizedEmail}。你现在是 openlatter 用户，下一封会在上午送达。`,
      state: "success"
    });
    return "success";
  }, []);

  const value = useMemo(
    () => ({
      email,
      note,
      noteState,
      isSubmitting,
      buttonLabel: isSubmitting ? "绑定中" : email ? "已绑定" : "绑定",
      submitEmail
    }),
    [email, isSubmitting, note, noteState, submitEmail]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error("useSubscription must be used inside SubscriptionProvider");
  }

  return context;
}

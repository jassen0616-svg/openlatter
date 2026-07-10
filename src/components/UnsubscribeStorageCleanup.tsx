"use client";

import { useEffect } from "react";

const STORAGE_KEY = "openlatterSubscriber";

export function UnsubscribeStorageCleanup() {
  useEffect(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The server-side unsubscribe has already succeeded when storage is unavailable.
    }
  }, []);

  return null;
}

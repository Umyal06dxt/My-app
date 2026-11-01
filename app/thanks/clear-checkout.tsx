"use client";

import { useEffect } from "react";
import { checkoutStore } from "@/lib/checkout-store";

/** Once a session is paid (including via tunyt.com), forget the saved in-progress checkout. */
export function ClearSavedCheckout({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    if (checkoutStore.current()?.sessionId === sessionId) checkoutStore.clear();
  }, [sessionId]);
  return null;
}

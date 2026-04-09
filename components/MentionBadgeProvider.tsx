"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase";

interface MentionBadgeContextValue {
  count: number;
  refresh: () => void;
}

const MentionBadgeContext = createContext<MentionBadgeContextValue>({
  count: 0,
  refresh: () => {},
});

export function MentionBadgeProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { count: mentionCount, error } = await supabase
      .from("mentions")
      .select("*", { count: "exact", head: true })
      .eq("mentioned_user_id", user.id)
      .eq("resolved", false);

    if (!error && mentionCount !== null) {
      setCount(mentionCount);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <MentionBadgeContext.Provider value={{ count, refresh }}>
      {children}
    </MentionBadgeContext.Provider>
  );
}

export function useMentionBadge() {
  return useContext(MentionBadgeContext);
}

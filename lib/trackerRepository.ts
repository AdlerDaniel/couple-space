import { supabase } from "@/lib/supabaseClient";
import { collectTrackerPages } from "@/lib/trackerPagination";

export function fetchTrackerEvents(coupleId: string, from: string, to: string) {
  return collectTrackerPages((first, last) => supabase.from("tracker_events")
    .select("*").eq("couple_id", coupleId).gte("date", from).lte("date", to)
    .order("date", { ascending: false }).order("created_at", { ascending: false }).order("id").range(first, last));
}

export function subscribeTrackerData(coupleId: string, onChange: () => void) {
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const scheduleRefresh = () => {
    if (disposed) return;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      if (!disposed) onChange();
    }, 120);
  };

  const filter = `couple_id=eq.${coupleId}`;
  const postgresTables = [
    "tracker_events",
    "tracker_goals",
    "tracker_category_preferences",
  ] as const;

  const postgresChannel = supabase.channel(`tracker-db:${coupleId}`);
  for (const table of postgresTables) {
    postgresChannel
      .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, scheduleRefresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter }, scheduleRefresh);
  }

  const broadcastChannel = supabase
    .channel(`tracker:${coupleId}`, { config: { private: true } })
    .on("broadcast", { event: "changed" }, scheduleRefresh);

  const subscribeChannels = async () => {
    let privateAuthReady = false;
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) {
        await supabase.realtime.setAuth(accessToken);
        privateAuthReady = true;
      }
    } catch {
      // Postgres Changes remains an independent RLS-protected fallback.
    }
    if (disposed) return;

    postgresChannel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !disposed) scheduleRefresh();
    });
    if (privateAuthReady) {
      broadcastChannel.subscribe((status) => {
        if (status === "SUBSCRIBED" && !disposed) scheduleRefresh();
      });
    }
  };

  void subscribeChannels();

  return () => {
    disposed = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    void supabase.removeChannel(postgresChannel);
    void supabase.removeChannel(broadcastChannel);
  };
}

export async function adjustTrackerEventCount(input: {
  coupleId: string;
  categoryId: string;
  date: string;
  delta: -1 | 1;
}) {
  return supabase.rpc("adjust_tracker_event_count", {
    p_couple_id: input.coupleId,
    p_category_id: input.categoryId,
    p_date: input.date,
    p_delta: input.delta,
  });
}

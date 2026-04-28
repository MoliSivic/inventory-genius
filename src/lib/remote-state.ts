import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseDataSyncReady } from "./supabase";
import type { AppState } from "./types";

const REMOTE_STATE_TABLE = "inventory_app_state";
const REMOTE_STATE_ID = "default";

type RemoteStateRow = {
  id: string;
  state: AppState;
  updated_at: string;
};

export function canSyncRemoteState() {
  return isSupabaseDataSyncReady;
}

export async function loadRemoteState(fallbackState: AppState) {
  if (!canSyncRemoteState()) return fallbackState;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(REMOTE_STATE_TABLE)
    .select("id,state,updated_at")
    .eq("id", REMOTE_STATE_ID)
    .maybeSingle<RemoteStateRow>();

  if (error) throw error;

  if (data?.state) return data.state;

  await saveRemoteState(fallbackState);
  return fallbackState;
}

export async function saveRemoteState(state: AppState) {
  if (!canSyncRemoteState()) return;

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(REMOTE_STATE_TABLE).upsert({
    id: REMOTE_STATE_ID,
    state,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export function subscribeRemoteState(onState: (state: AppState) => void) {
  if (!canSyncRemoteState()) return () => {};

  const supabase = getSupabaseClient();
  let channel: RealtimeChannel | null = supabase
    .channel("inventory-app-state")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: REMOTE_STATE_TABLE,
        filter: `id=eq.${REMOTE_STATE_ID}`,
      },
      (payload) => {
        const nextState = (payload.new as Partial<RemoteStateRow> | null)?.state;
        if (nextState) onState(nextState);
      },
    )
    .subscribe();

  return () => {
    if (!channel) return;
    void supabase.removeChannel(channel);
    channel = null;
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';

export type LiveSyncEventDetail = {
  restaurantId: string;
  source?: string;
  timestamp: number;
};

const EVENT_NAME = 'nova-restaurant-live-sync';
const STORAGE_KEY_PREFIX = 'nova-restaurant-live-sync:';
const REALTIME_EVENT_NAME = 'restaurant-sync';

const getRealtimeTopic = (restaurantId: string) =>
  `nova-restaurant-sync-${restaurantId}`;

/** Tables whose rows are owned directly by a restaurant. */
export type RestaurantRealtimeTable =
  | 'categories'
  | 'menu_items'
  | 'menu_item_extras'
  | 'orders'
  | 'order_items'
  | 'restaurant_members'
  | 'restaurant_subscriptions'
  | 'restaurant_roles'
  | 'restaurant_qr_designs'
  | 'restaurant_price_adjustment_history'
  | 'menu_item_pricing_history'
  | 'restaurant_themes';

type RestaurantRealtimeOptions = {
  restaurantId: string;
  tables: readonly RestaurantRealtimeTable[];
  onChange: () => void | Promise<void>;
  /** A readable prefix for the transient channel name. */
  name?: string;
  /** Listen for the restaurant row itself as well as restaurant-owned rows. */
  includeRestaurant?: boolean;
  /** Listen to relation tables that do not have a restaurant_id column. */
  unfilteredTables?: readonly RestaurantRealtimeTable[];
  debounceMs?: number;
  onStatus?: (status: string) => void;
};

/**
 * Creates one scoped Supabase Realtime subscription for a page. Events that
 * arrive together (for example an item and its extras) are coalesced into one
 * refresh. The returned cleanup always removes the channel.
 */
export function subscribeRestaurantRealtime(
  supabase: SupabaseClient,
  {
    restaurantId,
    tables,
    onChange,
    name = 'restaurant-live',
    includeRestaurant = true,
    unfilteredTables = [],
    debounceMs = 100,
    onStatus,
  }: RestaurantRealtimeOptions
) {
  if (!restaurantId) {
    return () => {};
  }

  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (!disposed) void onChange();
    }, debounceMs);
  };
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let channel = supabase.channel(`${name}-${restaurantId}-${id}`);

  if (includeRestaurant) {
    channel = channel.on('postgres_changes', {
      event: '*', schema: 'public', table: 'restaurants', filter: `id=eq.${restaurantId}`,
    }, refresh);
  }

  for (const table of new Set(tables)) {
    channel = channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table,
      ...(unfilteredTables.includes(table)
        ? {}
        : { filter: `restaurant_id=eq.${restaurantId}` }),
    }, refresh);
  }

  channel.subscribe((status) => {
    onStatus?.(status);
  });
  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}

export function notifyRestaurantSync(restaurantId: string, source = 'local') {
  if (!restaurantId || typeof window === 'undefined') {
    return;
  }

  const detail: LiveSyncEventDetail = {
    restaurantId,
    source,
    timestamp: Date.now(),
  };

  try {
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, { detail })
    );
  } catch {
    // Ignore unsupported browser event dispatch.
  }

  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(EVENT_NAME);
      channel.postMessage(detail);
      setTimeout(() => channel.close(), 0);
    }
  } catch {
    // Ignore unsupported broadcast channels.
  }

  try {
    window.localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${restaurantId}`,
      String(detail.timestamp)
    );
  } catch {
    // Ignore storage errors in private browsing or restricted environments.
  }
}

export function subscribeRestaurantSync(
  restaurantId: string,
  callback: (detail: LiveSyncEventDetail) => void
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleEvent = (event: Event) => {
    const customEvent = event as CustomEvent<LiveSyncEventDetail>;
    const detail = customEvent.detail;

    if (detail?.restaurantId === restaurantId) {
      callback(detail);
    }
  };

  const handleStorage = (event: StorageEvent) => {
    if (event.key === `${STORAGE_KEY_PREFIX}${restaurantId}`) {
      callback({
        restaurantId,
        source: 'storage',
        timestamp: Number(event.newValue ?? Date.now()),
      });
    }
  };

  window.addEventListener(EVENT_NAME, handleEvent);
  window.addEventListener('storage', handleStorage);

  let channel: BroadcastChannel | null = null;

  try {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(EVENT_NAME);
      channel.onmessage = (messageEvent: MessageEvent<LiveSyncEventDetail>) => {
        if (messageEvent.data?.restaurantId === restaurantId) {
          callback(messageEvent.data);
        }
      };
    }
  } catch {
    // Ignore unsupported broadcast channels.
  }

  return () => {
    window.removeEventListener(EVENT_NAME, handleEvent);
    window.removeEventListener('storage', handleStorage);

    if (channel) {
      channel.onmessage = null;
      channel.close();
    }
  };
}

/**
 * Sends a confirmed mutation to other open application sessions immediately.
 * Database changes are still subscribed to above, so this is an acceleration
 * path rather than a replacement for the authoritative Postgres event.
 */
export function notifyRestaurantRealtimeSync(
  supabase: SupabaseClient,
  restaurantId: string,
  source = 'local'
) {
  notifyRestaurantSync(restaurantId, source);

  if (!restaurantId || typeof window === 'undefined') {
    return;
  }

  const channel = supabase.channel(getRealtimeTopic(restaurantId));
  const cleanup = () => {
    void supabase.removeChannel(channel);
  };

  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') {
      return;
    }

    void channel
      .send({
        type: 'broadcast',
        event: REALTIME_EVENT_NAME,
        payload: { restaurantId, source, timestamp: Date.now() },
      })
      .finally(cleanup);
  });

  window.setTimeout(cleanup, 5000);
}

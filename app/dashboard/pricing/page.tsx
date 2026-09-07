'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, CalendarClock, ChevronRight, CircleDollarSign, Filter, Percent, Search, Sparkles, Tag, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { notifyRestaurantRealtimeSync, subscribeRestaurantRealtime } from '@/lib/live-sync';
import { calculateAdjustedPrice, logMenuItemPricingChange, roundPrice } from '@/lib/pricing-audit';
import { DashboardLoader } from '@/app/dashboard/components/dashboard-loader';
import { applyRestaurantTheme, defaultRestaurantTheme, loadRestaurantTheme, subscribeRestaurantTheme } from '@/lib/restaurant-theme';
import { PlanRequired } from '@/app/dashboard/components/plan-required';
import {
  subscriptionAllows,
  type BillingPlan,
  type SubscriptionStatus,
} from '@/lib/billing/plans';

interface RestaurantSettings {
  currency: string;
  price_adjustment_enabled: boolean;
  price_adjustment_mode: 'percentage' | 'fixed' | null;
  price_adjustment_direction: 'increase' | 'decrease' | null;
  price_adjustment_value: number | null;
}

interface MenuPricingItem {
  id: string;
  name: string;
  price: number;
  created_at: string | null;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  discount_enabled: boolean;
  discount_start_at: string | null;
  discount_end_at: string | null;
}

interface PriceHistoryEntry {
  id: string;
  item_name?: string;
  old_price?: number;
  new_price?: number;
  direction?: 'increase' | 'decrease';
  created_at: string;
  summary: string;
  type: 'restaurant' | 'computed';
}

interface PromotionHistoryEntry {
  id: string;
  item_name: string;
  discount_value: number;
  discount_type: 'percentage' | 'fixed';
  discount_label: string;
  status: 'Active' | 'Scheduled' | 'Expired' | 'Disabled';
  start_at: string | null;
  end_at: string | null;
  created_at: string | null;
}

interface UnifiedHistoryRow {
  id: string;
  type: 'price' | 'price-adjustment' | 'discount' | 'promotion' | 'status';
  source: 'restaurant' | 'menu';
  sourceNote: string;
  item_name: string;
  old_value: string | number | null;
  new_value: string | number | null;
  action_label: string;
  summary: string;
  created_at: string;
  badge: 'success' | 'warning' | 'info' | 'neutral';
  value_kind?: 'currency' | 'percent';
}

type HistoryFilter = 'all' | 'price' | 'price-adjustment' | 'discount' | 'promotion' | 'status';
const historyTypeRank: Record<UnifiedHistoryRow['type'], number> = {
  'price-adjustment': 0,
  price: 1,
  discount: 2,
  promotion: 3,
  status: 4,
};

const emptyRestaurantSettings: RestaurantSettings = {
  currency: 'USD',
  price_adjustment_enabled: false,
  price_adjustment_mode: 'percentage',
  price_adjustment_direction: 'increase',
  price_adjustment_value: 0,
};

export default function PricingPromotionsPage() {
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState('Restaurant');
  const [restaurantSettings, setRestaurantSettings] = useState<RestaurantSettings>(emptyRestaurantSettings);
  const [items, setItems] = useState<MenuPricingItem[]>([]);
  const [history, setHistory] = useState<Array<{
    id: string;
    action: string;
    adjustment_mode: string;
    adjustment_value: number;
    currency: string;
    description: string;
    created_at: string;
  }>>([]);
  const [priceAuditHistory, setPriceAuditHistory] = useState<Array<{
    id: string;
    item_name: string;
    menu_item_id: string;
    change_type: 'price' | 'discount' | 'promotion' | 'status';
    direction: 'increase' | 'decrease' | 'discount' | 'status';
    old_price: number | null;
    new_price: number | null;
    old_discount_value: number | null;
    new_discount_value: number | null;
    discount_type: 'percentage' | 'fixed' | null;
    summary: string;
    created_at: string;
    details: Record<string, unknown>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState(defaultRestaurantTheme);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyRows, setHistoryRows] = useState<UnifiedHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [sortField, setSortField] = useState<'created_at' | 'item_name' | 'type' | 'old_value' | 'new_value'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [tableSearch, setTableSearch] = useState('');
  const [planAllowed, setPlanAllowed] = useState(true);

  const [markupMode, setMarkupMode] = useState<'percentage' | 'fixed'>('percentage');
  const [markupDirection, setMarkupDirection] = useState<'increase' | 'decrease'>('increase');
  const [markupEnabled, setMarkupEnabled] = useState(false);
  const [markupValue, setMarkupValue] = useState('5');

  const pricingText = !markupEnabled
    ? 'No restaurant-wide price adjustment is active.'
    : markupMode === 'percentage'
      ? `${markupDirection === 'increase' ? 'Increase' : 'Decrease'} menu prices by ${markupValue}%.`
      : `${markupDirection === 'increase' ? 'Increase' : 'Decrease'} menu prices by ${restaurantSettings.currency || 'USD'}${markupValue}.`;

  const isDiscountCurrentlyActive = (item: MenuPricingItem) => {
    if (!item.discount_enabled || !item.discount_type || !item.discount_value || item.discount_value <= 0) {
      return false;
    }

    const now = new Date();

    if (item.discount_start_at) {
      const startsAt = new Date(item.discount_start_at);
      if (Number.isNaN(startsAt.getTime()) || startsAt > now) {
        return false;
      }
    }

    if (item.discount_end_at) {
      const endsAt = new Date(item.discount_end_at);
      if (Number.isNaN(endsAt.getTime()) || endsAt < now) {
        return false;
      }
    }

    return true;
  };

  const getDiscountLabel = (item: MenuPricingItem) => {
    if (!item.discount_enabled || !item.discount_type || !item.discount_value) {
      return 'No active discount';
    }

    if (item.discount_type === 'percentage') {
      return `${item.discount_value}% off`;
    }

    return `${restaurantSettings.currency || 'USD'}${item.discount_value} off`;
  };

  const getBasePriceWithAdjustment = (price: number) => {
    if (!restaurantSettings.price_adjustment_enabled || !restaurantSettings.price_adjustment_mode || !restaurantSettings.price_adjustment_direction) {
      return price;
    }

    return calculateAdjustedPrice(
      price,
      restaurantSettings.price_adjustment_direction,
      restaurantSettings.price_adjustment_mode,
      Number(restaurantSettings.price_adjustment_value) || 0
    );
  };

  const formatHistoryValue = (
    value: string | number | null | undefined,
    fallback = '—',
    valueKind: 'currency' | 'percent' = 'currency'
  ) => {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }

    const numeric = Number(value);
    if (!Number.isNaN(numeric)) {
      if (valueKind === 'percent') {
        return `${numeric.toFixed(2)}%`;
      }

      return `${restaurantSettings.currency || 'USD'}${Number.isInteger(numeric) ? numeric.toString() : numeric.toFixed(2)}`;
    }

    return String(value);
  };

  const historyPageCount = Math.max(1, Math.ceil(historyTotal / 15));

  const loadPricing = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: membership } = await supabase
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.restaurant_id) {
      setLoading(false);
      return;
    }

    const restaurantIdValue = membership.restaurant_id;
      setRestaurantId(restaurantIdValue);

      const { data: subscription } = await supabase
        .from('restaurant_subscriptions')
        .select('plan_code, status, trial_ends_at')
        .eq('restaurant_id', restaurantIdValue)
        .maybeSingle();

      const allowed = subscriptionAllows(
        subscription as {
          plan_code: BillingPlan;
          status: SubscriptionStatus;
          trial_ends_at: string;
        } | null,
        'pricing'
      );

      setPlanAllowed(allowed);

      if (!allowed) {
        setLoading(false);
        return;
      }

      const { data: restaurant } = await supabase
        .from('restaurants')
      .select('*')
      .eq('id', restaurantIdValue)
      .single();

    if (restaurant) {
      setRestaurantName(restaurant.name || 'Restaurant');
      const nextSettings: RestaurantSettings = {
        currency: restaurant.currency || 'USD',
        price_adjustment_enabled: restaurant.price_adjustment_enabled === true,
        price_adjustment_mode: restaurant.price_adjustment_mode || 'percentage',
        price_adjustment_direction: restaurant.price_adjustment_direction || 'increase',
        price_adjustment_value: Number(restaurant.price_adjustment_value) || 0,
      };

      setRestaurantSettings(nextSettings);
      setMarkupMode(nextSettings.price_adjustment_mode || 'percentage');
      setMarkupDirection(nextSettings.price_adjustment_direction || 'increase');
      setMarkupEnabled(nextSettings.price_adjustment_enabled === true);
      setMarkupValue(String(nextSettings.price_adjustment_value ?? '0'));
    }

    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('id, name, price, created_at, discount_type, discount_value, discount_enabled, discount_start_at, discount_end_at')
      .eq('restaurant_id', restaurantIdValue)
      .order('created_at', { ascending: false });

    if (menuItems) {
      setItems(menuItems as MenuPricingItem[]);
    }

    const nextTheme = await loadRestaurantTheme(supabase, restaurantIdValue);
    setTheme(nextTheme);
    applyRestaurantTheme(nextTheme);

    setLoading(false);
  };

  const loadHistoryPage = async () => {
    if (!restaurantId) {
      return;
    }

    setHistoryLoading(true);

    const pageSize = 15;
    const start = (historyPage - 1) * pageSize;
    const end = start + pageSize - 1;

    const baseRestaurantQuery = supabase
      .from('restaurant_price_adjustment_history')
      .select('*', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    const baseMenuQuery = supabase
      .from('menu_item_pricing_history')
      .select('*', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    const [restaurantResult, menuResult] = await Promise.all([
      baseRestaurantQuery,
      baseMenuQuery,
    ]);

    if (restaurantResult.error || menuResult.error) {
      setHistoryRows([]);
      setHistoryTotal(0);
      setPriceAuditHistory([]);
      setHistoryLoading(false);
      return;
    }

    const restaurantHistory = (restaurantResult.data ?? []).filter((row) => {
      if (historyFilter === 'price') {
        return false;
      }

      if (historyFilter === 'price-adjustment') {
        return row.action === 'increase' || row.action === 'decrease';
      }

      if (historyFilter === 'discount' || historyFilter === 'promotion') {
        return row.action === 'discount' || row.action === 'promotion';
      }

      if (historyFilter === 'status') {
        return row.action === 'disabled' || row.action === 'enabled';
      }

      return true;
    });

    const restaurantRows: UnifiedHistoryRow[] = restaurantHistory.map((row) => ({
      id: String(row.id),
      type: row.action === 'disabled' || row.action === 'enabled' ? 'status' : 'price-adjustment',
      source: 'restaurant',
      sourceNote: 'Restaurant-wide adjustment',
      item_name: row.description || 'Restaurant-wide pricing',
      old_value: null,
      new_value: row.adjustment_value ?? null,
      action_label: row.action === 'disabled' ? 'Status' : row.action === 'increase' || row.action === 'decrease' ? 'Price Adjustment' : String(row.action || 'Price'),
      summary: row.description || 'Restaurant-wide pricing update',
      created_at: row.created_at || new Date().toISOString(),
      badge: row.action === 'disabled' ? 'neutral' : row.action === 'increase' ? 'success' : row.action === 'decrease' ? 'warning' : 'info',
      value_kind: row.adjustment_mode === 'percentage' ? 'percent' : 'currency',
    }));

    const menuHistory = menuResult.data ?? [];
    const filteredMenuHistory = menuHistory.filter((row) => {
      if (historyFilter === 'price') {
        return row.change_type === 'price';
      }

      if (historyFilter === 'price-adjustment') {
        return false;
      }

      if (historyFilter === 'discount') {
        return row.change_type === 'discount' || row.change_type === 'promotion';
      }

      if (historyFilter === 'promotion') {
        return row.change_type === 'promotion';
      }

      if (historyFilter === 'status') {
        return row.change_type === 'status';
      }

      return true;
    });

    setPriceAuditHistory(menuHistory as typeof priceAuditHistory);

    const menuRows: UnifiedHistoryRow[] = filteredMenuHistory.map((row) => {
      const isDiscountEvent = row.change_type === 'discount' || row.change_type === 'promotion';
      const isPriceAdjustment = row.change_type === 'price' && row.details?.source === 'one-time-price-adjustment';
      const kind: UnifiedHistoryRow['type'] = row.change_type === 'discount' ? 'discount' : row.change_type === 'promotion' ? 'promotion' : row.change_type === 'status' ? 'status' : 'price';
      const discountType = row.discount_type ?? 'percentage';

      return {
        id: String(row.id),
        type: kind,
        source: 'menu',
        sourceNote: isPriceAdjustment ? 'Restaurant-wide' : 'Manual',
        item_name: row.item_name || 'Menu item',
        old_value: isDiscountEvent ? (row.old_discount_value ?? row.old_price ?? null) : (row.old_price ?? null),
        new_value: isDiscountEvent ? (row.new_discount_value ?? row.new_price ?? null) : (row.new_price ?? null),
        action_label: row.change_type === 'discount' ? 'Discount' : row.change_type === 'promotion' ? 'Promotion' : row.change_type === 'status' ? 'Status' : 'Price',
        summary: row.summary || 'Menu pricing update',
        created_at: row.created_at || new Date().toISOString(),
        badge: row.change_type === 'discount' ? 'info' : row.change_type === 'promotion' ? 'success' : row.change_type === 'status' ? 'neutral' : 'warning',
        value_kind: isDiscountEvent && discountType === 'percentage' ? 'percent' : 'currency',
      };
    });

    const merged = [...restaurantRows, ...menuRows]
      .sort((a, b) => {
        const timeDelta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (timeDelta !== 0) {
          return timeDelta;
        }

        return (historyTypeRank[a.type] ?? 99) - (historyTypeRank[b.type] ?? 99);
      });

    setHistoryTotal(merged.length);
    setHistoryRows(merged.slice(start, end + 1));
    setHistoryLoading(false);
  };

  const getDiscountStatus = (item: MenuPricingItem): PromotionHistoryEntry['status'] => {
    if (!item.discount_enabled) {
      return 'Disabled';
    }

    if (isDiscountCurrentlyActive(item)) {
      return 'Active';
    }

    if (item.discount_start_at && new Date(item.discount_start_at) > new Date()) {
      return 'Scheduled';
    }

    return 'Expired';
  };

  const promotionHistory = useMemo<PromotionHistoryEntry[]>(() => {
    return items
      .filter((item) => {
        const status = getDiscountStatus(item);
        return status === 'Active' || status === 'Scheduled';
      })
      .map((item) => {
        const discountValue = Number(item.discount_value) || 0;
        const discountType = item.discount_type || 'percentage';

        return {
          id: item.id,
          item_name: item.name,
          discount_value: discountValue,
          discount_type: discountType,
          discount_label: getDiscountLabel(item),
          status: getDiscountStatus(item),
          start_at: item.discount_start_at,
          end_at: item.discount_end_at,
          created_at: item.created_at,
        };
      })
      .sort((a, b) => {
        const aTime = a.start_at ? new Date(a.start_at).getTime() : new Date(a.created_at || Date.now()).getTime();
        const bTime = b.start_at ? new Date(b.start_at).getTime() : new Date(b.created_at || Date.now()).getTime();
        return bTime - aTime;
      });
  }, [items, restaurantSettings.currency]);

  const pricingSnapshot = useMemo(() => {
    const activePromoItems = items.filter((item) => {
      const status = getDiscountStatus(item);
      return status === 'Active';
    }).length;

    const scheduledPromos = items.filter((item) => {
      const status = getDiscountStatus(item);
      return status === 'Scheduled';
    }).length;

    return {
      activePromoItems,
      scheduledPromos,
      ruleEnabled: Boolean(restaurantSettings.price_adjustment_enabled),
    };
  }, [items, restaurantSettings.price_adjustment_enabled]);

  const promotionAuditHistory = useMemo<PromotionHistoryEntry[]>(() => {
    return priceAuditHistory
      .filter((entry) => entry.change_type === 'discount' || entry.change_type === 'promotion' || entry.change_type === 'status')
      .map((entry) => {
        const details = entry.details || {};
        const enabled = details.new_discount_enabled === undefined
          ? entry.new_discount_value !== null
          : Boolean(details.new_discount_enabled);
        const startAt = typeof details.start_at === 'string' ? details.start_at : null;
        const endAt = typeof details.end_at === 'string' ? details.end_at : null;
        const status: PromotionHistoryEntry['status'] = !enabled
          ? 'Disabled'
          : startAt && new Date(startAt) > new Date()
            ? 'Scheduled'
            : endAt && new Date(endAt) < new Date()
              ? 'Expired'
              : 'Active';
        const value = entry.new_discount_value ?? entry.old_discount_value ?? 0;

        return {
          id: entry.id,
          item_name: entry.item_name,
          discount_value: Number(value) || 0,
          discount_type: entry.discount_type || 'percentage',
          discount_label: entry.discount_type === 'fixed'
            ? `${restaurantSettings.currency || 'USD'}${Number.isInteger(Number(value)) ? Number(value).toString() : Number(value).toFixed(2)} off`
            : `${Number(value) || 0}% off`,
          status,
          start_at: startAt,
          end_at: endAt,
          created_at: entry.created_at,
        };
      });
  }, [priceAuditHistory, restaurantSettings.currency]);

  const handleSort = (field: 'created_at' | 'item_name' | 'type' | 'old_value' | 'new_value') => {
    if (sortField === field) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortField(field);
    setSortDirection(field === 'created_at' || field === 'item_name' ? 'desc' : 'asc');
  };

  const sortedHistoryRows = useMemo(() => {
    const rows = [...historyRows];

    rows.sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1;

      switch (sortField) {
        case 'type':
          return direction * (a.action_label.localeCompare(b.action_label));
        case 'item_name':
          return direction * (a.item_name.localeCompare(b.item_name));
        case 'old_value': {
          const aValue = Number(a.old_value ?? 0);
          const bValue = Number(b.old_value ?? 0);
          return direction * (aValue - bValue);
        }
        case 'new_value': {
          const aValue = Number(a.new_value ?? 0);
          const bValue = Number(b.new_value ?? 0);
          return direction * (aValue - bValue);
        }
        case 'created_at':
        default:
          return direction * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      }
    });

    return rows;
  }, [historyRows, sortDirection, sortField]);

  const visibleHistoryRows = useMemo(() => {
    const query = tableSearch.trim().toLowerCase();

    if (!query) {
      return sortedHistoryRows;
    }

    return sortedHistoryRows.filter((row) => {
      const haystack = [row.item_name, row.action_label, row.summary, row.type, row.source].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [sortedHistoryRows, tableSearch]);

  const renderSortIcon = (field: 'created_at' | 'item_name' | 'type' | 'old_value' | 'new_value') => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />;
    }

    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />;
  };

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    let active = true;

    const syncTheme = async () => {
      const nextTheme = await loadRestaurantTheme(supabase, restaurantId);
      if (!active) {
        return;
      }

      setTheme(nextTheme);
      applyRestaurantTheme(nextTheme);
    };

    syncTheme();

    const unsubscribe = subscribeRestaurantTheme(supabase, restaurantId, (nextTheme) => {
      if (!active) {
        return;
      }

      setTheme(nextTheme);
      applyRestaurantTheme(nextTheme);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [restaurantId]);

  useEffect(() => {
    loadPricing();
  }, []);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    loadHistoryPage();
  }, [restaurantId, historyPage, historyFilter]);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    const unsubscribe = subscribeRestaurantRealtime(supabase, {
      restaurantId,
      name: 'dashboard-pricing',
      tables: [
        'menu_items',
        'menu_item_extras',
        'categories',
        'menu_item_pricing_history',
        'restaurant_price_adjustment_history',
      ],
      onChange: async () => {
      await loadPricing();
      await loadHistoryPage();
      },
    });

    return () => {
      unsubscribe();
    };
  }, [restaurantId]);

  const handleSave = async () => {
    if (!restaurantId) {
      setMessage('No restaurant was found for this account.');
      return;
    }

    setSaving(true);
    setMessage('');

    const adjustmentValue = Number(markupValue);

    if (markupEnabled && (!Number.isFinite(adjustmentValue) || adjustmentValue < 0)) {
      setSaving(false);
      setMessage('Enter a valid adjustment value.');
      return;
    }

    const value = roundPrice(adjustmentValue || 0);
    let changedItems: Array<{
      id: string;
      name: string;
      oldPrice: number;
      newPrice: number;
    }> = [];

    if (markupEnabled && value > 0) {
      const { data: currentItems, error: itemsError } = await supabase
        .from('menu_items')
        .select('id, name, price')
        .eq('restaurant_id', restaurantId);

      if (itemsError) {
        setSaving(false);
        setMessage(`Could not load current menu prices: ${itemsError.message}`);
        return;
      }

      changedItems = (currentItems || [])
        .map((item) => {
          const oldPrice = roundPrice(Number(item.price) || 0);
          const newPrice = calculateAdjustedPrice(
            oldPrice,
            markupDirection,
            markupMode,
            value
          );

          return {
            id: item.id,
            name: item.name,
            oldPrice,
            newPrice,
          };
        })
        .filter((item) => item.oldPrice !== item.newPrice);

      const updateResults = await Promise.all(
        changedItems.map((item) =>
          supabase
            .from('menu_items')
            .update({ price: item.newPrice })
            .eq('id', item.id)
            .eq('restaurant_id', restaurantId)
        )
      );

      const updateError = updateResults.find((result) => result.error)?.error;
      if (updateError) {
        setSaving(false);
        setMessage(`Could not apply the price adjustment: ${updateError.message}`);
        return;
      }
    }

    const payload = {
      currency: restaurantSettings.currency,
      price_adjustment_mode: markupMode,
      price_adjustment_direction: markupDirection,
      price_adjustment_enabled: false,
      price_adjustment_value: value,
    };

    const { error } = await supabase
      .from('restaurants')
      .update(payload)
      .eq('id', restaurantId);

    setSaving(false);

    if (error) {
      setMessage(`Could not save pricing settings: ${error.message}`);
      return;
    }

    for (const item of changedItems) {
      await logMenuItemPricingChange(supabase, {
        restaurant_id: restaurantId,
        menu_item_id: item.id,
        item_name: item.name,
        change_type: 'price',
        direction: markupDirection,
        old_price: item.oldPrice,
        new_price: item.newPrice,
        summary: `${item.name}: ${formatHistoryValue(item.oldPrice)} → ${formatHistoryValue(item.newPrice)}`,
        details: {
          source: 'one-time-price-adjustment',
          adjustment_mode: markupMode,
          adjustment_value: value,
        },
      });
    }

    if (markupEnabled && value > 0) {
      const adjustmentDescription = `${markupDirection === 'increase' ? 'Increase' : 'Decrease'} prices by ${value}${markupMode === 'percentage' ? '%' : ` ${restaurantSettings.currency}`}`;
      const { error: adjustmentHistoryError } = await supabase
        .from('restaurant_price_adjustment_history')
        .insert({
          restaurant_id: restaurantId,
          action: markupDirection,
          adjustment_mode: markupMode,
          adjustment_value: value,
          currency: restaurantSettings.currency,
          description: adjustmentDescription,
          created_at: new Date().toISOString(),
        });

      if (adjustmentHistoryError) {
        console.error('Could not save price adjustment history:', adjustmentHistoryError);
      }
    }

    await loadHistoryPage();

    setRestaurantSettings((current) => ({
      ...current,
      currency: restaurantSettings.currency,
      price_adjustment_mode: markupMode,
      price_adjustment_direction: markupDirection,
      price_adjustment_enabled: false,
      price_adjustment_value: Number(markupValue) || 0,
    }));
    setMarkupEnabled(false);

    notifyRestaurantRealtimeSync(supabase, restaurantId, 'pricing');
    setMessage(
      markupEnabled
        ? `Applied once to ${changedItems.length} menu item${changedItems.length === 1 ? '' : 's'}.`
        : 'Price adjustment disabled.'
    );
  };

  if (loading) {
    return <DashboardLoader />;
  }

  if (!planAllowed) {
    return (
      <PlanRequired
        featureName="Pricing & Promotions"
        requiredPlan="Enterprise"
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ background: theme.portal_background, color: theme.portal_text }}>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-7 rounded-[28px] border p-6 shadow-sm" style={{ background: theme.portal_surface, borderColor: theme.portal_border }}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: theme.portal_accent }}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: theme.portal_accent }} />
                Workspace
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Pricing & Promotions</h1>
              <p className="mt-2 text-sm" style={{ color: `${theme.portal_text}90` }}>
                Manage pricing rules, active promotions, and pricing changes in one place.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border px-4 py-3 text-right" style={{ borderColor: theme.portal_border, background: `${theme.portal_accent}10` }}>
                <div className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: `${theme.portal_text}70` }}>Currency</div>
                <div className="mt-1 text-lg font-black">{restaurantSettings.currency}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          <div className="space-y-6">
            <div className="rounded-[28px] border p-6 shadow-sm" style={{ background: theme.portal_surface, borderColor: theme.portal_border }}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: theme.portal_accent_soft, color: theme.portal_accent }}>
                  <CircleDollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: `${theme.portal_text}70` }}>Pricing rules</p>
                  <h2 className="text-xl font-black">Current price adjustment</h2>
                </div>
              </div>

              <div className="space-y-4">
                <button type="button" onClick={() => setMarkupEnabled((enabled) => !enabled)} className="flex w-full items-center justify-between rounded-2xl border p-4 text-left transition" style={{ borderColor: markupEnabled ? theme.portal_accent : theme.portal_border, background: markupEnabled ? theme.portal_accent_soft : theme.portal_background }}>
                  <span>
                    <span className="block text-sm font-black">Apply once to all menu prices</span>
                    <span className="mt-1 block text-xs" style={{ color: `${theme.portal_text}70` }}>Each save uses the current saved price and then turns itself off.</span>
                  </span>
                  <span className={`h-6 w-11 rounded-full p-1 transition ${markupEnabled ? 'bg-[#536DFE]' : 'bg-[#E8E7E4]'}`}>
                    <span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition ${markupEnabled ? 'translate-x-5' : ''}`} />
                  </span>
                </button>

                <div>
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: `${theme.portal_text}70` }}>Increase or decrease</label>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl p-1" style={{ background: theme.portal_background }}>
                    {(['increase', 'decrease'] as const).map((direction) => (
                      <button key={direction} type="button" onClick={() => setMarkupDirection(direction)} className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${markupDirection === direction ? 'bg-[#202534] text-white' : 'text-[#756F66]'}`}>
                        {direction}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: `${theme.portal_text}70` }}>Adjustment type</label>
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F7F5F1] p-1">
                    <button type="button" onClick={() => setMarkupMode('percentage')} className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${markupMode === 'percentage' ? 'bg-[#202534] text-white' : 'text-[#756F66]'}`}>
                      %
                    </button>
                    <button type="button" onClick={() => setMarkupMode('fixed')} className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${markupMode === 'fixed' ? 'bg-[#202534] text-white' : 'text-[#756F66]'}`}>
                      Fixed
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: `${theme.portal_text}70` }}>Value</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={markupValue}
                    onChange={(e) => setMarkupValue(e.target.value)} className="w-full rounded-2xl border border-[#E7E4DE] bg-[#F7F5F1] px-4 py-3 text-sm text-[#202534] outline-none transition focus:border-[#536DFE] focus:ring-4 focus:ring-[#536DFE]/10" />
                </div>

                <div className="rounded-2xl border p-4 text-sm" style={{ background: theme.portal_background, borderColor: theme.portal_border }}>
                  {pricingText}
                </div>

                {message && (
                  <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${message.toLowerCase().includes('success') ? 'border-[#EFE3CF] bg-[#EEF0FF] text-[#756F66]' : 'border-[#E7E4DE] bg-[#F7F5F1] text-[#A85C4A]'}`}>
                    {message}
                  </div>
                )}

                <button type="button" onClick={handleSave} disabled={saving} className="w-full rounded-2xl bg-[#202534] px-5 py-3.5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#536DFE] disabled:opacity-60">
                  {saving ? 'Saving...' : 'Save pricing rule'}
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border p-6 shadow-sm" style={{ background: theme.portal_surface, borderColor: theme.portal_border }}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: theme.portal_accent_soft, color: theme.portal_accent }}>
                  <Tag className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: `${theme.portal_text}70` }}>Active rules</p>
                  <h2 className="text-xl font-black">Active and scheduled discounts</h2>
                </div>
              </div>

              <div className="space-y-3">
                {promotionHistory.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-5 text-sm" style={{ borderColor: theme.portal_border, color: `${theme.portal_text}75` }}>
                    No active or scheduled discounts found.
                  </div>
                ) : (
                  promotionHistory.map((item) => (
                    <div key={item.id} className="rounded-2xl border p-4" style={{ background: theme.portal_background, borderColor: theme.portal_border }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-base font-black">{item.item_name}</div>
                          <div className="mt-1 text-xs" style={{ color: `${theme.portal_text}70` }}>{item.discount_label}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${item.status === 'Active' ? 'bg-[#E8F5ED] text-[#3E8E68]' : item.status === 'Scheduled' ? 'bg-[#EEF0FF] text-[#536DFE]' : 'bg-[#F7F5F1] text-[#756F66]'}`}>
                          {item.status}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px]" style={{ color: `${theme.portal_text}75` }}>
                        {item.start_at && <span className="rounded-full border px-2.5 py-1" style={{ borderColor: theme.portal_border }}>Starts {new Date(item.start_at).toLocaleString()}</span>}
                        {item.end_at && <span className="rounded-full border px-2.5 py-1" style={{ borderColor: theme.portal_border }}>Ends {new Date(item.end_at).toLocaleString()}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border p-6 shadow-sm" style={{ background: theme.portal_surface, borderColor: theme.portal_border }}>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: `${theme.portal_text}70` }}>Overview</p>
                  <h2 className="mt-1 text-xl font-black">Pricing snapshot</h2>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: theme.portal_accent_soft, color: theme.portal_accent }}>
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl p-4" style={{ background: theme.portal_background }}>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: `${theme.portal_text}70` }}>Active promo items</span>
                    <span className="font-black">{pricingSnapshot.activePromoItems}</span>
                  </div>
                </div>

                <div className="rounded-2xl p-4" style={{ background: theme.portal_background }}>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: `${theme.portal_text}70` }}>Scheduled promos</span>
                    <span className="font-black">{pricingSnapshot.scheduledPromos}</span>
                  </div>
                </div>

                <div className="rounded-2xl p-4" style={{ background: theme.portal_background }}>
                  <div className="flex items-center justify-between text-sm">
                    <span style={{ color: `${theme.portal_text}70` }}>Rule enabled</span>
                    <span className="font-black">{pricingSnapshot.ruleEnabled ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border p-6 shadow-sm" style={{ background: theme.portal_surface, borderColor: theme.portal_border }}>
              <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: theme.portal_accent_soft, color: theme.portal_accent }}>
                    <Percent className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: `${theme.portal_text}70` }}>History</p>
                    <h2 className="text-lg font-black">Pricing history</h2>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(['all', 'price', 'price-adjustment', 'discount', 'promotion', 'status'] as HistoryFilter[]).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setHistoryFilter(filter);
                        setHistoryPage(1);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${historyFilter === filter ? 'text-white' : ''}`}
                      style={{
                        borderColor: historyFilter === filter ? theme.portal_accent : theme.portal_border,
                        background: historyFilter === filter ? theme.portal_accent : 'transparent',
                        color: historyFilter === filter ? '#fff' : theme.portal_text,
                      }}
                    >
                      {filter === 'all' ? 'All' : filter === 'price-adjustment' ? 'Price Adjustment' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em]" style={{ background: theme.portal_background, borderColor: theme.portal_border, color: `${theme.portal_text}70` }}>
                <span>{historyTotal} records</span>
                <span>Newest first</span>
              </div>

              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: `${theme.portal_text}60` }} />
                  <input
                    type="search"
                    value={tableSearch}
                    onChange={(event) => setTableSearch(event.target.value)}
                    placeholder="Search item, type, summary..."
                    className="w-full rounded-2xl border bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#536DFE] focus:ring-4 focus:ring-[#536DFE]/10"
                    style={{ borderColor: theme.portal_border, color: theme.portal_text }}
                  />
                </div>

                <div className="flex items-center gap-2 rounded-2xl border px-3 py-2" style={{ borderColor: theme.portal_border, background: theme.portal_background }}>
                  <Filter className="h-4 w-4" style={{ color: `${theme.portal_text}70` }} />
                  <select
                    value={historyFilter}
                    onChange={(event) => {
                      setHistoryFilter(event.target.value as HistoryFilter);
                      setHistoryPage(1);
                    }}
                    className="bg-transparent text-xs font-black uppercase tracking-[0.12em] outline-none"
                    style={{ color: theme.portal_text }}
                  >
                    <option value="all">All</option>
                    <option value="price">Price</option>
                    <option value="price-adjustment">Price Adjustment</option>
                    <option value="discount">Discount</option>
                    <option value="promotion">Promotion</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>

              <div className="overflow-hidden rounded-[22px] border" style={{ background: theme.portal_background, borderColor: theme.portal_border }}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead style={{ background: `${theme.portal_surface}` }}>
                      <tr className="border-b" style={{ borderColor: theme.portal_border }}>
                        <th className="cursor-pointer px-4 py-3 font-black uppercase tracking-[0.12em] text-[10px]" style={{ color: `${theme.portal_text}70` }} onClick={() => handleSort('type')}>
                          <span className="inline-flex items-center gap-1.5">Type {renderSortIcon('type')}</span>
                        </th>
                        <th className="cursor-pointer px-4 py-3 font-black uppercase tracking-[0.12em] text-[10px]" style={{ color: `${theme.portal_text}70` }} onClick={() => handleSort('item_name')}>
                          <span className="inline-flex items-center gap-1.5">Item {renderSortIcon('item_name')}</span>
                        </th>
                        <th className="cursor-pointer px-4 py-3 font-black uppercase tracking-[0.12em] text-[10px]" style={{ color: `${theme.portal_text}70` }} onClick={() => handleSort('old_value')}>
                          <span className="inline-flex items-center gap-1.5">Old {renderSortIcon('old_value')}</span>
                        </th>
                        <th className="cursor-pointer px-4 py-3 font-black uppercase tracking-[0.12em] text-[10px]" style={{ color: `${theme.portal_text}70` }} onClick={() => handleSort('new_value')}>
                          <span className="inline-flex items-center gap-1.5">New {renderSortIcon('new_value')}</span>
                        </th>
                        <th className="cursor-pointer px-4 py-3 font-black uppercase tracking-[0.12em] text-[10px]" style={{ color: `${theme.portal_text}70` }} onClick={() => handleSort('created_at')}>
                          <span className="inline-flex items-center gap-1.5">Date {renderSortIcon('created_at')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: `${theme.portal_text}70` }}>Loading history…</td>
                        </tr>
                      ) : visibleHistoryRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: `${theme.portal_text}70` }}>No pricing history for this filter.</td>
                        </tr>
                      ) : (
                        visibleHistoryRows.map((entry) => (
                          <tr key={entry.id} className="border-t align-top" style={{ borderColor: theme.portal_border }}>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${entry.badge === 'success' ? 'bg-[#E8F5ED] text-[#3E8E68]' : entry.badge === 'warning' ? 'bg-[#FFF3E6] text-[#C67739]' : entry.badge === 'info' ? 'bg-[#EEF0FF] text-[#536DFE]' : 'bg-[#F7F5F1] text-[#756F66]'}`}>
                                {entry.action_label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold">{entry.item_name}</div>
                              <div className="mt-1 text-[11px]" style={{ color: `${theme.portal_text}65` }}>{entry.sourceNote}</div>
                            </td>
                            <td className="px-4 py-3 text-sm" style={{ color: `${theme.portal_text}80` }}>{formatHistoryValue(entry.old_value, '—', entry.value_kind ?? 'currency')}</td>
                            <td className="px-4 py-3 text-sm font-semibold" style={{ color: theme.portal_text }}>{formatHistoryValue(entry.new_value, '—', entry.value_kind ?? 'currency')}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: `${theme.portal_text}70` }}>{new Date(entry.created_at).toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[11px]" style={{ color: `${theme.portal_text}70` }}>
                  Showing {historyRows.length} of {historyTotal}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    disabled={historyPage <= 1 || historyLoading}
                    className="rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] disabled:opacity-40"
                    style={{ borderColor: theme.portal_border, color: theme.portal_text }}
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, historyPageCount) }, (_, index) => {
                      const pageNumber = index + 1;
                      const isCurrent = pageNumber === historyPage;
                      return (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => setHistoryPage(pageNumber)}
                          className="h-8 w-8 rounded-full text-[11px] font-black"
                          style={{
                            background: isCurrent ? theme.portal_accent : 'transparent',
                            color: isCurrent ? '#fff' : theme.portal_text,
                            border: `1px solid ${theme.portal_border}`,
                          }}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))}
                    disabled={historyPage >= historyPageCount || historyLoading}
                    className="rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] disabled:opacity-40"
                    style={{ borderColor: theme.portal_border, color: theme.portal_text }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

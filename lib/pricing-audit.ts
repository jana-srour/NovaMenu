import type { SupabaseClient } from '@supabase/supabase-js';

export type PriceDirection = 'increase' | 'decrease' | 'discount' | 'status';
export type PriceChangeType = 'price' | 'discount' | 'promotion' | 'status';

export function roundPrice(value: number) {
  const safeValue = Number(value) || 0;
  return Math.round((safeValue + Number.EPSILON) * 100) / 100;
}

export function calculateAdjustedPrice(
  basePrice: number,
  direction: 'increase' | 'decrease',
  mode: 'percentage' | 'fixed',
  value: number
) {
  const safeBase = roundPrice(basePrice);
  const safeValue = Number(value) || 0;

  if (mode === 'percentage') {
    const multiplier = safeValue / 100;
    return roundPrice(direction === 'increase'
      ? safeBase * (1 + multiplier)
      : Math.max(0, safeBase * (1 - multiplier)));
  }

  return roundPrice(direction === 'increase'
    ? safeBase + safeValue
    : Math.max(0, safeBase - safeValue));
}

export async function logMenuItemPricingChange(
  supabaseClient: Pick<SupabaseClient, 'from'>,
  params: {
    restaurant_id: string;
    menu_item_id: string;
    item_name: string;
    change_type: PriceChangeType;
    direction: PriceDirection;
    old_price?: number | null;
    new_price?: number | null;
    old_discount_value?: number | null;
    new_discount_value?: number | null;
    discount_type?: 'percentage' | 'fixed' | null;
    summary: string;
    created_at?: string;
    details?: Record<string, unknown>;
  }
) {
  const { error } = await supabaseClient
    .from('menu_item_pricing_history')
    .insert({
      restaurant_id: params.restaurant_id,
      menu_item_id: params.menu_item_id,
      item_name: params.item_name,
      change_type: params.change_type,
      direction: params.direction,
      old_price: params.old_price ?? null,
      new_price: params.new_price ?? null,
      old_discount_value: params.old_discount_value ?? null,
      new_discount_value: params.new_discount_value ?? null,
      discount_type: params.discount_type ?? null,
      summary: params.summary,
      details: params.details ?? {},
      created_at: params.created_at ?? new Date().toISOString(),
    });

  return { error };
}

import { supabase } from '@/lib/supabase';

export type ReportDateRange = {
  from?: string;
  to?: string;
};

export type ReportRestaurant = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  logo_url: string | null;
};

export type ReportCategory = {
  id: string;
  name: string;
  sort_order: number | null;
};

export type ReportMenuItem = {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  is_available: boolean;
  sort_order: number | null;
  discount_type: string | null;
  discount_value: number | null;
  discount_enabled: boolean;
  discount_start_at: string | null;
  discount_end_at: string | null;
};

export type ReportOrder = {
  id: string;
  order_number: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  table_number?: string | null;
  channel?: string | null;
  total: number | null;
  status: string;
  created_at: string;
};

export type ReportOrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  extras: unknown;
};

export type ReportDiscount = {
  id: string;
  restaurant_id: string;
  name: string;
  discount_type: string;
  discount_value: number;
  start_at: string | null;
  end_at: string | null;
  is_active: boolean;
  category_id: string | null;
  menu_item_id: string | null;
  created_at: string;
};

export type ReportPricingHistory = {
  id?: string;
  restaurant_id?: string;
  action?: string | null;
  adjustment_mode?: string | null;
  adjustment_value?: number | null;
  currency?: string | null;
  description?: string | null;
  created_at: string;
};

export type ReportMenuPricingHistory = {
  id?: string;
  restaurant_id?: string;
  menu_item_id?: string | null;
  item_name?: string | null;
  change_type?: string | null;
  direction?: string | null;
  old_price?: number | null;
  new_price?: number | null;
  old_discount_value?: number | null;
  new_discount_value?: number | null;
  discount_type?: string | null;
  summary?: string | null;
  created_at: string;
  details?: Record<string, unknown> | null;
};

export type ReportsData = {
  restaurant: ReportRestaurant;
  categories: ReportCategory[];
  menuItems: ReportMenuItem[];
  orders: ReportOrder[];
  orderItems: ReportOrderItem[];
  discounts: ReportDiscount[];
  restaurantPricingHistory: ReportPricingHistory[];
  menuPricingHistory: ReportMenuPricingHistory[];
};

export function getReportPeriodRange(
  period: '7d' | '30d' | '90d' | '12m',
  anchor = new Date(),
): ReportDateRange {
  const start = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate(),
  );
  const end = new Date(
    anchor.getFullYear(),
    anchor.getMonth(),
    anchor.getDate() + 1,
  );

  if (period === '7d') {
    start.setDate(start.getDate() - 6);
  } else if (period === '30d') {
    start.setDate(start.getDate() - 29);
  } else if (period === '90d') {
    start.setDate(start.getDate() - 89);
  } else {
    start.setDate(1);
    start.setMonth(start.getMonth() - 11);
  }

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

export async function getCurrentRestaurantId(): Promise<string | null> {
  const { data: auth, error: authError } =
    await supabase.auth.getUser();

  if (authError || !auth.user) {
    return null;
  }

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from('restaurant_members')
    .select('restaurant_id')
    .eq('user_id', auth.user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error(
      'Reports membership lookup failed:',
      membershipError
    );

    return null;
  }

  return membership?.restaurant_id ?? null;
}

function applyDateRange<
  T extends {
    gte: (
      column: string,
      value: string
    ) => T;

    lt: (
      column: string,
      value: string
    ) => T;
  }
>(
  query: T,
  range?: ReportDateRange
): T {
  let result = query;

  if (range?.from) {
    result = result.gte(
      'created_at',
      range.from
    );
  }

  if (range?.to) {
    result = result.lt(
      'created_at',
      range.to
    );
  }

  return result;
}

export async function getReportsData(
  range?: ReportDateRange
): Promise<ReportsData | null> {
  const restaurantId =
    await getCurrentRestaurantId();

  if (!restaurantId) {
    return null;
  }

  /*
   * Load the restaurant/menu information and
   * orders independently.
   *
   * Orders are filtered by their REAL created_at.
   */

  const [
    restaurantResult,
    categoriesResult,
    menuItemsResult,
    ordersResult,
    discountsResult,
    restaurantPricingHistoryResult,
    menuPricingHistoryResult,
  ] = await Promise.all([
    supabase
      .from('restaurants')
      .select(
        'id, name, slug, currency, logo_url'
      )
      .eq('id', restaurantId)
      .single(),

    supabase
      .from('categories')
      .select(
        'id, name, sort_order'
      )
      .eq(
        'restaurant_id',
        restaurantId
      )
      .order('sort_order', {
        ascending: true,
      }),

    supabase
      .from('menu_items')
      .select(`
        id,
        restaurant_id,
        category_id,
        name,
        description,
        price,
        image_url,
        is_available,
        sort_order,
        discount_type,
        discount_value,
        discount_enabled,
        discount_start_at,
        discount_end_at
      `)
      .eq(
        'restaurant_id',
        restaurantId
      )
      .order('sort_order', {
        ascending: true,
      })
      .order('created_at', {
        ascending: false,
      }),

    applyDateRange(
      supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_name,
          customer_phone,
          customer_address,
          table_number,
          channel,
          total,
          status,
          created_at
        `)
        .eq(
          'restaurant_id',
          restaurantId
        )
        .order('created_at', {
          ascending: false,
        }),
      range
    ),

    supabase
      .from('discounts')
      .select(`
        id,
        restaurant_id,
        name,
        discount_type,
        discount_value,
        start_at,
        end_at,
        is_active,
        category_id,
        menu_item_id,
        created_at
      `)
      .eq(
        'restaurant_id',
        restaurantId
      )
      .order('created_at', {
        ascending: false,
      }),

    supabase
      .from(
        'restaurant_price_adjustment_history'
      )
      .select(`
        id,
        restaurant_id,
        action,
        adjustment_mode,
        adjustment_value,
        currency,
        description,
        created_at
      `)
      .eq(
        'restaurant_id',
        restaurantId
      )
      .order('created_at', {
        ascending: false,
      }),

    supabase
      .from(
        'menu_item_pricing_history'
      )
      .select(`
        id,
        restaurant_id,
        menu_item_id,
        item_name,
        change_type,
        direction,
        old_price,
        new_price,
        old_discount_value,
        new_discount_value,
        discount_type,
        summary,
        created_at,
        details
      `)
      .eq(
        'restaurant_id',
        restaurantId
      )
      .order('created_at', {
        ascending: false,
      }),
  ]);

  const firstError =
    restaurantResult.error ||
    categoriesResult.error ||
    menuItemsResult.error ||
    ordersResult.error ||
    discountsResult.error ||
    restaurantPricingHistoryResult.error ||
    menuPricingHistoryResult.error;

  if (firstError) {
    console.error(
      'Reports data loading failed:',
      firstError
    );

    throw new Error(
      firstError.message ||
        'Could not load reports data.'
    );
  }

  if (!restaurantResult.data) {
    return null;
  }

  const orders =
    (ordersResult.data ||
      []) as ReportOrder[];

  /*
   * Menu Management stores item promotions directly on menu_items.
   * Keep the optional discounts table for installations that use it, but
   * always expose menu-item promotions to reports as well.
   */
  const menuPromotions: ReportDiscount[] = (
    (menuItemsResult.data || []) as ReportMenuItem[]
  )
    .filter((item) => item.discount_enabled && item.discount_type)
    .map((item) => ({
      id: `menu-item-promotion:${item.id}`,
      restaurant_id: item.restaurant_id,
      name: item.name,
      discount_type: item.discount_type!,
      discount_value: Number(item.discount_value || 0),
      start_at: item.discount_start_at,
      end_at: item.discount_end_at,
      is_active: true,
      category_id: item.category_id,
      menu_item_id: item.id,
      created_at:
        item.discount_start_at ||
        new Date().toISOString(),
    }));

  const storedDiscounts =
    (discountsResult.data || []) as ReportDiscount[];

  const discounts = [
    ...storedDiscounts,
    ...menuPromotions.filter(
      (menuPromotion) =>
        !storedDiscounts.some(
          (storedDiscount) =>
            storedDiscount.menu_item_id ===
            menuPromotion.menu_item_id,
        ),
    ),
  ];

  /*
   * VERY IMPORTANT:
   *
   * Only load order_items belonging to the
   * exact orders returned above.
   *
   * Therefore:
   *
   * 7d  -> items belonging to 7d orders
   * 30d -> items belonging to 30d orders
   * 90d -> items belonging to 90d orders
   * 12m -> items belonging to 12m orders
   */

  let orderItems: ReportOrderItem[] =
    [];

  if (orders.length > 0) {
    const orderIds =
      orders.map(
        (order) => order.id
      );

    const {
      data,
      error,
    } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        menu_item_id,
        item_name,
        quantity,
        unit_price,
        extras
      `)
      .in(
        'order_id',
        orderIds
      );

    if (error) {
      console.error(
        'Reports order items loading failed:',
        error
      );

      throw new Error(
        error.message ||
          'Could not load report order items.'
      );
    }

    orderItems =
      (data ||
        []) as ReportOrderItem[];
  }

  return {
    restaurant:
      restaurantResult.data as ReportRestaurant,

    categories:
      (categoriesResult.data ||
        []) as ReportCategory[],

    menuItems:
      (menuItemsResult.data ||
        []) as ReportMenuItem[],

    orders,

    orderItems,

    discounts,

    restaurantPricingHistory:
      (restaurantPricingHistoryResult.data ||
        []) as ReportPricingHistory[],

    menuPricingHistory:
      (menuPricingHistoryResult.data ||
        []) as ReportMenuPricingHistory[],
  };
}
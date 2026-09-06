'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { subscribeRestaurantRealtime } from '@/lib/live-sync';
import {
  applyRestaurantTheme,
  defaultRestaurantTheme,
  loadRestaurantTheme,
  subscribeRestaurantTheme,
} from '@/lib/restaurant-theme';
import {
  MapPin,
  Phone,
  Smartphone,
  MessageCircle,
  Mail,
  Globe,
  ArrowDown,
  Sparkles,
  ScanLine,
  Plus,
  Minus,
  ShoppingBag,
  X,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface MenuExtra {
  id: string;
  name: string;
  price: number;
  is_available?: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string;
  sort_order?: number;
  discount_type: string | null;
  discount_value: number | null;
  discount_enabled: boolean;
  discount_start_at: string | null;
  discount_end_at: string | null;
  extras?: MenuExtra[];
}

interface CartExtra {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  currency: string;
  email: string | null;
  whatsapp_number: string;
  phone_number: string | null;
  mobile_number: string | null;
  website_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  address: string | null;
  price_adjustment_mode: 'percentage' | 'fixed' | null;
  price_adjustment_direction: 'increase' | 'decrease' | null;
  price_adjustment_enabled: boolean | null;
  price_adjustment_value: number | null;
}

interface CartItem extends MenuItem {
  quantity: number;
  selectedExtras: CartExtra[];
}

export default function PublicMenuPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [restaurant, setRestaurant] =
    useState<Restaurant | null>(null);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [menuItems, setMenuItems] =
    useState<MenuItem[]>([]);

  const [selectedCategory, setSelectedCategory] =
    useState<string>('all');

  const [cart, setCart] =
    useState<CartItem[]>([]);

  const [tableNumber, setTableNumber] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [showOrderPopup, setShowOrderPopup] =
    useState(true);

  const [selectedExtrasItem, setSelectedExtrasItem] =
    useState<MenuItem | null>(null);

  const [selectedExtras, setSelectedExtras] =
    useState<Record<string, number>>({});

  const [theme, setTheme] =
    useState(defaultRestaurantTheme);

  const [heroReady, setHeroReady] =
    useState(false);

  const [activeCard, setActiveCard] =
    useState<string | null>(null);

  const [showFeedback, setShowFeedback] = useState(false);

  const [feedback, setFeedback] = useState('');

  const [feedbackSent, setFeedbackSent] = useState(false);

  // ==================================================
  // DISCOUNT HELPERS
  // ==================================================

  const getAdjustedPrice = (item: MenuItem) => {
    return Number(item.price) || 0;
  };

  const isDiscountCurrentlyActive = (
    item: MenuItem
  ) => {
    if (
      !item.discount_enabled ||
      !item.discount_type ||
      item.discount_value === null ||
      item.discount_value <= 0
    ) {
      return false;
    }

    const now = new Date();

    if (item.discount_start_at) {
      const start = new Date(
        item.discount_start_at
      );

      if (now < start) {
        return false;
      }
    }

    if (item.discount_end_at) {
      const end = new Date(
        item.discount_end_at
      );

      if (now > end) {
        return false;
      }
    }

    return true;
  };

  const getDiscountedPrice = (
    item: MenuItem
  ) => {
    if (!isDiscountCurrentlyActive(item)) {
      return getAdjustedPrice(item);
    }

    const originalPrice =
      getAdjustedPrice(item);

    const discountValue =
      Number(item.discount_value);

    if (
      item.discount_type ===
      'percentage'
    ) {
      return Math.max(
        0,
        originalPrice -
          (originalPrice * discountValue) /
            100
      );
    }

    if (
      item.discount_type ===
      'fixed'
    ) {
      return Math.max(
        0,
        originalPrice - discountValue
      );
    }

    return originalPrice;
  };

  const getDiscountLabel = (
    item: MenuItem
  ) => {
    if (
      !isDiscountCurrentlyActive(item)
    ) {
      return '';
    }

    if (
      item.discount_type ===
      'percentage'
    ) {
      return `${Number(
        item.discount_value
      )}% OFF`;
    }

    if (
      item.discount_type ===
      'fixed'
    ) {
      return `SAVE ${
        restaurant?.currency || '$'
      }${Number(
        item.discount_value
      ).toFixed(2)}`;
    }

    return 'SPECIAL OFFER';
  };

  // ==================================================
  // LOAD MENU
  // ==================================================

  const fetchMenu = useCallback(
    async (
      restaurantId?: string
    ) => {
      const id =
        restaurantId ||
        restaurant?.id;

      if (!id) {
        return;
      }

      const {
        data: categoryData,
        error: categoryError,
      } = await supabase
        .from('categories')
        .select(
          'id, name, sort_order'
        )
        .eq(
          'restaurant_id',
          id
        )
        .order(
          'sort_order',
          {
            ascending: true,
          }
        );

      if (categoryError) {
        console.error(
          'Category refresh error:',
          categoryError
        );
      }

      const {
        data: itemData,
        error: itemError,
      } = await supabase
        .from('menu_items')
        .select(`
          id,
          name,
          description,
          price,
          image_url,
          category_id,
          sort_order,
          discount_type,
          discount_value,
          discount_enabled,
          discount_start_at,
          discount_end_at,
          menu_item_extras (
            id,
            name,
            price,
            is_available,
            sort_order
          )
        `)
        .eq(
          'restaurant_id',
          id
        )
        .eq(
          'is_available',
          true
        )
        .order(
          'sort_order',
          {
            ascending: true,
          }
        );

      if (itemError) {
        console.error(
          'Menu refresh error:',
          itemError
        );
      }

      setCategories(
        categoryData || []
      );

      type PublicMenuItemRow = {
        id: string;
        name: string;
        description: string | null;
        price: number;
        image_url: string | null;
        category_id: string;
        sort_order?: number;
        discount_type: string | null;
        discount_value: number | null;
        discount_enabled: boolean;
        discount_start_at: string | null;
        discount_end_at: string | null;
        menu_item_extras?: Array<{
          id: string;
          name: string;
          price: number;
          is_available?: boolean;
          sort_order?: number;
        }>;
      };

      const mappedItems: MenuItem[] =
        (itemData || []).map(
          (
            item: PublicMenuItemRow
          ) => ({
            ...item,
            extras:
              item.menu_item_extras ||
              [],
          })
        );

      setMenuItems(
        mappedItems
      );
    },
    [restaurant?.id]
  );

  // ==================================================
  // RESTAURANT THEME
  // ==================================================

  useEffect(() => {
    const restaurantId: string =
      restaurant?.id ?? '';

    if (!restaurantId) {
      return;
    }

    let active = true;

    async function loadTheme() {
      const nextTheme =
        await loadRestaurantTheme(
          supabase,
          restaurantId
        );

      if (!active) {
        return;
      }

      setTheme(nextTheme);
      applyRestaurantTheme(nextTheme);
    }

    loadTheme();

    const unsubscribe =
      subscribeRestaurantTheme(
        supabase,
        restaurantId,
        (nextTheme) => {
          if (!active) {
            return;
          }

          setTheme(nextTheme);
          applyRestaurantTheme(nextTheme);
        }
      );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [restaurant?.id]);

  // ==================================================
  // REALTIME
  // ==================================================

  useEffect(() => {
    if (!restaurant?.id) {
      return;
    }

    const unsubscribe =
      subscribeRestaurantRealtime(
        supabase,
        {
          restaurantId:
            restaurant.id,
          name:
            'public-menu',
          tables: [
            'menu_items',
            'categories',
            'menu_item_extras',
          ],
          onChange:
            async () => {
              const {
                data:
                  updatedRestaurant,
              } =
                await supabase
                  .from(
                    'restaurants'
                  )
                  .select(
                    'id, name, description, logo_url, currency, email, whatsapp_number, phone_number, mobile_number, website_url, facebook_url, instagram_url, twitter_url, address, price_adjustment_mode, price_adjustment_direction, price_adjustment_enabled, price_adjustment_value'
                  )
                  .eq(
                    'id',
                    restaurant.id
                  )
                  .single();

              if (
                updatedRestaurant
              ) {
                setRestaurant(
                  (current) =>
                    current
                      ? {
                          ...current,
                          ...updatedRestaurant,
                        }
                      : current
                );
              }

              await fetchMenu(
                restaurant.id
              );
            },
        }
      );

    return () => {
      unsubscribe();
    };
  }, [
    restaurant?.id,
    fetchMenu,
  ]);

  // ==================================================
  // INITIAL LOAD
  // ==================================================

  useEffect(() => {
    async function loadInitialMenu() {
      if (!slug) {
        return;
      }

      setLoading(true);

      const {
        data: restaurantData,
        error: restaurantError,
      } = await supabase
        .from('restaurants')
        .select(
          'id, name, description, logo_url, currency, email, whatsapp_number, phone_number, mobile_number, website_url, facebook_url, instagram_url, twitter_url, address, price_adjustment_mode, price_adjustment_direction, price_adjustment_enabled, price_adjustment_value'
        )
        .eq(
          'slug',
          slug
        )
        .single();

      if (
        restaurantError ||
        !restaurantData
      ) {
        console.error(
          restaurantError
        );

        setLoading(false);
        return;
      }

      const restaurantWithPricing: Restaurant =
        {
          id:
            restaurantData.id,
          name:
            restaurantData.name,
          description:
            restaurantData.description ||
            null,
          logo_url:
            restaurantData.logo_url ||
            null,
          currency:
            restaurantData.currency ||
            '$',
          email:
            restaurantData.email ||
            null,
          whatsapp_number:
            restaurantData.whatsapp_number ||
            '',
          phone_number:
            restaurantData.phone_number ||
            null,
          mobile_number:
            restaurantData.mobile_number ||
            null,
          website_url:
            restaurantData.website_url ||
            null,
          facebook_url:
            restaurantData.facebook_url ||
            null,
          instagram_url:
            restaurantData.instagram_url ||
            null,
          twitter_url:
            restaurantData.twitter_url ||
            null,
          address:
            restaurantData.address ||
            null,
          price_adjustment_mode:
            restaurantData.price_adjustment_mode ||
            null,
          price_adjustment_direction:
            restaurantData.price_adjustment_direction ||
            null,
          price_adjustment_enabled:
            restaurantData.price_adjustment_enabled ===
            true,
          price_adjustment_value:
            restaurantData.price_adjustment_value ??
            null,
        };

      setRestaurant(
        restaurantWithPricing
      );

      await fetchMenu(
        restaurantData.id
      );

      setLoading(false);

      requestAnimationFrame(() => {
        setTimeout(
          () => setHeroReady(true),
          100
        );
      });
    }

    loadInitialMenu();
  }, [
    slug,
    fetchMenu,
  ]);

  // ==================================================
  // CART
  // ==================================================

  const getExtraSignature = (
    extras: CartExtra[] = []
  ) =>
    [...extras]
      .map(
        (extra) =>
          `${extra.id}:${extra.name}:${Number(
            extra.price || 0
          )}:${Number(
            extra.quantity || 0
          )}`
      )
      .sort()
      .join('|');

  const addToCart = (
    item: MenuItem,
    extras: CartExtra[] = []
  ) => {
    setCart((prev) => {
      const signature =
        getExtraSignature(
          extras
        );

      const existing =
        prev.find(
          (x) =>
            x.id === item.id &&
            getExtraSignature(
              x.selectedExtras
            ) === signature
        );

      if (existing) {
        return prev.map(
          (x) =>
            x.id === item.id &&
            getExtraSignature(
              x.selectedExtras
            ) === signature
              ? {
                  ...x,
                  quantity:
                    x.quantity + 1,
                }
              : x
        );
      }

      return [
        ...prev,
        {
          ...item,
          quantity: 1,
          selectedExtras:
            extras,
        },
      ];
    });

    setShowOrderPopup(true);
  };

  const decreaseQuantity = (
    id: string,
    extras: CartExtra[] = []
  ) => {
    const signature =
      getExtraSignature(
        extras
      );

    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id &&
          getExtraSignature(
            item.selectedExtras
          ) === signature
            ? {
                ...item,
                quantity:
                  item.quantity - 1,
              }
            : item
        )
        .filter(
          (item) =>
            !(
              item.id === id &&
              getExtraSignature(
                item.selectedExtras
              ) === signature
            ) ||
            item.quantity > 0
        )
    );
  };

  const removeExtraFromCart = (
    itemId: string,
    currentExtras: CartExtra[],
    extraId: string
  ) => {
    const updatedExtras =
      currentExtras.filter(
        (extra) =>
          extra.id !== extraId
      );

    setCart((prev) => {
      const currentItem =
        prev.find(
          (item) =>
            item.id === itemId &&
            getExtraSignature(
              item.selectedExtras
            ) ===
              getExtraSignature(
                currentExtras
              )
        );

      if (!currentItem) {
        return prev;
      }

      const existingLine =
        prev.find(
          (item) =>
            item.id === itemId &&
            item !== currentItem &&
            getExtraSignature(
              item.selectedExtras
            ) ===
              getExtraSignature(
                updatedExtras
              )
        );

      if (existingLine) {
        return prev
          .filter(
            (item) =>
              item !== currentItem
          )
          .map((item) =>
            item ===
            existingLine
              ? {
                  ...item,
                  quantity:
                    item.quantity +
                    currentItem.quantity,
                }
              : item
          );
      }

      return prev.map(
        (item) =>
          item === currentItem
            ? {
                ...item,
                selectedExtras:
                  updatedExtras,
              }
            : item
      );
    });
  };

  const changeExtraQuantity = (
    itemId: string,
    currentExtras: CartExtra[],
    extraId: string,
    delta: number
  ) => {
    const currentSignature =
      getExtraSignature(
        currentExtras
      );

    setCart((prev) => {
      const currentItem =
        prev.find(
          (item) =>
            item.id === itemId &&
            getExtraSignature(
              item.selectedExtras
            ) === currentSignature
        );

      if (!currentItem) {
        return prev;
      }

      const updatedExtras =
        currentExtras
          .map((extra) =>
            extra.id === extraId
              ? {
                  ...extra,
                  quantity:
                    Math.max(
                      0,
                      Number(
                        extra.quantity ||
                          0
                      ) +
                        delta
                    ),
                }
              : extra
          )
          .filter(
            (extra) =>
              Number(
                extra.quantity || 0
              ) > 0
          );

      const updatedSignature =
        getExtraSignature(
          updatedExtras
        );

      const existingLine =
        prev.find(
          (item) =>
            item !== currentItem &&
            item.id === itemId &&
            getExtraSignature(
              item.selectedExtras
            ) ===
              updatedSignature
        );

      if (existingLine) {
        return prev
          .filter(
            (item) =>
              item !== currentItem
          )
          .map((item) =>
            item ===
            existingLine
              ? {
                  ...item,
                  quantity:
                    item.quantity +
                    currentItem.quantity,
                }
              : item
          );
      }

      return prev.map(
        (item) =>
          item === currentItem
            ? {
                ...item,
                selectedExtras:
                  updatedExtras,
              }
            : item
      );
    });
  };

  const clearCart = () => {
    setCart([]);
    setTableNumber('');
    setShowOrderPopup(true);
  };

  const getTotalItemQuantity = (
    id: string
  ) => {
    return cart
      .filter(
        (item) =>
          item.id === id
      )
      .reduce(
        (sum, item) =>
          sum + item.quantity,
        0
      );
  };

  const activeCart =
    cart.filter(
      (cartItem) =>
        menuItems.some(
          (menuItem) =>
            menuItem.id ===
            cartItem.id
        )
    );

  const getCartLinePrice = (
    item: CartItem
  ) => {
    const itemPrice =
      getDiscountedPrice(
        item
      );

    const extrasPrice =
      item.selectedExtras.reduce(
        (sum, extra) =>
          sum +
          Number(
            extra.price || 0
          ) *
            Number(
              extra.quantity || 0
            ),
        0
      );

    return (
      itemPrice +
      extrasPrice
    );
  };

  const totalItems =
    activeCart.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );

  const totalPrice =
    activeCart.reduce(
      (sum, item) =>
        sum +
        getCartLinePrice(
          item
        ) *
          item.quantity,
      0
    );

  // ==================================================
  // CREATE DATABASE ORDER
  // ==================================================

  const createDatabaseOrder = async (
    channel: 'Waiter' | 'WhatsApp'
  ) => {
    if (!restaurant) {
      return {
        success: false,
        error: 'Restaurant not found.',
      };
    }

    if (cart.length === 0) {
      return {
        success: false,
        error: 'Your order is empty.',
      };
    }

    // Table is required for internal waiter orders.
    // For WhatsApp we allow it to remain optional.
    if (
      channel === 'Waiter' &&
      !tableNumber.trim()
    ) {
      return {
        success: false,
        error: 'Please enter the table number.',
      };
    }

    const { data: order, error: orderError } =
      await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurant.id,
          customer_name: 'Guest',
          table_number:
            tableNumber.trim() || null,
          status: 'New',
          channel,
          total: totalPrice,
        })
        .select('id')
        .single();

    if (orderError || !order) {
      console.error(
        'Order creation error:',
        orderError
      );

      return {
        success: false,
        error:
          orderError?.message ||
          'Could not create the order.',
      };
    }

    const orderItems = cart.map((item) => {
      const extrasText =
        item.selectedExtras.length > 0
          ? ` + ${item.selectedExtras
              .map(
                (extra) =>
                  `${extra.name} × ${extra.quantity}`
              )
              .join(', ')}`
          : '';

      return {
        order_id: order.id,
        item_name:
          `${item.name}${extrasText}`,
        quantity: item.quantity,
        unit_price:
          getCartLinePrice(item),
      };
    });

    const { error: itemsError } =
      await supabase
        .from('order_items')
        .insert(orderItems);

    if (itemsError) {
      console.error(
        'Order items creation error:',
        itemsError
      );

      // Remove the parent order if its items
      // could not be created.
      await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);

      return {
        success: false,
        error:
          itemsError.message ||
          'Could not create order items.',
      };
    }

    return {
      success: true,
      orderId: order.id,
    };
  };

  // ==================================================
  // WHATSAPP ORDER
  // ==================================================

  const handleWhatsAppOrder = async () => {
    if (!restaurant || cart.length === 0) {
      return;
    }

    if (!restaurant.whatsapp_number) {
      alert(
        'WhatsApp number is not configured for this restaurant.'
      );
      return;
    }

    // FIRST create the order in the database
    const result =
      await createDatabaseOrder(
        'WhatsApp'
      );

    if (!result.success) {
      alert(
        result.error ||
          'Could not create the order.'
      );
      return;
    }

    const items = cart
      .map((item) => {
        const activeDiscount =
          isDiscountCurrentlyActive(item);

        const originalPrice =
          getAdjustedPrice(item);

        const finalPrice =
          getCartLinePrice(item);

        const extrasText =
          item.selectedExtras.length > 0
            ? ` + ${item.selectedExtras
                .map(
                  (extra) =>
                    `${extra.name} × ${extra.quantity}`
                )
                .join(', ')}`
            : '';

        const priceText =
          `${restaurant.currency}${(
            finalPrice * item.quantity
          ).toFixed(2)}`;

        if (activeDiscount) {
          return (
            `${item.quantity}x ${item.name}${extrasText} — ` +
            `${priceText} ` +
            `(was ${restaurant.currency}${(
              originalPrice *
              item.quantity
            ).toFixed(2)})`
          );
        }

        return (
          `${item.quantity}x ${item.name}${extrasText} — ` +
          `${priceText}`
        );
      })
      .join('\n');

    const message =
      `*New Order - ${restaurant.name}*\n\n` +
      (tableNumber
        ? `*Table:* ${tableNumber}\n\n`
        : '') +
      `*Order ID:* ${result.orderId}\n\n` +
      `*Order:*\n${items}\n\n` +
      `*Total:* ${
        restaurant.currency
      }${totalPrice.toFixed(2)}`;

    const phone =
      restaurant.whatsapp_number.replace(
        /[^0-9]/g,
        ''
      );

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(
        message
      )}`,
      '_blank'
    );

    // Clear after successful order creation
    setCart([]);
    setTableNumber('');
    setShowOrderPopup(false);
  };

  // ==================================================
  // CATEGORY
  // ==================================================

  const scrollToCategory = (
    id: string
  ) => {
    setSelectedCategory(id);

    if (id === 'all') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });

      return;
    }

    setTimeout(() => {
      document
        .getElementById(
          `category-${id}`
        )
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 50);
  };

  // ==================================================
  // EXTRAS
  // ==================================================

  const availableExtrasForItem = (
    item: MenuItem
  ) => {
    const extras =
      item.extras &&
      item.extras.length > 0
        ? item.extras
        : [];

    return extras.filter(
      (extra) =>
        extra.is_available !==
        false
    );
  };

  const openExtrasSelector = (
    item: MenuItem
  ) => {
    const extras =
      availableExtrasForItem(
        item
      );

    if (extras.length === 0) {
      addToCart(
        item,
        []
      );
      return;
    }

    const initialChoices =
      Object.fromEntries(
        extras.map(
          (extra) => [
            extra.id,
            0,
          ]
        )
      );

    setSelectedExtras(
      initialChoices
    );

    setSelectedExtrasItem(
      item
    );
  };

  const increaseSelectedExtra = (
    extraId: string
  ) => {
    setSelectedExtras(
      (prev) => ({
        ...prev,
        [extraId]:
          (prev[extraId] || 0) +
          1,
      })
    );
  };

  const decreaseSelectedExtra = (
    extraId: string
  ) => {
    setSelectedExtras(
      (prev) => ({
        ...prev,
        [extraId]:
          Math.max(
            0,
            (prev[extraId] || 0) -
              1
          ),
      })
    );
  };

  const confirmSelectedExtras =
    () => {
      if (
        !selectedExtrasItem
      ) {
        return;
      }

      const extras =
        availableExtrasForItem(
          selectedExtrasItem
        )
          .filter(
            (extra) =>
              (selectedExtras[
                extra.id
              ] || 0) > 0
          )
          .map((extra) => ({
            id: extra.id,
            name: extra.name,
            price: Number(
              extra.price || 0
            ),
            quantity:
              selectedExtras[
                extra.id
              ] || 0,
          }));

      addToCart(
        selectedExtrasItem,
        extras
      );

      setSelectedExtrasItem(
        null
      );

      setSelectedExtras({});
    };

  const selectedExtrasList =
    selectedExtrasItem
      ? availableExtrasForItem(
          selectedExtrasItem
        )
      : [];

  // ==================================================
  // CATEGORY COUNTS
  // ==================================================

  const categoryCounts =
    useMemo(() => {
      const map: Record<
        string,
        number
      > = {};

      menuItems.forEach(
        (item) => {
          map[item.category_id] =
            (map[
              item.category_id
            ] || 0) + 1;
        }
      );

      return map;
    }, [menuItems]);

  // ==================================================
  // LOADING
  // ==================================================

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={{
          background:
            theme.public_background,
          color:
            theme.public_text,
        }}
      >
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[150px] animate-pulse"
          style={{
            background:
              `${theme.public_accent}18`,
          }}
        />

        <div
          className="absolute w-[2px] h-[70vh] opacity-20 animate-[pulse_3s_ease-in-out_infinite]"
          style={{
            background:
              theme.public_accent,
          }}
        />

        <div className="relative z-10 text-center">

          <div
            className="relative mx-auto w-20 h-20 rounded-full border flex items-center justify-center"
            style={{
              borderColor:
                `${theme.public_accent}70`,
              boxShadow:
                `0 0 50px ${theme.public_accent}20`,
            }}
          >
            <div
              className="absolute inset-2 rounded-full border animate-spin"
              style={{
                borderColor:
                  `${theme.public_border}`,
                borderTopColor:
                  theme.public_accent,
              }}
            />

            <img
              src="/novamenu-icon.jpeg"
              alt="NOVAMENU"
              className="relative h-12 w-12 rounded-full object-cover"
            />
          </div>

          <p
            className="mt-7 text-[9px] font-bold tracking-[0.5em]"
            style={{
              color:
                theme.public_text,
            }}
          >
            NOVAMENU
          </p>

          <div className="mt-5 flex items-center justify-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                background:
                  theme.public_accent,
              }}
            />

            <span
              className="text-[8px] uppercase tracking-[0.3em]"
              style={{
                color:
                  theme.public_accent_soft,
              }}
            >
              Initializing menu
            </span>
          </div>

        </div>
      </div>
    );
  }

  // ==================================================
  // NOT FOUND
  // ==================================================

  if (!restaurant) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{
          background:
            theme.public_background,
          color:
            theme.public_text,
        }}
      >
        <div className="text-center max-w-sm">

          <div
            className="w-20 h-20 mx-auto rounded-full border flex items-center justify-center"
            style={{
              borderColor:
                `${theme.public_accent}55`,
              boxShadow:
                `0 0 60px ${theme.public_accent}12`,
            }}
          >
            <span
              className="font-serif text-3xl"
              style={{
                color:
                  theme.public_accent,
              }}
            >
              N
            </span>
          </div>

          <h1
            className="mt-7 text-2xl font-serif"
            style={{
              color:
                theme.public_text,
            }}
          >
            Restaurant not found
          </h1>

          <p
            className="mt-2 text-sm"
            style={{
              color:
                `${theme.public_text}66`,
            }}
          >
            We could not find this menu.
          </p>

        </div>
      </div>
    );
  }
  
  // ==================================================
  // PAGE
  // ==================================================

  const getContrastText = (hex: string) => {
    const clean = hex.replace("#", "");

    if (clean.length !== 6) return "#FFFFFF";

    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);

    const luminance =
      (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.58
      ? "#171A24"
      : "#FFFFFF";
  };

  const heroTextColor = getContrastText(
    theme.public_hero_background
  );

  const handleFeedbackSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!restaurant?.email) return;
    const subject = encodeURIComponent(`${restaurant?.name || 'Restaurant'} menu feedback`);
    const body = encodeURIComponent(feedback.trim());
    window.location.href = `mailto:${restaurant.email}?subject=${subject}&body=${body}`;
    setFeedbackSent(true);
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        background: theme.public_background,
        color: theme.public_text,
      }}
    >

      {restaurant?.email && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-7 sm:right-7">
        {showFeedback && (
          <div className="w-[min(calc(100vw-2.5rem),360px)] rounded-3xl border p-5 shadow-2xl" style={{ background: theme.public_surface, borderColor: theme.public_border, color: theme.public_text }}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: theme.public_accent }}>Contact us</p>
                <h2 className="mt-1 text-lg font-black">How was your experience?</h2>
              </div>
              <button type="button" onClick={() => setShowFeedback(false)} aria-label="Close feedback" className="rounded-full p-1" style={{ color: `${theme.public_text}80` }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleFeedbackSubmit}>
              <textarea
                value={feedback}
                onChange={(event) => { setFeedback(event.target.value); setFeedbackSent(false); }}
                required
                rows={4}
                placeholder="Share your feedback with us..."
                className="w-full resize-none rounded-2xl border px-3 py-3 text-sm outline-none"
                style={{ background: theme.public_background, borderColor: theme.public_border, color: theme.public_text }}
              />
              <button type="submit" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em]" style={{ background: theme.public_accent, color: getContrastText(theme.public_accent) }}>
                <Mail className="h-4 w-4" />
                {feedbackSent ? 'Opening email app' : 'Send feedback'}
              </button>
            </form>
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowFeedback((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border px-4 py-3 text-xs font-black shadow-xl transition hover:-translate-y-0.5"
          style={{ background: theme.public_surface, borderColor: theme.public_border, color: theme.public_text }}
        >
          <MessageCircle className="h-4 w-4" style={{ color: theme.public_accent }} />
          Feedback
        </button>
        </div>
      )}

      {/* ==================================================
          FUTURISTIC GLOBAL ATMOSPHERE
      ================================================== */}

      <style jsx global>{`
        @keyframes novaFloat {
          0%, 100% {
            transform: translate3d(0, 0, 0);
          }
          50% {
            transform: translate3d(0, -14px, 0);
          }
        }

        @keyframes novaFloatSlow {
          0%, 100% {
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          50% {
            transform: translate3d(10px, -18px, 0) rotate(8deg);
          }
        }

        @keyframes novaScan {
          0% {
            transform: translateY(-120%);
            opacity: 0;
          }
          15% {
            opacity: .7;
          }
          85% {
            opacity: .7;
          }
          100% {
            transform: translateY(120%);
            opacity: 0;
          }
        }

        @keyframes novaPulse {
          0%, 100% {
            opacity: .25;
            transform: scale(1);
          }
          50% {
            opacity: .65;
            transform: scale(1.08);
          }
        }

        @keyframes novaOrbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes novaReveal {
          from {
            opacity: 0;
            transform: translateY(35px) scale(.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes novaShimmer {
          0% {
            transform: translateX(-120%);
          }
          100% {
            transform: translateX(220%);
          }
        }

        @keyframes novaGridMove {
          from {
            background-position: 0 0;
          }
          to {
            background-position: 80px 80px;
          }
        }

        .nova-float {
          animation: novaFloat 6s ease-in-out infinite;
        }

        .nova-float-slow {
          animation: novaFloatSlow 9s ease-in-out infinite;
        }

        .nova-orbit {
          animation: novaOrbit 18s linear infinite;
        }

        .nova-scan {
          animation: novaScan 5s ease-in-out infinite;
        }

        .nova-pulse {
          animation: novaPulse 4s ease-in-out infinite;
        }

        .nova-reveal {
          animation: novaReveal .8s cubic-bezier(.2,.8,.2,1) both;
        }

        .nova-hide-scrollbar {
          scrollbar-width: none;
        }

        .nova-hide-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .nova-card {
          transform-style: preserve-3d;
          transition:
            transform .5s cubic-bezier(.2,.8,.2,1),
            box-shadow .5s ease,
            border-color .3s ease;
        }

        .nova-card:hover {
          transform:
            perspective(1200px)
            translateY(-8px)
            rotateX(1deg);
        }

        .nova-image {
          transition:
            transform 1.2s cubic-bezier(.2,.8,.2,1),
            filter .8s ease;
        }

        .nova-card:hover .nova-image {
          transform: scale(1.07);
          filter: saturate(1.08);
        }

        .nova-shimmer {
          position: relative;
          overflow: hidden;
        }

        .nova-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          width: 45%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,.10),
            transparent
          );
          transform: translateX(-120%);
          animation: novaShimmer 5s ease-in-out infinite;
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      {/* ==================================================
          HERO / SPATIAL RESTAURANT INTRO
      ================================================== */}

      <section
        className="relative min-h-[92svh] overflow-hidden"
        style={{
          background:
            theme.public_hero_background,
        }}
      >

        {/* DEPTH LIGHT */}

        <div
          className="absolute left-1/2 top-[15%] -translate-x-1/2 w-[650px] h-[650px] rounded-full blur-[150px] pointer-events-none nova-pulse"
          style={{
            background:
              `${theme.public_accent}18`,
          }}
        />

        <div
          className="absolute -right-[180px] top-[30%] w-[450px] h-[450px] rounded-full blur-[130px] pointer-events-none nova-float-slow"
          style={{
            background:
              `${theme.public_accent_soft}12`,
          }}
        />

        {/* TECH GRID */}

        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage:
              `linear-gradient(${theme.public_text} 1px, transparent 1px), linear-gradient(90deg, ${theme.public_text} 1px, transparent 1px)`,
            backgroundSize:
              '70px 70px',
            animation:
              'novaGridMove 25s linear infinite',
          }}
        />

        {/* SCAN LINE */}

        <div className="absolute inset-x-0 top-0 h-full pointer-events-none overflow-hidden opacity-30">
          <div
            className="nova-scan absolute left-0 right-0 h-px"
            style={{
              background:
                `linear-gradient(90deg, transparent, ${theme.public_accent}, transparent)`,
              boxShadow:
                `0 0 30px ${theme.public_accent}`,
            }}
          />
        </div>

        {/* ORBITAL AR RINGS */}

        <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">

          <div
            className="nova-orbit w-[280px] h-[280px] sm:w-[390px] sm:h-[390px] rounded-full border"
            style={{
              borderColor:
                `${theme.public_accent}18`,
              transform:
                'rotateX(65deg)',
            }}
          />

          <div
            className="absolute inset-[12%] nova-orbit rounded-full border"
            style={{
              borderColor:
                `${theme.public_accent_soft}14`,
              transform:
                'rotateX(65deg) rotateZ(25deg)',
              animationDuration:
                '25s',
              animationDirection:
                'reverse',
            }}
          />

          <div
            className="absolute inset-[26%] rounded-full border nova-pulse"
            style={{
              borderColor:
                `${theme.public_accent}20`,
            }}
          />

        </div>

        {/* FLOATING AR MARKERS */}

        <div
          className="absolute top-[27%] left-[8%] hidden sm:flex items-center gap-2 nova-float"
        >
          <ScanLine
            size={13}
            style={{
              color:
                theme.public_accent,
            }}
          />
          <span
            className="text-[8px] uppercase tracking-[.3em]"
            style={{
              color:
                `${theme.public_text}45`,
            }}
          >
            Spatial menu
          </span>
        </div>

        <div
          className="absolute top-[34%] right-[8%] hidden sm:flex items-center gap-2 nova-float-slow"
        >
          <span
            className="text-[8px] uppercase tracking-[.3em]"
            style={{
              color:
                `${theme.public_text}45`,
            }}
          >
            Live interface
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background:
                theme.public_accent,
              boxShadow:
                `0 0 12px ${theme.public_accent}`,
            }}
          />
        </div>

        {/* HEADER */}

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8">

          <div
            className="flex items-center justify-between py-5 border-b"
            style={{
              borderColor: `${theme.public_border}60`,
            }}
          >

            {/* NOVAMENU BRAND */}

            <div className="flex items-center gap-3">

              <div
                className="relative w-9 h-9 rounded-full overflow-hidden flex items-center justify-center"
                style={{
                  boxShadow: `0 0 18px ${theme.public_accent}30`,
                }}
              >
                <img
                  src="/novamenu-icon.jpeg"
                  alt="NOVAMENU"
                  className="h-full w-full object-cover"
                />

                <span
                  className="absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full"
                  style={{
                    background: theme.public_accent,
                    boxShadow: `0 0 8px ${theme.public_accent}`,
                  }}
                />
              </div>


              <div className="leading-none">

                <p
                  className="text-[10px] font-black tracking-[.35em]"
                  style={{
                    color: theme.public_accent,
                    textShadow: `
                      0 0 8px ${theme.public_accent}45,
                      0 1px 2px rgba(0,0,0,0.35)
                    `,
                  }}
                >
                  NOVAMENU
                </p>

                <p
                  className="text-[8px] uppercase tracking-[.22em] mt-1 font-medium"
                  style={{
                    color:
                      `${theme.public_text}68`,
                  }}
                >
                  Digital Menu
                </p>

              </div>

            </div>


            {/* ONLINE STATUS */}

            <div
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 border rounded-full"
              style={{
                borderColor:
                  `${theme.public_accent}45`,
                background:
                  `${theme.public_surface}90`,
                boxShadow:
                  `0 8px 30px ${theme.public_accent}08`,
              }}
            >

              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{
                  background:
                    theme.public_accent,
                  boxShadow:
                    `0 0 8px ${theme.public_accent}`,
                }}
              />

              <span
                className="text-[8px] uppercase tracking-[.28em] font-bold"
                style={{
                  color:
                    theme.public_text,
                }}
              >
                Menu Online
              </span>

            </div>

          </div>

        </div>
        {/* HERO CONTENT */}

        <div
          className={`relative z-10 min-h-[calc(92svh-70px)] flex flex-col items-center justify-center text-center transition-all duration-1000 ${
            heroReady
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8"
          }`}
        >

          {/* AR LABEL */}

          <div className="flex items-center gap-3 mb-8">

            <div
              className="w-8 sm:w-14 h-px"
              style={{
                background: theme.public_accent,
              }}
            />

            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
              style={{
                borderColor: `${theme.public_accent}45`,
                background: `${theme.public_surface}80`,
                boxShadow: `0 8px 30px ${theme.public_accent}08`,
              }}
            >

              <Sparkles
                size={11}
                style={{
                  color: theme.public_accent,
                }}
              />

              <span
                className="text-[8px] uppercase tracking-[.35em] font-semibold"
                style={{
                  color: theme.public_accent,
                }}
              >
                Welcome
              </span>

            </div>

            <div
              className="w-8 sm:w-14 h-px"
              style={{
                background: theme.public_accent,
              }}
            />

          </div>


          {/* LOGO */}

          <div className="relative mb-8">

            <div
              className="absolute inset-[-35px] rounded-full blur-3xl nova-pulse"
              style={{
                background: `${theme.public_accent}16`,
              }}
            />

            <div
              className="absolute inset-[-18px] rounded-full border nova-orbit"
              style={{
                borderColor: `${theme.public_accent}30`,
                borderTopColor: theme.public_accent,
              }}
            />

            <div
              className="absolute inset-[-10px] rounded-full border"
              style={{
                borderColor: `${theme.public_border}70`,
              }}
            />

            <div
              className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 p-1.5"
              style={{
                background: theme.public_surface,
                borderColor: `${theme.public_accent}75`,
                boxShadow: `0 30px 100px ${theme.public_accent}18`,
              }}
            >

              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center">

                {restaurant.logo_url ? (

                  <img
                    src={restaurant.logo_url}
                    alt={restaurant.name}
                    className="w-full h-full object-cover"
                  />

                ) : (

                  <span
                    className="font-serif text-6xl"
                    style={{
                      color: theme.public_accent,
                    }}
                  >
                    {restaurant.name
                      .charAt(0)
                      .toUpperCase()}
                  </span>

                )}

              </div>

            </div>

          </div>


         {/* RESTAURANT NAME */}

<h1
  className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[.95] tracking-[-.035em] max-w-5xl"
  style={{
    color: heroTextColor,
    textShadow:
      heroTextColor === "#FFFFFF"
        ? `0 0 40px ${theme.public_accent}18`
        : "0 2px 18px rgba(0,0,0,0.08)",
  }}
>
  {restaurant.name}
</h1>


{/* DECORATIVE DIVIDER */}

<div className="flex items-center justify-center gap-3 mt-6">

  <span
    className="w-12 h-px"
    style={{
      background:
        `${theme.public_accent}80`,
    }}
  />

  <span
    className="w-1.5 h-1.5 rotate-45"
    style={{
      background:
        theme.public_accent,
      boxShadow:
        `0 0 10px ${theme.public_accent}`,
    }}
  />

  <span
    className="w-12 h-px"
    style={{
      background:
        `${theme.public_accent}80`,
    }}
  />

</div>


{/* DESCRIPTION */}

{restaurant.description && (

  <p
    className="max-w-xl mt-6 text-sm sm:text-base leading-relaxed whitespace-pre-line"
    style={{
      color:
        heroTextColor === "#FFFFFF"
          ? "rgba(255,255,255,0.78)"
          : "rgba(23,26,36,0.78)",
    }}
  >
    {restaurant.description}
  </p>

)}


{/* LOCATION */}

{restaurant.address && (

  <a
    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      restaurant.address
    )}`}
    target="_blank"
    rel="noreferrer"
    className="mt-5 inline-flex items-center gap-2 transition-all hover:opacity-80"
  >

    <MapPin
      size={13}
      style={{
        color:
          theme.public_accent,
      }}
    />

    <span
      className="text-[9px] uppercase tracking-[.2em] font-medium"
      style={{
        color:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.72)"
            : "rgba(23,26,36,0.72)",
      }}
    >
      {restaurant.address}
    </span>

  </a>

)}


{/* CONTACT BUTTONS */}

<div className="flex flex-wrap justify-center gap-2.5 mt-7">

  {/* PHONE */}

  {restaurant.email && (
    <a
      href={`mailto:${restaurant.email}`}
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border backdrop-blur-md transition-all hover:-translate-y-1"
      style={{
        borderColor: heroTextColor === "#FFFFFF" ? "rgba(255,255,255,0.22)" : "rgba(23,26,36,0.20)",
        background: heroTextColor === "#FFFFFF" ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.45)",
        color: heroTextColor,
      }}
    >
      <Mail size={12} style={{ color: theme.public_accent }} />
      <span className="text-[8px] uppercase tracking-[.18em] font-semibold" style={{ color: heroTextColor }}>
        Email
      </span>
    </a>
  )}

  {restaurant.phone_number && (

    <a
      href={`tel:${restaurant.phone_number}`}
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border backdrop-blur-md transition-all hover:-translate-y-1"
      style={{
        borderColor:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.22)"
            : "rgba(23,26,36,0.20)",
        background:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.45)",
        color:
          heroTextColor,
      }}
    >

      <Phone
        size={12}
        style={{
          color:
            theme.public_accent,
        }}
      />

      <span
        className="text-[8px] uppercase tracking-[.18em] font-semibold"
        style={{
          color:
            heroTextColor,
        }}
      >
        Call
      </span>

    </a>

  )}


  {/* MOBILE */}

  {restaurant.mobile_number && (

    <a
      href={`tel:${restaurant.mobile_number}`}
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border backdrop-blur-md transition-all hover:-translate-y-1"
      style={{
        borderColor:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.22)"
            : "rgba(23,26,36,0.20)",
        background:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.45)",
        color:
          heroTextColor,
      }}
    >

      <Smartphone
        size={12}
        style={{
          color:
            theme.public_accent,
        }}
      />

      <span
        className="text-[8px] uppercase tracking-[.18em] font-semibold"
        style={{
          color:
            heroTextColor,
        }}
      >
        Mobile
      </span>

    </a>

  )}


  {/* WHATSAPP */}

  {restaurant.whatsapp_number && (

    <a
      href={`https://wa.me/${restaurant.whatsapp_number.replace(
        /[^0-9]/g,
        ""
      )}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all hover:-translate-y-1"
      style={{
        borderColor:
          `${theme.public_accent}70`,
        background:
          `${theme.public_accent}18`,
        color:
          heroTextColor,
        boxShadow:
          `0 8px 35px ${theme.public_accent}12`,
      }}
    >

      <MessageCircle
        size={12}
        style={{
          color:
            theme.public_accent,
        }}
      />

      <span
        className="text-[8px] uppercase tracking-[.18em] font-bold"
        style={{
          color:
            heroTextColor,
        }}
      >
        WhatsApp
      </span>

    </a>

  )}


  {/* WEBSITE */}

  {restaurant.website_url && (

    <a
      href={
        restaurant.website_url.startsWith("http")
          ? restaurant.website_url
          : `https://${restaurant.website_url}`
      }
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border backdrop-blur-md transition-all hover:-translate-y-1"
      style={{
        borderColor:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.22)"
            : "rgba(23,26,36,0.20)",
        background:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.45)",
        color:
          heroTextColor,
      }}
    >

      <Globe
        size={12}
        style={{
          color:
            theme.public_accent,
        }}
      />

      <span
        className="text-[8px] uppercase tracking-[.18em] font-semibold"
        style={{
          color:
            heroTextColor,
        }}
      >
        Website
      </span>

    </a>

  )}


  {/* INSTAGRAM */}

  {restaurant.instagram_url && (

    <a
      href={
        restaurant.instagram_url.startsWith("http")
          ? restaurant.instagram_url
          : `https://${restaurant.instagram_url}`
      }
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border backdrop-blur-md transition-all hover:-translate-y-1"
      style={{
        borderColor:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.22)"
            : "rgba(23,26,36,0.20)",
        background:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.45)",
        color:
          heroTextColor,
      }}
    >

      <span
        className="text-[11px] font-bold"
        style={{
          color:
            heroTextColor,
        }}
      >
        @
      </span>

      <span
        className="text-[8px] uppercase tracking-[.18em] font-semibold"
        style={{
          color:
            heroTextColor,
        }}
      >
        Instagram
      </span>

    </a>

  )}


  {/* FACEBOOK */}

  {restaurant.facebook_url && (

    <a
      href={
        restaurant.facebook_url.startsWith("http")
          ? restaurant.facebook_url
          : `https://${restaurant.facebook_url}`
      }
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border backdrop-blur-md transition-all hover:-translate-y-1"
      style={{
        borderColor:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.22)"
            : "rgba(23,26,36,0.20)",
        background:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.45)",
        color:
          heroTextColor,
      }}
    >

      <span
        className="text-[11px] font-bold"
        style={{
          color:
            heroTextColor,
        }}
      >
        f
      </span>

      <span
        className="text-[8px] uppercase tracking-[.18em] font-semibold"
        style={{
          color:
            heroTextColor,
        }}
      >
        Facebook
      </span>

    </a>

  )}


  {/* X */}

  {restaurant.twitter_url && (

    <a
      href={
        restaurant.twitter_url.startsWith("http")
          ? restaurant.twitter_url
          : `https://${restaurant.twitter_url}`
      }
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-3.5 py-2.5 rounded-full border backdrop-blur-md transition-all hover:-translate-y-1"
      style={{
        borderColor:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.22)"
            : "rgba(23,26,36,0.20)",
        background:
          heroTextColor === "#FFFFFF"
            ? "rgba(255,255,255,0.07)"
            : "rgba(255,255,255,0.45)",
        color:
          heroTextColor,
      }}
    >

      <span
        className="text-[10px] font-bold"
        style={{
          color:
            heroTextColor,
        }}
      >
        𝕏
      </span>

      <span
        className="text-[8px] uppercase tracking-[.18em] font-semibold"
        style={{
          color:
            heroTextColor,
        }}
      >
        X
      </span>

    </a>

  )}

</div>


{/* START MENU */}

<button
  onClick={() =>
    document
      .getElementById("menu-interface")
      ?.scrollIntoView({
        behavior: "smooth",
      })
  }
  className="group mt-10 flex flex-col items-center gap-3"
>

  <span
    className="text-[8px] uppercase tracking-[.4em] font-bold"
    style={{
      color:
        heroTextColor === "#FFFFFF"
          ? "rgba(255,255,255,0.72)"
          : "rgba(23,26,36,0.72)",
    }}
  >
    Enter Menu
  </span>

  <span
    className="w-10 h-10 rounded-full border flex items-center justify-center transition-all group-hover:-translate-y-1"
    style={{
      borderColor:
        `${theme.public_accent}65`,
      color:
        theme.public_accent,
      background:
        heroTextColor === "#FFFFFF"
          ? "rgba(255,255,255,0.07)"
          : "rgba(255,255,255,0.45)",
      boxShadow:
        `0 8px 30px ${theme.public_accent}10`,
    }}
  >
    <ArrowDown size={15} />
  </span>

</button>

        </div>

        </section>


        {/* ==================================================
            MENU INTERFACE
        ================================================== */}

        <section
          id="menu-interface"
          className="relative"
        >

          {/* FIXED-DEPTH ATMOSPHERE */}

          <div
            className="fixed inset-0 pointer-events-none z-0"
            style={{
              background:
                `radial-gradient(circle at 10% 20%, ${theme.public_accent}06, transparent 30%), radial-gradient(circle at 90% 70%, ${theme.public_accent_soft}05, transparent 30%)`,
            }}
          />

        {/* ==================================================
            CATEGORY COMMAND BAR
        ================================================== */}

        <div
          className="sticky top-0 z-40 border-b backdrop-blur-2xl"
          style={{
            background:
              `${theme.public_background}E8`,
            borderColor:
              `${theme.public_border}90`,
          }}
        >

          <div className="max-w-7xl mx-auto px-4 sm:px-8">

            <div className="flex items-center gap-4">

              {/* MENU LABEL */}

              <div className="hidden md:flex shrink-0 items-center gap-2 pr-3 border-r"
                style={{
                  borderColor:
                    theme.public_border,
                }}
              >
                <Zap
                  size={13}
                  style={{
                    color:
                      theme.public_accent,
                  }}
                />

                <span
                  className="text-[8px] uppercase tracking-[.3em] font-bold"
                  style={{
                    color:
                      theme.public_text,
                  }}
                >
                  Menu
                </span>
              </div>

              <div className="flex-1 flex gap-2 overflow-x-auto py-3 nova-hide-scrollbar">

                <button
                  onClick={() =>
                    scrollToCategory(
                      'all'
                    )
                  }
                  className="shrink-0 px-4 py-2.5 rounded-full border text-[9px] uppercase tracking-[.18em] font-bold transition-all"
                  style={
                    selectedCategory ===
                    'all'
                      ? {
                          borderColor:
                            theme.public_accent,
                          background:
                            `${theme.public_accent}16`,
                          color:
                            theme.public_accent,
                          boxShadow:
                            `0 0 25px ${theme.public_accent}10`,
                        }
                      : {
                          borderColor:
                            `${theme.public_border}80`,
                          background:
                            `${theme.public_surface}30`,
                          color:
                            `${theme.public_text}65`,
                        }
                  }
                >
                  All
                </button>

                {categories.map(
                  (
                    category,
                    index
                  ) => (
                    <button
                      key={
                        category.id
                      }
                      onClick={() =>
                        scrollToCategory(
                          category.id
                        )
                      }
                      className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full border text-[9px] uppercase tracking-[.18em] font-bold transition-all"
                      style={
                        selectedCategory ===
                        category.id
                          ? {
                              borderColor:
                                theme.public_accent,
                              background:
                                `${theme.public_accent}16`,
                              color:
                                theme.public_accent,
                            }
                          : {
                              borderColor:
                                `${theme.public_border}80`,
                              background:
                                `${theme.public_surface}30`,
                              color:
                                `${theme.public_text}65`,
                            }
                      }
                    >
                      <span
                        className="text-[7px]"
                        style={{
                          color:
                            theme.public_accent_soft,
                        }}
                      >
                        {String(
                          index +
                            1
                        ).padStart(
                          2,
                          '0'
                        )}
                      </span>

                      {
                        category.name
                      }

                      <span
                        className="text-[7px]"
                        style={{
                          color:
                            `${theme.public_text}35`,
                        }}
                      >
                        {
                          categoryCounts[
                            category.id
                          ] || 0
                        }
                      </span>
                    </button>
                  )
                )}

              </div>

              {/* CART MINI STATUS */}

              {cart.length > 0 && (
                <button
                  onClick={() =>
                    setShowOrderPopup(
                      true
                    )
                  }
                  className="hidden sm:flex shrink-0 items-center gap-2 px-3 py-2 rounded-full border transition-all"
                  style={{
                    borderColor:
                      `${theme.public_accent}60`,
                    background:
                      `${theme.public_accent}12`,
                    color:
                      theme.public_accent,
                  }}
                >
                  <ShoppingBag
                    size={13}
                  />

                  <span className="text-[8px] font-black">
                    {totalItems}
                  </span>
                </button>
              )}

            </div>

          </div>
        </div>

        {/* ==================================================
            MENU CONTENT
        ================================================== */}

        <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">

          <div className="py-14 sm:py-20">

            {categories.map(
              (
                category,
                categoryIndex
              ) => {

                const categoryItems =
                  menuItems.filter(
                    (item) =>
                      item.category_id ===
                      category.id
                  );

                if (
                  categoryItems.length ===
                  0
                ) {
                  return null;
                }

                if (
                  selectedCategory !==
                    'all' &&
                  selectedCategory !==
                    category.id
                ) {
                  return null;
                }

                return (
                  <section
                    key={
                      category.id
                    }
                    id={`category-${category.id}`}
                    className="scroll-mt-24 mb-20 sm:mb-28"
                  >

                    {/* CATEGORY HEADER */}

                    <div className="relative mb-9 sm:mb-12">

                      <div className="flex items-end justify-between gap-5">

                        <div>

                          <div className="flex items-center gap-3 mb-3">

                            <span
                              className="text-[8px] uppercase tracking-[.35em] font-bold"
                              style={{
                                color:
                                  theme.public_accent,
                              }}
                            >
                              Sector
                            </span>

                            <span
                              className="w-8 h-px"
                              style={{
                                background:
                                  `${theme.public_accent}70`,
                              }}
                            />

                            <span
                              className="text-[8px] font-mono"
                              style={{
                                color:
                                  `${theme.public_text}35`,
                              }}
                            >
                              {String(
                                categoryIndex +
                                  1
                              ).padStart(
                                2,
                                '0'
                              )}
                            </span>

                          </div>

                          <h2
                            className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-none tracking-[-.025em]"
                            style={{
                              color:
                                theme.public_text,
                            }}
                          >
                            {
                              category.name
                            }
                          </h2>

                        </div>

                        <div
                          className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-full border"
                          style={{
                            borderColor:
                              `${theme.public_border}80`,
                            background:
                              `${theme.public_surface}40`,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              background:
                                theme.public_accent,
                            }}
                          />

                          <span
                            className="text-[8px] uppercase tracking-[.2em]"
                            style={{
                              color:
                                `${theme.public_text}55`,
                            }}
                          >
                            {
                              categoryItems.length
                            }{' '}
                            dishes
                          </span>
                        </div>

                      </div>

                      <div className="mt-5 h-px relative overflow-hidden"
                        style={{
                          background:
                            `${theme.public_border}70`,
                        }}
                      >
                        <div
                          className="absolute left-0 top-0 h-px w-24"
                          style={{
                            background:
                              theme.public_accent,
                            boxShadow:
                              `0 0 15px ${theme.public_accent}`,
                          }}
                        />
                      </div>

                    </div>

                    {/* FOOD CARDS */}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-7">

                      {categoryItems.map(
                        (
                          item,
                          itemIndex
                        ) => {

                          const discounted =
                            isDiscountCurrentlyActive(
                              item
                            );

                          const finalPrice =
                            getDiscountedPrice(
                              item
                            );

                          const discountLabel =
                            getDiscountLabel(
                              item
                            );

                          const quantity =
                            getTotalItemQuantity(
                              item.id
                            );

                          const isActive =
                            activeCard ===
                            item.id;

                          return (
                            <article
                              key={
                                item.id
                              }
                              onMouseEnter={() =>
                                setActiveCard(
                                  item.id
                                )
                              }
                              onMouseLeave={() =>
                                setActiveCard(
                                  null
                                )
                              }
                              className="nova-card relative overflow-hidden rounded-[26px] border nova-shimmer"
                              style={{
                                borderColor:
                                  isActive
                                    ? `${theme.public_accent}75`
                                    : `${theme.public_border}80`,
                                background:
                                  theme.public_surface,
                                boxShadow:
                                  isActive
                                    ? `0 25px 70px ${theme.public_accent}12`
                                    : '0 20px 60px rgba(0,0,0,.10)',
                              }}
                            >

                              {/* TOP TECH LINE */}

                              <div
                                className="absolute left-0 right-0 top-0 h-px"
                                style={{
                                  background:
                                    isActive
                                      ? theme.public_accent
                                      : `${theme.public_accent}25`,
                                }}
                              />

                              <div className="p-3 sm:p-4">

                                <div className="flex gap-4 sm:gap-5">

                                  {/* IMAGE */}

                                  <div
                                    className="relative shrink-0 w-[118px] h-[118px] sm:w-[150px] sm:h-[150px] overflow-hidden rounded-[20px]"
                                    style={{
                                      background:
                                        theme.public_background,
                                      boxShadow:
                                        `0 15px 45px rgba(0,0,0,.18)`,
                                    }}
                                  >

                                    {item.image_url ? (
                                      <img
                                        src={
                                          item.image_url
                                        }
                                        alt={
                                          item.name
                                        }
                                        className="nova-image w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <span
                                          className="font-serif text-4xl"
                                          style={{
                                            color:
                                              `${theme.public_accent}45`,
                                          }}
                                        >
                                          N
                                        </span>
                                      </div>
                                    )}

                                    {/* IMAGE DEPTH */}

                                    <div
                                      className="absolute inset-0"
                                      style={{
                                        background:
                                          `linear-gradient(145deg, transparent 45%, ${theme.public_accent}18 100%)`,
                                      }}
                                    />

                                    {/* AR CORNERS */}

                                    <div
                                      className="absolute top-2 left-2 w-3 h-3 border-l border-t"
                                      style={{
                                        borderColor:
                                          theme.public_accent,
                                      }}
                                    />

                                    <div
                                      className="absolute bottom-2 right-2 w-3 h-3 border-r border-b"
                                      style={{
                                        borderColor:
                                          theme.public_accent,
                                      }}
                                    />

                                    {/* DISCOUNT */}

                                    {discounted && (
                                      <div
                                        className="absolute top-2 right-2 px-2 py-1 rounded-full backdrop-blur-md"
                                        style={{
                                          background:
                                            `${theme.public_accent}E8`,
                                          color:
                                            theme.public_button_text,
                                        }}
                                      >
                                        <span className="text-[7px] font-black uppercase tracking-[.1em]">
                                          {
                                            discountLabel
                                          }
                                        </span>
                                      </div>
                                    )}

                                  </div>

                                  {/* INFORMATION */}

                                  <div className="min-w-0 flex-1 flex flex-col">

                                    <div className="flex items-start justify-between gap-3">

                                      <div className="min-w-0">

                                        <div className="flex items-center gap-2 mb-1.5">

                                          <span
                                            className="text-[7px] uppercase tracking-[.25em]"
                                            style={{
                                              color:
                                                theme.public_accent_soft,
                                            }}
                                          >
                                            {String(
                                              itemIndex +
                                                1
                                            ).padStart(
                                              2,
                                              '0'
                                            )}
                                          </span>

                                          {quantity >
                                            0 && (
                                            <span
                                              className="text-[7px] uppercase tracking-[.18em] font-bold"
                                              style={{
                                                color:
                                                  theme.public_accent,
                                              }}
                                            >
                                              In order
                                            </span>
                                          )}

                                        </div>

                                        <h3
                                          className="font-serif text-xl sm:text-2xl leading-tight"
                                          style={{
                                            color:
                                              theme.public_text,
                                          }}
                                        >
                                          {
                                            item.name
                                          }
                                        </h3>

                                      </div>

                                      {/* PRICE */}

                                      <div className="shrink-0 text-right">

                                        {discounted ? (
                                          <>
                                            <span
                                              className="block text-[9px] line-through"
                                              style={{
                                                color:
                                                  `${theme.public_text}45`,
                                              }}
                                            >
                                              {
                                                restaurant.currency
                                              }
                                              {getAdjustedPrice(
                                                item
                                              ).toFixed(
                                                2
                                              )}
                                            </span>

                                            <span
                                              className="block mt-1 text-base sm:text-lg font-black"
                                              style={{
                                                color:
                                                  theme.public_accent,
                                              }}
                                            >
                                              {
                                                restaurant.currency
                                              }
                                              {finalPrice.toFixed(
                                                2
                                              )}
                                            </span>
                                          </>
                                        ) : (
                                          <span
                                            className="text-base sm:text-lg font-black"
                                            style={{
                                              color:
                                                theme.public_accent,
                                            }}
                                          >
                                            {
                                              restaurant.currency
                                            }
                                            {finalPrice.toFixed(
                                              2
                                            )}
                                          </span>
                                        )}

                                      </div>

                                    </div>

                                    {item.description && (
                                      <p
                                        className="mt-2.5 text-[11px] sm:text-xs leading-relaxed line-clamp-3"
                                        style={{
                                          color:
                                            `${theme.public_text}75`,
                                        }}
                                      >
                                        {
                                          item.description
                                        }
                                      </p>
                                    )}

                                    <div className="mt-auto pt-4">

                                      {quantity ===
                                      0 ? (
                                        <button
                                          onClick={() =>
                                            openExtrasSelector(
                                              item
                                            )
                                          }
                                          className="group inline-flex items-center gap-2"
                                        >

                                          <span
                                            className="w-8 h-8 rounded-full border flex items-center justify-center transition-all group-hover:scale-110"
                                            style={{
                                              borderColor:
                                                `${theme.public_accent}70`,
                                              background:
                                                `${theme.public_accent}10`,
                                              color:
                                                theme.public_accent,
                                            }}
                                          >
                                            <Plus
                                              size={
                                                14
                                              }
                                            />
                                          </span>

                                          <span
                                            className="text-[8px] uppercase tracking-[.2em] font-bold"
                                            style={{
                                              color:
                                                theme.public_accent,
                                            }}
                                          >
                                            {availableExtrasForItem(
                                              item
                                            ).length >
                                            0
                                              ? 'Customize'
                                              : 'Add to order'}
                                          </span>

                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-3">

                                          <div
                                            className="inline-flex items-center rounded-full border p-1"
                                            style={{
                                              borderColor:
                                                `${theme.public_accent}50`,
                                              background:
                                                `${theme.public_accent}08`,
                                            }}
                                          >

                                            <button
                                              type="button"
                                              onClick={() =>
                                                decreaseQuantity(
                                                  item.id,
                                                  []
                                                )
                                              }
                                              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-105"
                                              style={{
                                                color:
                                                  theme.public_accent,
                                              }}
                                            >
                                              <Minus
                                                size={
                                                  13
                                                }
                                              />
                                            </button>

                                            <span
                                              className="w-7 text-center text-xs font-black"
                                              style={{
                                                color:
                                                  theme.public_text,
                                              }}
                                            >
                                              {
                                                quantity
                                              }
                                            </span>

                                            <button
                                              type="button"
                                              onClick={() =>
                                                addToCart(
                                                  item,
                                                  []
                                                )
                                              }
                                              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-105"
                                              style={{
                                                color:
                                                  theme.public_accent,
                                              }}
                                            >
                                              <Plus
                                                size={
                                                  13
                                                }
                                              />
                                            </button>

                                          </div>

                                          <button
                                            onClick={() =>
                                              openExtrasSelector(
                                                item
                                              )
                                            }
                                            className="text-[8px] uppercase tracking-[.16em] font-bold"
                                            style={{
                                              color:
                                                `${theme.public_text}55`,
                                            }}
                                          >
                                            Customize
                                          </button>

                                        </div>
                                      )}

                                    </div>

                                  </div>

                                </div>

                                                                {/* CART LINE BREAKDOWN */}

                                {quantity > 0 &&
                                  cart.filter(
                                    (cartItem) =>
                                      cartItem.id === item.id
                                  ).length > 0 && (
                                    <div
                                      className="mt-4 pt-4 border-t flex flex-wrap gap-2"
                                      style={{
                                        borderColor:
                                          `${theme.public_border}55`,
                                      }}
                                    >
                                      {cart
                                        .filter(
                                          (cartItem) =>
                                            cartItem.id === item.id
                                        )
                                        .map((cartItem) => (
                                          <div
                                            key={`${cartItem.id}-${getExtraSignature(
                                              cartItem.selectedExtras
                                            )}`}
                                            className="flex items-center gap-2.5 rounded-full border px-3 py-2 backdrop-blur-md"
                                            style={{
                                              /*
                                               * IMPORTANT:
                                               * This is intentionally a dark
                                               * contrast surface instead of
                                               * theme.public_surface.
                                               *
                                               * Some restaurant themes use a
                                               * light public surface while
                                               * their text is white.
                                               */
                                              background:
                                                "rgba(8,11,18,0.92)",
                                              borderColor:
                                                cartItem.selectedExtras.length > 0
                                                  ? `${theme.public_accent}45`
                                                  : "rgba(255,255,255,0.14)",
                                              boxShadow:
                                                "0 8px 25px rgba(0,0,0,0.18)",
                                            }}
                                          >

                                            {/* QUANTITY */}

                                            <span
                                              className="text-[9px] font-black"
                                              style={{
                                                color: "#FFFFFF",
                                                textShadow:
                                                  "0 1px 8px rgba(0,0,0,.45)",
                                              }}
                                            >
                                              {cartItem.quantity}×
                                            </span>


                                            {/* ACCENT INDICATOR */}

                                            {cartItem.selectedExtras.length >
                                              0 && (
                                              <span
                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                style={{
                                                  background:
                                                    theme.public_accent,
                                                  boxShadow:
                                                    `0 0 9px ${theme.public_accent}`,
                                                }}
                                              />
                                            )}


                                            {/* EXTRAS */}

                                            {cartItem.selectedExtras.length >
                                              0 && (
                                              <span
                                                className="text-[8px] font-semibold leading-none"
                                                style={{
                                                  color:
                                                    "rgba(255,255,255,0.88)",
                                                  textShadow:
                                                    "0 1px 8px rgba(0,0,0,.35)",
                                                }}
                                              >
                                                {cartItem.selectedExtras
                                                  .map(
                                                    (extra) =>
                                                      extra.name
                                                  )
                                                  .join(", ")}
                                              </span>
                                            )}

                                          </div>
                                        ))}
                                    </div>
                                  )}

                              </div>

                            </article>
                          );
                        }
                      )}

                    </div>

                  </section>
                );
              }
            )}

            {/* EMPTY MENU */}

            {menuItems.length ===
              0 && (
              <div className="py-24 text-center">

                <div
                  className="w-16 h-16 mx-auto rounded-full border flex items-center justify-center"
                  style={{
                    borderColor:
                      `${theme.public_accent}40`,
                  }}
                >
                  <Sparkles
                    size={20}
                    style={{
                      color:
                        theme.public_accent,
                    }}
                  />
                </div>

                <h2
                  className="mt-6 text-xl font-serif"
                  style={{
                    color:
                      theme.public_text,
                  }}
                >
                  Menu coming soon
                </h2>

                <p
                  className="mt-2 text-xs"
                  style={{
                    color:
                      `${theme.public_text}50`,
                  }}
                >
                  This restaurant has not
                  published any dishes yet.
                </p>

              </div>
            )}

          </div>

        </main>

      </section>

            {/* ==================================================
          EXTRAS / CUSTOMIZATION
      ================================================== */}

      {selectedExtrasItem && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-5"
          style={{
            background:
              "rgba(0,0,0,.72)",
            backdropFilter:
              "blur(18px)",
          }}
        >

          <div
            className="relative w-full max-w-lg max-h-[88svh] overflow-hidden rounded-[30px] border shadow-2xl"
            style={{
              /*
               * DEDICATED DARK MODAL SURFACE
               *
               * We intentionally do NOT use theme.public_surface here.
               * A restaurant theme can have a light surface while its
               * public text color is white.
               *
               * The modal is an interactive command surface, so it gets
               * guaranteed contrast while still using the restaurant's
               * accent color everywhere important.
               */
              background:
                "linear-gradient(145deg, rgba(9,12,20,0.985), rgba(17,21,32,0.975))",
              borderColor:
                `${theme.public_accent}55`,
              color:
                "#FFFFFF",
              boxShadow:
                `0 30px 120px rgba(0,0,0,.6), 0 0 70px ${theme.public_accent}10`,
            }}
          >

            {/* MODAL AMBIENT */}

            <div
              className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
              style={{
                background:
                  `${theme.public_accent}18`,
              }}
            />

            <div
              className="absolute -bottom-40 -left-40 w-72 h-72 rounded-full blur-[100px] pointer-events-none"
              style={{
                background:
                  `${theme.public_accent_soft}08`,
              }}
            />


            {/* HEADER */}

            <div
              className="relative p-5 sm:p-6 border-b"
              style={{
                borderColor:
                  "rgba(255,255,255,0.10)",
              }}
            >

              {/* CLOSE */}

              <button
                type="button"
                onClick={() => {
                  setSelectedExtrasItem(null);
                  setSelectedExtras({});
                }}
                className="absolute top-4 right-4 w-9 h-9 rounded-full border flex items-center justify-center transition-all hover:scale-105"
                style={{
                  borderColor:
                    "rgba(255,255,255,0.18)",
                  color:
                    "#FFFFFF",
                  background:
                    "rgba(255,255,255,0.06)",
                  boxShadow:
                    "0 6px 20px rgba(0,0,0,.18)",
                }}
              >
                <X size={15} />
              </button>


              {/* PERSONALIZE LABEL */}

              <div className="flex items-center gap-2 mb-2">

                <Sparkles
                  size={12}
                  style={{
                    color:
                      theme.public_accent,
                  }}
                />

                <span
                  className="text-[8px] uppercase tracking-[.3em] font-black"
                  style={{
                    color:
                      theme.public_accent,
                  }}
                >
                  Personalize
                </span>

              </div>


              {/* ITEM NAME */}

              <h3
                className="pr-10 text-2xl font-serif"
                style={{
                  color:
                    "#FFFFFF",
                  textShadow:
                    "0 1px 18px rgba(0,0,0,.35)",
                }}
              >
                {selectedExtrasItem.name}
              </h3>


              {/* DESCRIPTION */}

              <p
                className="mt-1 text-[10px]"
                style={{
                  color:
                    "rgba(255,255,255,0.70)",
                }}
              >
                Choose your extras and sauces
              </p>

            </div>


            {/* ==================================================
                EXTRAS
            ================================================== */}

            <div
              className="relative p-5 sm:p-6 max-h-[50vh] overflow-y-auto space-y-2.5"
            >

              {selectedExtrasList.map(
                (extra) => {

                  const quantity =
                    selectedExtras[
                      extra.id
                    ] || 0;

                  return (
                    <div
                      key={
                        extra.id
                      }
                      className="flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 transition-all"
                      style={{
                        borderColor:
                          quantity > 0
                            ? `${theme.public_accent}70`
                            : "rgba(255,255,255,0.12)",

                        background:
                          quantity > 0
                            ? `${theme.public_accent}14`
                            : "rgba(255,255,255,0.045)",

                        boxShadow:
                          quantity > 0
                            ? `0 8px 25px ${theme.public_accent}08`
                            : "none",
                      }}
                    >

                      {/* EXTRA INFORMATION */}

                      <div className="min-w-0">

                        <p
                          className="text-sm font-bold"
                          style={{
                            color:
                              "#FFFFFF",
                            textShadow:
                              "0 1px 8px rgba(0,0,0,.3)",
                          }}
                        >
                          {extra.name}
                        </p>

                        <p
                          className="mt-1 text-[9px] uppercase tracking-[.15em]"
                          style={{
                            color:
                              "rgba(255,255,255,0.68)",
                          }}
                        >
                          {restaurant.currency}
                          {Number(
                            extra.price || 0
                          ).toFixed(2)}{" "}
                          each
                        </p>

                      </div>


                      {/* ==================================================
                          QUANTITY CONTROL
                      ================================================== */}

                      <div
                        className="shrink-0 flex items-center gap-1 rounded-full border p-1"
                        style={{
                          borderColor:
                            quantity > 0
                              ? `${theme.public_accent}60`
                              : "rgba(255,255,255,0.16)",

                          background:
                            "rgba(0,0,0,0.28)",
                        }}
                      >

                        {/* MINUS */}

                        <button
                          type="button"
                          onClick={() =>
                            decreaseSelectedExtra(
                              extra.id
                            )
                          }
                          disabled={
                            quantity === 0
                          }
                          className="w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-25 transition-all hover:scale-105"
                          style={{
                            color:
                              theme.public_accent,
                          }}
                        >
                          <Minus
                            size={
                              14
                            }
                          />
                        </button>


                        {/* NUMBER */}

                        <span
                          className="w-7 text-center text-xs font-black"
                          style={{
                            color:
                              quantity > 0
                                ? theme.public_accent
                                : "#FFFFFF",
                            textShadow:
                              "0 1px 8px rgba(0,0,0,.35)",
                          }}
                        >
                          {quantity}
                        </span>


                        {/* PLUS */}

                        <button
                          type="button"
                          onClick={() =>
                            increaseSelectedExtra(
                              extra.id
                            )
                          }
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105"
                          style={{
                            color:
                              theme.public_accent,
                          }}
                        >
                          <Plus
                            size={
                              14
                            }
                          />
                        </button>

                      </div>

                    </div>
                  );
                }
              )}

            </div>


            {/* ==================================================
                FOOTER
            ================================================== */}

            <div
              className="relative p-5 sm:p-6 border-t"
              style={{
                borderColor:
                  "rgba(255,255,255,0.10)",
                background:
                  "rgba(0,0,0,0.18)",
              }}
            >

              {/* TOTAL */}

              <div className="flex items-center justify-between mb-4">

                <span
                  className="text-[8px] uppercase tracking-[.25em] font-bold"
                  style={{
                    color:
                      "rgba(255,255,255,0.68)",
                  }}
                >
                  Extras Total
                </span>

                <span
                  className="text-lg font-black"
                  style={{
                    color:
                      theme.public_accent,
                    textShadow:
                      `0 0 18px ${theme.public_accent}25`,
                  }}
                >
                  {restaurant.currency}
                  {selectedExtrasList
                    .reduce(
                      (sum, extra) =>
                        sum +
                        Number(
                          extra.price || 0
                        ) *
                          Number(
                            selectedExtras[
                              extra.id
                            ] || 0
                          ),
                      0
                    )
                    .toFixed(2)}
                </span>

              </div>


              {/* ACTIONS */}

              <div className="flex gap-2">

                {/* CANCEL */}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedExtrasItem(null);
                    setSelectedExtras({});
                  }}
                  className="flex-1 py-3.5 rounded-2xl border text-[9px] uppercase tracking-[.2em] font-black transition-all hover:-translate-y-0.5"
                  style={{
                    borderColor:
                      "rgba(255,255,255,0.18)",
                    background:
                      "rgba(255,255,255,0.055)",
                    color:
                      "#FFFFFF",
                  }}
                >
                  Cancel
                </button>


                {/* ADD TO ORDER */}

                <button
                  type="button"
                  onClick={
                    confirmSelectedExtras
                  }
                  className="flex-1 py-3.5 rounded-2xl text-[9px] uppercase tracking-[.2em] font-black transition-all hover:-translate-y-0.5"
                  style={{
                    background:
                      theme.public_accent,
                    color:
                      theme.public_button_text,
                    boxShadow:
                      `0 12px 30px ${theme.public_accent}25`,
                  }}
                >
                  Add to Order
                </button>

              </div>

            </div>

          </div>

        </div>
      )}


            {/* ==================================================
                FLOATING ORDER COMMAND CENTER
            ================================================== */}

            {cart.length > 0 && (
              <div className="fixed bottom-4 left-3 right-3 z-[60]">

                <div className="max-w-3xl mx-auto">

                  {showOrderPopup ? (

                    <div
  className="relative overflow-hidden rounded-[26px] border backdrop-blur-2xl"
  style={{
    background:
      "linear-gradient(145deg, rgba(8,11,18,0.975), rgba(16,20,30,0.965))",
    borderColor:
      `${theme.public_accent}55`,
    color:
      "#FFFFFF",
    boxShadow:
      `0 25px 100px rgba(0,0,0,.55), 0 0 50px ${theme.public_accent}08`,
  }}
>

                      {/* COMMAND LINE */}

                      <div
                        className="h-px"
                        style={{
                          background:
                            `linear-gradient(90deg, transparent, ${theme.public_accent}, transparent)`,
                        }}
                      />


                      {/* CLOSE */}

<button
  type="button"
  onClick={() =>
    setShowOrderPopup(false)
  }
  className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full border flex items-center justify-center transition-all hover:bg-white/10 hover:scale-105"
  style={{
    borderColor:
      "rgba(255,255,255,0.18)",
    color:
      "rgba(255,255,255,0.92)",
    background:
      "rgba(8,11,18,0.92)",
    boxShadow:
      "0 6px 20px rgba(0,0,0,.30)",
  }}
>
  <X size={13} />
</button>


                      <div className="px-4 pb-4 pt-12 sm:px-5 sm:pb-5 sm:pt-12">

                        <div className="flex flex-col sm:flex-row gap-4">


                          {/* ORDER ITEMS */}

                          <div className="flex-1 min-w-0">

                            <div className="flex items-center gap-2">

                              <ShoppingBag
                                size={13}
                                style={{
                                  color:
                                    theme.public_accent,
                                }}
                              />

                              <span
                                className="text-[8px] uppercase tracking-[.3em] font-black"
                                style={{
                                  color:
                                    theme.public_accent,
                                }}
                              >
                                Your Order
                              </span>

                              <span
                                className="ml-auto sm:hidden text-[8px] font-bold"
                                style={{
                                  color:
                                    "rgba(255,255,255,0.68)",
                                }}
                              >
                                {totalItems} items
                              </span>

                            </div>


                            <div className="mt-3 max-h-40 overflow-y-auto space-y-2 pr-1">

                              {activeCart.map(
                                (item) => (

                                  <div
                                    key={`${item.id}-${getExtraSignature(
                                      item.selectedExtras
                                    )}`}
                                    className="rounded-2xl border px-3 py-2.5"
                                    style={{
                                      borderColor:
                                        `${theme.public_border}65`,
                                      background:
                                        "rgba(255,255,255,0.035)",
                                    }}
                                  >

                                    <div className="flex items-start justify-between gap-3">

                                      <div className="min-w-0">

                                        <p
                                          className="text-[11px] font-bold"
                                          style={{
                                            color:
                                              "#FFFFFF",
                                          }}
                                        >
                                          {item.quantity}×{" "}
                                          {item.name}
                                        </p>


                                        {item.selectedExtras.length >
                                          0 && (

                                          <div className="mt-2 space-y-1">

                                            {item.selectedExtras.map(
                                              (extra) => (

                                                <div
                                                  key={extra.id}
                                                  className="flex items-center justify-between gap-2"
                                                >

                                                  <span
                                                    className="text-[9px]"
                                                    style={{
                                                      color:
                                                        "rgba(255,255,255,0.62)",
                                                    }}
                                                  >
                                                    +{" "}
                                                    {extra.name}
                                                  </span>


                                                  <div className="flex items-center gap-1">

                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        changeExtraQuantity(
                                                          item.id,
                                                          item.selectedExtras,
                                                          extra.id,
                                                          -1
                                                        )
                                                      }
                                                      className="w-5 h-5 rounded-full border flex items-center justify-center"
                                                      style={{
                                                        borderColor:
                                                          `${theme.public_accent}45`,
                                                        color:
                                                          theme.public_accent,
                                                        background:
                                                          `${theme.public_accent}08`,
                                                      }}
                                                    >
                                                      <Minus
                                                        size={9}
                                                      />
                                                    </button>


                                                    <span
                                                      className="w-4 text-center text-[8px] font-bold"
                                                      style={{
                                                        color:
                                                          "#FFFFFF",
                                                      }}
                                                    >
                                                      {extra.quantity}
                                                    </span>


                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        changeExtraQuantity(
                                                          item.id,
                                                          item.selectedExtras,
                                                          extra.id,
                                                          1
                                                        )
                                                      }
                                                      className="w-5 h-5 rounded-full border flex items-center justify-center"
                                                      style={{
                                                        borderColor:
                                                          `${theme.public_accent}45`,
                                                        color:
                                                          theme.public_accent,
                                                        background:
                                                          `${theme.public_accent}08`,
                                                      }}
                                                    >
                                                      <Plus
                                                        size={9}
                                                      />
                                                    </button>


                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        removeExtraFromCart(
                                                          item.id,
                                                          item.selectedExtras,
                                                          extra.id
                                                        )
                                                      }
                                                      className="ml-1 w-5 h-5 rounded-full border flex items-center justify-center"
                                                      style={{
                                                        borderColor:
                                                          `${theme.public_border}90`,
                                                        color:
                                                          "rgba(255,255,255,0.62)",
                                                      }}
                                                    >
                                                      <X
                                                        size={9}
                                                      />
                                                    </button>

                                                  </div>

                                                </div>

                                              )
                                            )}

                                          </div>

                                        )}

                                      </div>


                                      <div className="shrink-0 text-right">

                                        <p
                                          className="text-[10px] font-black"
                                          style={{
                                            color:
                                              theme.public_accent,
                                          }}
                                        >
                                          {restaurant.currency}
                                          {(
                                            getCartLinePrice(
                                              item
                                            ) *
                                            item.quantity
                                          ).toFixed(2)}
                                        </p>


                                        <div className="flex items-center justify-end gap-1 mt-2">

                                          <button
                                            type="button"
                                            onClick={() =>
                                              decreaseQuantity(
                                                item.id,
                                                item.selectedExtras
                                              )
                                            }
                                            className="w-6 h-6 rounded-full border flex items-center justify-center"
                                            style={{
                                              borderColor:
                                                `${theme.public_accent}45`,
                                              color:
                                                theme.public_accent,
                                            }}
                                          >
                                            <Minus size={10} />
                                          </button>


                                          <span
                                            className="w-5 text-center text-[9px] font-bold"
                                            style={{
                                              color:
                                                "#FFFFFF",
                                            }}
                                          >
                                            {item.quantity}
                                          </span>


                                          <button
                                            type="button"
                                            onClick={() =>
                                              addToCart(
                                                item,
                                                item.selectedExtras
                                              )
                                            }
                                            className="w-6 h-6 rounded-full border flex items-center justify-center"
                                            style={{
                                              borderColor:
                                                `${theme.public_accent}45`,
                                              color:
                                                theme.public_accent,
                                            }}
                                          >
                                            <Plus size={10} />
                                          </button>

                                        </div>

                                      </div>

                                    </div>

                                  </div>

                                )
                              )}

                            </div>

                          </div>


                          {/* COMMAND PANEL */}

                          <div className="w-full sm:w-[260px] shrink-0">

                            <div
                              className="rounded-2xl border p-3"
                              style={{
                                borderColor:
                                  `${theme.public_border}70`,
                                background:
                                  "rgba(255,255,255,0.035)",
                              }}
                            >

                              <div className="flex items-center justify-between pr-10">

                                <span
                                  className="text-[8px] uppercase tracking-[.2em] font-bold"
                                  style={{
                                    color:
                                      "rgba(255,255,255,0.68)",
                                  }}
                                >
                                  Total
                                </span>

                                <span
                                  className="text-xl font-black"
                                  style={{
                                    color:
                                      theme.public_accent,
                                  }}
                                >
                                  {restaurant.currency}
                                  {totalPrice.toFixed(2)}
                                </span>

                              </div>


                              <div className="mt-3 flex gap-2">

                                {(restaurant.phone_number ||
                                  restaurant.mobile_number) && (

                                  <a
                                    href={`tel:${
                                      restaurant.phone_number ||
                                      restaurant.mobile_number ||
                                      ""
                                    }`}
                                    className="shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center transition-all hover:-translate-y-0.5"
                                    style={{
                                      borderColor:
                                        `${theme.public_accent}45`,
                                      color:
                                        theme.public_accent,
                                      background:
                                        `${theme.public_accent}08`,
                                    }}
                                  >
                                    <Phone size={14} />
                                  </a>

                                )}

                                {/* SEND TO ORDERS */}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!tableNumber.trim()) {
                                      alert(
                                        'Please enter the table number.'
                                      );
                                      return;
                                    }

                                    const result =
                                      await createDatabaseOrder(
                                        'Waiter'
                                      );

                                    if (!result.success) {
                                      alert(
                                        result.error ||
                                          'Could not create the order.'
                                      );
                                      return;
                                    }

                                    // Clear cart after successful submission
                                    setCart([]);
                                    setTableNumber('');
                                    setShowOrderPopup(false);

                                    alert(
                                      `Order ${result.orderId} has been sent to Orders.`
                                    );
                                  }}
                                  className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-[9px] uppercase tracking-[.13em] font-black transition-all hover:opacity-90"
                                  style={{
                                    background:
                                      `${theme.public_accent}18`,
                                    border:
                                      `1px solid ${theme.public_accent}60`,
                                    color:
                                      theme.public_accent,
                                    boxShadow:
                                      `0 10px 30px ${theme.public_accent}10`,
                                  }}
                                >
                                  <ShoppingBag size={14} />
                                  Send to Orders
                                </button>
                                <button
                                  type="button"
                                  onClick={handleWhatsAppOrder}
                                  className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-[9px] uppercase tracking-[.13em] font-black transition-all hover:opacity-90"
                                  style={{
                                    background:
                                      theme.public_accent,
                                    color:
                                      theme.public_button_text,
                                    boxShadow:
                                      `0 10px 30px ${theme.public_accent}20`,
                                  }}
                                >
                                  <MessageCircle size={14} />
                                  Order via WhatsApp
                                </button>

                              </div>

                            </div>


                            {/* TABLE NUMBER */}

                            <div className="mt-3">
                              <label
                                className="block mb-1.5 text-[8px] uppercase tracking-[.2em] font-black"
                                style={{
                                  color: "rgba(255,255,255,0.68)",
                                }}
                              >
                                Table Number
                              </label>

                              <input
                                value={tableNumber}
                                onChange={(e) =>
                                  setTableNumber(e.target.value)
                                }
                                placeholder="e.g. 2"
                                inputMode="numeric"
                                className="w-full h-10 px-3 rounded-xl border outline-none text-[10px]"
                                style={{
                                  background:
                                    "rgba(255,255,255,0.045)",
                                  color: "#FFFFFF",
                                  borderColor:
                                    `${theme.public_border}75`,
                                }}
                              />
                            </div>


                            {/* CLEAR ORDER */}

                            <button
                              type="button"
                              onClick={clearCart}
                              className="mt-2 w-full py-2 text-[8px] uppercase tracking-[.2em] font-bold transition-all hover:opacity-80"
                              style={{
                                color:
                                  "rgba(255,255,255,0.58)",
                              }}
                            >
                              Clear Order
                            </button>

                          </div>

                        </div>

                      </div>

                    </div>

                  ) : (

                    <div className="flex justify-end">

                      <button
                        type="button"
                        onClick={() =>
                          setShowOrderPopup(true)
                        }
                        className="group flex items-center gap-3 px-5 py-3.5 rounded-full border backdrop-blur-xl shadow-2xl transition-all hover:-translate-y-1"
                        style={{
                          background:
                            "linear-gradient(145deg, rgba(8,11,18,0.96), rgba(16,20,30,0.94))",
                          borderColor:
                            `${theme.public_accent}65`,
                          color:
                            "#FFFFFF",
                          boxShadow:
                            `0 20px 60px rgba(0,0,0,.25), 0 0 35px ${theme.public_accent}10`,
                        }}
                      >

                        <span
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{
                            background:
                              `${theme.public_accent}15`,
                            color:
                              theme.public_accent,
                          }}
                        >
                          <ShoppingBag size={14} />
                        </span>


                        <span
                          className="text-[9px] uppercase tracking-[.16em] font-black"
                          style={{
                            color:
                              "#FFFFFF",
                          }}
                        >
                          View Order
                        </span>


                        <span
                          className="text-sm font-black"
                          style={{
                            color:
                              theme.public_accent,
                          }}
                        >
                          {restaurant.currency}
                          {totalPrice.toFixed(2)}
                        </span>


                        <ChevronRight
                          size={14}
                          style={{
                            color:
                              "rgba(255,255,255,0.62)",
                          }}
                        />

                      </button>

                    </div>

                  )}

                </div>

              </div>
            )}


            {/* ==================================================
                FOOTER
            ================================================== */}

            <footer
              className="relative overflow-hidden border-t"
              style={{
                background:
                  theme.public_hero_background,
                borderColor:
                  `${theme.public_accent}20`,
              }}
            >

              {/* AMBIENT GLOW */}

              <div
                className="pointer-events-none absolute left-1/2 top-0 w-[500px] h-[300px] -translate-x-1/2 rounded-full blur-[130px]"
                style={{
                  background:
                    `${theme.public_accent}12`,
                }}
              />


              {/* TOP LINE */}

              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-px"
                style={{
                  background:
                    `linear-gradient(90deg, transparent, ${theme.public_accent}, transparent)`,
                }}
              />


              <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">

                <div className="text-center">


                  {/* LOGO */}

                  <div className="relative inline-flex">

                    <div
                      className="absolute inset-[-15px] rounded-full border nova-orbit"
                      style={{
                        borderColor:
                          `${theme.public_accent}30`,
                        borderTopColor:
                          `${theme.public_accent}90`,
                      }}
                    />

                    <div
                      className="relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center border"
                      style={{
                        borderColor: `${theme.public_accent}80`,
                        boxShadow: `0 0 40px ${theme.public_accent}20`,
                      }}
                    >
                      <img
                        src="/novamenu-icon.jpeg"
                        alt="NOVAMENU"
                        className="h-full w-full object-cover"
                      />

                    </div>

                  </div>


                  {/* BRAND */}

                  <p
                    className="mt-7 text-[11px] tracking-[.45em] font-black"
                    style={{
                      color: "#FFFFFF",
                      textShadow:
                        `0 0 20px ${theme.public_accent}18`,
                    }}
                  >
                    NOVAMENU
                  </p>


                  {/* DESCRIPTION */}

                  <p
                    className="mt-3 text-[9px] uppercase tracking-[.25em] font-medium"
                    style={{
                      color:
                        "rgba(255,255,255,0.70)",
                    }}
                  >
                    Digital dining experience
                  </p>


                  {/* DIVIDER */}

                  <div className="flex items-center justify-center gap-3 my-8">

                    <span
                      className="w-12 h-px"
                      style={{
                        background:
                          `${theme.public_accent}55`,
                      }}
                    />

                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background:
                          theme.public_accent,
                        boxShadow:
                          `0 0 10px ${theme.public_accent}`,
                      }}
                    />

                    <span
                      className="w-12 h-px"
                      style={{
                        background:
                          `${theme.public_accent}55`,
                      }}
                    />

                  </div>


                  {/* POWERED BY */}

                  <p
                    className="text-[8px] uppercase tracking-[.22em] font-medium"
                    style={{
                      color:
                        "rgba(255,255,255,0.58)",
                    }}
                  >
                    Powered by{" "}
                    <span
                      style={{
                        color: "#FFFFFF",
                        fontWeight: 800,
                      }}
                    >
                      Novera Labs
                    </span>
                  </p>

                </div>

              </div>

            </footer>

    </div>
  );
}
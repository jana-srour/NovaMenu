'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { notifyRestaurantRealtimeSync, subscribeRestaurantRealtime } from '@/lib/live-sync';
import { logMenuItemPricingChange, roundPrice } from '@/lib/pricing-audit';
import { AccessRestricted } from '@/app/dashboard/components/access-restricted';
import { DashboardLoader } from '@/app/dashboard/components/dashboard-loader';
import { PlanRequired } from '@/app/dashboard/components/plan-required';
import {
  subscriptionAllows,
  type BillingPlan,
  type SubscriptionStatus,
} from '@/lib/billing/plans';
import {
  Plus,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  FolderPlus,
  Utensils,
  Loader2,
  X,
  GripVertical,
  ImagePlus,
  Link as LinkIcon,
  Upload,
  Tag,
  Percent,
  DollarSign,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;

  // Discount fields
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number | null;
  discount_enabled: boolean;
  discount_start_at: string | null;
  discount_end_at: string | null;
}

interface MenuExtra {
  id: string;
  menu_item_id: string;
  type: 'extra' | 'sauce';
  name: string;
  price: number;
  is_available: boolean;
  sort_order: number;
}

export default function MenuManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  const [menuExtras, setMenuExtras] = useState<MenuExtra[]>([]);

  const [selectedCategory, setSelectedCategory] =
    useState<string | 'all'>('all');

  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantSettings, setRestaurantSettings] = useState<{
    currency: string;
    price_adjustment_enabled: boolean;
    price_adjustment_mode: 'percentage' | 'fixed' | null;
    price_adjustment_direction: 'increase' | 'decrease' | null;
    price_adjustment_value: number | null;
  }>({
    currency: '$',
    price_adjustment_enabled: false,
    price_adjustment_mode: 'percentage',
    price_adjustment_direction: 'increase',
    price_adjustment_value: 0,
  });
  const [errorMessage, setErrorMessage] = useState('');

  const [hasMenuAccess, setHasMenuAccess] = useState(false);
  const [planAllowed, setPlanAllowed] = useState(false);

  // Category modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');

  // Item modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    price: '',
    category_id: '',
    image_url: '',
    is_available: true,

    // Discount
    discount_enabled: false,
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    discount_start_at: '',
    discount_end_at: '',

    // Extras & Sauces
    options: [] as MenuExtra[],
  });

  // Images
  const [imageMode, setImageMode] =
    useState<'url' | 'upload'>('url');

  const [uploadingImage, setUploadingImage] =
    useState(false);

  const [imagePreview, setImagePreview] =
    useState('');

  // Dragging
  const [draggedCategoryId, setDraggedCategoryId] =
    useState<string | null>(null);

  const [draggedItemId, setDraggedItemId] =
    useState<string | null>(null);

  // =====================================================
  // LOAD DATA
  // =====================================================

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setHasMenuAccess(false);
    }
    setErrorMessage('');

    try {
      // =====================================================
      // AUTHENTICATED USER
      // =====================================================

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = '/login';
        return;
      }

      // =====================================================
      // RESTAURANT MEMBERSHIP
      // =====================================================

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from('restaurant_members')
        .select(`
          restaurant_id,
          role,
          position_id
        `)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        console.error(
          'Membership error:',
          membershipError
        );

        setErrorMessage(
          'Unable to verify your restaurant access.'
        );

        return;
      }

      if (!membership?.restaurant_id) {
        setErrorMessage(
          'No restaurant is associated with your account.'
        );

        return;
      }

      const id = membership.restaurant_id;

      // =====================================================
      // SUBSCRIPTION ACCESS
      // =====================================================

      const { data: subscription } = await supabase
        .from('restaurant_subscriptions')
        .select('plan_code, status, trial_ends_at')
        .eq('restaurant_id', id)
        .maybeSingle();

      const allowed = subscriptionAllows(
        subscription as {
          plan_code: BillingPlan;
          status: SubscriptionStatus;
          trial_ends_at: string;
        } | null,
        'menu'
      );

      setPlanAllowed(allowed);

      if (!allowed) {
        setLoading(false);
        return;
      }

      // =====================================================
      // MENU PERMISSION
      // =====================================================

      const memberRole =
        typeof membership.role === 'string'
          ? membership.role
              .toLowerCase()
              .trim()
          : '';

      // OWNER / ADMIN → ALWAYS ALLOWED

      if (['owner', 'admin'].includes(memberRole)) {
        setHasMenuAccess(true);
      }

      // STAFF → CHECK ASSIGNED POSITION

      else {
        // No position assigned = NO ACCESS

        if (!membership.position_id) {
          setHasMenuAccess(false);
          return;
        }

        const {
          data: restaurantRole,
          error: restaurantRoleError,
        } = await supabase
          .from('restaurant_roles')
          .select('can_manage_menu')
          .eq('id', membership.position_id)
          .eq('restaurant_id', id)
          .maybeSingle();

        if (restaurantRoleError) {
          console.error(
            'Restaurant role permission error:',
            restaurantRoleError
          );

          setErrorMessage(
            'Unable to verify your menu permission.'
          );

          return;
        }

        // POSITION DOES NOT EXIST → NO ACCESS

        if (!restaurantRole) {
          setHasMenuAccess(false);
          return;
        }

        // NO MENU PERMISSION → STOP HERE

        if (
          restaurantRole.can_manage_menu !== true
        ) {
          setHasMenuAccess(false);
          return;
        }

        // MENU PERMISSION GRANTED

        setHasMenuAccess(true);
      }

      // =====================================================
      // ONLY AFTER PERMISSION IS GRANTED
      // LOAD RESTAURANT DATA
      // =====================================================

      setRestaurantId(id);

      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('currency, price_adjustment_enabled, price_adjustment_mode, price_adjustment_direction, price_adjustment_value')
        .eq('id', id)
        .maybeSingle();

      if (!restaurantError && restaurantData) {
        setRestaurantSettings({
          currency: restaurantData.currency || '$',
          price_adjustment_enabled: restaurantData.price_adjustment_enabled === true,
          price_adjustment_mode: restaurantData.price_adjustment_mode || 'percentage',
          price_adjustment_direction: restaurantData.price_adjustment_direction || 'increase',
          price_adjustment_value: Number(restaurantData.price_adjustment_value) || 0,
        });
      }

      // =====================================================
      // CATEGORIES
      // =====================================================

      const {
        data: catData,
        error: categoryError,
      } = await supabase
        .from('categories')
        .select('id, name, sort_order')
        .eq('restaurant_id', id)
        .order('sort_order', {
          ascending: true,
        });

      if (categoryError) {
        setErrorMessage(categoryError.message);
        return;
      }

      // =====================================================
      // MENU ITEMS
      // =====================================================

      const {
        data: itemData,
        error: itemError,
      } = await supabase
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
        .eq('restaurant_id', id)
        .order('sort_order', {
          ascending: true,
        })
        .order('created_at', {
          ascending: false,
        });

      if (itemError) {
        setErrorMessage(itemError.message);
        return;
      }

      // =====================================================
      // MENU EXTRAS / SAUCES
      // =====================================================

      const {
        data: extraData,
        error: extraError,
      } = await supabase
        .from('menu_item_extras')
        .select(`
          id,
          menu_item_id,
          type,
          name,
          price,
          is_available,
          sort_order,
          menu_items!inner(
            restaurant_id
          )
        `)
        .eq('menu_items.restaurant_id', id)
        .order('sort_order', {
          ascending: true,
        });

      if (extraError) {
        setErrorMessage(extraError.message);
        return;
      }

      setMenuExtras(
        (extraData || []).map((option: any) => ({
          id: option.id,
          menu_item_id: option.menu_item_id,
          type: option.type,
          name: option.name,
          price: Number(option.price) || 0,
          is_available: option.is_available,
          sort_order: option.sort_order,
        }))
      );

      setCategories(catData || []);
      setItems(itemData || []);
    } catch (error) {
      console.error('Menu permission/load error:', error);

      setErrorMessage(
        'Something went wrong.'
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    let active = true;

    const refreshMenu = async () => {
      if (active) {
        // Realtime updates must never replace the current page with the
        // initial full-screen loader.
        await fetchData(false);
      }
    };

    const unsubscribe = subscribeRestaurantRealtime(supabase, {
      restaurantId,
      name: 'dashboard-menu',
      tables: [
        'menu_items',
        'menu_item_extras',
        'categories',
        'restaurant_price_adjustment_history',
        'menu_item_pricing_history',
      ],
      onChange: refreshMenu,
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [restaurantId, fetchData]);

  // =====================================================
  // DISCOUNT HELPERS
  // =====================================================

  const isDiscountCurrentlyActive = (
    item: MenuItem
  ) => {
    if (
      !item.discount_enabled ||
      !item.discount_value ||
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

  const resetExpiredDiscounts = useCallback(async (
      menuItems: MenuItem[]
    ) => {
      const now = new Date();

      const expiredItems = menuItems.filter((item) => {
        if (!item.discount_enabled) {
          return false;
        }

        if (!item.discount_end_at) {
          return false;
        }

        return new Date(item.discount_end_at) < now;
      });

      if (expiredItems.length === 0) {
        return;
      }

      try {
        await Promise.all(
          expiredItems.map((item) =>
            supabase
              .from('menu_items')
              .update({
                discount_enabled: false,
                discount_type: null,
                discount_value: null,
                discount_start_at: null,
                discount_end_at: null,
              })
              .eq('id', item.id)
          )
        );

        setItems((prev) =>
          prev.map((item) => {
            const expired = expiredItems.some(
              (expiredItem) =>
                expiredItem.id === item.id
            );

            if (!expired) {
              return item;
            }

            return {
              ...item,
              discount_enabled: false,
              discount_type: null,
              discount_value: null,
              discount_start_at: null,
              discount_end_at: null,
            };
          })
        );
      } catch (error) {
        console.error(
          'Failed to reset expired discounts:',
          error
        );
      }
    }, []);

    useEffect(() => {
      if (!items.length) {
        return;
      }

      resetExpiredDiscounts(items);
    }, [items, resetExpiredDiscounts]);

  const getAdjustedPriceValue = (basePrice: number) => {
    const safeBasePrice = roundPrice(basePrice);

    if (
      !restaurantSettings.price_adjustment_enabled ||
      !restaurantSettings.price_adjustment_mode ||
      !restaurantSettings.price_adjustment_direction
    ) {
      return safeBasePrice;
    }

    const value = Number(restaurantSettings.price_adjustment_value) || 0;

    if (restaurantSettings.price_adjustment_mode === 'percentage') {
      const multiplier = value / 100;
      return roundPrice(Math.max(
        0,
        restaurantSettings.price_adjustment_direction === 'increase'
          ? safeBasePrice * (1 + multiplier)
          : safeBasePrice * (1 - multiplier)
      ));
    }

    return roundPrice(Math.max(
      0,
      restaurantSettings.price_adjustment_direction === 'increase'
        ? safeBasePrice + value
        : safeBasePrice - value
    ));
  };

  const getAdjustedPrice = (item: MenuItem) => {
    // Menu Management is the source of truth for the stored/base price.
    // Restaurant-wide adjustments are customer-facing and are calculated by
    // the public menu, not written back to or displayed as this saved value.
    return roundPrice(Number(item.price) || 0);
  };

  const getDiscountedPrice = (
    item: MenuItem
  ) => {
    const basePrice = getAdjustedPrice(item);

    if (!isDiscountCurrentlyActive(item)) {
      return basePrice;
    }

    const discount =
      Number(item.discount_value) || 0;

    if (item.discount_type === 'percentage') {
      return Math.max(
        0,
        basePrice -
          basePrice *
            (discount / 100)
      );
    }

    if (item.discount_type === 'fixed') {
      return Math.max(
        0,
        basePrice - discount
      );
    }

    return basePrice;
  };

  const getDiscountLabel = (
    item: MenuItem
  ) => {
    if (!isDiscountCurrentlyActive(item)) {
      return '';
    }

    if (
      item.discount_type ===
      'percentage'
    ) {
      return `-${Number(
        item.discount_value
      ).toFixed(0)}%`;
    }

    return `-$${Number(
      item.discount_value
    ).toFixed(2)}`;
  };

  // =====================================================
  // CATEGORY ORDERING
  // =====================================================

  const handleCategoryDragStart = (
    id: string
  ) => {
    setDraggedCategoryId(id);
  };

  const handleCategoryDrop = async (
    targetId: string
  ) => {
    if (
      !draggedCategoryId ||
      draggedCategoryId === targetId
    ) {
      setDraggedCategoryId(null);
      return;
    }

    const oldIndex =
      categories.findIndex(
        (category) =>
          category.id ===
          draggedCategoryId
      );

    const newIndex =
      categories.findIndex(
        (category) =>
          category.id === targetId
      );

    if (
      oldIndex === -1 ||
      newIndex === -1
    ) {
      setDraggedCategoryId(null);
      return;
    }

    const reordered = [...categories];

    const [moved] =
      reordered.splice(oldIndex, 1);

    reordered.splice(
      newIndex,
      0,
      moved
    );

    const updated =
      reordered.map(
        (category, index) => ({
          ...category,
          sort_order: index,
        })
      );

    setCategories(updated);
    setDraggedCategoryId(null);

    try {
      const updates = updated.map(
        (category) =>
          supabase
            .from('categories')
            .update({
              sort_order:
                category.sort_order,
            })
            .eq(
              'id',
              category.id
            )
      );

      const results =
        await Promise.all(updates);

      const failed =
        results.find(
          (result) =>
            result.error
        );

      if (failed?.error) {
        throw failed.error;
      }

      if (restaurantId) {
        notifyRestaurantRealtimeSync(supabase, restaurantId, 'menu');
      }
    } catch (error) {
      console.error(
        'Category reorder error:',
        error
      );

      setErrorMessage(
        'Failed to save category order.'
      );

      fetchData(false);
    }
  };

  // =====================================================
  // ITEM ORDERING
  // =====================================================

  const handleItemDragStart = (
    id: string
  ) => {
    setDraggedItemId(id);
  };

  const handleItemDrop = async (
    targetId: string
  ) => {
    if (
      !draggedItemId ||
      draggedItemId === targetId
    ) {
      setDraggedItemId(null);
      return;
    }

    const targetItem =
      items.find(
        (item) =>
          item.id === targetId
      );

    const draggedItem =
      items.find(
        (item) =>
          item.id ===
          draggedItemId
      );

    if (
      !targetItem ||
      !draggedItem
    ) {
      setDraggedItemId(null);
      return;
    }

    if (
      targetItem.category_id !==
      draggedItem.category_id
    ) {
      setDraggedItemId(null);
      return;
    }

    const categoryItems =
      items
        .filter(
          (item) =>
            item.category_id ===
            draggedItem.category_id
        )
        .sort(
          (a, b) =>
            a.sort_order -
            b.sort_order
        );

    const oldIndex =
      categoryItems.findIndex(
        (item) =>
          item.id ===
          draggedItemId
      );

    const newIndex =
      categoryItems.findIndex(
        (item) =>
          item.id === targetId
      );

    if (
      oldIndex === -1 ||
      newIndex === -1
    ) {
      setDraggedItemId(null);
      return;
    }

    const reordered =
      [...categoryItems];

    const [moved] =
      reordered.splice(
        oldIndex,
        1
      );

    reordered.splice(
      newIndex,
      0,
      moved
    );

    const updatedCategoryItems =
      reordered.map(
        (item, index) => ({
          ...item,
          sort_order: index,
        })
      );

    const updatedItems =
      items.map((item) => {
        const updatedItem =
          updatedCategoryItems.find(
            (i) =>
              i.id === item.id
          );

        return (
          updatedItem || item
        );
      });

    setItems(updatedItems);
    setDraggedItemId(null);

    try {
      const updates =
        updatedCategoryItems.map(
          (item) =>
            supabase
              .from('menu_items')
              .update({
                sort_order:
                  item.sort_order,
              })
              .eq(
                'id',
                item.id
              )
        );

      const results =
        await Promise.all(updates);

      const failed =
        results.find(
          (result) =>
            result.error
        );

      if (failed?.error) {
        throw failed.error;
      }

      if (restaurantId) {
        notifyRestaurantRealtimeSync(supabase, restaurantId, 'menu');
      }
    } catch (error) {
      console.error(
        'Item reorder error:',
        error
      );

      setErrorMessage(
        'Failed to save item order.'
      );

      fetchData(false);
    }
  };

  // =====================================================
  // OPEN CATEGORY MODAL
  // =====================================================

  const openCategoryModal = (
    category?: Category
  ) => {
    setErrorMessage('');

    if (category) {
      setEditingCategory(category);
      setCategoryName(
        category.name
      );
    } else {
      setEditingCategory(null);
      setCategoryName('');
    }

    setIsCategoryModalOpen(true);
  };

  // =====================================================
  // SAVE CATEGORY
  // =====================================================

  const handleSaveCategory = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setErrorMessage('');

    const name =
      categoryName.trim();

    if (!name) {
      setErrorMessage(
        'Please enter a category name.'
      );
      return;
    }

    if (!restaurantId) {
      setErrorMessage(
        'Restaurant not found.'
      );
      return;
    }

    // EDIT
    if (editingCategory) {
      const { data, error } =
        await supabase
          .from('categories')
          .update({
            name,
          })
          .eq(
            'id',
            editingCategory.id
          )
          .select(
            'id, name, sort_order'
          )
          .single();

      if (error) {
        setErrorMessage(
          error.message
        );
        return;
      }

      if (data) {
        setCategories(
          (prev) =>
            prev.map(
              (category) =>
                category.id ===
                editingCategory.id
                  ? data
                  : category
            )
        );
      }
    }

    // ADD
    else {
      const { data, error } =
        await supabase
          .from('categories')
          .insert({
            restaurant_id:
              restaurantId,
            name,
            sort_order:
              categories.length,
          })
          .select(
            'id, name, sort_order'
          )
          .single();

      if (error) {
        setErrorMessage(
          error.message
        );
        return;
      }

      if (data) {
        setCategories(
          (prev) => [
            ...prev,
            data,
          ]
        );
      }
    }

    setCategoryName('');
    setEditingCategory(null);
    setIsCategoryModalOpen(false);

    if (restaurantId) {
      notifyRestaurantRealtimeSync(supabase, restaurantId, 'menu');
    }
  };

  // =====================================================
  // DELETE CATEGORY
  // =====================================================

  const handleDeleteCategory = async (
    id: string
  ) => {
    if (
      !confirm(
        'Delete this category? All menu items inside it will also be deleted.'
      )
    ) {
      return;
    }

    const { error } =
      await supabase
        .from('categories')
        .delete()
        .eq('id', id);

    if (error) {
      setErrorMessage(
        error.message
      );
      return;
    }

    setCategories(
      (prev) =>
        prev.filter(
          (category) =>
            category.id !== id
        )
    );

    setItems(
      (prev) =>
        prev.filter(
          (item) =>
            item.category_id !==
            id
        )
    );

    if (restaurantId) {
      notifyRestaurantRealtimeSync(supabase, restaurantId, 'menu');
    }

    if (
      selectedCategory === id
    ) {
      setSelectedCategory(
        'all'
      );
    }
  };

  // =====================================================
  // IMAGE UPLOAD
  // =====================================================

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      e.target.files?.[0];

    if (
      !file ||
      !restaurantId
    ) {
      return;
    }

    if (
      !file.type.startsWith(
        'image/'
      )
    ) {
      setErrorMessage(
        'Please select an image file.'
      );
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      setErrorMessage(
        'Image must be smaller than 5MB.'
      );
      return;
    }

    setUploadingImage(true);
    setErrorMessage('');

    try {
      const extension =
        file.name
          .split('.')
          .pop()
          ?.toLowerCase() ||
        'jpg';

      const fileName = `${restaurantId}/${crypto.randomUUID()}.${extension}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from('menu-images')
        .upload(
          fileName,
          file,
          {
            cacheControl:
              '3600',
            upsert: false,
          }
        );

      if (uploadError) {
        throw uploadError;
      }

      const { data } =
        supabase.storage
          .from('menu-images')
          .getPublicUrl(
            fileName
          );

      if (
        !data.publicUrl
      ) {
        throw new Error(
          'Could not generate image URL.'
        );
      }

      setItemForm(
        (prev) => ({
          ...prev,
          image_url:
            data.publicUrl,
        })
      );

      setImagePreview(
        data.publicUrl
      );
    } catch (error: any) {
      console.error(
        'Upload error:',
        error
      );

      setErrorMessage(
        error?.message ||
          'Failed to upload image.'
      );
    }

    setUploadingImage(false);
  };

  // =====================================================
  // OPEN ITEM MODAL
  // =====================================================

  const openItemModal = (
    item?: MenuItem
  ) => {
    setErrorMessage('');

    if (item) {
      setEditingItem(item);

      setItemForm({
        name: item.name,
        description:
          item.description || '',
        price:
          roundPrice(Number(item.price) || 0).toString(),
        category_id:
          item.category_id,
        image_url:
          item.image_url || '',
        is_available:
          item.is_available,

        discount_enabled:
          item.discount_enabled,

        discount_type:
          item.discount_type ||
          'percentage',

        discount_value:
          item.discount_value !==
          null
            ? item.discount_value.toString()
            : '',

        discount_start_at:
          item.discount_start_at
            ? new Date(
                item.discount_start_at
              )
                .toISOString()
                .slice(
                  0,
                  16
                )
            : '',

        discount_end_at:
          item.discount_end_at
            ? new Date(
                item.discount_end_at
              )
                .toISOString()
                .slice(
                  0,
                  16
                )
            : '',
        
          options: menuExtras.filter(
            (option) =>
              option.menu_item_id === item.id
          ),
      });

      setImagePreview(
        item.image_url || ''
      );

      setImageMode(
        item.image_url
          ? 'url'
          : 'upload'
      );
    } else {
      setEditingItem(null);

      setItemForm({
        name: '',
        description: '',
        price: '',
        category_id:
          categories[0]?.id ||
          '',
        image_url: '',
        is_available: true,

        discount_enabled:
          false,

        discount_type:
          'percentage',

        discount_value: '',

        discount_start_at:
          '',

        discount_end_at:
          '',

        options: [],
      });

      setImagePreview('');
      setImageMode(
        'upload'
      );
    }

    setIsItemModalOpen(true);
  };

  // =====================================================
  // MENU ITEM OPTIONS
  // =====================================================

  const addItemOption = (
    type: 'extra' | 'sauce'
  ) => {
    const newOption: MenuExtra = {
      id: `temp-${crypto.randomUUID()}`,
      menu_item_id:
        editingItem?.id || '',
      type,
      name: '',
      price: 0,
      is_available: true,
      sort_order:
        itemForm.options.filter(
          (option) =>
            option.type === type
        ).length,
    };

    setItemForm((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        newOption,
      ],
    }));
  };

  const updateItemOption = (
    id: string,
    updates: Partial<MenuExtra>
  ) => {
    setItemForm((prev) => ({
      ...prev,
      options: prev.options.map(
        (option) =>
          option.id === id
            ? {
                ...option,
                ...updates,
              }
            : option
      ),
    }));
  };

  const removeItemOption = (
    id: string
  ) => {
    setItemForm((prev) => ({
      ...prev,
      options: prev.options.filter(
        (option) =>
          option.id !== id
      ),
    }));
  };

  // =====================================================
  // SAVE ITEM
  // =====================================================

  const handleSaveItem = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setErrorMessage('');

    if (!restaurantId) {
      setErrorMessage(
        'Restaurant not found.'
      );
      return;
    }

    if (
      !itemForm.name.trim()
    ) {
      setErrorMessage(
        'Please enter an item name.'
      );
      return;
    }

    const basePrice = roundPrice(parseFloat(itemForm.price));

    if (
      !itemForm.price ||
      Number.isNaN(basePrice) ||
      basePrice < 0
    ) {
      setErrorMessage(
        'Please enter a valid price.'
      );
      return;
    }

    if (
      !itemForm.category_id
    ) {
      setErrorMessage(
        'Please select a category.'
      );
      return;
    }

    // =================================================
    // DISCOUNT VALIDATION
    // =================================================

    let discountValue:
      | number
      | null = null;

    if (
      itemForm.discount_enabled
    ) {
      discountValue =
        parseFloat(
          itemForm.discount_value
        );

      if (
        !itemForm.discount_value ||
        Number.isNaN(
          discountValue
        ) ||
        discountValue <= 0
      ) {
        setErrorMessage(
          'Please enter a valid discount value.'
        );
        return;
      }

      if (
        itemForm.discount_type ===
          'percentage' &&
        discountValue > 100
      ) {
        setErrorMessage(
          'Percentage discount cannot be more than 100%.'
        );
        return;
      }

      const itemPriceForDiscountValidation =
        restaurantSettings.price_adjustment_enabled
          ? getAdjustedPriceValue(Number(itemForm.price) || 0)
          : Number(itemForm.price) || 0;

      if (
        itemForm.discount_type ===
          'fixed' &&
        discountValue >= itemPriceForDiscountValidation
      ) {
        setErrorMessage(
          'Fixed discount must be less than the item price.'
        );
        return;
      }
    }

    const payload = {
      restaurant_id:
        restaurantId,

      category_id:
        itemForm.category_id,

      name:
        itemForm.name.trim(),

      description:
        itemForm.description.trim() ||
        null,

      price: basePrice,

      image_url:
        itemForm.image_url.trim() ||
        null,

      is_available:
        itemForm.is_available,

      // Discount
      discount_type:
        itemForm.discount_enabled
          ? itemForm.discount_type
          : null,

      discount_value:
        itemForm.discount_enabled
          ? discountValue
          : null,

      discount_enabled:
        itemForm.discount_enabled,

      discount_start_at:
        itemForm.discount_enabled &&
        itemForm.discount_start_at
          ? new Date(
              itemForm.discount_start_at
            ).toISOString()
          : null,

      discount_end_at:
        itemForm.discount_enabled &&
        itemForm.discount_end_at
          ? new Date(
              itemForm.discount_end_at
            ).toISOString()
          : null,
    };

    let savedMenuItemId: string | null = null;

    // =================================================
    // EDIT
    // =================================================

    if (editingItem) {
      const { data, error } = await supabase
        .from('menu_items')
        .update(payload)
        .eq('id', editingItem.id)
        .select()
        .single();

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data) {
        savedMenuItemId = data.id;

        const oldPrice = Number(editingItem.price) || 0;
        const newPrice = Number(data.price) || 0;
        const oldDiscountValue = Number(editingItem.discount_value) || null;
        const newDiscountValue = Number(data.discount_value) || null;

        if (oldPrice !== newPrice) {
          const direction = newPrice > oldPrice ? 'increase' : 'decrease';
          const summary = `${editingItem.name}: ${oldPrice.toFixed(2)} → ${newPrice.toFixed(2)} (${direction})`;

          await logMenuItemPricingChange(supabase, {
            restaurant_id: restaurantId,
            menu_item_id: editingItem.id,
            item_name: editingItem.name,
            change_type: 'price',
            direction,
            old_price: oldPrice,
            new_price: newPrice,
            summary,
            details: {
              old_price: oldPrice,
              new_price: newPrice,
              price_changed: true,
              edited_by: 'dashboard-menu',
            },
          });
        }

        const nextDiscountEnabled = Boolean(data.discount_enabled);
        const nextDiscountType = data.discount_type ?? null;
        const nextDiscountValue = Number(data.discount_value) || null;
        const nextDiscountStart = data.discount_start_at ?? null;
        const nextDiscountEnd = data.discount_end_at ?? null;

        const discountChanged =
          (oldDiscountValue ?? null) !== (newDiscountValue ?? null) ||
          editingItem.discount_enabled !== data.discount_enabled ||
          editingItem.discount_type !== data.discount_type ||
          (editingItem.discount_start_at ?? null) !== (data.discount_start_at ?? null) ||
          (editingItem.discount_end_at ?? null) !== (data.discount_end_at ?? null);

        if (discountChanged) {
          const summary = nextDiscountEnabled
            ? `${editingItem.name}: promotion ${editingItem.discount_enabled ? 'updated' : 'created'} (${nextDiscountType || 'percentage'} ${nextDiscountValue ?? 0})${nextDiscountStart ? ` starts ${new Date(nextDiscountStart).toLocaleString()}` : ''}${nextDiscountEnd ? ` ends ${new Date(nextDiscountEnd).toLocaleString()}` : ''}`
            : `${editingItem.name}: discount ${editingItem.discount_enabled ? 'disabled' : 'removed'} (${editingItem.discount_type || 'none'} ${oldDiscountValue ?? 0})`;

          await logMenuItemPricingChange(supabase, {
            restaurant_id: restaurantId,
            menu_item_id: editingItem.id,
            item_name: editingItem.name,
            change_type: nextDiscountEnabled ? 'discount' : 'status',
            direction: nextDiscountEnabled ? 'discount' : 'status',
            old_discount_value: oldDiscountValue,
            new_discount_value: nextDiscountValue,
            discount_type: nextDiscountType,
            summary,
            details: {
              old_discount_enabled: editingItem.discount_enabled,
              new_discount_enabled: data.discount_enabled,
              old_discount_type: editingItem.discount_type,
              new_discount_type: data.discount_type,
              old_discount_value: oldDiscountValue,
              new_discount_value: nextDiscountValue,
              start_at: nextDiscountStart,
              end_at: nextDiscountEnd,
              change_source: 'menu-management',
            },
          });
        }

        setItems((prev) =>
          prev.map((item) =>
            item.id === editingItem.id
              ? {
                  ...data,
                  sort_order: editingItem.sort_order,
                }
              : item
          )
        );
      }
    }

    // =================================================
    // ADD
    // =================================================

    else {
      const categoryItems =
        items.filter(
          (item) =>
            item.category_id ===
            itemForm.category_id
        );

      const nextSortOrder =
        categoryItems.length;

      const {
        data,
        error,
      } = await supabase
        .from('menu_items')
        .insert({
          ...payload,
          sort_order:
            nextSortOrder,
        })
        .select()
        .single();

      if (error) {
        setErrorMessage(
          error.message
        );
        return;
      }

      if (data) {
        savedMenuItemId = data.id;

        await logMenuItemPricingChange(supabase, {
          restaurant_id: restaurantId,
          menu_item_id: data.id,
          item_name: data.name,
          change_type: 'price',
          direction: 'increase',
          old_price: null,
          new_price: Number(data.price) || 0,
          summary: `${data.name}: created at ${Number(data.price) || 0}`,
          details: {
            created: true,
            original_price: Number(data.price) || 0,
          },
        });

        if (data.discount_enabled && data.discount_type && data.discount_value) {
          await logMenuItemPricingChange(supabase, {
            restaurant_id: restaurantId,
            menu_item_id: data.id,
            item_name: data.name,
            change_type: 'discount',
            direction: 'discount',
            old_discount_value: null,
            new_discount_value: Number(data.discount_value) || null,
            discount_type: data.discount_type,
            summary: `${data.name}: promotion created (${data.discount_type} ${Number(data.discount_value) || 0})`,
            details: {
              created: true,
              discount_enabled: data.discount_enabled,
              discount_type: data.discount_type,
              discount_value: Number(data.discount_value) || null,
              start_at: data.discount_start_at,
              end_at: data.discount_end_at,
              change_source: 'menu-management',
            },
          });
        }

        setItems(
          (prev) => [
            ...prev,
            data,
          ]
        );
      }
    }

    // =================================================
    // SAVE MENU ITEM EXTRAS & SAUCES
    // =================================================

    const validOptions = itemForm.options.filter(
      (option) => option.name.trim()
    );

    // -------------------------------------------------
    // DELETE OLD OPTIONS WHEN EDITING
    // -------------------------------------------------

    if (editingItem && savedMenuItemId) {
      const {
        error: deleteOptionsError,
      } = await supabase
        .from('menu_item_extras')
        .delete()
        .eq(
          'menu_item_id',
          savedMenuItemId
        );

      if (deleteOptionsError) {
        setErrorMessage(
          deleteOptionsError.message
        );
        return;
      }
    }

    // -------------------------------------------------
    // INSERT NEW OPTIONS
    // -------------------------------------------------

    if (
      validOptions.length > 0 &&
      savedMenuItemId
    ) {
      const optionsPayload =
        validOptions.map(
          (option, index) => ({
            restaurant_id:
              restaurantId,

            menu_item_id:
              savedMenuItemId,

            type:
              option.type,

            name:
              option.name.trim(),

            price: roundPrice(Number(option.price) || 0),

            is_available:
              option.is_available,

            sort_order:
              index,
          })
        );

      const {
        error: optionsError,
      } = await supabase
        .from('menu_item_extras')
        .insert(optionsPayload);

      if (optionsError) {
        setErrorMessage(
          optionsError.message
        );
        return;
      }
    }

    // -------------------------------------------------
    // RELOAD SAVED OPTIONS
    // -------------------------------------------------

    const {
      data: savedOptions,
      error: savedOptionsError,
    } = await supabase
      .from('menu_item_extras')
      .select(`
        id,
        restaurant_id,
        menu_item_id,
        type,
        name,
        price,
        is_available,
        sort_order
      `)
      .eq(
        'menu_item_id',
        savedMenuItemId
      )
      .order('sort_order', {
        ascending: true,
      });

    if (savedOptionsError) {
      setErrorMessage(
        savedOptionsError.message
      );
      return;
    }

    // -------------------------------------------------
    // UPDATE LOCAL STATE
    // -------------------------------------------------

    setMenuExtras(
      (prev) => [
        ...prev.filter(
          (option) =>
            option.menu_item_id !==
            savedMenuItemId
        ),

        ...(savedOptions || []).map(
          (option: any) => ({
            id: option.id,
            menu_item_id:
              option.menu_item_id,
            type:
              option.type || 'extra',
            name:
              option.name,
            price:
              Number(option.price) || 0,
            is_available:
              option.is_available,
            sort_order:
              option.sort_order,
          })
        ),
      ]
    );

    setIsItemModalOpen(false);
    setEditingItem(null);
    setImagePreview('');

    if (restaurantId) {
      notifyRestaurantRealtimeSync(supabase, restaurantId, 'menu');
    }
  };

  // =====================================================
  // AVAILABILITY
  // =====================================================

  const toggleAvailability = async (
    item: MenuItem
  ) => {
    const newStatus =
      !item.is_available;

    const {
      error,
    } = await supabase
      .from('menu_items')
      .update({
        is_available:
          newStatus,
      })
      .eq(
        'id',
        item.id
      );

    if (error) {
      setErrorMessage(
        error.message
      );
      return;
    }

    setItems(
      (prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                is_available:
                  newStatus,
              }
            : i
        )
    );

    if (restaurantId) {
      notifyRestaurantRealtimeSync(supabase, restaurantId, 'menu');
    }
  };

  // =====================================================
  // DELETE ITEM
  // =====================================================

  const handleDeleteItem = async (
    id: string
  ) => {
    if (
      !confirm(
        'Are you sure you want to delete this item?'
      )
    ) {
      return;
    }

    const itemToDelete = items.find(
      (item) => item.id === id
    );

    if (itemToDelete) {
      const discountValue = Number(itemToDelete.discount_value) || null;
      const hasDiscountState = itemToDelete.discount_enabled || itemToDelete.discount_start_at || itemToDelete.discount_end_at || discountValue !== null;

      if (hasDiscountState) {
        await logMenuItemPricingChange(supabase, {
          restaurant_id: restaurantId!,
          menu_item_id: id,
          item_name: itemToDelete.name,
          change_type: 'status',
          direction: 'status',
          old_discount_value: discountValue,
          new_discount_value: null,
          discount_type: itemToDelete.discount_type ?? null,
          summary: `${itemToDelete.name}: discount removed (${itemToDelete.discount_type || 'none'} ${discountValue ?? 0})`,
          details: {
            deleted: true,
            old_discount_enabled: itemToDelete.discount_enabled,
            old_discount_type: itemToDelete.discount_type,
            old_discount_value: discountValue,
            old_discount_start_at: itemToDelete.discount_start_at,
            old_discount_end_at: itemToDelete.discount_end_at,
            change_source: 'menu-management',
          },
        });
      }
    }

    const {
      error,
    } = await supabase
      .from('menu_items')
      .delete()
      .eq(
        'id',
        id
      );

    if (error) {
      setErrorMessage(
        error.message
      );
      return;
    }

    setItems(
      (prev) =>
        prev.filter(
          (item) =>
            item.id !== id
        )
    );

    if (restaurantId) {
      notifyRestaurantRealtimeSync(supabase, restaurantId, 'menu');
    }
  };

  // =====================================================
  // FILTER
  // =====================================================

  const filteredItems =
    selectedCategory ===
    'all'
      ? [...items].sort(
          (a, b) =>
            a.sort_order -
            b.sort_order
        )
      : items
          .filter(
            (item) =>
              item.category_id ===
              selectedCategory
          )
          .sort(
            (a, b) =>
              a.sort_order -
              b.sort_order
          );

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return <DashboardLoader />;
  }

  if (!planAllowed) {
    return (
      <PlanRequired
        featureName="Menu Management"
        requiredPlan="Starter"
      />
    );
  }

  if (!hasMenuAccess) {
    return (
      <AccessRestricted
        title="Menu Access Restricted"
        description="You do not have permission to manage the restaurant menu."
      />
    );
  }

  // =====================================================
  // PAGE
  // =====================================================

  return (
    <div className="min-h-screen" style={{ background: 'var(--portal-background)', color: 'var(--portal-text)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-10">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--portal-accent)' }} />

              <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--portal-accent)' }}>
                Restaurant Menu
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Menu Management
            </h1>

            <p className="text-sm mt-2" style={{ color: 'var(--portal-text)' }}>
              Organize your categories,
              dishes and promotions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">

            <button
              onClick={() =>
                openCategoryModal()
              }
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all"
              style={{ background: 'var(--portal-surface)', border: '1px solid var(--portal-border)', color: 'var(--portal-text)' }}
            >
              <FolderPlus className="w-4 h-4" style={{ color: 'var(--portal-accent)' }} />

              Add Category
            </button>

            <button
              onClick={() =>
                openItemModal()
              }
              disabled={
                categories.length === 0
              }
              className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--portal-accent)', color: '#fff' }}
            >
              <Plus className="w-4 h-4" />

              Add Menu Item
            </button>

          </div>
        </div>

        {/* =================================================
            ERROR
        ================================================= */}

        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-sm font-semibold text-red-600">
            {errorMessage}
          </div>
        )}

        {/* =================================================
            STATS
        ================================================= */}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">

          <div className="rounded-2xl p-4" style={{ background: 'var(--portal-surface)', border: '1px solid var(--portal-border)' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--portal-text)' }}>
              Items
            </p>

            <p className="text-2xl font-black mt-1">
              {items.length}
            </p>
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'var(--portal-surface)', border: '1px solid var(--portal-border)' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--portal-text)' }}>
              Categories
            </p>

            <p className="text-2xl font-black mt-1">
              {categories.length}
            </p>
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'var(--portal-surface)', border: '1px solid var(--portal-border)' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--portal-text)' }}>
              Available
            </p>

            <p className="text-2xl font-black mt-1" style={{ color: 'var(--portal-accent)' }}>
              {
                items.filter(
                  (item) =>
                    item.is_available
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'var(--portal-surface)', border: '1px solid var(--portal-border)' }}>
            <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--portal-text)' }}>
              Promotions
            </p>

            <p className="text-2xl font-black mt-1" style={{ color: 'var(--portal-accent)' }}>
              {
                items.filter(
                  (item) =>
                    isDiscountCurrentlyActive(
                      item
                    )
                ).length
              }
            </p>
          </div>

        </div>

        {/* =================================================
            CATEGORIES
        ================================================= */}

        <div className="rounded-2xl p-2 mb-7 shadow-sm" style={{ background: 'var(--portal-surface)', border: '1px solid var(--portal-border)' }}>

          <div className="flex items-center gap-1.5 overflow-x-auto">

            <button
              onClick={() =>
                setSelectedCategory(
                  'all'
                )
              }
              className={`px-4 py-2.5 rounded-xl whitespace-nowrap text-sm font-bold transition-all ${
                selectedCategory ===
                'all'
                  ? 'shadow-sm'
                  : ''
              }`}
              style={selectedCategory === 'all' ? { background: 'var(--portal-accent)', color: '#fff' } : { color: 'var(--portal-text)' }}
            >
              All Items

              <span className="ml-1.5 opacity-60">
                {items.length}
              </span>
            </button>

            {categories.map(
              (category) => (
                <div
                  key={
                    category.id
                  }
                  draggable
                  onDragStart={() =>
                    handleCategoryDragStart(
                      category.id
                    )
                  }
                  onDragOver={(e) =>
                    e.preventDefault()
                  }
                  onDrop={() =>
                    handleCategoryDrop(
                      category.id
                    )
                  }
                  className={`flex items-center group cursor-grab active:cursor-grabbing ${
                    draggedCategoryId ===
                    category.id
                      ? 'opacity-40'
                      : ''
                  }`}
                >

                  <div className="px-1 text-[#B0B2B8] opacity-0 group-hover:opacity-100 transition">
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>

                  <button
                    onClick={() =>
                      setSelectedCategory(
                        category.id
                      )
                    }
                    className={`px-4 py-2.5 rounded-xl whitespace-nowrap text-sm font-bold transition-all ${
                      selectedCategory ===
                      category.id
                        ? ''
                        : ''
                    }`}
                    style={selectedCategory === category.id ? { background: 'var(--portal-accent-soft)', color: 'var(--portal-accent)' } : { color: 'var(--portal-text)' }}
                  >
                    {category.name}

                    <span className="ml-1.5 opacity-60">
                      {
                        items.filter(
                          (item) =>
                            item.category_id ===
                            category.id
                        ).length
                      }
                    </span>
                  </button>

                  {/* EDIT CATEGORY */}

                  <button
                    onClick={() =>
                      openCategoryModal(
                        category
                      )
                    }
                    className="opacity-0 group-hover:opacity-100 p-1.5 transition"
                    style={{ color: 'var(--portal-text)' }}
                    title="Edit category"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* DELETE CATEGORY */}

                  <button
                    onClick={() =>
                      handleDeleteCategory(
                        category.id
                      )
                    }
                    className="opacity-0 group-hover:opacity-100 p-1.5 transition"
                    style={{ color: 'var(--portal-text)' }}
                    title="Delete category"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                </div>
              )
            )}

          </div>

          {categories.length >
            1 && (
            <div className="px-3 pt-2 pb-1 text-[9px] text-[#A0A2A9]">
              <GripVertical className="inline w-3 h-3 mr-1" />

              Drag categories to
              change their order
            </div>
          )}

        </div>

        {/* =================================================
            ITEMS
        ================================================= */}

        {filteredItems.length ===
        0 ? (
          <div className="rounded-3xl py-20 text-center shadow-sm" style={{ background: 'var(--portal-surface)', border: '1px solid var(--portal-border)' }}>

            <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'var(--portal-accent-soft)' }}>
              <Utensils className="w-7 h-7" style={{ color: 'var(--portal-accent)' }} />
            </div>

            <h3 className="mt-5 text-lg font-black">
              No menu items yet
            </h3>

            <p className="mt-2 text-sm" style={{ color: 'var(--portal-text)' }}>
              Add your first dish
              to start building
              your menu.
            </p>

            <button
              onClick={() =>
                openItemModal()
              }
              disabled={
                categories.length ===
                0
              }
              className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition disabled:opacity-40"
              style={{ background: 'var(--portal-accent)', color: '#fff' }}
            >
              <Plus className="w-4 h-4" />

              Add Menu Item
            </button>

          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

            {filteredItems.map(
              (item) => {
                const discountedPrice =
                  getDiscountedPrice(
                    item
                  );

                const hasDiscount =
                  isDiscountCurrentlyActive(
                    item
                  );

                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() =>
                      handleItemDragStart(
                        item.id
                      )
                    }
                    onDragOver={(e) =>
                      e.preventDefault()
                    }
                    onDrop={() =>
                      handleItemDrop(
                        item.id
                      )
                    }
                    className={`group rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-grab active:cursor-grabbing ${
                      !item.is_available
                        ? 'opacity-60'
                        : ''
                    } ${
                      draggedItemId ===
                      item.id
                        ? 'opacity-40 scale-[0.98]'
                        : ''
                    }`}
                    style={{ background: 'var(--portal-surface)', border: '1px solid var(--portal-border)' }}
                  >

                    {/* IMAGE */}

                    {item.image_url ? (
                      <div className="relative h-48 overflow-hidden" style={{ background: 'var(--portal-background)' }}>

                        <img
                          src={
                            item.image_url
                          }
                          alt={
                            item.name
                          }
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        <div className="absolute top-3 left-3 w-8 h-8 rounded-lg backdrop-blur flex items-center justify-center shadow-sm" style={{ background: 'rgba(255,255,255,0.9)', color: 'var(--portal-text)' }}>
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {hasDiscount && (
                          <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-[10px] font-black shadow-lg" style={{ background: 'var(--portal-accent)', color: '#fff' }}>
                            {getDiscountLabel(
                              item
                            )}
                          </div>
                        )}

                        {!item.is_available && (
                          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(32,37,52,0.4)' }}>
                            <span className="px-3 py-1.5 rounded-full bg-white text-xs font-bold" style={{ color: 'var(--portal-text)' }}>
                              Hidden
                            </span>
                          </div>
                        )}

                      </div>
                    ) : (
                      <div className="h-32 flex items-center justify-center relative" style={{ background: 'linear-gradient(135deg, var(--portal-accent-soft), var(--portal-background)' }}>

                        <Utensils className="w-8 h-8" style={{ color: 'var(--portal-accent)' }} />

                        {hasDiscount && (
                          <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-[10px] font-black shadow-lg" style={{ background: 'var(--portal-accent)', color: '#fff' }}>
                            {getDiscountLabel(
                              item
                            )}
                          </div>
                        )}

                        <div className="absolute top-3 left-3 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.8)', color: 'var(--portal-text)' }}>
                          <GripVertical className="w-4 h-4" />
                        </div>

                      </div>
                    )}

                    {/* CONTENT */}

                    <div className="p-5">

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <h3 className="text-lg font-black truncate" style={{ color: 'var(--portal-text)' }}>
                            {item.name}
                          </h3>

                          <div className="w-8 h-0.5 mt-2" style={{ background: 'linear-gradient(90deg, var(--portal-accent), var(--portal-accent-soft))' }} />

                        </div>

                        <div className="shrink-0 text-right">

                          {hasDiscount ? (
                            <>
                              <p className="text-xs text-[#999BA3] line-through">
                                {restaurantSettings.currency}
                                {getAdjustedPrice(item).toFixed(2)}
                              </p>

                              <span className="px-2.5 py-1 rounded-lg text-sm font-black" style={{ background: 'var(--portal-accent-soft)', color: 'var(--portal-accent)' }}>
                                {restaurantSettings.currency}
                                {discountedPrice.toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <span className="px-2.5 py-1 rounded-lg text-sm font-black" style={{ background: 'var(--portal-accent-soft)', color: 'var(--portal-accent)' }}>
                              {restaurantSettings.currency}
                              {getAdjustedPrice(item).toFixed(2)}
                            </span>
                          )}

                        </div>

                      </div>

                      {item.description && (
                        <p className="text-sm mt-3 line-clamp-2 leading-relaxed" style={{ color: 'var(--portal-text)' }}>
                          {
                            item.description
                          }
                        </p>
                      )}

                      {/* DISCOUNT SUMMARY */}

                      {item.discount_enabled && (
                        <div
                          className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${
                            hasDiscount
                              ? ''
                              : ''
                          }`}
                          style={hasDiscount ? { background: 'var(--portal-accent-soft)', color: 'var(--portal-accent)' } : { background: 'var(--portal-background)', color: 'var(--portal-text)' }}
                        >
                          <Tag className="w-3.5 h-3.5" />

                          {hasDiscount
                            ? `Promotion active. ${getDiscountLabel(
                                item
                              )}`
                            : 'Promotion scheduled / inactive'}
                        </div>
                      )}

                      <div className="mt-5 pt-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--portal-border)' }}>

                        <button
                          onClick={() =>
                            toggleAvailability(
                              item
                            )
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                            item.is_available
                              ? ''
                              : ''
                          }`}
                          style={item.is_available ? { background: 'var(--portal-accent-soft)', color: 'var(--portal-accent)' } : { background: 'var(--portal-background)', color: 'var(--portal-text)' }}
                        >
                          {item.is_available ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}

                          {item.is_available
                            ? 'Available'
                            : 'Hidden'}
                        </button>

                        <div className="flex items-center gap-1">

                          <button
                            onClick={() =>
                              openItemModal(
                                item
                              )
                            }
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#756F66] hover:text-[#536DFE] hover:bg-[#EEF0FF] transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() =>
                              handleDeleteItem(
                                item.id
                              )
                            }
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-[#756F66] hover:text-red-500 hover:bg-red-50 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>

                      </div>

                    </div>

                  </div>
                );
              }
            )}

          </div>
        )}

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="py-10 text-center">

          <div className="flex items-center justify-center gap-2">

            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#536DFE] to-[#765BD5] flex items-center justify-center">
              <span className="text-white text-[8px] font-black">
                N
              </span>
            </div>

            <span className="text-[9px] font-black tracking-[0.16em] text-[#756F66]">
              NOVAMENU
            </span>

          </div>

        </div>

      </div>

      {/* =====================================================
          CATEGORY MODAL
      ===================================================== */}

      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202534]/40 backdrop-blur-sm px-4">

          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-[#E7E4DE]">

            <div className="flex items-center justify-between mb-6">

              <div>

                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#536DFE]">
                  Menu
                </p>

                <h2 className="text-xl font-black mt-1">
                  {editingCategory
                    ? 'Edit Category'
                    : 'New Category'}
                </h2>

              </div>

              <button
                onClick={() => {
                  setIsCategoryModalOpen(
                    false
                  );
                  setEditingCategory(
                    null
                  );
                  setCategoryName(
                    ''
                  );
                  setErrorMessage(
                    ''
                  );
                }}
                className="w-9 h-9 rounded-xl bg-[#F7F5F1] flex items-center justify-center text-[#756F66] hover:text-[#202534]"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <form
              onSubmit={
                handleSaveCategory
              }
              className="space-y-5"
            >

              <div>

                <label className="block text-xs font-bold text-[#756F66] mb-2">
                  CATEGORY NAME
                </label>

                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Burgers"
                  value={
                    categoryName
                  }
                  onChange={(e) =>
                    setCategoryName(
                      e.target.value
                    )
                  }
                  className="w-full border border-[#E7E4DE] rounded-xl px-4 py-3 text-sm bg-[#F7F5F1] text-[#202534] focus:outline-none focus:border-[#536DFE] focus:ring-4 focus:ring-[#536DFE]/10 transition"
                />

              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">

                <button
                  type="button"
                  onClick={() => {
                    setIsCategoryModalOpen(
                      false
                    );
                    setEditingCategory(
                      null
                    );
                    setCategoryName(
                      ''
                    );
                    setErrorMessage(
                      ''
                    );
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#756F66] hover:bg-[#F7F5F1]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#202534] text-white text-sm font-bold hover:bg-[#536DFE] transition"
                >
                  {editingCategory
                    ? 'Save Changes'
                    : 'Save Category'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* =====================================================
          ITEM MODAL
      ===================================================== */}

      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202534]/40 backdrop-blur-sm px-4">

          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-[#E7E4DE] max-h-[90vh] overflow-y-auto">

            {/* MODAL HEADER */}

            <div className="flex items-center justify-between mb-6">

              <div>

                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#536DFE]">
                  Menu Item
                </p>

                <h2 className="text-xl font-black mt-1">
                  {editingItem
                    ? 'Edit Item'
                    : 'New Menu Item'}
                </h2>

              </div>

              <button
                onClick={() => {
                  setIsItemModalOpen(
                    false
                  );
                  setEditingItem(
                    null
                  );
                  setErrorMessage(
                    ''
                  );
                  setImagePreview(
                    ''
                  );
                }}
                className="w-9 h-9 rounded-xl bg-[#F7F5F1] flex items-center justify-center text-[#756F66] hover:text-[#202534]"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            <form
              onSubmit={
                handleSaveItem
              }
              className="space-y-5"
            >

              {/* =================================================
                  NAME
              ================================================= */}

              <div>

                <label className="block text-xs font-bold text-[#756F66] mb-2">
                  ITEM NAME
                </label>

                <input
                  type="text"
                  required
                  placeholder="e.g. Classic Burger"
                  value={
                    itemForm.name
                  }
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      name: e.target
                        .value,
                    })
                  }
                  className="w-full border border-[#E7E4DE] rounded-xl px-4 py-3 text-sm bg-[#F7F5F1] focus:outline-none focus:border-[#536DFE] focus:ring-4 focus:ring-[#536DFE]/10 transition"
                />

              </div>

              {/* =================================================
                  PRICE + CATEGORY
              ================================================= */}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div>

                  <label className="block text-xs font-bold text-[#756F66] mb-2">
                    PRICE
                  </label>

                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    required
                    placeholder="0.00"
                    value={
                      itemForm.price
                    }
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        price: e.target
                          .value,
                      })
                    }
                    className="w-full border border-[#E7E4DE] rounded-xl px-4 py-3 text-sm bg-[#F7F5F1] focus:outline-none focus:border-[#536DFE] focus:ring-4 focus:ring-[#536DFE]/10 transition"
                  />

                </div>

                <div>

                  <label className="block text-xs font-bold text-[#756F66] mb-2">
                    CATEGORY *
                  </label>

                  <select
                    required
                    value={
                      itemForm.category_id
                    }
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        category_id:
                          e.target
                            .value,
                      })
                    }
                    className="w-full border border-[#E7E4DE] rounded-xl px-4 py-3 text-sm bg-[#F7F5F1] focus:outline-none focus:border-[#536DFE] focus:ring-4 focus:ring-[#536DFE]/10 transition"
                  >

                    <option value="">
                      Select category
                    </option>

                    {categories.map(
                      (
                        category
                      ) => (
                        <option
                          key={
                            category.id
                          }
                          value={
                            category.id
                          }
                        >
                          {
                            category.name
                          }
                        </option>
                      )
                    )}

                  </select>

                </div>

              </div>

              {/* =================================================
                  DISCOUNT
              ================================================= */}

              <div className="rounded-2xl border border-[#E7E4DE] overflow-hidden">

                <div className="p-4 bg-gradient-to-r from-[#EEF0FF] to-[#F7F5F1]">

                  <div className="flex items-center justify-between gap-4">

                    <div className="flex items-center gap-3">

                      <div className="w-10 h-10 rounded-xl bg-white border border-[#E1DDF7] flex items-center justify-center">
                        <Tag className="w-5 h-5 text-[#536DFE]" />
                      </div>

                      <div>

                        <p className="text-sm font-black">
                          Special Offer
                        </p>

                        <p className="text-[11px] text-[#756F66] mt-0.5">
                          Add a promotion to
                          this item
                        </p>

                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setItemForm((prev) => ({
                          ...prev,
                          discount_enabled:
                            !prev.discount_enabled,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                        itemForm.discount_enabled
                          ? 'bg-[#536DFE]'
                          : 'bg-[#D6D3CD]'
                      }`}
                      aria-pressed={itemForm.discount_enabled}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          itemForm.discount_enabled
                            ? 'translate-x-5'
                            : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {itemForm.discount_enabled && (
                  <div className="p-4 space-y-4 border-t border-[#E7E4DE]">

                    {/* Discount type */}

                    <div>

                      <label className="block text-[10px] uppercase tracking-wider font-bold text-[#756F66] mb-2">
                        DISCOUNT TYPE
                      </label>

                      <div className="grid grid-cols-2 gap-2">

                        <button
                          type="button"
                          onClick={() =>
                            setItemForm(
                              {
                                ...itemForm,
                                discount_type:
                                  'percentage',
                              }
                            )
                          }
                          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-xs font-bold transition ${
                            itemForm.discount_type ===
                            'percentage'
                              ? 'bg-[#EEF0FF] border-[#536DFE] text-[#536DFE]'
                              : 'bg-[#F7F5F1] border-[#E7E4DE] text-[#756F66]'
                          }`}
                        >
                          <Percent className="w-4 h-4" />
                          Percentage
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setItemForm(
                              {
                                ...itemForm,
                                discount_type:
                                  'fixed',
                              }
                            )
                          }
                          className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-xs font-bold transition ${
                            itemForm.discount_type ===
                            'fixed'
                              ? 'bg-[#EEF0FF] border-[#536DFE] text-[#536DFE]'
                              : 'bg-[#F7F5F1] border-[#E7E4DE] text-[#756F66]'
                          }`}
                        >
                          <DollarSign className="w-4 h-4" />
                          Fixed Amount
                        </button>

                      </div>

                    </div>

                    {/* Discount value */}

                    <div>

                      <label className="block text-[10px] uppercase tracking-wider font-bold text-[#756F66] mb-2">
                        DISCOUNT VALUE
                      </label>

                      <div className="relative">

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          max={
                            itemForm.discount_type ===
                            'percentage'
                              ? '100'
                              : undefined
                          }
                          placeholder={
                            itemForm.discount_type ===
                            'percentage'
                              ? '20'
                              : '5.00'
                          }
                          value={
                            itemForm.discount_value
                          }
                          onChange={(e) =>
                            setItemForm(
                              {
                                ...itemForm,
                                discount_value:
                                  e.target
                                    .value,
                              }
                            )
                          }
                          className="w-full border border-[#E7E4DE] rounded-xl px-4 py-3 pr-12 text-sm bg-[#F7F5F1] focus:outline-none focus:border-[#536DFE] focus:ring-4 focus:ring-[#536DFE]/10 transition"
                        />

                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#536DFE]">
                          {itemForm.discount_type ===
                          'percentage'
                            ? '%'
                            : '$'}
                        </span>

                      </div>

                    </div>

                    {/* Schedule */}

                    <div>

                      <div className="flex items-center gap-2 mb-3">

                        <div className="w-1.5 h-1.5 rounded-full bg-[#536DFE]" />

                        <p className="text-[10px] uppercase tracking-wider font-bold text-[#756F66]">
                          OPTIONAL SCHEDULE
                        </p>

                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                        <div>

                          <label className="block text-[10px] font-bold text-[#999BA3] mb-1.5">
                            START
                          </label>

                          <input
                            type="datetime-local"
                            value={
                              itemForm.discount_start_at
                            }
                            onChange={(
                              e
                            ) =>
                              setItemForm(
                                {
                                  ...itemForm,
                                  discount_start_at:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            className="w-full border border-[#E7E4DE] rounded-xl px-3 py-2.5 text-xs bg-[#F7F5F1] focus:outline-none focus:border-[#536DFE]"
                          />

                        </div>

                        <div>

                          <label className="block text-[10px] font-bold text-[#999BA3] mb-1.5">
                            END
                          </label>

                          <input
                            type="datetime-local"
                            value={
                              itemForm.discount_end_at
                            }
                            onChange={(
                              e
                            ) =>
                              setItemForm(
                                {
                                  ...itemForm,
                                  discount_end_at:
                                    e.target
                                      .value,
                                }
                              )
                            }
                            className="w-full border border-[#E7E4DE] rounded-xl px-3 py-2.5 text-xs bg-[#F7F5F1] focus:outline-none focus:border-[#536DFE]"
                          />

                        </div>

                      </div>

                      <p className="text-[10px] text-[#999BA3] mt-2">
                        Leave the dates empty
                        if the promotion
                        should run indefinitely.
                      </p>

                    </div>

                    {/* Preview */}

                    {itemForm.discount_value &&
                      Number(
                        itemForm.discount_value
                      ) > 0 && (
                        <div className="rounded-xl bg-[#202534] p-4 text-white">

                          <p className="text-[9px] uppercase tracking-[0.2em] text-white/40">
                            Customer sees
                          </p>

                          <div className="flex items-end justify-between mt-2">

                            <div>

                              <p className="text-xs text-white/40 line-through">
                                $
                                {(restaurantSettings.price_adjustment_enabled
                                  ? getAdjustedPriceValue(Number(itemForm.price) || 0)
                                  : Number(itemForm.price || 0)).toFixed(2)}
                              </p>

                              <p className="font-serif text-2xl text-[#536DFE]">
                                $
                                {(
                                  itemForm.discount_type ===
                                  'percentage'
                                    ? Math.max(
                                        0,
                                        (restaurantSettings.price_adjustment_enabled
                                          ? getAdjustedPriceValue(Number(itemForm.price) || 0)
                                          : Number(itemForm.price || 0)) -
                                          (restaurantSettings.price_adjustment_enabled
                                            ? getAdjustedPriceValue(Number(itemForm.price) || 0)
                                            : Number(itemForm.price || 0)) *
                                            (Number(
                                              itemForm.discount_value
                                            ) /
                                              100)
                                      )
                                    : Math.max(
                                        0,
                                        (restaurantSettings.price_adjustment_enabled
                                          ? getAdjustedPriceValue(Number(itemForm.price) || 0)
                                          : Number(itemForm.price || 0)) -
                                          Number(
                                            itemForm.discount_value
                                          )
                                      )
                                ).toFixed(
                                  2
                                )}
                              </p>

                            </div>

                            <span className="px-2.5 py-1.5 rounded-lg bg-[#536DFE] text-white text-[10px] font-black">
                              {itemForm.discount_type ===
                              'percentage'
                                ? `-${itemForm.discount_value}%`
                                : `-$${itemForm.discount_value}`}
                            </span>

                          </div>

                        </div>
                      )}

                  </div>
                )}

              </div>

              {/* =================================================
                      EXTRAS & SAUCES
                  ================================================= */}

                  <div className="mt-6 pt-6 border-t border-[#E7E4DE]">

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-black text-[#202534]">
                          Extras & Sauces
                        </h3>

                        <p className="text-xs text-[#756F66] mt-1">
                          Let customers customize this item.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">

                        <button
                          type="button"
                          onClick={() =>
                            addItemOption('extra')
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#EEF0FF] text-[#536DFE] text-xs font-bold hover:bg-[#E3E6FF] transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Extra
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            addItemOption('sauce')
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#F3EEFF] text-[#765BD5] text-xs font-bold hover:bg-[#ECE5FF] transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Sauce
                        </button>

                      </div>
                    </div>

                    {itemForm.options.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#DCD9D2] bg-[#FAF9F7] px-4 py-6 text-center">
                        <p className="text-xs font-semibold text-[#756F66]">
                          No extras or sauces added.
                        </p>

                        <p className="text-[11px] text-[#A0A2A9] mt-1">
                          Add an Extra or Sauce using the buttons above.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">

                        {itemForm.options.map(
                          (option) => (
                            <div
                              key={option.id}
                              className="rounded-2xl border border-[#E7E4DE] bg-[#FAF9F7] p-3"
                            >

                              <div className="flex items-start gap-3">

                                <div
                                  className={`shrink-0 mt-2 w-2 h-2 rounded-full ${
                                    option.type === 'extra'
                                      ? 'bg-[#536DFE]'
                                      : 'bg-[#765BD5]'
                                  }`}
                                />

                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">

                                  <input
                                    type="text"
                                    value={option.name}
                                    onChange={(e) =>
                                      updateItemOption(
                                        option.id,
                                        {
                                          name: e.target.value,
                                        }
                                      )
                                    }
                                    placeholder={
                                      option.type === 'extra'
                                        ? 'Extra name'
                                        : 'Sauce name'
                                    }
                                    className="w-full px-3 py-2.5 rounded-xl border border-[#E7E4DE] bg-white text-sm outline-none focus:border-[#536DFE] transition"
                                  />

                                  <div className="relative">

                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#A0A2A9]">
                                      {restaurantSettings.currency}
                                    </span>

                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      value={roundPrice(option.price)}
                                      onChange={(e) =>
                                        updateItemOption(
                                          option.id,
                                          {
                                            price:
                                              Number(
                                                e.target.value
                                              ) || 0,
                                          }
                                        )
                                      }
                                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-[#E7E4DE] bg-white text-sm outline-none focus:border-[#536DFE] transition"
                                    />

                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeItemOption(
                                        option.id
                                      )
                                    }
                                    className="w-10 h-10 flex items-center justify-center rounded-xl text-[#756F66] hover:text-red-500 hover:bg-red-50 transition"
                                    title="Remove"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>

                                </div>

                              </div>

                              <div className="flex items-center justify-between mt-2 ml-5">

                                <span
                                  className={`text-[10px] uppercase tracking-wider font-black ${
                                    option.type === 'extra'
                                      ? 'text-[#536DFE]'
                                      : 'text-[#765BD5]'
                                  }`}
                                >
                                  {option.type}
                                </span>

                                <label className="flex items-center gap-2 text-[11px] font-semibold text-[#756F66] cursor-pointer">

                                  <input
                                    type="checkbox"
                                    checked={option.is_available}
                                    onChange={(e) =>
                                      updateItemOption(
                                        option.id,
                                        {
                                          is_available:
                                            e.target.checked,
                                        }
                                      )
                                    }
                                    className="accent-[#536DFE]"
                                  />

                                  Available

                                </label>

                              </div>

                            </div>
                          )
                        )}

                      </div>
                    )}

                  </div>

              {/* =================================================
                  IMAGE
              ================================================= */}

              <div>

                <label className="block text-xs font-bold text-[#756F66] mb-2">
                  ITEM IMAGE
                </label>

                <div className="flex gap-2 mb-3">

                  <button
                    type="button"
                    onClick={() =>
                      setImageMode(
                        'upload'
                      )
                    }
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition ${
                      imageMode ===
                      'upload'
                        ? 'bg-[#EEF0FF] border-[#536DFE] text-[#536DFE]'
                        : 'bg-[#F7F5F1] border-[#E7E4DE] text-[#756F66]'
                    }`}
                  >
                    <Upload className="w-4 h-4" />

                    Upload
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setImageMode(
                        'url'
                      )
                    }
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition ${
                      imageMode ===
                      'url'
                        ? 'bg-[#EEF0FF] border-[#536DFE] text-[#536DFE]'
                        : 'bg-[#F7F5F1] border-[#E7E4DE] text-[#756F66]'
                    }`}
                  >
                    <LinkIcon className="w-4 h-4" />

                    Image URL
                  </button>

                </div>

                {imageMode ===
                'upload' ? (
                  <label className="block cursor-pointer">

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handleImageUpload
                      }
                      className="hidden"
                    />

                    <div className="border-2 border-dashed border-[#E7E4DE] rounded-2xl p-6 text-center hover:border-[#536DFE] hover:bg-[#F7F5F1] transition">

                      {uploadingImage ? (
                        <>
                          <Loader2 className="w-7 h-7 mx-auto text-[#536DFE] animate-spin" />

                          <p className="text-xs font-bold mt-2">
                            Uploading
                            image...
                          </p>
                        </>
                      ) : (
                        <>
                          <ImagePlus className="w-7 h-7 mx-auto text-[#536DFE]" />

                          <p className="text-xs font-bold mt-2">
                            Click to upload
                            an image
                          </p>

                          <p className="text-[10px] text-[#999BA3] mt-1">
                            JPG, PNG or WebP .
                            Max 5MB
                          </p>
                        </>
                      )}

                    </div>

                  </label>
                ) : (
                  <input
                    type="url"
                    placeholder="https://..."
                    value={
                      itemForm.image_url
                    }
                    onChange={(e) => {
                      setItemForm({
                        ...itemForm,
                        image_url:
                          e.target
                            .value,
                      });

                      setImagePreview(
                        e.target
                          .value
                      );
                    }}
                    className="w-full border border-[#E7E4DE] rounded-xl px-4 py-3 text-sm bg-[#F7F5F1] focus:outline-none focus:border-[#536DFE] focus:ring-4 focus:ring-[#536DFE]/10 transition"
                  />
                )}

                {/* PREVIEW */}

                {imagePreview ||
                itemForm.image_url ? (
                  <div className="mt-4">

                    <p className="text-[10px] uppercase tracking-wider font-bold text-[#756F66] mb-2">
                      Preview
                    </p>

                    <div className="h-44 rounded-2xl overflow-hidden bg-[#F7F5F1] border border-[#E7E4DE]">

                      <img
                        src={
                          imagePreview ||
                          itemForm.image_url
                        }
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={() =>
                          setErrorMessage(
                            'Unable to load this image.'
                          )
                        }
                      />

                    </div>

                  </div>
                ) : null}

              </div>

              {/* =================================================
                  DESCRIPTION
              ================================================= */}

              <div>

                <label className="block text-xs font-bold text-[#756F66] mb-2">
                  DESCRIPTION
                </label>

                <textarea
                  rows={3}
                  placeholder="Describe this dish..."
                  value={
                    itemForm.description
                  }
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      description:
                        e.target
                          .value,
                    })
                  }
                  className="w-full border border-[#E7E4DE] rounded-xl px-4 py-3 text-sm bg-[#F7F5F1] focus:outline-none focus:border-[#536DFE] focus:ring-4 focus:ring-[#536DFE]/10 transition resize-none"
                />

              </div>

              {/* =================================================
                  AVAILABILITY
              ================================================= */}

              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-[#F7F5F1] border border-[#E7E4DE] cursor-pointer">

                <input
                  type="checkbox"
                  checked={
                    itemForm.is_available
                  }
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      is_available:
                        e.target
                          .checked,
                    })
                  }
                  className="w-4 h-4 rounded border-[#E7E4DE] text-[#536DFE] focus:ring-[#536DFE]"
                />

                <div>

                  <p className="text-sm font-bold">
                    Available to order
                  </p>

                  <p className="text-xs text-[#756F66]">
                    Customers can see
                    and order this item.
                  </p>

                </div>

              </label>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-xs font-semibold text-red-600">
                  {errorMessage}
                </div>
              )}

              {/* =================================================
                  BUTTONS
              ================================================= */}

              <div className="flex justify-end gap-2 pt-4 border-t border-[#F0EEE9]">

                <button
                  type="button"
                  onClick={() => {
                    setIsItemModalOpen(
                      false
                    );
                    setEditingItem(
                      null
                    );
                    setErrorMessage(
                      ''
                    );
                    setImagePreview(
                      ''
                    );
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#756F66] hover:bg-[#F7F5F1]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    uploadingImage
                  }
                  className="px-5 py-2.5 rounded-xl bg-[#202534] text-white text-sm font-bold hover:bg-gradient-to-r hover:from-[#536DFE] hover:to-[#765BD5] transition disabled:opacity-50"
                >
                  {editingItem
                    ? 'Save Changes'
                    : 'Add Item'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

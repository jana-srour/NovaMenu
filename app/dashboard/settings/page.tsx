'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  Check,
  Clipboard,
  DollarSign,
  Palette,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { subscribeRestaurantRealtime } from '@/lib/live-sync';
import { DashboardLoader } from '@/app/dashboard/components/dashboard-loader';
import {
  applyRestaurantTheme,
  defaultRestaurantTheme,
  loadRestaurantTheme,
  normalizeRestaurantTheme,
  resetStoredRestaurantTheme,
  restaurantThemeOptions,
  saveRestaurantTheme,
  subscribeRestaurantTheme,
  type RestaurantTheme,
} from '@/lib/restaurant-theme';

const currencyOptions = [
  'USD',
  'EUR',
  'SAR',
  'AED',
  'QAR',
  'KWD',
  'LBP',
  'EGP',
  'JOD',
  'MAD',
  'GBP',
  'AUD',
  'CAD',
];

type SettingsForm = {
  email: string;
  whatsapp: string;
  phoneNumber: string;
  mobileNumber: string;
  website: string;
  facebook: string;
  instagram: string;
  twitter: string;
  address: string;
  description: string;
  logoUrl: string;
  currency: string;
};

const emptySettings: SettingsForm = {
  email: '',
  whatsapp: '',
  phoneNumber: '',
  mobileNumber: '',
  website: '',
  facebook: '',
  instagram: '',
  twitter: '',
  address: '',
  description: '',
  logoUrl: '',
  currency: 'USD',
};

export default function SettingsPage() {
  const pathname = usePathname();
  const isAppearancePage =
    pathname === '/dashboard/settings/appearance';

  const [restaurantId, setRestaurantId] =
    useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const [showDeactivateModal, setShowDeactivateModal] =
    useState(false);
  const [deactivating, setDeactivating] =
    useState(false);
  const [deactivationMessage, setDeactivationMessage] =
    useState('');
  const [deactivationError, setDeactivationError] =
    useState('');

  const [restaurantSlug, setRestaurantSlug] =
    useState('');
  const [restaurantName, setRestaurantName] =
    useState('Restaurant');

  const [settings, setSettings] =
    useState<SettingsForm>(emptySettings);

  const [savedSettings, setSavedSettings] =
    useState<SettingsForm>(emptySettings);

  const [isEditing, setIsEditing] =
    useState(false);

  const [markupMode, setMarkupMode] =
    useState<'percentage' | 'fixed'>(
      'percentage'
    );

  const [markupDirection, setMarkupDirection] =
    useState<'increase' | 'decrease'>(
      'increase'
    );

  const [markupEnabled, setMarkupEnabled] =
    useState(false);

  const [markupValue, setMarkupValue] =
    useState('5');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [uploadingLogo, setUploadingLogo] =
    useState(false);

  const [themeSaving, setThemeSaving] =
    useState(false);

  const [businessInfoMessage, setBusinessInfoMessage] =
    useState('');

  const [themeMessage, setThemeMessage] =
    useState('');

  const [theme, setTheme] =
    useState(defaultRestaurantTheme);

  const [linkCopied, setLinkCopied] =
    useState(false);

  const [history, setHistory] = useState<
    Array<{
      id: string;
      action: string;
      adjustment_mode: string;
      adjustment_value: number;
      currency: string;
      description: string;
      created_at: string;
    }>
  >([]);

  const updateField = (
    field: keyof SettingsForm,
    value: string
  ) => {
    setSettings((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleThemeSelection = (
    nextTheme: RestaurantTheme
  ) => {
    const normalizedTheme =
      normalizeRestaurantTheme(nextTheme);

    setTheme(normalizedTheme);
    applyRestaurantTheme(normalizedTheme);
  };

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    let active = true;

    const syncTheme = async () => {
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
    };

    syncTheme();

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
  }, [restaurantId]);

  useEffect(() => {
    async function loadSettings() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: membership } =
        await supabase
          .from('restaurant_members')
          .select(
            'restaurant_id, role'
          )
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

      if (!membership?.restaurant_id) {
        setLoading(false);
        return;
      }

      setIsOwner(
        membership.role === 'owner'
      );

      setRestaurantId(
        membership.restaurant_id
      );

      const { data: restaurant } =
        await supabase
          .from('restaurants')
          .select('*')
          .eq(
            'id',
            membership.restaurant_id
          )
          .single();

      if (restaurant) {
        const nextSettings: SettingsForm = {
          email:
            restaurant.email || '',
          whatsapp:
            restaurant.whatsapp_number || '',
          phoneNumber:
            restaurant.phone_number || '',
          mobileNumber:
            restaurant.mobile_number || '',
          website:
            restaurant.website_url || '',
          facebook:
            restaurant.facebook_url || '',
          instagram:
            restaurant.instagram_url || '',
          twitter:
            restaurant.twitter_url || '',
          address:
            restaurant.address || '',
          description:
            restaurant.description || '',
          logoUrl:
            restaurant.logo_url || '',
          currency:
            restaurant.currency || 'USD',
        };

        setRestaurantName(
          restaurant.name || 'Restaurant'
        );

        setRestaurantSlug(
          restaurant.slug || ''
        );

        setSettings(nextSettings);
        setSavedSettings(nextSettings);

        setMarkupMode(
          restaurant.price_adjustment_mode ||
            'percentage'
        );

        setMarkupDirection(
          restaurant.price_adjustment_direction ||
            'increase'
        );

        setMarkupEnabled(
          restaurant.price_adjustment_enabled ===
            true
        );

        setMarkupValue(
          String(
            restaurant.price_adjustment_value ??
              '0'
          )
        );
      }

      const nextTheme =
        await loadRestaurantTheme(
          supabase,
          membership.restaurant_id
        );

      setTheme(nextTheme);
      applyRestaurantTheme(nextTheme);

      const {
        data: historyData,
        error: historyError,
      } = await supabase
        .from(
          'restaurant_price_adjustment_history'
        )
        .select('*')
        .eq(
          'restaurant_id',
          membership.restaurant_id
        )
        .order('created_at', {
          ascending: false,
        })
        .limit(10);

      if (!historyError) {
        setHistory(
          historyData || []
        );
      }

      setLoading(false);
    }

    loadSettings();
  }, []);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    return subscribeRestaurantRealtime(
      supabase,
      {
        restaurantId,
        name: 'dashboard-settings',
        tables: [
          'restaurant_price_adjustment_history',
        ],
        onChange: async () => {
          const [
            restaurantResult,
            historyResult,
          ] = await Promise.all([
            supabase
              .from('restaurants')
              .select('*')
              .eq(
                'id',
                restaurantId
              )
              .single(),

            supabase
              .from(
                'restaurant_price_adjustment_history'
              )
              .select('*')
              .eq(
                'restaurant_id',
                restaurantId
              )
              .order('created_at', {
                ascending: false,
              })
              .limit(10),
          ]);

          const restaurant =
            restaurantResult.data;

          if (restaurant) {
            const nextSettings: SettingsForm = {
              email:
                restaurant.email || '',
              whatsapp:
                restaurant.whatsapp_number ||
                '',
              phoneNumber:
                restaurant.phone_number ||
                '',
              mobileNumber:
                restaurant.mobile_number ||
                '',
              website:
                restaurant.website_url || '',
              facebook:
                restaurant.facebook_url || '',
              instagram:
                restaurant.instagram_url || '',
              twitter:
                restaurant.twitter_url || '',
              address:
                restaurant.address || '',
              description:
                restaurant.description || '',
              logoUrl:
                restaurant.logo_url || '',
              currency:
                restaurant.currency || 'USD',
            };

            setRestaurantName(
              restaurant.name ||
                'Restaurant'
            );

            setRestaurantSlug(
              restaurant.slug || ''
            );

            setSettings(nextSettings);
            setSavedSettings(
              nextSettings
            );

            setMarkupMode(
              restaurant.price_adjustment_mode ||
                'percentage'
            );

            setMarkupDirection(
              restaurant.price_adjustment_direction ||
                'increase'
            );

            setMarkupEnabled(
              restaurant.price_adjustment_enabled ===
                true
            );

            setMarkupValue(
              String(
                restaurant.price_adjustment_value ??
                  '0'
              )
            );
          }

          if (!historyResult.error) {
            setHistory(
              historyResult.data || []
            );
          }
        },
      }
    );
  }, [restaurantId]);

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file || !restaurantId) {
      return;
    }

    if (
      !file.type.startsWith('image/')
    ) {
      setBusinessInfoMessage(
        'Please select an image file.'
      );
      return;
    }

    if (
      file.size > 5 * 1024 * 1024
    ) {
      setBusinessInfoMessage(
        'Logo must be smaller than 5MB.'
      );
      return;
    }

    setUploadingLogo(true);
    setBusinessInfoMessage('');

    try {
      const extension =
        file.name
          .split('.')
          .pop()
          ?.toLowerCase() || 'jpg';

      const fileName = `${restaurantId}/logo/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from('menu-images')
          .upload(
            fileName,
            file,
            {
              cacheControl: '3600',
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

      if (!data.publicUrl) {
        throw new Error(
          'Could not generate logo URL.'
        );
      }

      setSettings((current) => ({
        ...current,
        logoUrl:
          data.publicUrl,
      }));

      setBusinessInfoMessage(
        'Logo uploaded. Click Save to apply it to your restaurant.'
      );
    } catch (error: unknown) {
      console.error(
        'Logo upload error:',
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to upload logo.';

      setBusinessInfoMessage(
        message
      );
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!restaurantId) {
      setBusinessInfoMessage(
        'No restaurant was found for this account.'
      );
      return;
    }

    if (!settings.email.trim()) {
      setBusinessInfoMessage(
        'Restaurant email is required so customers can send feedback.'
      );

      setIsEditing(true);
      return;
    }

    setSaving(true);
    setBusinessInfoMessage('');

    const payload = {
      email: settings.email,
      whatsapp_number:
        settings.whatsapp,
      phone_number:
        settings.phoneNumber,
      mobile_number:
        settings.mobileNumber,
      website_url:
        settings.website,
      facebook_url:
        settings.facebook,
      instagram_url:
        settings.instagram,
      twitter_url:
        settings.twitter,
      address:
        settings.address,
      description:
        settings.description,
      logo_url:
        settings.logoUrl,
      currency:
        settings.currency,
      price_adjustment_mode:
        markupMode,
      price_adjustment_direction:
        markupDirection,
      price_adjustment_enabled:
        markupEnabled,
      price_adjustment_value:
        Number(markupValue) || 0,
    };

    const { error } =
      await supabase
        .from('restaurants')
        .update(payload)
        .eq(
          'id',
          restaurantId
        );

    if (error) {
      setSaving(false);

      setBusinessInfoMessage(
        `Could not save settings: ${error.message}`
      );

      return;
    }

    const action = markupEnabled
      ? markupDirection
      : 'disabled';

    const description =
      markupEnabled
        ? `${
            markupDirection ===
            'increase'
              ? 'Increase'
              : 'Decrease'
          } by ${
            Number(markupValue) || 0
          }${
            markupMode ===
            'percentage'
              ? '%'
              : ` ${settings.currency}`
          }`
        : 'Price automation disabled';

    const {
      error: historyError,
    } = await supabase
      .from(
        'restaurant_price_adjustment_history'
      )
      .insert({
        restaurant_id:
          restaurantId,
        action,
        adjustment_mode:
          markupMode,
        adjustment_value:
          Number(markupValue) || 0,
        currency:
          settings.currency,
        description,
        created_at:
          new Date().toISOString(),
      });

    setSaving(false);

    if (historyError) {
      console.error(
        'Price automation history save failed:',
        historyError
      );
    }

    const nextHistory =
      historyError
        ? history
        : [
            {
              id: crypto.randomUUID(),
              action,
              adjustment_mode:
                markupMode,
              adjustment_value:
                Number(markupValue) ||
                0,
              currency:
                settings.currency,
              description,
              created_at:
                new Date().toISOString(),
            },
            ...history,
          ];

    setHistory(nextHistory);

    setSavedSettings({
      ...settings,
    });

    setIsEditing(false);

    setBusinessInfoMessage(
      'Restaurant settings updated successfully.'
    );
  };

  const handleCancel = () => {
    setSettings({
      ...savedSettings,
    });

    setIsEditing(false);
    setBusinessInfoMessage('');
  };

  const handleDeactivate = async () => {
    if (!isOwner) {
      return;
    }

    setDeactivating(true);
    setDeactivationError('');
    setDeactivationMessage('');

    try {
      const {
        data: {
          session,
        },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(
          'Your session has expired. Please sign in again.'
        );
      }

      const response =
        await fetch(
          '/api/account/deactivate',
          {
            method: 'POST',
            headers: {
              Authorization:
                `Bearer ${session.access_token}`,
              'Content-Type':
                'application/json',
            },
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Unable to deactivate the restaurant.'
        );
      }

      const scheduledDate =
        data?.deletionScheduledAt
          ? new Date(
              data.deletionScheduledAt
            )
          : null;

      const formattedDate =
        scheduledDate &&
        !Number.isNaN(
          scheduledDate.getTime()
        )
          ? scheduledDate.toLocaleDateString(
              undefined,
              {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }
            )
          : null;

      setDeactivationMessage(
        data?.deletedImmediately
          ? 'Your trial account and its restaurant data have been permanently deleted.'
          : formattedDate
            ? `Your restaurant has been scheduled for deactivation. Your subscription will remain active until ${formattedDate}, after which the restaurant data and account will be permanently deleted.`
            : 'Your restaurant has been scheduled for deactivation. The restaurant will remain active until the end of the current subscription period, after which it will be permanently deleted.'
      );

      setShowDeactivateModal(false);
    } catch (error: unknown) {
      console.error(
        'Restaurant deactivation error:',
        error
      );

      setDeactivationError(
        error instanceof Error
          ? error.message
          : 'Unable to deactivate the restaurant.'
      );
    } finally {
      setDeactivating(false);
    }
  };

  const publicMenuUrl =
    restaurantSlug &&
    typeof window !== 'undefined'
      ? `${window.location.origin}/menu/${restaurantSlug}`
      : '';

  const findRestaurantId = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data: membership, error } = await supabase
      .from('restaurant_members')
      .select('restaurant_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Restaurant lookup failed:', error);
      return null;
    }

    return membership?.restaurant_id || null;
  };

  const handleCopyMenuLink =
    async () => {
      if (!publicMenuUrl) {
        return;
      }

      await navigator.clipboard.writeText(
        publicMenuUrl
      );

      setLinkCopied(true);

      window.setTimeout(
        () => setLinkCopied(false),
        2200
      );
    };

  const handleResetTheme = async () => {
    const nextTheme =
      defaultRestaurantTheme;

    setTheme(nextTheme);
    applyRestaurantTheme(nextTheme);

    const resolvedRestaurantId =
      restaurantId || await findRestaurantId();

    if (!resolvedRestaurantId) {
      setThemeMessage(
        'No restaurant was found for this account.'
      );
      return;
    }

    setThemeSaving(true);
    setThemeMessage('');

    resetStoredRestaurantTheme(
      resolvedRestaurantId
    );

    const result =
      await saveRestaurantTheme(
        supabase,
        resolvedRestaurantId,
        nextTheme
      );

    setThemeSaving(false);

    if (result.error) {
      setThemeMessage(
        `Could not reset theme: ${
          result.error.message ||
          'Unknown error'
        }`
      );
      return;
    }

    setThemeMessage(
      'Brand colors reset to default successfully.'
    );
  };

  const handleSaveTheme = async () => {
    const resolvedRestaurantId =
      restaurantId || await findRestaurantId();

    if (!resolvedRestaurantId) {
      setThemeMessage(
        'No restaurant was found for this account.'
      );
      return;
    }

    setThemeSaving(true);
    setThemeMessage('');

    const result =
      await saveRestaurantTheme(
        supabase,
        resolvedRestaurantId,
        theme
      );

    setThemeSaving(false);

    if (result.error) {
      setThemeMessage(
        `Could not save theme: ${
          result.error.message ||
          'Unknown error'
        }`
      );
      return;
    }

    applyRestaurantTheme(theme);

    setThemeMessage(
      'Brand colors saved successfully.'
    );
  };

  const profileChecks = [
    ['Business address', settings.address],
    ['Phone number', settings.phoneNumber],
    ['Mobile number', settings.mobileNumber],
    ['WhatsApp number', settings.whatsapp],
    ['Website', settings.website],
    ['Facebook', settings.facebook],
    ['Instagram', settings.instagram],
    ['Twitter / X', settings.twitter],
  ];

  const completedProfileFields =
    profileChecks.filter(
      ([, value]) => value.trim()
    ).length;

  const profileCompleteness =
    Math.round(
      (completedProfileFields /
        profileChecks.length) *
        100
    );

  if (loading) {
    return <DashboardLoader />;
  }

  return (
    <>
      <div
        className="settings-page min-h-screen"
        data-settings-section={
          isAppearancePage ? 'appearance' : 'profile'
        }
        style={{
          background:
            theme.portal_background,
          color:
            theme.portal_text,
        }}
      >
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <header
            className="mb-7 rounded-[28px] border p-6 shadow-sm"
            style={{
              background:
                theme.portal_surface,
              borderColor:
                theme.portal_border,
              color:
                theme.portal_text,
            }}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div
                  className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{
                    color:
                      theme.portal_accent,
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      background:
                        theme.portal_accent,
                    }}
                  />
                  Settings
                </div>

                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                  {isAppearancePage
                    ? 'Appearance'
                    : restaurantName}
                </h1>

                <p className="mt-2 text-sm text-[#756F66]">
                  {isAppearancePage
                    ? 'Shape the visual identity of your restaurant portal and public menu.'
                    : 'Configure your restaurant profile, communication channels, pricing rules, and brand identity.'}
                </p>
              </div>

              <div className={`flex items-center gap-3 ${isAppearancePage ? 'hidden' : ''}`}>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() =>
                      setIsEditing(true)
                    }
                    className="rounded-2xl bg-[#202534] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#536DFE]"
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={
                        handleCancel
                      }
                      className="rounded-2xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] transition"
                      style={{
                        background:
                          theme.portal_surface,
                        borderColor:
                          theme.portal_border,
                        color:
                          theme.portal_text,
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      form="settings-form"
                      disabled={saving}
                      className="rounded-2xl bg-[#536DFE] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#536DFE] disabled:opacity-60"
                    >
                      {saving
                        ? 'Saving...'
                        : 'Save'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </header>

          <section className={`settings-content grid gap-6 ${isAppearancePage ? '' : 'xl:grid-cols-[1.2fr_0.8fr]'}`}>
            <div className="settings-profile-column space-y-6">
              <div
                className="settings-profile-panel rounded-[28px] border p-6 shadow-sm"
                style={{
                  background:
                    theme.portal_surface,
                  borderColor:
                    theme.portal_border,
                  color:
                    theme.portal_text,
                }}
              >
                <div className="mb-6 flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      background:
                        theme.portal_accent_soft,
                      color:
                        theme.portal_accent,
                    }}
                  >
                    <Palette className="h-5 w-5" />
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#756F66]">
                      Contact details
                    </p>

                    <h2 className="text-xl font-black">
                      Business info
                    </h2>
                  </div>
                </div>

                <form
                  id="settings-form"
                  onSubmit={handleSave}
                  className="space-y-5"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div
                      className="md:col-span-2 rounded-2xl border p-4"
                      style={{
                        background:
                          theme.portal_background,
                        borderColor:
                          theme.portal_border,
                      }}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#756F66]">
                            Restaurant logo
                          </p>

                          <p className="mt-1 text-xs text-[#756F66]">
                            Upload a square image for the best public-menu display.
                          </p>
                        </div>

                        {settings.logoUrl ? (
                          <img
                            src={
                              settings.logoUrl
                            }
                            alt="Restaurant preview"
                            className="h-16 w-16 rounded-2xl border object-cover"
                            style={{
                              background:
                                theme.portal_surface,
                              borderColor:
                                theme.portal_border,
                            }}
                          />
                        ) : (
                          <div
                            className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed text-2xl"
                            style={{
                              background:
                                theme.portal_surface,
                              borderColor:
                                theme.portal_border,
                              color:
                                theme.portal_text,
                            }}
                          >
                            N
                          </div>
                        )}
                      </div>

                      <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-[#202534] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#536DFE] disabled:cursor-not-allowed disabled:opacity-60">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={
                            handleLogoUpload
                          }
                          disabled={
                            !isEditing ||
                            uploadingLogo
                          }
                        />

                        {uploadingLogo
                          ? 'Uploading...'
                          : settings.logoUrl
                            ? 'Change logo'
                            : 'Upload logo'}
                      </label>
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        Restaurant description
                      </label>

                      <textarea
                        value={
                          settings.description
                        }
                        onChange={(e) =>
                          updateField(
                            'description',
                            e.target.value
                          )
                        }
                        placeholder="Tell customers what makes your restaurant special."
                        disabled={!isEditing}
                        rows={4}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        Business address
                      </label>

                      <input
                        type="text"
                        value={
                          settings.address
                        }
                        onChange={(e) =>
                          updateField(
                            'address',
                            e.target.value
                          )
                        }
                        placeholder="Street, city, country"
                        disabled={!isEditing}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        Restaurant email
                      </label>

                      <input
                        type="email"
                        value={
                          settings.email
                        }
                        onChange={(e) =>
                          updateField(
                            'email',
                            e.target.value
                          )
                        }
                        placeholder="hello@yourrestaurant.com"
                        required
                        disabled={!isEditing}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        Phone number
                      </label>

                      <input
                        type="tel"
                        value={
                          settings.phoneNumber
                        }
                        onChange={(e) =>
                          updateField(
                            'phoneNumber',
                            e.target.value
                          )
                        }
                        placeholder="+966 12 345 6789"
                        disabled={!isEditing}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        Mobile number
                      </label>

                      <input
                        type="tel"
                        value={
                          settings.mobileNumber
                        }
                        onChange={(e) =>
                          updateField(
                            'mobileNumber',
                            e.target.value
                          )
                        }
                        placeholder="+966 500 000 000"
                        disabled={!isEditing}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        WhatsApp number
                      </label>

                      <input
                        type="tel"
                        value={
                          settings.whatsapp
                        }
                        onChange={(e) =>
                          updateField(
                            'whatsapp',
                            e.target.value
                          )
                        }
                        placeholder="+966500000000"
                        disabled={!isEditing}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        Website
                      </label>

                      <input
                        type="url"
                        value={
                          settings.website
                        }
                        onChange={(e) =>
                          updateField(
                            'website',
                            e.target.value
                          )
                        }
                        placeholder="https://yourrestaurant.com"
                        disabled={!isEditing}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        Facebook
                      </label>

                      <input
                        type="url"
                        value={
                          settings.facebook
                        }
                        onChange={(e) =>
                          updateField(
                            'facebook',
                            e.target.value
                          )
                        }
                        placeholder="https://facebook.com/restaurant"
                        disabled={!isEditing}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        Instagram
                      </label>

                      <input
                        type="url"
                        value={
                          settings.instagram
                        }
                        onChange={(e) =>
                          updateField(
                            'instagram',
                            e.target.value
                          )
                        }
                        placeholder="https://instagram.com/restaurant"
                        disabled={!isEditing}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        Twitter / X
                      </label>

                      <input
                        type="url"
                        value={
                          settings.twitter
                        }
                        onChange={(e) =>
                          updateField(
                            'twitter',
                            e.target.value
                          )
                        }
                        placeholder="https://x.com/restaurant"
                        disabled={!isEditing}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-[#756F66]">
                        Currency
                      </label>

                      <select
                        value={
                          settings.currency
                        }
                        onChange={(e) =>
                          updateField(
                            'currency',
                            e.target.value
                          )
                        }
                        disabled={!isEditing}
                        className="w-full rounded-2xl border px-4 py-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={{
                          background:
                            theme.portal_background,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      >
                        {currencyOptions.map(
                          (option) => (
                            <option
                              key={option}
                              value={option}
                            >
                              {option}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={
                          handleCancel
                        }
                        className="flex-1 rounded-2xl border px-5 py-3.5 text-xs font-black uppercase tracking-[0.14em] transition"
                        style={{
                          background:
                            theme.portal_surface,
                          borderColor:
                            theme.portal_border,
                          color:
                            theme.portal_text,
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 rounded-2xl bg-[#202534] px-5 py-3.5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-gradient-to-r hover:from-[#536DFE] hover:to-[#765BD5] disabled:opacity-60"
                      >
                        {saving
                          ? 'Saving...'
                          : 'Save Settings'}
                      </button>
                    </div>
                  )}
                </form>

                {businessInfoMessage && (
                  <div
                    className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                      businessInfoMessage
                        .toLowerCase()
                        .includes(
                          'success'
                        )
                        ? 'border-[#EFE3CF] bg-[#EEF0FF] text-[#756F66]'
                        : 'border-[#E7E4DE] bg-[#F7F5F1] text-[#A85C4A]'
                    }`}
                  >
                    {businessInfoMessage}
                  </div>
                )}
              </div>

              <div
                className="settings-profile-panel rounded-[28px] border p-6 shadow-sm"
                style={{
                  background:
                    theme.portal_surface,
                  borderColor:
                    theme.portal_border,
                  color:
                    theme.portal_text,
                }}
              >
                <div className="mb-5 flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl"
                    style={{
                      background:
                        theme.portal_accent_soft,
                      color:
                        theme.portal_accent,
                    }}
                  >
                    <Clipboard className="h-5 w-5" />
                  </div>

                  <div>
                    <p
                      className="text-[9px] font-black uppercase tracking-[0.18em]"
                      style={{
                        color:
                          `${theme.portal_text}70`,
                      }}
                    >
                      QR Studio destination
                    </p>

                    <h2 className="text-xl font-black">
                      Public menu link
                    </h2>
                  </div>
                </div>

                <p
                  className="mb-3 text-xs leading-5"
                  style={{
                    color:
                      `${theme.portal_text}80`,
                  }}
                >
                  This is the restaurant page link used by QR Studio. Copy it to share or print alongside your QR code.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    readOnly
                    value={
                      publicMenuUrl ||
                      'Loading restaurant link...'
                    }
                    aria-label="Public menu link"
                    className="min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{
                      background:
                        theme.portal_background,
                      borderColor:
                        theme.portal_border,
                      color:
                        theme.portal_text,
                    }}
                  />

                  <button
                    type="button"
                    onClick={
                      handleCopyMenuLink
                    }
                    disabled={
                      !publicMenuUrl
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    style={{
                      background:
                        theme.portal_accent,
                    }}
                  >
                    {linkCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Clipboard className="h-4 w-4" />
                    )}

                    {linkCopied
                      ? 'Copied'
                      : 'Copy link'}
                  </button>
                </div>
              </div>

                <div
                className="settings-appearance-panel relative overflow-hidden rounded-[32px] border border-[#D8CBB7] shadow-[0_20px_60px_rgba(83,65,38,0.10)]"
                style={{
                  background:
                    theme.portal_surface,
                  borderColor:
                    theme.portal_border,
                }}
              >
                <div
                  className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
                  style={{
                    background:
                      `${theme.portal_accent}18`,
                  }}
                />

                <div
                  className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full blur-3xl"
                  style={{
                    background:
                      `${theme.portal_accent_soft}28`,
                  }}
                />

                <div className="relative p-6 sm:p-7">
                  <div className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className="relative flex h-14 w-14 items-center justify-center rounded-[20px] border shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                        style={{
                          borderColor:
                            theme.portal_border,
                          background:
                            `linear-gradient(135deg, ${theme.portal_accent_soft}, ${theme.portal_surface})`,
                        }}
                      >
                        <Palette
                          className="h-6 w-6"
                          style={{
                            color:
                              theme.portal_accent,
                          }}
                        />

                        <span className="absolute inset-1 rounded-[16px] border border-white/50" />
                      </div>

                      <div>
                        <p
                          className="text-[9px] font-black uppercase tracking-[0.22em]"
                          style={{
                            color:
                              theme.portal_accent,
                          }}
                        >
                          Brand identity
                        </p>

                        <h2
                          className="mt-1 text-2xl font-black tracking-tight"
                          style={{
                            color:
                              theme.portal_text,
                          }}
                        >
                          Theme Designer
                        </h2>

                        <p
                          className="mt-1 max-w-md text-xs leading-5"
                          style={{
                            color:
                              theme.portal_text,
                          }}
                        >
                          Craft a signature visual identity for your restaurant portal and public menu.
                        </p>
                      </div>
                    </div>

                    <div
                      className="self-start rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] shadow-sm"
                      style={{
                        borderColor:
                          theme.portal_border,
                        background:
                          theme.portal_background,
                        color:
                          theme.portal_accent,
                      }}
                    >
                      Premium palette
                    </div>
                  </div>

                  <div className="mb-7 overflow-hidden rounded-[26px] border border-[#D8CBB7] bg-[#202534] shadow-[0_14px_35px_rgba(23,22,19,0.15)]">
                    <div className="relative p-5 sm:p-6">
                      <div
                        className="absolute inset-0 opacity-70"
                        style={{
                          background:
                            `radial-gradient(circle at 15% 0%, ${theme.portal_accent}55, transparent 38%), radial-gradient(circle at 90% 100%, ${theme.public_accent}40, transparent 40%)`,
                        }}
                      />

                      <div className="relative">
                        <div className="mb-5 flex items-center justify-between">
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-white/45">
                              Live preview
                            </p>

                            <p className="mt-1 text-sm font-black text-white">
                              Your restaurant identity
                            </p>
                          </div>

                          <span
                            className="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em]"
                            style={{
                              backgroundColor:
                                theme.public_accent_soft,
                              color:
                                theme.public_accent,
                            }}
                          >
                            Preview
                          </span>
                        </div>

                        <div
                          className="grid gap-3 rounded-[22px] p-4 sm:grid-cols-[1.2fr_0.8fr]"
                          style={{
                            backgroundColor:
                              theme.portal_background,
                            color:
                              theme.portal_text,
                            border:
                              `1px solid ${theme.portal_border}`,
                          }}
                        >
                          <div
                            className="rounded-[18px] p-4"
                            style={{
                              backgroundColor:
                                theme.portal_surface,
                              border:
                                `1px solid ${theme.portal_border}`,
                            }}
                          >
                            <div
                              className="mb-3 h-2 w-24 rounded-full"
                              style={{
                                backgroundColor:
                                  theme.portal_accent,
                              }}
                            />

                            <div
                              className="h-3 w-40 rounded-full opacity-80"
                              style={{
                                backgroundColor:
                                  theme.portal_text,
                              }}
                            />

                            <div className="mt-3 h-2 w-28 rounded-full opacity-30 bg-current" />

                            <div className="mt-5 flex gap-2">
                              <span
                                className="rounded-xl px-3 py-2 text-[9px] font-black"
                                style={{
                                  backgroundColor:
                                    theme.portal_accent,
                                  color:
                                    theme.portal_surface,
                                }}
                              >
                                Portal
                              </span>

                              <span
                                className="rounded-xl border px-3 py-2 text-[9px] font-black"
                                style={{
                                  borderColor:
                                    theme.portal_border,
                                  color:
                                    theme.portal_text,
                                }}
                              >
                                Dashboard
                              </span>
                            </div>
                          </div>

                          <div
                            className="rounded-[18px] p-4"
                            style={{
                              backgroundColor:
                                theme.public_surface,
                              border:
                                `1px solid ${theme.public_border}`,
                            }}
                          >
                            <div
                              className="mb-3 h-20 rounded-[15px]"
                              style={{
                                background:
                                  `linear-gradient(135deg, ${theme.public_hero_background}, ${theme.public_accent_soft})`,
                              }}
                            />

                            <div
                              className="h-3 w-32 rounded-full"
                              style={{
                                backgroundColor:
                                  theme.public_text,
                              }}
                            />

                            <div className="mt-3 flex items-center justify-between">
                              <span
                                className="rounded-xl px-3 py-2 text-[9px] font-black"
                                style={{
                                  backgroundColor:
                                    theme.public_accent,
                                  color:
                                    theme.public_button_text,
                                }}
                              >
                                View menu
                              </span>

                              <span
                                className="h-2 w-10 rounded-full"
                                style={{
                                  backgroundColor:
                                    theme.public_border,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-4 flex items-end justify-between">
                      <div>
                        <p
                          className="text-[9px] font-black uppercase tracking-[0.18em]"
                          style={{
                            color:
                              theme.portal_accent,
                          }}
                        >
                          Brand palette
                        </p>

                        <h3
                          className="mt-1 text-lg font-black"
                          style={{
                            color:
                              theme.portal_text,
                          }}
                        >
                          Choose a premium theme
                        </h3>
                      </div>

                      <span className="hidden text-[10px] font-semibold text-[#9A9186] sm:block">
                        7 curated looks
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {restaurantThemeOptions.map(
                        (option) => {
                          const isSelected =
                            theme.theme_id ===
                            option.id;

                          const preview =
                            option.palette;

                          return (
                            <button
                              key={
                                option.id
                              }
                              type="button"
                              onClick={() =>
                                handleThemeSelection(
                                  preview
                                )
                              }
                              className="rounded-[24px] border p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                              style={{
                                borderColor:
                                  isSelected
                                    ? preview.portal_accent
                                    : '#DDD3C3',
                                background:
                                  preview.portal_surface,
                                boxShadow:
                                  isSelected
                                    ? `0 0 0 1px ${preview.portal_accent}22`
                                    : undefined,
                              }}
                            >
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div
                                    className="flex h-10 w-10 items-center justify-center rounded-xl border"
                                    style={{
                                      background:
                                        `linear-gradient(135deg, ${preview.public_accent}, ${preview.public_accent_soft})`,
                                      borderColor:
                                        preview.public_border,
                                    }}
                                  >
                                    <span
                                      className="h-3 w-3 rounded-full border border-white/60"
                                      style={{
                                        background:
                                          preview.public_button_text,
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <p
                                      className="text-[9px] font-black uppercase tracking-[0.18em]"
                                      style={{
                                        color:
                                          preview.portal_accent,
                                      }}
                                    >
                                      Theme
                                    </p>

                                    <h4
                                      className="mt-0.5 text-sm font-black"
                                      style={{
                                        color:
                                          preview.portal_text,
                                      }}
                                    >
                                      {option.name}
                                    </h4>
                                  </div>
                                </div>

                                {isSelected && (
                                  <span
                                    className="rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em]"
                                    style={{
                                      background:
                                        preview.portal_accent_soft,
                                      color:
                                        preview.portal_accent,
                                    }}
                                  >
                                    Active
                                  </span>
                                )}
                              </div>

                              <div
                                className="overflow-hidden rounded-2xl border"
                                style={{
                                  borderColor:
                                    preview.public_border,
                                  background:
                                    preview.public_background,
                                }}
                              >
                                <div
                                  className="h-12"
                                  style={{
                                    background:
                                      `linear-gradient(135deg, ${preview.public_hero_background}, ${preview.public_accent_soft})`,
                                  }}
                                />

                                <div className="flex items-center justify-between gap-2 p-3">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 rounded-full"
                                      style={{
                                        background:
                                          preview.public_accent,
                                      }}
                                    />

                                    <span
                                      className="h-2.5 w-16 rounded-full"
                                      style={{
                                        background:
                                          preview.public_text,
                                        opacity: 0.8,
                                      }}
                                    />
                                  </div>

                                  <span
                                    className="rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em]"
                                    style={{
                                      background:
                                        preview.public_accent,
                                      color:
                                        preview.public_button_text,
                                    }}
                                  >
                                    Menu
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <div
                    className="mt-7 flex flex-col gap-3 rounded-[24px] border p-4 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      borderColor:
                        theme.portal_border,
                      background:
                        `linear-gradient(90deg, ${theme.portal_background}, ${theme.portal_surface})`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
                        style={{
                          background:
                            theme.portal_text,
                          color:
                            theme.portal_accent,
                        }}
                      >
                        <Sparkles className="h-4 w-4" />
                      </div>

                      <div>
                        <p
                          className="text-xs font-black"
                          style={{
                            color:
                              theme.portal_text,
                          }}
                        >
                          Your palette is ready
                        </p>

                        <p
                          className="text-[10px]"
                          style={{
                            color:
                              theme.portal_text,
                          }}
                        >
                          Changes apply across the restaurant experience.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={
                          handleResetTheme
                        }
                        disabled={
                          themeSaving
                        }
                        className="group relative overflow-hidden rounded-2xl border px-5 py-3.5 text-xs font-black uppercase tracking-[0.16em] shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          borderColor:
                            theme.portal_border,
                          background:
                            theme.portal_background,
                          color:
                            theme.portal_text,
                        }}
                      >
                        Reset default
                      </button>

                      <button
                        type="button"
                        onClick={
                          handleSaveTheme
                        }
                        disabled={
                          themeSaving
                        }
                        className="group relative overflow-hidden rounded-2xl px-6 py-3.5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_8px_20px_rgba(23,22,19,0.18)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(23,22,19,0.24)] disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          background:
                            theme.portal_accent,
                          color:
                            theme.portal_surface,
                        }}
                      >
                        <span className="relative z-10">
                          {themeSaving
                            ? 'Saving theme...'
                            : 'Save colors'}
                        </span>

                        <span
                          className="absolute inset-0 -translate-x-full bg-gradient-to-r transition-transform duration-500 group-hover:translate-x-0"
                          style={{
                            background:
                              `linear-gradient(90deg, ${theme.portal_accent_soft}, ${theme.portal_accent}, ${theme.portal_accent_soft})`,
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {themeMessage && (
                    <div
                      className={`mt-4 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                        themeMessage
                          .toLowerCase()
                          .includes(
                            'success'
                          )
                          ? 'border-[#E7E4DE] bg-[#EEF0FF] text-[#756F66]'
                          : 'border-[#E7E4DE] bg-[#F7F5F1] text-[#A85C4A]'
                      }`}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm">
                        {themeMessage
                          .toLowerCase()
                          .includes(
                            'success'
                          )
                          ? '✓'
                          : '!'}
                      </span>

                      {themeMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* OWNER-ONLY DANGER ZONE */}
              {isOwner && (
                <div
                  className="settings-profile-panel"
                >
                <div
                  className="rounded-[28px] border p-6 shadow-sm"
                  style={{
                    background:
                      theme.portal_surface,
                    borderColor:
                      '#E7C7C0',
                    color:
                      theme.portal_text,
                  }}
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                        style={{
                          background:
                            '#FBEDEA',
                          color:
                            '#A85C4A',
                        }}
                      >
                        <AlertTriangle className="h-5 w-5" />
                      </div>

                      <div>
                        <p
                          className="text-[9px] font-black uppercase tracking-[0.18em]"
                          style={{
                            color:
                              '#A85C4A',
                          }}
                        >
                          Account management
                        </p>

                        <h2 className="mt-1 text-xl font-black">
                          Danger Zone
                        </h2>

                        <p
                          className="mt-2 max-w-xl text-xs leading-5"
                          style={{
                            color:
                              `${theme.portal_text}80`,
                          }}
                        >
                          Deactivating this restaurant cancels paid subscriptions at the end of the current billing period, keeping your restaurant and data available until then. Trial accounts are deactivated immediately. After deactivation, the restaurant data and associated accounts are permanently deleted.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDeactivationError('');
                        setDeactivationMessage('');
                        setShowDeactivateModal(
                          true
                        );
                      }}
                      className="shrink-0 rounded-2xl border px-5 py-3 text-[10px] font-black uppercase tracking-[0.15em] transition hover:bg-[#A85C4A] hover:text-white"
                      style={{
                        borderColor:
                          '#D7A79D',
                        color:
                          '#A85C4A',
                        background:
                          theme.portal_surface,
                      }}
                    >
                      Deactivate restaurant
                    </button>
                  </div>

                  {deactivationMessage && (
                    <div
                      className="mt-5 rounded-2xl border px-4 py-4 text-sm font-semibold"
                      style={{
                        background:
                          '#F3FAF5',
                        borderColor:
                          '#CBE4D2',
                        color:
                          '#356B48',
                      }}
                    >
                      {deactivationMessage}
                    </div>
                  )}

                  {deactivationError && (
                    <div
                      className="mt-5 rounded-2xl border px-4 py-4 text-sm font-semibold"
                      style={{
                        background:
                          '#FBEDEA',
                        borderColor:
                          '#E7C7C0',
                        color:
                          '#A85C4A',
                      }}
                    >
                      {deactivationError}
                    </div>
                  )}
                </div>
                </div>
              )}
            </div>

            <aside className="settings-profile-sidebar space-y-6">
              <div className="rounded-[28px] border border-[#E7E4DE] bg-[#202534] p-6 text-white shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/45">
                      Business overview
                    </p>

                    <h2 className="mt-1 text-xl font-black">
                      Restaurant health
                    </h2>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-xl">
                    ✓
                  </div>
                </div>

                <div className="rounded-2xl bg-white/6 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70">
                      Menu status
                    </span>

                    <span className="font-black text-[#AEB7FF]">
                      Live
                    </span>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-white/70">
                      Profile completeness
                    </span>

                    <span className="font-black text-[#AEB7FF]">
                      {profileCompleteness}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#536DFE] via-[#536DFE] to-[#3E8E68] transition-all"
                      style={{
                        width:
                          `${profileCompleteness}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 text-[11px] text-white/60">
                    {completedProfileFields} of{' '}
                    {profileChecks.length}{' '}
                    fields configured
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.16em] text-white/45">
                    Main info
                  </div>

                  {[
                    [
                      'Address',
                      settings.address ||
                        'Not set',
                    ],
                    [
                      'Phone',
                      settings.phoneNumber ||
                        'Not set',
                    ],
                    [
                      'Mobile',
                      settings.mobileNumber ||
                        'Not set',
                    ],
                    [
                      'WhatsApp',
                      settings.whatsapp ||
                        'Not set',
                    ],
                    [
                      'Website',
                      settings.website
                        ? 'Configured'
                        : 'Not set',
                    ],
                  ].map(
                    ([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between rounded-2xl bg-white/6 px-3 py-2.5 text-xs"
                      >
                        <span className="text-white/65">
                          {label}
                        </span>

                        <span
                          className={
                            value ===
                            'Not set'
                              ? 'font-bold text-white/40'
                              : 'font-bold text-[#A8E7C2]'
                          }
                        >
                          {value}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div
                className="rounded-[28px] border p-6 shadow-sm"
                style={{
                  background:
                    theme.portal_surface,
                  borderColor:
                    theme.portal_border,
                  color:
                    theme.portal_text,
                }}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#756F66]">
                  Quick links
                </p>

                <div className="mt-4 space-y-3 text-sm">
                  {[
                    [
                      'Website',
                      settings.website,
                    ],
                    [
                      'Facebook',
                      settings.facebook,
                    ],
                    [
                      'Instagram',
                      settings.instagram,
                    ],
                    [
                      'Twitter / X',
                      settings.twitter,
                    ],
                  ].map(
                    ([label, href]) =>
                      href ? (
                        <a
                          key={label}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-2xl border p-3"
                          style={{
                            background:
                              theme.portal_background,
                            borderColor:
                              theme.portal_border,
                            color:
                              theme.portal_text,
                          }}
                        >
                          <span>
                            {label}
                          </span>

                          <span className="text-[#536DFE]">
                            ↗
                          </span>
                        </a>
                      ) : (
                        <div
                          key={label}
                          className="flex items-center justify-between rounded-2xl border p-3"
                          style={{
                            background:
                              theme.portal_background,
                            borderColor:
                              theme.portal_border,
                            color:
                              theme.portal_text,
                          }}
                          aria-disabled="true"
                        >
                          <span>
                            {label}
                          </span>

                          <span className="text-[10px] uppercase tracking-[0.12em]">
                            Not set
                          </span>
                        </div>
                      )
                  )}
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>

      {/* DEACTIVATION CONFIRMATION MODAL */}
      {showDeactivateModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#171613]/65 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              if (!deactivating) {
                setShowDeactivateModal(
                  false
                );
              }
            }
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-[30px] border shadow-[0_30px_100px_rgba(0,0,0,0.28)]"
            style={{
              background:
                theme.portal_surface,
              borderColor:
                theme.portal_border,
              color:
                theme.portal_text,
            }}
          >
            <div className="p-6 sm:p-7">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    background:
                      '#FBEDEA',
                    color:
                      '#A85C4A',
                  }}
                >
                  <AlertTriangle className="h-6 w-6" />
                </div>

                <div>
                  <p
                    className="text-[9px] font-black uppercase tracking-[0.18em]"
                    style={{
                      color:
                        '#A85C4A',
                    }}
                  >
                    Permanent account action
                  </p>

                  <h2 className="mt-1 text-2xl font-black tracking-tight">
                    Deactivate restaurant?
                  </h2>
                </div>
              </div>

              <div
                className="mt-6 rounded-[22px] border p-5"
                style={{
                  background:
                    theme.portal_background,
                  borderColor:
                    theme.portal_border,
                }}
              >
                <p className="text-sm font-semibold leading-6">
                  Are you sure you want to deactivate{' '}
                  <span className="font-black">
                    {restaurantName}
                  </span>
                  ?
                </p>

                <div className="mt-4 space-y-3 text-xs leading-5">
                  <div className="flex gap-3">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background:
                          theme.portal_accent,
                      }}
                    />

                    <span
                      style={{
                        color:
                          `${theme.portal_text}90`,
                      }}
                    >
                      Your paid Paddle subscription will be canceled at the end of the current billing period. Trial accounts are canceled immediately.
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background:
                          theme.portal_accent,
                      }}
                    />

                    <span
                      style={{
                        color:
                          `${theme.portal_text}90`,
                      }}
                    >
                      For paid subscriptions, your restaurant, menu, orders, settings, team records, and other data remain intact until the billing period ends. Trial account data is deleted immediately.
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background:
                          '#A85C4A',
                      }}
                    />

                    <span
                      className="font-semibold"
                      style={{
                        color:
                          '#A85C4A',
                      }}
                    >
                      After the scheduled date, the restaurant and its associated data will be permanently deleted.
                    </span>
                  </div>
                </div>
              </div>

              {deactivationError && (
                <div
                  className="mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold"
                  style={{
                    background:
                      '#FBEDEA',
                    borderColor:
                      '#E7C7C0',
                    color:
                      '#A85C4A',
                  }}
                >
                  {deactivationError}
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={deactivating}
                  onClick={() =>
                    setShowDeactivateModal(
                      false
                    )
                  }
                  className="rounded-2xl border px-5 py-3.5 text-xs font-black uppercase tracking-[0.14em] transition disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background:
                      theme.portal_surface,
                    borderColor:
                      theme.portal_border,
                    color:
                      theme.portal_text,
                  }}
                >
                  Keep restaurant
                </button>

                <button
                  type="button"
                  disabled={deactivating}
                  onClick={
                    handleDeactivate
                  }
                  className="rounded-2xl px-5 py-3.5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    background:
                      '#A85C4A',
                  }}
                >
                  {deactivating
                    ? 'Deactivating...'
                    : 'Yes, deactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
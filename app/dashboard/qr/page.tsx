'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { notifyRestaurantRealtimeSync, subscribeRestaurantRealtime } from '@/lib/live-sync';
import { AccessRestricted } from '@/app/dashboard/components/access-restricted';
import { DashboardLoader } from '@/app/dashboard/components/dashboard-loader';
import { PlanRequired } from '@/app/dashboard/components/plan-required';
import {
  subscriptionAllows,
  type BillingPlan,
  type SubscriptionStatus,
} from '@/lib/billing/plans';

type Palette = {
  id: string;
  name: string;
  description: string;
  background: string;
  card: string;
  text: string;
  muted: string;
  accent: string;
  qr: string;
};

const palettes: Palette[] = [
  {
    id: 'ivory',
    name: 'Ivory',
    description: 'Warm & elegant',
    background: '#F7F5F1',
    card: '#FFFDF9',
    text: '#202534',
    muted: '#77746E',
    accent: '#536DFE',
    qr: '#202534',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Luxury dining',
    background: '#0F1117',
    card: '#181B23',
    text: '#FFFFFF',
    muted: '#A9ADB8',
    accent: '#765BD5',
    qr: '#111111',
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Fresh & natural',
    background: '#ECF8F1',
    card: '#FBFDF9',
    text: '#253329',
    muted: '#748076',
    accent: '#3E8E68',
    qr: '#253329',
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    description: 'Warm Mediterranean',
    background: '#FFF1EC',
    card: '#FFF9F5',
    text: '#352722',
    muted: '#8C7469',
    accent: '#A85C4A',
    qr: '#352722',
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    description: 'Modern & bold',
    background: '#EEF0FF',
    card: '#FFFFFF',
    text: '#202534',
    muted: '#727991',
    accent: '#536DFE',
    qr: '#202534',
  },
  {
    id: 'espresso',
    name: 'Espresso',
    description: 'Rich & sophisticated',
    background: '#F7F5F1',
    card: '#FDFBF7',
    text: '#30251F',
    muted: '#82766E',
    accent: '#A85C4A',
    qr: '#30251F',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Cool & refined',
    background: '#E4EEF1',
    card: '#FAFDFC',
    text: '#203139',
    muted: '#70828A',
    accent: '#536DFE',
    qr: '#203139',
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Soft & stylish',
    background: '#F2E7E9',
    card: '#FFFDFD',
    text: '#35272C',
    muted: '#8C777E',
    accent: '#A85C4A',
    qr: '#35272C',
  },
];

const suggestions = [
  '#202534',
  '#536DFE',
  '#765BD5',
  '#536DFE',
  '#765BD5',
  '#3E8E68',
  '#A85C4A',
  '#A85C4A',
  '#536DFE',
  '#A85C4A',
  '#FFFFFF',
  '#F7F5F1',
  '#F7F5F1',
  '#ECF8F1',
  '#EEF0FF',
  '#FFF1EC',
];

type SavedDesign = {
  selectedPalette?: string;
  customColors?: {
    background: string;
    card: string;
    text: string;
    muted: string;
    accent: string;
    qr: string;
  };
  restaurantName?: string;
  headline?: string;
  subheadline?: string;
  showRestaurantName?: boolean;
  showHeadline?: boolean;
  showSubheadline?: boolean;
  showTable?: boolean;
  tableNumber?: string;
  logo?: string | null;
  format?: 'portrait' | 'square';
  publicMenuUrl?: string;
};

export default function QRStudioPage() {
  const [restaurantId, setRestaurantId] =
    useState<string | null>(null);
  
  const [canManageQR, setCanManageQR] =
    useState(false);

  const [planAllowed, setPlanAllowed] =
    useState(false);

  const [restaurantSlug, setRestaurantSlug] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [saveMessage, setSaveMessage] =
    useState('');

  const [selectedPalette, setSelectedPalette] =
    useState('ivory');

  const [customPalette, setCustomPalette] =
    useState<Palette | null>(null);

  const [showPaletteEditor, setShowPaletteEditor] =
    useState(false);

  const [customColors, setCustomColors] = useState({
    background: '#F7F5F1',
    card: '#FFFFFF',
    text: '#202534',
    muted: '#77746E',
    accent: '#536DFE',
    qr: '#202534',
  });

  const [restaurantName, setRestaurantName] =
    useState('La Piazza Restaurant');

  const [headline, setHeadline] =
    useState('Scan. Explore. Enjoy.');

  const [subheadline, setSubheadline] =
    useState('View our menu & order from your table');

  const [showRestaurantName, setShowRestaurantName] =
    useState(true);

  const [showHeadline, setShowHeadline] =
    useState(true);

  const [showSubheadline, setShowSubheadline] =
    useState(true);

  const [showTable, setShowTable] =
    useState(false);

  const [tableNumber, setTableNumber] =
    useState('12');

  const [logo, setLogo] =
    useState<string | null>(null);

  const [format, setFormat] =
    useState<'portrait' | 'square'>('portrait');

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  /*
   * =========================================================
   * GET RESTAURANT + LOAD SAVED DESIGN
   * =========================================================
   */

  const loadRestaurantAndDesign = useCallback(
    async () => {
      try {
        setLoading(true);

        setSaveMessage('');

        /*
         * Get logged-in user.
         */
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error(
            'You must be logged in to use QR Studio.'
          );
        }

        /*
         * Find the restaurant through restaurant_members.
         */
        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from('restaurant_members')
          .select('restaurant_id, role, position_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) {
          throw new Error(
            `Could not find your restaurant: ${membershipError.message}`
          );
        }

        if (!membership) {
          throw new Error(
            'No restaurant is associated with your account.'
          );
        }

        const currentRestaurantId =
          membership.restaurant_id;

        // =====================================================
        // SUBSCRIPTION ACCESS
        // =====================================================

        const { data: subscription } = await supabase
          .from('restaurant_subscriptions')
          .select('plan_code, status, trial_ends_at')
          .eq('restaurant_id', currentRestaurantId)
          .maybeSingle();

        const allowed = subscriptionAllows(
          subscription as {
            plan_code: BillingPlan;
            status: SubscriptionStatus;
            trial_ends_at: string;
          } | null,
          'qr'
        );

        setPlanAllowed(allowed);

        if (!allowed) {
          setLoading(false);
          return;
        }

        const currentRole =
          typeof membership.role === 'string'
            ? membership.role.toLowerCase().trim()
            : '';

        setRestaurantId(currentRestaurantId);

        if (['owner', 'admin'].includes(currentRole)) {
          setCanManageQR(true);
        } else if (!membership.position_id) {
          setCanManageQR(false);
        } else {
          const { data: roleData, error: roleError } =
            await supabase
              .from('restaurant_roles')
              .select('can_manage_qr_studio')
              .eq('id', membership.position_id)
              .eq('restaurant_id', currentRestaurantId)
              .maybeSingle();

          if (roleError) {
            throw new Error(
              `Could not load role permissions: ${roleError.message}`
            );
          }

          setCanManageQR(
            roleData?.can_manage_qr_studio === true
          );
        }

        /*
         * Get restaurant details.
         */
        const {
          data: restaurant,
          error: restaurantError,
        } = await supabase
          .from('restaurants')
          .select('id, name, slug')
          .eq('id', currentRestaurantId)
          .single();

        if (restaurantError || !restaurant) {
          throw new Error(
            `Could not load restaurant: ${
              restaurantError?.message ||
              'Restaurant not found'
            }`
          );
        }

        setRestaurantName(
          restaurant.name || 'Restaurant'
        );

        setRestaurantSlug(
          restaurant.slug || ''
        );

        /*
         * =====================================================
         * LOAD EXISTING QR DESIGN
         * =====================================================
         */

        const {
          data: savedDesignRow,
          error: designError,
        } = await supabase
          .from('restaurant_qr_designs')
          .select('design')
          .eq(
            'restaurant_id',
            currentRestaurantId
          )
          .maybeSingle();

        if (designError) {
          throw new Error(
            `Could not load QR design: ${designError.message}`
          );
        }

        /*
         * No saved design yet.
         * Keep the default designer values.
         */
        if (!savedDesignRow?.design) {
          setLoading(false);
          return;
        }

        const design =
          savedDesignRow.design as SavedDesign;

        /*
         * Restore all saved values.
         */

        if (design.selectedPalette) {
          setSelectedPalette(
            design.selectedPalette
          );
        }

        if (design.customColors) {
          setCustomColors({
            background:
              design.customColors.background ||
              '#F7F5F1',
            card:
              design.customColors.card ||
              '#FFFFFF',
            text:
              design.customColors.text ||
              '#202534',
            muted:
              design.customColors.muted ||
              '#77746E',
            accent:
              design.customColors.accent ||
              '#536DFE',
            qr:
              design.customColors.qr ||
              '#202534',
          });

          /*
           * Reconstruct custom palette.
           */
          setCustomPalette({
            id: 'custom',
            name: 'My Palette',
            description: 'Your own brand style',
            background:
              design.customColors.background ||
              '#F7F5F1',
            card:
              design.customColors.card ||
              '#FFFFFF',
            text:
              design.customColors.text ||
              '#202534',
            muted:
              design.customColors.muted ||
              '#77746E',
            accent:
              design.customColors.accent ||
              '#536DFE',
            qr:
              design.customColors.qr ||
              '#202534',
          });
        }

        if (
          design.restaurantName !== undefined
        ) {
          setRestaurantName(
            design.restaurantName
          );
        }

        if (
          design.headline !== undefined
        ) {
          setHeadline(
            design.headline
          );
        }

        if (
          design.subheadline !== undefined
        ) {
          setSubheadline(
            design.subheadline
          );
        }

        if (
          design.showRestaurantName !==
          undefined
        ) {
          setShowRestaurantName(
            design.showRestaurantName
          );
        }

        if (
          design.showHeadline !== undefined
        ) {
          setShowHeadline(
            design.showHeadline
          );
        }

        if (
          design.showSubheadline !== undefined
        ) {
          setShowSubheadline(
            design.showSubheadline
          );
        }

        if (
          design.showTable !== undefined
        ) {
          setShowTable(
            design.showTable
          );
        }

        if (
          design.tableNumber !== undefined
        ) {
          setTableNumber(
            design.tableNumber
          );
        }

        if (design.logo !== undefined) {
          setLogo(
            design.logo
          );
        }

        if (design.format) {
          setFormat(
            design.format
          );
        }
      } catch (error) {
        console.error(
          'Load QR design error:',
          error
        );

        setSaveMessage(
          error instanceof Error
            ? error.message
            : 'Could not load QR design.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRestaurantAndDesign();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadRestaurantAndDesign]);

  useEffect(() => {
    if (!restaurantId) {
      return;
    }

    return subscribeRestaurantRealtime(supabase, {
      restaurantId,
      name: 'dashboard-qr-studio',
      tables: ['restaurant_qr_designs', 'restaurant_roles'],
      onChange: loadRestaurantAndDesign,
    });
  }, [restaurantId, loadRestaurantAndDesign]);

  if (!loading && !planAllowed) {
    return (
      <PlanRequired
        featureName="QR Studio"
        requiredPlan="Starter"
      />
    );
  }
  
  if (!loading && !canManageQR) {
    return (
      <AccessRestricted
        title="QR Studio Access Restricted"
        description="You do not have permission to manage the restaurant QR design."
      />
    );
  }

  /*
   * =========================================================
   * PUBLIC MENU URL
   * =========================================================
   */

  const publicMenuUrl =
    typeof window !== 'undefined' &&
    restaurantSlug
      ? `${window.location.origin}/menu/${restaurantSlug}`
      : `https://novamenu.app/menu/${restaurantSlug}`;

  /*
   * =========================================================
   * PALETTE
   * =========================================================
   */

  const palette =
    selectedPalette === 'custom' &&
    customPalette
      ? customPalette
      : palettes.find(
          (p) =>
            p.id === selectedPalette
        ) || palettes[0];

  /*
   * =========================================================
   * QR VALUE
   * =========================================================
   */

  const qrValue = showTable
    ? `${publicMenuUrl}?table=${encodeURIComponent(
        tableNumber
      )}`
    : publicMenuUrl;

  /*
   * =========================================================
   * CUSTOM PALETTE
   * =========================================================
   */

  const applyCustomPalette = () => {
    const newPalette: Palette = {
      id: 'custom',
      name: 'My Palette',
      description: 'Your own brand style',
      background:
        customColors.background,
      card:
        customColors.card,
      text:
        customColors.text,
      muted:
        customColors.muted,
      accent:
        customColors.accent,
      qr:
        customColors.qr,
    };

    setCustomPalette(
      newPalette
    );

    setSelectedPalette(
      'custom'
    );

    setShowPaletteEditor(
      false
    );
  };

  const updateCustomColor = (
    key: keyof typeof customColors,
    value: string
  ) => {
    setCustomColors(
      (current) => ({
        ...current,
        [key]: value,
      })
    );
  };

  /*
   * =========================================================
   * LOGO
   * =========================================================
   */

  const handleLogo = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {
      setLogo(
        reader.result as string
      );
    };

    reader.readAsDataURL(
      file
    );
  };

  /*
   * =========================================================
   * SAVE DESIGN
   * =========================================================
   */

  const saveDesign = async () => {
  try {
    setSaving(true);
    setSaveMessage('');

    if (!restaurantId) {
      throw new Error('Restaurant not loaded.');
    }

    const design: SavedDesign = {
      selectedPalette,
      customColors,
      restaurantName,
      headline,
      subheadline,
      showRestaurantName,
      showHeadline,
      showSubheadline,
      showTable,
      tableNumber,
      logo,
      format,
    };

    const { error } = await supabase
      .from('restaurant_qr_designs')
      .upsert(
        {
          restaurant_id: restaurantId,
          design,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'restaurant_id',
        }
      );

    if (error) {
      throw new Error(
        `Could not save the QR design: ${error.message}`
      );
    }

    notifyRestaurantRealtimeSync(supabase, restaurantId, 'qr-studio');
    setSaveMessage('✓ QR design saved successfully.');
  } catch (error) {
    console.error('Save QR design error:', error);

    setSaveMessage(
      error instanceof Error
        ? error.message
        : 'Could not save the QR design.'
    );
  } finally {
    setSaving(false);
  }
};

  /*
   * =========================================================
   * CREATE HIGH-RES QR IMAGE
   * =========================================================
   */

  const createQRImage =
    async (): Promise<Blob> => {
      const card =
        document.getElementById(
          'qr-design-card'
        ) as HTMLElement | null;

      if (!card) {
        throw new Error(
          'QR design card not found'
        );
      }

      const { toPng } =
        await import(
          'html-to-image'
        );

      await new Promise<void>(
        (resolve) => {
          requestAnimationFrame(
            () => resolve()
          );
        }
      );

      const images =
        Array.from(
          card.querySelectorAll(
            'img'
          )
        );

      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>(
              (resolve) => {
                if (
                  img.complete
                ) {
                  resolve();
                  return;
                }

                img.onload =
                  () => resolve();

                img.onerror =
                  () => resolve();
              }
            )
        )
      );

      const rect =
        card.getBoundingClientRect();

      if (
        rect.width <= 0 ||
        rect.height <= 0
      ) {
        throw new Error(
          'Invalid QR design dimensions'
        );
      }

      const dataUrl =
        await toPng(card, {
          cacheBust: true,
          pixelRatio: 4,
          width: rect.width,
          height: rect.height,
          style: {
            margin: '0',
            transform: 'none',
          },
          backgroundColor:
            getComputedStyle(
              card
            ).backgroundColor,
          skipFonts: false,
        });

      const response =
        await fetch(dataUrl);

      if (!response.ok) {
        throw new Error(
          'Could not create PNG'
        );
      }

      const blob =
        await response.blob();

      if (!blob.size) {
        throw new Error(
          'Generated PNG is empty'
        );
      }

      return blob;
    };

  /*
   * =========================================================
   * DOWNLOAD
   * =========================================================
   */

  const downloadDesign =
    async () => {
      try {
        const blob =
          await createQRImage();

        const url =
          URL.createObjectURL(
            blob
          );

        const link =
          document.createElement(
            'a'
          );

        const safeName =
          restaurantName
            .trim()
            .replace(
              /[^a-zA-Z0-9]+/g,
              '-'
            )
            .replace(
              /^-|-$/g,
              ''
            )
            .toLowerCase();

        link.href = url;

        link.download =
          `${
            safeName ||
            'restaurant'
          }-qr-card.png`;

        document.body.appendChild(
          link
        );

        link.click();

        document.body.removeChild(
          link
        );

        setTimeout(() => {
          URL.revokeObjectURL(
            url
          );
        }, 1000);
      } catch (error) {
        console.error(
          'Download error:',
          error
        );

        alert(
          'Could not download the design. Please try again.'
        );
      }
    };

  /*
   * =========================================================
   * PRINT
   * =========================================================
   */

  const printDesign =
    async () => {
      try {
        const blob =
          await createQRImage();

        const imageUrl =
          URL.createObjectURL(
            blob
          );

        const iframe =
          document.createElement(
            'iframe'
          );

        iframe.style.position =
          'fixed';

        iframe.style.right =
          '0';

        iframe.style.bottom =
          '0';

        iframe.style.width =
          '0';

        iframe.style.height =
          '0';

        iframe.style.border =
          '0';

        iframe.style.visibility =
          'hidden';

        document.body.appendChild(
          iframe
        );

        const printDocument =
          iframe.contentWindow
            ?.document;

        if (
          !printDocument ||
          !iframe.contentWindow
        ) {
          URL.revokeObjectURL(
            imageUrl
          );

          document.body.removeChild(
            iframe
          );

          throw new Error(
            'Could not create print window'
          );
        }

        const printWidth =
          format === 'portrait'
            ? '10cm'
            : '12cm';

        const printHeight =
          format === 'portrait'
            ? '15cm'
            : '12cm';

        printDocument.open();

        printDocument.write(`
          <!DOCTYPE html>

          <html>

            <head>

              <meta charset="UTF-8" />

              <title>
                ${escapeHtml(
                  restaurantName
                )} QR
              </title>

              <style>

                * {
                  box-sizing: border-box;
                }

                html,
                body {
                  margin: 0 !important;
                  padding: 0 !important;

                  width: ${printWidth} !important;
                  height: ${printHeight} !important;

                  background: white !important;

                  overflow: hidden !important;
                }

                body {
                  display: block !important;
                }

                img {
                  display: block !important;

                  width: ${printWidth} !important;
                  height: ${printHeight} !important;

                  margin: 0 !important;
                  padding: 0 !important;

                  border: 0 !important;

                  object-fit: fill !important;
                }

                @page {
                  size:
                    ${printWidth}
                    ${printHeight};

                  margin: 0 !important;
                }

                @media print {

                  html,
                  body {
                    width:
                      ${printWidth} !important;

                    height:
                      ${printHeight} !important;

                    margin: 0 !important;
                    padding: 0 !important;

                    overflow: hidden !important;
                  }

                  img {
                    width:
                      ${printWidth} !important;

                    height:
                      ${printHeight} !important;

                    margin: 0 !important;
                    padding: 0 !important;
                  }

                }

              </style>

            </head>

            <body>

              <img
                id="qr-print-image"
                src="${imageUrl}"
                alt="NOVAMENU QR Design"
              />

            </body>

          </html>
        `);

        printDocument.close();

        const printImage =
          printDocument.getElementById(
            'qr-print-image'
          ) as HTMLImageElement | null;

        if (!printImage) {
          URL.revokeObjectURL(
            imageUrl
          );

          document.body.removeChild(
            iframe
          );

          throw new Error(
            'Print image was not created'
          );
        }

        let printed = false;

        const cleanup = () => {
          setTimeout(() => {
            URL.revokeObjectURL(
              imageUrl
            );

            if (
              iframe.parentNode
            ) {
              iframe.parentNode.removeChild(
                iframe
              );
            }
          }, 1000);
        };

        const doPrint = () => {
          if (printed) return;

          printed = true;

          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();

              iframe.contentWindow?.print();
            } finally {
              cleanup();
            }
          }, 300);
        };

        printImage.onload =
          doPrint;

        printImage.onerror =
          () => {
            cleanup();

            alert(
              'Could not prepare the design for printing. Please try again.'
            );
          };

        if (
          printImage.complete
        ) {
          doPrint();
        }
      } catch (error) {
        console.error(
          'Print error:',
          error
        );

        alert(
          'Could not prepare the design for printing. Please try again.'
        );
      }
    };

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{
        backgroundColor: 'var(--portal-background)',
        color: 'var(--portal-text)',
      }}
    >
      <div className="text-center">

        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black text-white shadow-lg"
          style={{
            backgroundColor: 'var(--portal-accent)',
          }}
        >
          N
        </div>

        <div
          className="mx-auto mt-5 h-5 w-5 animate-spin rounded-full border-2"
          style={{
            borderColor: 'var(--portal-border)',
            borderTopColor: 'var(--portal-accent)',
          }}
        />

        <p
          className="mt-3 text-sm font-semibold"
          style={{
            color: 'var(--portal-text)',
          }}
        >
          Loading your QR Studio...
        </p>

      </div>
    </div>
  );
}

  /*
   * =========================================================
   * UI
   * =========================================================
   */

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--portal-background)',
        color: 'var(--portal-text)',
      }}
    >
      {/* HEADER */}

      <header
  className="sticky top-0 z-50 border-b backdrop-blur-xl"
  style={{
    borderColor: 'var(--portal-border)',
    backgroundColor: 'color-mix(in srgb, var(--portal-surface) 92%, transparent)',
  }}
>
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between px-5 lg:px-8">

          <div className="flex items-center gap-3">

            <div
  className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white shadow-lg"
  style={{
    background: `linear-gradient(135deg, ${palette.accent}, ${palette.text})`,
  }}
>
  NS
</div>

            <div>

              <div className="text-sm font-black tracking-[0.18em]">
                NOVAMENU
              </div>

              <div
  className="text-[9px] font-semibold tracking-[0.18em]"
  style={{ color: 'var(--portal-text)', opacity: 0.6 }}
>
                QR STUDIO
              </div>

            </div>

          </div>

          <div className="flex items-center gap-3">

            {saveMessage && (
              <div
                className={`hidden rounded-xl px-4 py-2.5 text-xs font-bold sm:block ${
                  saveMessage.startsWith(
                    '✓'
                  )
                    ? 'bg-[#E9F6ED] text-[#39734A]'
                    : 'bg-[#FCEAEA] text-[#A14F4F]'
                }`}
              >
                {saveMessage}
              </div>
            )}

            <button
              onClick={
                saveDesign
              }
              disabled={saving}
              className="rounded-xl px-5 py-2.5 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
style={{ backgroundColor: 'var(--portal-accent)' }}
            >
              {saving
                ? 'Saving...'
                : 'Save Design'}
            </button>

          </div>

        </div>
      </header>

      {/* MOBILE SAVE MESSAGE */}

      {saveMessage && (
        <div className="px-4 pt-3 sm:hidden">
          <div
            className={`rounded-xl px-4 py-3 text-xs font-bold ${
              saveMessage.startsWith(
                '✓'
              )
                ? 'bg-[#E9F6ED] text-[#39734A]'
                : 'bg-[#FCEAEA] text-[#A14F4F]'
            }`}
          >
            {saveMessage}
          </div>
        </div>
      )}

      {/* MAIN */}

      <main className="mx-auto max-w-[1500px] px-4 py-5 lg:px-8">

        <div
  className="grid min-h-[calc(100vh-126px)] overflow-hidden rounded-[30px] border shadow-[0_25px_80px_rgba(32,37,52,0.07)] lg:grid-cols-[400px_1fr]"
  style={{
    borderColor: 'var(--portal-border)',
    backgroundColor: 'var(--portal-surface)',
  }}
>

          {/* LEFT SIDEBAR */}

          <aside
  className="border-b lg:border-b-0 lg:border-r"
  style={{
    borderColor: 'var(--portal-border)',
    backgroundColor: 'var(--portal-background)',
  }}
>

            <div className="h-full overflow-y-auto p-5 lg:p-6">

              <div className="mb-7">

                <div className="mb-2 flex items-center gap-2">

                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#536DFE]/10 text-[#536DFE]">
                    ✓
                  </span>

                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8A8E98]">
                    Design Studio
                  </span>

                </div>

                <h1 className="text-2xl font-black tracking-tight">
                  Make it yours.
                </h1>

                <p className="mt-1.5 text-sm leading-5 text-[#858994]">
                  Create a premium QR card
                  that matches your restaurant.
                </p>

              </div>

              {/* PALETTES */}

              <EditorSection
                number="01"
                title="Choose your style"
              >

                <div className="grid grid-cols-2 gap-3">

                  {palettes.map(
                    (item) => {

                      const active =
                        selectedPalette ===
                        item.id;

                      return (
                        <button
                          key={
                            item.id
                          }
                          onClick={() =>
                            setSelectedPalette(
                              item.id
                            )
                          }
                          className={`relative overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${
                            active
                              ? 'border-[#536DFE] shadow-md'
                              : 'border-[#E7E4DE]'
                          }`}
                        >

                          <div
                            className="relative h-[82px]"
                            style={{
                              backgroundColor:
                                item.background,
                            }}
                          >

                            <div
                              className="absolute left-1/2 top-1/2 h-[62px] w-[78px] -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-md"
                              style={{
                                backgroundColor:
                                  item.card,
                              }}
                            />

                            <div className="absolute bottom-2 left-2 flex gap-1">

                              <span
                                className="h-3.5 w-3.5 rounded-full border border-black/5"
                                style={{
                                  backgroundColor:
                                    item.background,
                                }}
                              />

                              <span
                                className="h-3.5 w-3.5 rounded-full border border-black/5"
                                style={{
                                  backgroundColor:
                                    item.card,
                                }}
                              />

                              <span
                                className="h-3.5 w-3.5 rounded-full border border-black/5"
                                style={{
                                  backgroundColor:
                                    item.accent,
                                }}
                              />

                            </div>

                          </div>

                          <div
  className="px-3 py-2.5"
  style={{
    backgroundColor: 'var(--portal-surface)',
  }}
>

                            <div className="text-xs font-bold">
                              {item.name}
                            </div>

                            <div
  className="mt-0.5 text-[10px]"
  style={{
    color: 'var(--portal-text)',
    opacity: 0.6,
  }}
>
                              {item.description}
                            </div>

                          </div>

                          {active && (
                            <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#536DFE] text-[11px] font-black text-white">
                              ✓
                            </div>
                          )}

                        </button>
                      );
                    }
                  )}

                </div>

                {customPalette && (
                  <button
                    onClick={() =>
                      setSelectedPalette(
                        'custom'
                      )
                    }
                    className={`mt-3 w-full overflow-hidden rounded-2xl border text-left ${
                      selectedPalette ===
                      'custom'
                        ? 'border-[#536DFE]'
                        : 'border-[#E7E4DE]'
                    }`}
                  >

                    <div
                      className="h-[75px]"
                      style={{
                        backgroundColor:
                          customPalette.background,
                      }}
                    />

                    <div
  className="px-3 py-2.5"
  style={{
    backgroundColor: 'var(--portal-surface)',
  }}
>

                      <div className="text-xs font-bold">
                        My Palette
                      </div>

                      <div className="text-[10px] text-[#756F66]">
                        Your own brand style
                      </div>

                    </div>

                  </button>
                )}

                <button
                  onClick={() =>
                    setShowPaletteEditor(
                      true
                    )
                  }
                  className="mt-3 flex w-full items-center justify-between rounded-2xl border border-dashed p-3.5 text-left hover:border-[var(--portal-accent)]"
style={{
  borderColor: 'var(--portal-border)',
  backgroundColor: 'var(--portal-surface)',
}}
                >

                  <div>

                    <div className="text-xs font-bold">
                      {customPalette
                        ? 'Edit your palette'
                        : 'Create your own palette'}
                    </div>

                    <div className="mt-1 text-[10px] text-[#756F66]">
                      Pick colors visually
                    </div>

                  </div>

                  <span className="text-lg text-[#8B8E97]">
                    ↗
                  </span>

                </button>

              </EditorSection>

              {/* CONTENT */}

              <EditorSection
                number="02"
                title="Your content"
              >

                <Input
                  label="Restaurant name"
                  value={
                    restaurantName
                  }
                  onChange={
                    setRestaurantName
                  }
                />

                <div className="mt-4">

                  <Input
                    label="Headline"
                    value={
                      headline
                    }
                    onChange={
                      setHeadline
                    }
                  />

                </div>

                <div className="mt-4">

                  <Input
                    label="Description"
                    value={
                      subheadline
                    }
                    onChange={
                      setSubheadline
                    }
                  />

                </div>

              </EditorSection>

              {/* LOGO */}

              <EditorSection
                number="03"
                title="Restaurant logo"
              >

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept="image/*"
                  onChange={
                    handleLogo
                  }
                  className="hidden"
                />

                {!logo ? (
                  <button
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="w-full rounded-2xl border border-dashed p-4 text-left hover:border-[var(--portal-accent)]"
style={{
  borderColor: 'var(--portal-border)',
  backgroundColor: 'var(--portal-surface)',
}}
                  >

                    <div className="text-sm font-bold">
                      ↗ Upload logo
                    </div>

                    <div className="mt-1 text-[11px] text-[#756F66]">
                      PNG, JPG or transparent
                      logo
                    </div>

                  </button>
                ) : (
                  <div className="flex items-center justify-between rounded-2xl border p-3"
style={{
  borderColor: 'var(--portal-border)',
  backgroundColor: 'var(--portal-surface)',
}}>

                    <div className="flex items-center gap-3">

                      <img
                        src={
                          logo
                        }
                        className="h-12 w-12 rounded-xl object-contain"
                        alt="Logo"
                      />

                      <div className="text-sm font-bold">
                        Logo added
                      </div>

                    </div>

                    <button
                      onClick={() =>
                        setLogo(
                          null
                        )
                      }
                      className="text-xs font-bold text-[#A16A6A]"
                    >
                      Remove
                    </button>

                  </div>
                )}

              </EditorSection>

              {/* ELEMENTS */}

              <EditorSection
                number="04"
                title="Elements"
              >

                <div className="space-y-3">

                  <Toggle
                    label="Restaurant name"
                    checked={
                      showRestaurantName
                    }
                    onChange={
                      setShowRestaurantName
                    }
                  />

                  <Toggle
                    label="Headline"
                    checked={
                      showHeadline
                    }
                    onChange={
                      setShowHeadline
                    }
                  />

                  <Toggle
                    label="Description"
                    checked={
                      showSubheadline
                    }
                    onChange={
                      setShowSubheadline
                    }
                  />

                </div>

              </EditorSection>

              {/* TABLE */}

              <EditorSection
                number="05"
                title="Table QR"
              >

                <Toggle
                  label="Use table number"
                  description="Optional — use one QR per table"
                  checked={
                    showTable
                  }
                  onChange={
                    setShowTable
                  }
                />

                {showTable && (
                  <input
                    value={
                      tableNumber
                    }
                    onChange={(e) =>
                      setTableNumber(
                        e.target.value
                      )
                    }
                    className="mt-3 h-10 w-full rounded-xl border px-3 text-sm font-bold outline-none focus:border-[var(--portal-accent)]"
style={{
  borderColor: 'var(--portal-border)',
  backgroundColor: 'var(--portal-surface)',
  color: 'var(--portal-text)',
}}
                    placeholder="Table number"
                  />
                )}

              </EditorSection>

              {/* FORMAT */}

              <EditorSection
                number="06"
                title="Print format"
              >

                <div className="grid grid-cols-2 gap-2">

                  <FormatButton
                    active={
                      format ===
                      'portrait'
                    }
                    title="Table Card"
                    subtitle="10 × 15 cm"
                    onClick={() =>
                      setFormat(
                        'portrait'
                      )
                    }
                  />

                  <FormatButton
                    active={
                      format ===
                      'square'
                    }
                    title="Square"
                    subtitle="12 × 12 cm"
                    onClick={() =>
                      setFormat(
                        'square'
                      )
                    }
                  />

                </div>

              </EditorSection>

            </div>

          </aside>

          {/* PREVIEW */}

          <section
            className="relative flex min-h-[760px] flex-col overflow-hidden"
            style={{
              backgroundColor:
                palette.background,
            }}
          >

            <div className="flex items-center justify-between px-6 py-5">

              <div>

                <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-45">
                  Live Preview
                </div>

                <div
                  className="mt-1 text-sm font-bold"
                  style={{
                    color:
                      palette.text,
                  }}
                >
                  Your printed QR card
                </div>

              </div>

              <div
  className="rounded-xl border p-1"
  style={{
    borderColor: 'var(--portal-border)',
    backgroundColor: 'color-mix(in srgb, var(--portal-surface) 70%, transparent)',
  }}
>

                <button
                  onClick={() =>
                    setFormat(
                      'portrait'
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-[10px] font-bold ${
                    format === 'portrait'
  ? 'shadow-sm'
  : 'opacity-50'
                  }`}
                >
                  Card
                </button>

                <button
                  onClick={() =>
                    setFormat(
                      'square'
                    )
                  }
                  className={`rounded-lg px-3 py-2 text-[10px] font-bold ${
                    format === 'square'
  ? 'shadow-sm'
  : 'opacity-50'
                  }`}
                >
                  Square
                </button>

              </div>

            </div>

            {/* CARD */}

            <div className="flex flex-1 items-center justify-center px-5 pb-8">

              <div
                id="qr-design-card"
                className={`relative overflow-hidden shadow-[0_35px_100px_rgba(25,30,45,0.20)] ${
                  format ===
                  'portrait'
                    ? 'h-[570px] w-[380px]'
                    : 'h-[440px] w-[440px]'
                }`}
                style={{
                  backgroundColor:
                    palette.card,
                  color:
                    palette.text,
                  borderRadius:
                    '30px',
                }}
              >

                <div
                  className="pointer-events-none absolute inset-3 rounded-[25px] border"
                  style={{
                    borderColor:
                      palette.accent,
                    opacity:
                      0.22,
                  }}
                />

                <div className="relative flex h-full flex-col items-center px-10 py-10 text-center">

                  <Logo
                    logo={logo}
                    restaurantName={
                      restaurantName
                    }
                    accent={
                      palette.accent
                    }
                    small={
                      format ===
                      'square'
                    }
                  />

                  {showRestaurantName && (
                    <div
                      className="mt-3 text-[9px] font-black uppercase tracking-[0.2em]"
                      style={{
                        color:
                          palette.accent,
                      }}
                    >
                      {
                        restaurantName
                      }
                    </div>
                  )}

                  {showHeadline && (
                    <h2
                      className={`font-black leading-[1.08] tracking-tight ${
                        format ===
                        'portrait'
                          ? 'mt-4 text-[25px]'
                          : 'mt-3 text-[20px]'
                      }`}
                      style={{
                        color:
                          palette.text,
                      }}
                    >
                      {
                        headline
                      }
                    </h2>
                  )}

                  {showSubheadline && (
                    <p
                      className="mt-2 max-w-[260px] text-[10px] leading-4"
                      style={{
                        color:
                          palette.muted,
                      }}
                    >
                      {
                        subheadline
                      }
                    </p>
                  )}

                  {/* QR */}

                  <div
                    className={`rounded-[22px] bg-white shadow-[0_12px_35px_rgba(20,25,35,0.12)] ${
                      format ===
                      'portrait'
                        ? 'mt-7 p-5'
                        : 'mt-5 p-5'
                    }`}
                  >

                    <QRCodeSVG
                      id="novamenu-download-qr"
                      value={
                        qrValue
                      }
                      size={
                        format ===
                        'portrait'
                          ? 165
                          : 125
                      }
                      level="H"
                      includeMargin
                      bgColor="#FFFFFF"
                      fgColor={
                        palette.qr
                      }
                    />

                  </div>

                  {showTable && (
                    <div
                      className="mt-4 rounded-full px-4 py-1.5 text-[8px] font-black uppercase tracking-[0.14em]"
                      style={{
                        backgroundColor:
                          `${palette.accent}18`,
                        color:
                          palette.accent,
                      }}
                    >
                      TABLE{' '}
                      {
                        tableNumber
                      }
                    </div>
                  )}

                  {/* FOOTER */}

                  <div className="mt-auto pb-1 pt-6">

                    <div
                      className="mx-auto mb-3 h-px w-9"
                      style={{
                        backgroundColor:
                          palette.accent,
                        opacity:
                          0.35,
                      }}
                    />

                    <div
                      className="text-[8px] font-semibold uppercase tracking-[0.16em]"
                      style={{
                        color:
                          palette.muted,
                        opacity:
                          0.65,
                      }}
                    >
                      Scan with your phone
                    </div>

                    <div
                      className="mt-2 text-[7px] font-semibold tracking-wide"
                      style={{
                        color:
                          palette.muted,
                        opacity:
                          0.4,
                      }}
                    >
                      Powered by Novera Labs
                    </div>

                  </div>

                </div>

              </div>

            </div>

            {/* ACTIONS */}

            <div
  className="border-t px-5 py-4 backdrop-blur-xl"
  style={{
    borderColor: 'var(--portal-border)',
    backgroundColor: 'color-mix(in srgb, var(--portal-surface) 80%, transparent)',
  }}
>

              <div className="flex gap-2 sm:justify-end">

                <button
                  onClick={
                    downloadDesign
                  }
                  className="flex flex-1 items-center justify-center rounded-xl px-5 py-3 text-xs font-bold text-white transition hover:opacity-90 sm:flex-none"
style={{
  backgroundColor: 'var(--portal-accent)',
}}
                >
                  ↗ Download PNG
                </button>

                <button
                  onClick={
                    printDesign
                  }
                  className="flex flex-1 items-center justify-center rounded-xl border px-5 py-3 text-xs font-bold transition hover:border-[var(--portal-accent)] sm:flex-none"
style={{
  borderColor: 'var(--portal-border)',
  backgroundColor: 'var(--portal-surface)',
  color: 'var(--portal-text)',
}}
                >
                  ⎙ Print
                </button>

              </div>

            </div>

          </section>

        </div>

      </main>

      {/* CUSTOM PALETTE MODAL */}

      {showPaletteEditor && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#151923]/55 p-4 backdrop-blur-md">

          <div
  className="w-full max-w-[820px] overflow-hidden rounded-[30px] shadow-[0_40px_120px_rgba(0,0,0,0.25)]"
  style={{
    backgroundColor: 'var(--portal-background)',
    color: 'var(--portal-text)',
  }}
>

            <div
  className="flex items-center justify-between border-b px-6 py-5"
  style={{
    borderColor: 'var(--portal-border)',
    backgroundColor: 'var(--portal-surface)',
  }}
>

              <div>

                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8C909A]">
                  Brand Studio
                </div>

                <h2 className="mt-1 text-lg font-black">
                  Create your own palette
                </h2>

              </div>

              <button
                onClick={() =>
                  setShowPaletteEditor(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F3EDE3] text-lg"
              >
                ×
              </button>

            </div>

            <div className="grid max-h-[75vh] overflow-y-auto lg:grid-cols-2">

              {/* COLORS */}

              <div className="p-6">

                <p className="mb-5 text-xs leading-5"
style={{
  color: 'var(--portal-text)',
  opacity: 0.6,
}}>
                  Pick colors visually.
                  No HEX knowledge needed.
                </p>

                <ColorPicker
                  title="Background"
                  value={
                    customColors.background
                  }
                  onChange={(v) =>
                    updateCustomColor(
                      'background',
                      v
                    )
                  }
                />

                <ColorPicker
                  title="Card"
                  value={
                    customColors.card
                  }
                  onChange={(v) =>
                    updateCustomColor(
                      'card',
                      v
                    )
                  }
                />

                <ColorPicker
                  title="Text"
                  value={
                    customColors.text
                  }
                  onChange={(v) =>
                    updateCustomColor(
                      'text',
                      v
                    )
                  }
                />

                <ColorPicker
                  title="Accent"
                  value={
                    customColors.accent
                  }
                  onChange={(v) =>
                    updateCustomColor(
                      'accent',
                      v
                    )
                  }
                />

                <ColorPicker
                  title="QR"
                  value={
                    customColors.qr
                  }
                  onChange={(v) =>
                    updateCustomColor(
                      'qr',
                      v
                    )
                  }
                />

              </div>

              {/* CUSTOM PREVIEW */}

              <div
                className="flex min-h-[500px] items-center justify-center p-7"
                style={{
                  backgroundColor:
                    customColors.background,
                }}
              >

                <div
                  className="w-[250px] rounded-[28px] p-7 text-center shadow-[0_25px_70px_rgba(25,30,45,0.2)]"
                  style={{
                    backgroundColor:
                      customColors.card,
                    color:
                      customColors.text,
                  }}
                >

                  <div
                    className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black"
                    style={{
                      backgroundColor:
                        `${customColors.accent}18`,
                      color:
                        customColors.accent,
                    }}
                  >
                    L
                  </div>

                  <div
                    className="mt-3 text-[8px] font-black uppercase tracking-[0.2em]"
                    style={{
                      color:
                        customColors.accent,
                    }}
                  >
                    LA PIAZZA
                  </div>

                  <div className="mt-3 text-lg font-black">
                    Scan. Explore.
                    Enjoy.
                  </div>

                  <div
                    className="mt-1.5 text-[8px]"
                    style={{
                      color:
                        customColors.muted,
                    }}
                  >
                    View our menu &
                    order from your table
                  </div>

                  <div className="mx-auto mt-5 w-fit rounded-[18px] bg-white p-4 shadow-lg">

                    <QRCodeSVG
                      value={
                        publicMenuUrl
                      }
                      size={125}
                      level="H"
                      includeMargin
                      bgColor="#FFFFFF"
                      fgColor={
                        customColors.qr
                      }
                    />

                  </div>

                  <div
                    className="mt-4 text-[7px] font-bold uppercase tracking-[0.16em]"
                    style={{
                      color:
                        customColors.muted,
                    }}
                  >
                    Scan with your phone
                  </div>

                </div>

              </div>

            </div>

            {/* MODAL ACTIONS */}

            <div className="flex justify-end gap-2 border-t border-[#E7E4DE] bg-white px-6 py-4">

              <button
                onClick={() =>
                  setShowPaletteEditor(
                    false
                  )
                }
                className="rounded-xl border border-[#DDDAD4] px-5 py-2.5 text-xs font-bold"
              >
                Cancel
              </button>

              <button
                onClick={
                  applyCustomPalette
                }
                className="rounded-xl bg-[#202534] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#536DFE]"
              >
                Apply palette
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function escapeHtml(
  value: string
) {
  return value
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}

/* =========================================================
   COMPONENTS
========================================================= */

function EditorSection({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7">

      <div className="mb-3 flex items-center gap-2">

        <span className="text-[9px] font-black tracking-widest"
style={{ color: 'var(--portal-text)', opacity: 0.45 }}>
          {number}
        </span>

        <span className="h-px w-4"
style={{ backgroundColor: 'var(--portal-border)' }} />

        <h2
  className="text-xs font-black uppercase tracking-[0.12em]"
  style={{ color: 'var(--portal-text)' }}
>
          {title}
        </h2>

      </div>

      {children}

    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>

      <label
  className="mb-2 block text-[11px] font-bold uppercase tracking-wider"
  style={{
    color: 'var(--portal-text)',
    opacity: 0.6,
  }}
>
        {label}
      </label>

      <input
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        className="h-11 w-full rounded-xl border px-3.5 text-sm font-medium outline-none focus:border-[var(--portal-accent)]"
style={{
  borderColor: 'var(--portal-border)',
  backgroundColor: 'var(--portal-surface)',
  color: 'var(--portal-text)',
}}
      />

    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (
    value: boolean
  ) => void;
}) {
  return (
    <button
      onClick={() =>
        onChange(!checked)
      }
      className="flex w-full items-center justify-between text-left"
    >

      <div>

        <div className="text-sm font-semibold">
          {label}
        </div>

        {description && (
          <div className="mt-0.5 text-[10px] leading-4 text-[#756F66]">
            {description}
          </div>
        )}

      </div>

      <div
        className={`relative h-6 w-11 rounded-full transition ${
          checked
            ? 'bg-[#536DFE]'
            : 'bg-[#E8E7E4]'
        }`}
      >

        <div
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${
            checked
              ? 'left-6'
              : 'left-1'
          }`}
        />

      </div>

    </button>
  );
}

function FormatButton({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border p-3 text-left transition"
      style={{
        borderColor: active
          ? 'var(--portal-accent)'
          : 'var(--portal-border)',
        backgroundColor: active
          ? 'color-mix(in srgb, var(--portal-accent) 10%, var(--portal-surface))'
          : 'var(--portal-surface)',
        color: 'var(--portal-text)',
      }}
    >
      <div className="text-xs font-bold">
        {title}
      </div>

      <div
        className="mt-1 text-[10px]"
        style={{
          color: 'var(--portal-text)',
          opacity: 0.6,
        }}
      >
        {subtitle}
      </div>
    </button>
  );
}

function Logo({
  logo,
  restaurantName,
  accent,
  small = false,
}: {
  logo: string | null;
  restaurantName: string;
  accent: string;
  small?: boolean;
}) {
  if (logo) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-white p-2 shadow-sm ${
          small
            ? 'h-11 w-11'
            : 'h-14 w-14'
        }`}
      >

        <img
          src={logo}
          alt="Restaurant logo"
          className="max-h-full max-w-full object-contain"
        />

      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-2xl font-black ${
        small
          ? 'h-11 w-11 text-sm'
          : 'h-14 w-14 text-lg'
      }`}
      style={{
        backgroundColor:
          `${accent}18`,
        color: accent,
      }}
    >
      {restaurantName
        .charAt(0)
        .toUpperCase()}
    </div>
  );
}

function ColorPicker({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div
  className="mb-5 rounded-2xl border p-4"
  style={{
    borderColor: 'var(--portal-border)',
    backgroundColor: 'var(--portal-surface)',
    color: 'var(--portal-text)',
  }}
>

      <div className="flex items-center justify-between">

        <div className="text-xs font-black">
          {title}
        </div>

        <label
          className="h-10 w-10 cursor-pointer rounded-xl border border-[#E1DED8] shadow-sm"
          style={{
            backgroundColor:
              value,
          }}
        >

          <input
            type="color"
            value={value}
            onChange={(e) =>
              onChange(
                e.target.value
              )
            }
            className="h-full w-full cursor-pointer opacity-0"
          />

        </label>

      </div>

      <div className="mt-3 flex flex-wrap gap-2">

        {suggestions.map(
          (color) => (
            <button
              key={color}
              onClick={() =>
                onChange(
                  color
                )
              }
              className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
                value.toLowerCase() ===
                color.toLowerCase()
                  ? 'border-[#536DFE] ring-2 ring-[#536DFE]/15'
                  : 'border-white shadow-sm'
              }`}
              style={{
                backgroundColor:
                  color,
              }}
              title="Choose color"
            />
          )
        )}

      </div>

    </div>
  );
}

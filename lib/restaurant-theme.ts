import type { SupabaseClient } from '@supabase/supabase-js';

export type RestaurantThemeId =
  | 'novera-blue'
  | 'pearl'
  | 'midnight'
  | 'noir-gold'
  | 'royal'
  | 'forest'
  | 'ocean';

export type RestaurantTheme = {
  theme_id: RestaurantThemeId;
  portal_background: string;
  portal_surface: string;
  portal_text: string;
  portal_border: string;
  portal_accent: string;
  portal_accent_soft: string;
  public_background: string;
  public_surface: string;
  public_hero_background: string;
  public_text: string;
  public_border: string;
  public_accent: string;
  public_accent_soft: string;
  public_button_text: string;
};

export const restaurantThemePresets: Record<RestaurantThemeId, RestaurantTheme> = {
  'novera-blue': {
    theme_id: 'novera-blue',
    portal_background: '#F7F5F1',
    portal_surface: '#FFFFFF',
    portal_text: '#202534',
    portal_border: '#E7E4DE',
    portal_accent: '#536DFE',
    portal_accent_soft: '#EEF0FF',
    public_background: '#F7F5F1',
    public_surface: '#FFFFFF',
    public_hero_background: '#1E2B4A',
    public_text: '#202534',
    public_border: '#E7E4DE',
    public_accent: '#536DFE',
    public_accent_soft: '#EEF0FF',
    public_button_text: '#FFFFFF',
  },
  pearl: {
    theme_id: 'pearl',
    portal_background: '#F5F8F8',
    portal_surface: '#FFFFFF',
    portal_text: '#22363A',
    portal_border: '#DFE9E8',
    portal_accent: '#4F9D9B',
    portal_accent_soft: '#E7F5F3',
    public_background: '#F5F8F8',
    public_surface: '#FFFFFF',
    public_hero_background: '#DDEAE8',
    public_text: '#22363A',
    public_border: '#DFE9E8',
    public_accent: '#4F9D9B',
    public_accent_soft: '#E7F5F3',
    public_button_text: '#FFFFFF',
  },
  midnight: {
    theme_id: 'midnight',
    portal_background: '#0B1220',
    portal_surface: '#101A2D',
    portal_text: '#EAF2FF',
    portal_border: '#1C2A40',
    portal_accent: '#7AA5FF',
    portal_accent_soft: '#1E3359',
    public_background: '#0B1220',
    public_surface: '#101A2D',
    public_hero_background: '#142C46',
    public_text: '#EAF2FF',
    public_border: '#1C2A40',
    public_accent: '#7AA5FF',
    public_accent_soft: '#1E3359',
    public_button_text: '#FFFFFF',
  },
  'noir-gold': {
    theme_id: 'noir-gold',
    portal_background: '#121212',
    portal_surface: '#1B1B1A',
    portal_text: '#F4E7CF',
    portal_border: '#322D28',
    portal_accent: '#C9A76A',
    portal_accent_soft: '#382F24',
    public_background: '#121212',
    public_surface: '#1B1B1A',
    public_hero_background: '#2A231C',
    public_text: '#F4E7CF',
    public_border: '#322D28',
    public_accent: '#C9A76A',
    public_accent_soft: '#382F24',
    public_button_text: '#121212',
  },
  royal: {
    theme_id: 'royal',
    portal_background: '#F5F1FF',
    portal_surface: '#FFFFFF',
    portal_text: '#2E2242',
    portal_border: '#E4DDF8',
    portal_accent: '#7C6BC9',
    portal_accent_soft: '#F1E9FF',
    public_background: '#F5F1FF',
    public_surface: '#FFFFFF',
    public_hero_background: '#DCD2F4',
    public_text: '#2E2242',
    public_border: '#E4DDF8',
    public_accent: '#7C6BC9',
    public_accent_soft: '#F1E9FF',
    public_button_text: '#FFFFFF',
  },
  forest: {
    theme_id: 'forest',
    portal_background: '#F5F9F4',
    portal_surface: '#FBFFFB',
    portal_text: '#21362D',
    portal_border: '#D7E8D8',
    portal_accent: '#5E8C6A',
    portal_accent_soft: '#EAF5EC',
    public_background: '#F5F9F4',
    public_surface: '#FBFFFB',
    public_hero_background: '#DEEEDC',
    public_text: '#21362D',
    public_border: '#D7E8D8',
    public_accent: '#5E8C6A',
    public_accent_soft: '#EAF5EC',
    public_button_text: '#FFFFFF',
  },
  ocean: {
    theme_id: 'ocean',
    portal_background: '#F4FAFD',
    portal_surface: '#FFFFFF',
    portal_text: '#18364B',
    portal_border: '#D9EBF5',
    portal_accent: '#3D96B8',
    portal_accent_soft: '#DDF4FB',
    public_background: '#F4FAFD',
    public_surface: '#FFFFFF',
    public_hero_background: '#D7ECF5',
    public_text: '#18364B',
    public_border: '#D9EBF5',
    public_accent: '#3D96B8',
    public_accent_soft: '#DDF4FB',
    public_button_text: '#FFFFFF',
  },
};

export const restaurantThemeOptions = Object.values(restaurantThemePresets).map((theme) => ({
  id: theme.theme_id,
  name: theme.theme_id
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' '),
  palette: theme,
}));

export const defaultRestaurantTheme: RestaurantTheme = restaurantThemePresets['novera-blue'];

export function getRestaurantThemeById(themeId?: string | null): RestaurantTheme {
  if (themeId && restaurantThemePresets[themeId as RestaurantThemeId]) {
    return { ...restaurantThemePresets[themeId as RestaurantThemeId] };
  }

  return { ...defaultRestaurantTheme };
}

export function normalizeRestaurantTheme(
  raw?: Partial<RestaurantTheme> | null
): RestaurantTheme {
  if (!raw) {
    return { ...defaultRestaurantTheme };
  }

  const paletteKeys = [
    'portal_background',
    'portal_surface',
    'portal_text',
    'portal_border',
    'portal_accent',
    'portal_accent_soft',
    'public_background',
    'public_surface',
    'public_hero_background',
    'public_text',
    'public_border',
    'public_accent',
    'public_accent_soft',
    'public_button_text',
  ] as const;

  const hasCompletePalette = paletteKeys.every(
    (key) =>
      typeof raw[key] === 'string' &&
      raw[key]?.trim()
  );

  if (!hasCompletePalette) {
    return { ...defaultRestaurantTheme };
  }

  const palette = Object.fromEntries(
    paletteKeys.map((key) => [key, raw[key]])
  ) as Omit<RestaurantTheme, 'theme_id'>;

  // Match the saved palette to one of the predefined themes.
  const matchingPreset = Object.values(restaurantThemePresets).find((preset) =>
    paletteKeys.every(
      (key) => preset[key].toLowerCase() === palette[key].toLowerCase()
    )
  );

  if (matchingPreset) {
    return {
      ...matchingPreset,
    };
  }

  // If the database contains a custom palette,
  // preserve it instead of throwing it away.
  return {
    theme_id: 'novera-blue',
    ...palette,
  };
}

export function setStoredRestaurantTheme(
  restaurantId: string,
  theme: RestaurantTheme
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    `nova-theme-${restaurantId}`,
    JSON.stringify(theme)
  );
}

export function resetStoredRestaurantTheme(
  restaurantId: string
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(
    `nova-theme-${restaurantId}`
  );
}

export function getStoredRestaurantTheme(
  restaurantId: string
): RestaurantTheme | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(
      `nova-theme-${restaurantId}`
    );

    if (!raw) {
      return null;
    }

    return normalizeRestaurantTheme(
      JSON.parse(raw)
    );
  } catch {
    return null;
  }
}

export function applyRestaurantTheme(
  theme: RestaurantTheme
) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;

  const values = {
    '--portal-background': theme.portal_background,
    '--portal-surface': theme.portal_surface,
    '--portal-text': theme.portal_text,
    '--portal-border': theme.portal_border,
    '--portal-accent': theme.portal_accent,
    '--portal-accent-soft': theme.portal_accent_soft,
    '--portal-muted': '#756F66',
    '--portal-success-bg': '#ECF8F1',
    '--portal-success-text': '#3E8E68',
    '--portal-error-bg': '#FFF1EC',
    '--portal-error-text': '#A85C4A',
    '--portal-disabled-bg': '#E8E7E4',
    '--portal-disabled-text': '#9A9892',
    '--public-background': theme.public_background,
    '--public-surface': theme.public_surface,
    '--public-hero-background': theme.public_hero_background,
    '--public-text': theme.public_text,
    '--public-border': theme.public_border,
    '--public-accent': theme.public_accent,
    '--public-accent-soft': theme.public_accent_soft,
    '--public-button-text': theme.public_button_text,
  };

  Object.entries(values).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export async function loadRestaurantTheme(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<RestaurantTheme> {
  try {
    const { data, error } = await supabase
      .from('restaurant_themes')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (!error && data) {
      const theme = normalizeRestaurantTheme(data as Partial<RestaurantTheme>);
      setStoredRestaurantTheme(restaurantId, theme);
      return theme;
    }
  } catch (error) {
    console.error('Restaurant theme load failed:', error);
  }

  const stored = getStoredRestaurantTheme(restaurantId);
  return stored || { ...defaultRestaurantTheme };
}

export async function saveRestaurantTheme(
  supabase: SupabaseClient,
  restaurantId: string,
  theme: RestaurantTheme
) {
  const {
    theme_id,
    ...palette
  } = theme;

  const payload = {
    restaurant_id: restaurantId,
    ...palette,
  };

  setStoredRestaurantTheme(restaurantId, theme);

  try {
    const result = await supabase
      .from('restaurant_themes')
      .upsert(payload, { onConflict: 'restaurant_id' })
      .select()
      .single();

    return result;
  } catch (error) {
    console.error('Theme save failed:', error);

    return {
      data: payload,
      error: null,
    };
  }
}

export function subscribeRestaurantTheme(
  supabase: SupabaseClient,
  restaurantId: string,
  onChange: (theme: RestaurantTheme) => void
) {
  const channelName = `restaurant-theme-${restaurantId}-${crypto.randomUUID()}`;

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'restaurant_themes',
        filter: `restaurant_id=eq.${restaurantId}`,
      },
      async () => {
        const next = await loadRestaurantTheme(supabase, restaurantId);
        onChange(next);
        applyRestaurantTheme(next);
      }
    );

  channel.subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

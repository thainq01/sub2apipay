import type { ScreenType } from '@/stores/screen';

/**
 * Parameters that should be preserved across screen navigation
 */
const PRESERVED_PARAMS = [
  'token',
  'theme',
  'lang',
  'ui_mode',
  'src_host',
  'src_url',
] as const;

/**
 * Screen-specific params that should only be included when navigating to that screen
 */
const SCREEN_SPECIFIC_PARAMS: Record<ScreenType, string[]> = {
  home: [],
  pay: ['resume_order', 'amount', 'tab'],
  orders: ['filter', 'page', 'page_size'],
  subscriptions: ['resume_order'],
};

export interface ScreenNavParams {
  screen: ScreenType;
  token?: string | null;
  theme?: string | null;
  lang?: string | null;
  ui_mode?: string | null;
  src_host?: string | null;
  src_url?: string | null;
  // Screen-specific params
  resume_order?: string | null;
  amount?: string | number | null;
  tab?: string | null;
  filter?: string | null;
  page?: string | number | null;
  page_size?: string | number | null;
}

/**
 * Build URL for screen navigation with all preserved params
 */
export function buildScreenUrl(params: ScreenNavParams): string {
  const url = new URLSearchParams();

  // Set screen
  url.set('screen', params.screen);

  // Preserve common params
  if (params.token) url.set('token', params.token);
  if (params.theme) url.set('theme', params.theme);
  if (params.lang === 'en') url.set('lang', 'en');
  if (params.ui_mode) url.set('ui_mode', params.ui_mode);
  if (params.src_host) url.set('src_host', params.src_host);
  if (params.src_url) url.set('src_url', params.src_url);

  // Screen-specific params
  const allowedSpecific = SCREEN_SPECIFIC_PARAMS[params.screen];

  if (allowedSpecific.includes('resume_order') && params.resume_order) {
    url.set('resume_order', params.resume_order);
  }
  if (allowedSpecific.includes('amount') && params.amount != null) {
    url.set('amount', String(params.amount));
  }
  if (allowedSpecific.includes('tab') && params.tab) {
    url.set('tab', params.tab);
  }
  if (allowedSpecific.includes('filter') && params.filter && params.filter !== 'ALL') {
    url.set('filter', params.filter);
  }
  if (allowedSpecific.includes('page') && params.page != null && Number(params.page) > 1) {
    url.set('page', String(params.page));
  }
  if (allowedSpecific.includes('page_size') && params.page_size != null) {
    url.set('page_size', String(params.page_size));
  }

  return `/app?${url.toString()}`;
}

/**
 * Navigate to a screen without page reload using History API
 */
export function navigateToScreen(params: ScreenNavParams): void {
  const url = buildScreenUrl(params);
  window.history.pushState({ screen: params.screen }, '', url);

  // Dispatch a custom event so ScreenRouter can react
  window.dispatchEvent(new CustomEvent('screen-navigate', { detail: params }));
}

/**
 * Replace current history entry (for initial load or corrections)
 */
export function replaceScreenUrl(params: ScreenNavParams): void {
  const url = buildScreenUrl(params);
  window.history.replaceState({ screen: params.screen }, '', url);
}

/**
 * Extract navigation params from current URL search params
 */
export function extractNavParams(searchParams: URLSearchParams): ScreenNavParams {
  const screen = (searchParams.get('screen') || 'home') as ScreenType;

  return {
    screen,
    token: searchParams.get('token'),
    theme: searchParams.get('theme'),
    lang: searchParams.get('lang'),
    ui_mode: searchParams.get('ui_mode'),
    src_host: searchParams.get('src_host'),
    src_url: searchParams.get('src_url'),
    resume_order: searchParams.get('resume_order'),
    amount: searchParams.get('amount'),
    tab: searchParams.get('tab'),
    filter: searchParams.get('filter'),
    page: searchParams.get('page'),
    page_size: searchParams.get('page_size'),
  };
}

/**
 * Get current nav params from window location
 */
export function getCurrentNavParams(): ScreenNavParams {
  if (typeof window === 'undefined') {
    return { screen: 'home' };
  }
  return extractNavParams(new URLSearchParams(window.location.search));
}

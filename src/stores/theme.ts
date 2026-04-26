import { create } from 'zustand';

type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  // Always start 'light' — matches server. Hydrator corrects before paint.
  theme: 'light',
  setTheme: (theme) => {
    set({ theme });
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
      document.documentElement.dataset.theme = theme;
    }
  },
  toggleTheme: () => {
    set((s) => {
      const next: Theme = s.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', next);
        document.documentElement.dataset.theme = next;
      }
      return { theme: next };
    });
  },
}));

export function hydrateTheme(urlParam?: string | null): void {
  if (typeof window === 'undefined') return;
  let theme: Theme = 'light';
  if (urlParam === 'dark' || urlParam === 'light') {
    theme = urlParam;
  } else {
    const dom = document.documentElement.dataset.theme;
    if (dom === 'dark' || dom === 'light') theme = dom;
  }
  useThemeStore.setState({ theme });
  document.documentElement.dataset.theme = theme;
}

import { create } from 'zustand';

export type Locale = 'en' | 'ko';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'en',
  setLocale: (locale) => set({ locale }),
}));

export const useLocale = () => useLocaleStore((state) => state.locale);

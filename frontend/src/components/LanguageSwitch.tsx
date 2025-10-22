'use client';

import { useMemo } from 'react';
import { useLocaleStore, type Locale } from '@/stores/useLocaleStore';
import { useTranslations } from '@/lib/i18n';

interface LanguageOption {
  code: Locale;
  label: string;
}

export default function LanguageSwitch({ className = '' }: { className?: string }) {
  const locale = useLocaleStore((state) => state.locale);
  const setLocale = useLocaleStore((state) => state.setLocale);
  const t = useTranslations();

  const options = useMemo<LanguageOption[]>(
    () => [
      { code: 'ko', label: t('language.korean') },
      { code: 'en', label: t('language.english') },
    ],
    [t],
  );

  return (
    <div className={`flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 p-0.5 text-xs shadow-sm ${className}`}>
      <span className="sr-only">{t('language.switchLabel')}</span>
      {options.map((option) => {
        const isActive = option.code === locale;
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => setLocale(option.code)}
            className={`rounded-full px-2.5 py-1 font-semibold transition ${
              isActive
                ? 'bg-primary-500 text-white shadow'
                : 'text-slate-500 hover:text-primary-600'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

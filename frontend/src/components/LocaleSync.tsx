'use client';

import { useEffect } from 'react';
import { useLocaleStore } from '@/stores/useLocaleStore';

export default function LocaleSync() {
  const locale = useLocaleStore((state) => state.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

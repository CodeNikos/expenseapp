import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getStoredGuestLang, normalizeLang, setStoredGuestLang, tString, translations } from '../i18n/translations';
import { useAuth } from '../hooks/useAuth';

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const { user } = useAuth();
  const [guestLangVersion, setGuestLangVersion] = useState(0);

  const lang = useMemo(() => {
    if (user) {
      return normalizeLang(user.language ?? 'es');
    }
    return getStoredGuestLang();
  }, [user, user?.language, guestLangVersion]);

  const dict = translations[lang] || translations.es;

  const t = useCallback((key, vars) => tString(dict, key, vars), [dict]);

  const dateLocale = lang === 'en' ? 'en-US' : 'es-PA';

  const setGuestLanguage = useCallback((l) => {
    setStoredGuestLang(l);
    setGuestLangVersion((v) => v + 1);
  }, []);

  const value = useMemo(
    () => ({ t, lang, dateLocale, setGuestLanguage }),
    [t, lang, dateLocale, setGuestLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n debe usarse dentro de I18nProvider');
  }
  return ctx;
}

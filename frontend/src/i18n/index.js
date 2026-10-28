import { createI18n } from 'vue-i18n';
import en from './locales/en';
import hi from './locales/hi';
import kn from './locales/kn';
import te from './locales/te';
import ta from './locales/ta';
import ml from './locales/ml';

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', bcp47: 'en-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', bcp47: 'hi-IN' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', bcp47: 'kn-IN' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', bcp47: 'te-IN' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', bcp47: 'ta-IN' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', bcp47: 'ml-IN' },
];
const CODES = LANGUAGES.map((l) => l.code);
const STORAGE_KEY = 'ph_lang';

function initialLocale() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (CODES.includes(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  for (const lang of navigator.languages || [navigator.language]) {
    const code = String(lang || '').slice(0, 2).toLowerCase();
    if (CODES.includes(code)) return code;
  }
  return 'en';
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages: { en, hi, kn, te, ta, ml },
  missingWarn: false,
  fallbackWarn: false,
});

/** For code outside components (stores, utils). Reactive when called inside a render or computed. */
export const t = (...args) => i18n.global.t(...args);

export const currentLocale = () => i18n.global.locale.value;

/** BCP 47 tag for Intl date/number formatting, e.g. 'hi-IN'. */
export const intlLocale = () => LANGUAGES.find((l) => l.code === currentLocale())?.bcp47 || 'en-IN';

export function setLocale(code) {
  if (!CODES.includes(code)) return;
  i18n.global.locale.value = code;
  document.documentElement.lang = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage blocked */
  }
}

document.documentElement.lang = currentLocale();

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enUS from './locales/en-US.json';
import ptBR from './locales/pt-BR.json';
import esES from './locales/es-ES.json';

// Translation resources
const resources = {
  'en-US': { translation: enUS },
  'pt-BR': { translation: ptBR },
  'es-ES': { translation: esES }
};

i18n
  // Detects language via localStorage -> navigator -> html tag
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-US',
    debug: false,
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    },
    interpolation: {
      escapeValue: false // React already protects from XSS
    }
  });

export default i18n; 
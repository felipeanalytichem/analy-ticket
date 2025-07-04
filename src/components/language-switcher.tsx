import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface LanguageOption {
  code: string;
  label: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en-US', label: '🇺🇸 EN' },
  { code: 'pt-BR', label: '🇧🇷 PT' },
  { code: 'es-ES', label: '🇪🇸 ES' },
];

export function LanguageSwitcher() {
  const { i18n: instance } = useTranslation();
  const [lang, setLang] = useState(instance.language || 'en-US');

  useEffect(() => {
    setLang(instance.language);
  }, [instance.language]);

  const changeLanguage = async (code: string) => {
    if (code === instance.language) return;
    await i18n.changeLanguage(code);
    setLang(code);

    // Persist into userPreferences if exists
    try {
      const raw = localStorage.getItem('userPreferences');
      const prefs = raw ? JSON.parse(raw) : {};
      prefs.language = code;
      localStorage.setItem('userPreferences', JSON.stringify(prefs));
    } catch (err) {
      console.error('Error saving language preference', err);
    }
  };

  return (
    <Select value={lang} onValueChange={changeLanguage}>
      <SelectTrigger className="w-24 h-8 text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code} className="flex items-center gap-2">
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 
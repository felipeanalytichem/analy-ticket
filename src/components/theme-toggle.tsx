
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useTranslation } from 'react-i18next';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return (
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-300" />
        );
      case "dark":
        return (
          <Moon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-300" />
        );
      case "system":
        return (
          <Monitor className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-300" />
        );
      default:
        return (
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all duration-300" />
        );
    }
  };

  const getThemeLabel = () => {
    switch (theme) {
      case "light":
        return t('theme.switchToDark');
      case "dark":
        return t('theme.switchToSystem');
      case "system":
        return t('theme.switchToLight');
      default:
        return t('theme.toggle');
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      title={getThemeLabel()}
    >
      {getThemeIcon()}
      <span className="sr-only">{getThemeLabel()}</span>
    </Button>
  );
}

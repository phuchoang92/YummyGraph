import { Palette } from '@/lib/lucide-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/hooks/useTheme';
import { THEMES, type ThemeId } from '@/lib/themes';

export const ThemeSwitcher = () => {
  const { t } = useTranslation('header');
  const { theme, setTheme } = useTheme();
  const activeSwatch = THEMES.find((entry) => entry.id === theme)?.swatch ?? '#00ff88';

  return (
    <label
      className="flex h-9 items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-2 text-text-secondary transition-colors hover:border-border-default hover:bg-hover hover:text-text-primary"
      title={t('selectTheme')}
    >
      <Palette className="h-4 w-4" aria-hidden="true" style={{ color: activeSwatch }} />
      <span className="sr-only">{t('theme')}</span>
      <select
        data-testid="theme-switcher"
        value={theme}
        aria-label={t('selectTheme')}
        onChange={(event) => setTheme(event.target.value as ThemeId)}
        className="cursor-pointer border-none bg-transparent text-xs font-medium outline-none"
      >
        {THEMES.map((entry) => (
          <option key={entry.id} value={entry.id} className="bg-surface text-text-primary">
            {t(`themes.${entry.id}`)}
          </option>
        ))}
      </select>
    </label>
  );
};

import { useAppTheme } from '@/contexts/ThemeContext';

export function useColorScheme() {
  const { theme } = useAppTheme();
  return theme;
}

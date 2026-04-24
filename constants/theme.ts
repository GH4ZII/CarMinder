/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColor = '#2DD4BF';
const accentColor = '#2DD4BF';

export const Colors = {
  light: {
    text: '#102016',
    background: '#F7FBF8',
    tint: tintColor,
    accent: accentColor,
    icon: '#5F7768',
    tabIconDefault: '#6E8578',
    tabIconSelected: tintColor,
    card: '#FFFFFF',
    border: '#D8E5DD',
    surface: '#EFF6F1',
  },
  dark: {
    text: '#E9EEF7',
    background: '#07142B',
    tint: tintColor,
    accent: accentColor,
    icon: '#8DA0B8',
    tabIconDefault: '#7F90A7',
    tabIconSelected: tintColor,
    card: '#0A1A37',
    border: '#294263',
    surface: '#0A1A37',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

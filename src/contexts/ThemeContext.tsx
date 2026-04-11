import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { LIGHT_COLORS, DARK_COLORS, type ColorPalette } from '../constants/colors';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  colors: ColorPalette;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  /** Initialise from system once; manual toggle is not overwritten when the OS theme changes. */
  const [theme, setTheme] = useState<Theme>(systemScheme === 'dark' ? 'dark' : 'light');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const colors: ColorPalette = theme === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

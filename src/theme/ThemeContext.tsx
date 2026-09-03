import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { NavigationBar, setStyle } from 'expo-navigation-bar';
import { ColorPalette, darkPalette, lightPalette } from './colors';
import { userRepository } from '../database/repositories/userRepository';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isDark: boolean;
  colors: ColorPalette;
  theme: ColorPalette;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'dark',
  setThemeMode: async () => {},
  isDark: true,
  colors: darkPalette,
  theme: darkPalette,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    userRepository
      .getSetting('theme_preference', 'dark')
      .then((savedMode) => {
        if (isMounted && (savedMode === 'dark' || savedMode === 'light' || savedMode === 'system')) {
          setThemeModeState(savedMode as ThemeMode);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await userRepository.setSetting('theme_preference', mode);
    } catch (e) {
      console.error('Failed to persist theme preference:', e);
    }
  };

  const isDark = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme !== 'light';
    }
    return themeMode === 'dark';
  }, [themeMode, systemScheme]);

  const activePalette = useMemo(() => {
    return isDark ? darkPalette : lightPalette;
  }, [isDark]);

  // Sync Android 3-Button & Gesture Navigation Bar styling with active theme in Expo SDK 57
  useEffect(() => {
    if (Platform.OS === 'android') {
      try {
        const style = themeMode === 'system' ? 'auto' : isDark ? 'dark' : 'light';
        setStyle(style);
      } catch (e) {
        // Graceful fallback for environments without navigation bar control
      }
    }
  }, [themeMode, isDark]);

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      isDark,
      colors: activePalette,
      theme: activePalette,
    }),
    [themeMode, isDark, activePalette]
  );

  return (
    <ThemeContext.Provider value={value}>
      {Platform.OS === 'android' ? (
        <NavigationBar style={themeMode === 'system' ? 'auto' : isDark ? 'dark' : 'light'} />
      ) : null}
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}

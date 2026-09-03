import '../src/services/cryptoPolyfill';
import '../global.css';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors } from '../src/theme/colors';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { NotificationProvider } from '../src/components/NotificationContext';
import { initializeDatabase } from '../src/database/init';
import { initializeCloudBackupSync } from '../src/services/cloudBackup';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 0, // Instant local-first reactivity
      gcTime: 1000 * 60 * 5,
    },
  },
});

function RootNavigation() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    initializeDatabase()
      .then(() => {
        setIsDbReady(true);
        initializeCloudBackupSync();
      })
      .catch((err) => {
        console.error('Failed to initialize local database:', err);
        setDbError(err.message || 'Database initialization failed');
      });
  }, []);

  if (!isDbReady) {
    return (
      <View style={styles.loadingContainer}>
        {dbError ? (
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Error: {dbError}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.primary} />
        )}
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <NotificationProvider>
            <RootNavigation />
          </NotificationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import { useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { dbEvents } from '../database/events';

/**
 * Hook that triggers refetch on tab focus AND on database change events.
 */
export function useDatabaseRefresh(
  events: Array<'work_changed' | 'shifts_changed' | 'finance_changed' | 'payslips_changed' | 'settings_changed'>,
  onRefresh: () => void
) {
  // 1. Refresh on tab focus
  useFocusEffect(
    useCallback(() => {
      onRefresh();
    }, [onRefresh])
  );

  // 2. Refresh on database change events
  useEffect(() => {
    const unsubscribes = events.map((event) =>
      dbEvents.subscribe(event, () => {
        onRefresh();
      })
    );

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [events, onRefresh]);
}

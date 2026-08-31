import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, Clock, Calendar, FileText, Wallet } from 'lucide-react-native';
import { colors } from '../../src/theme/colors';
import { Platform } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.cardBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'android' ? 68 : 84,
          paddingBottom: Platform.OS === 'android' ? 10 : 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: 'Track Work',
          tabBarIcon: ({ color, size }) => <Clock size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shifts"
        options={{
          title: 'Shifts',
          tabBarIcon: ({ color, size }) => <Calendar size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="payslips"
        options={{
          title: 'Payslips',
          tabBarIcon: ({ color, size }) => <FileText size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finance',
          tabBarIcon: ({ color, size }) => <Wallet size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

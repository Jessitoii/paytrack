import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Lock, Mail, ShieldCheck } from 'lucide-react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('demo@paytrack.app');
  const [password, setPassword] = useState('password123');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please enter email and password');
      return;
    }

    try {
      setIsSubmitting(true);
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-[#090D16] justify-center p-6">
      {/* Brand Header */}
      <View className="items-center mb-8">
        <View className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 items-center justify-center mb-4">
          <ShieldCheck size={36} color="#10B981" />
        </View>
        <Text className="text-white text-3xl font-extrabold tracking-tight">PayTrack</Text>
        <Text className="text-gray-400 text-xs text-center mt-1">
          Smart Payroll Tracker & Personal Finance for Shift Workers
        </Text>
      </View>

      {/* Form Card */}
      <View className="bg-card border border-cardBorder rounded-3xl p-6 shadow-xl mb-6">
        <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Email Address</Text>
        <View className="flex-row items-center bg-[#0B0F19] border border-gray-800 rounded-xl px-4 py-3 mb-4">
          <Mail size={18} color="#64748B" />
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="worker@example.com"
            placeholderTextColor="#64748B"
            className="flex-1 text-white text-base ml-3"
          />
        </View>

        <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Password</Text>
        <View className="flex-row items-center bg-[#0B0F19] border border-gray-800 rounded-xl px-4 py-3 mb-6">
          <Lock size={18} color="#64748B" />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#64748B"
            className="flex-1 text-white text-base ml-3"
          />
        </View>

        <TouchableOpacity
          onPress={handleLogin}
          disabled={isSubmitting}
          className="bg-emerald-500 active:bg-emerald-600 py-4 rounded-xl items-center flex-row justify-center shadow-lg shadow-emerald-500/20"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#090D16" />
          ) : (
            <Text className="text-gray-950 font-bold text-base">Sign In</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Switch to Register */}
      <View className="flex-row justify-center items-center">
        <Text className="text-gray-400 text-xs">Don't have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/register' as any)}>
          <Text className="text-emerald-400 font-bold text-xs">Create Account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

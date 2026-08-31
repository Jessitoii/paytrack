import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Lock, Mail, User, ShieldCheck, ArrowLeft } from 'lucide-react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    try {
      setIsSubmitting(true);
      await register(email.trim(), password, name.trim());
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Could not create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-[#090D16] justify-center p-6">
      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        className="w-10 h-10 rounded-xl bg-card border border-cardBorder items-center justify-center mb-6"
      >
        <ArrowLeft size={18} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Brand Header */}
      <View className="mb-6">
        <Text className="text-white text-3xl font-extrabold tracking-tight">Create Account</Text>
        <Text className="text-gray-400 text-xs mt-1">
          Start tracking shifts, calculating pay, and growing your savings.
        </Text>
      </View>

      {/* Form Card */}
      <View className="bg-card border border-cardBorder rounded-3xl p-6 shadow-xl mb-6">
        <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Full Name</Text>
        <View className="flex-row items-center bg-[#0B0F19] border border-gray-800 rounded-xl px-4 py-3 mb-4">
          <User size={18} color="#64748B" />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Alper Ozer"
            placeholderTextColor="#64748B"
            className="flex-1 text-white text-base ml-3"
          />
        </View>

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
          onPress={handleRegister}
          disabled={isSubmitting}
          className="bg-emerald-500 active:bg-emerald-600 py-4 rounded-xl items-center flex-row justify-center shadow-lg shadow-emerald-500/20"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#090D16" />
          ) : (
            <Text className="text-gray-950 font-bold text-base">Sign Up</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Switch to Login */}
      <View className="flex-row justify-center items-center">
        <Text className="text-gray-400 text-xs">Already have an account? </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/login' as any)}>
          <Text className="text-emerald-400 font-bold text-xs">Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

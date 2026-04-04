import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';
import { ServiceUnavailable } from '@/components/ServiceUnavailable';
import { useAuth } from '@/hooks/useAuth';

const signupSchema = z
  .object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupScreen() {
  const router = useRouter();
  const { signup, isLoading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormValues) => {
    setServerError(null);
    setSuccessMessage(null);
    setServiceUnavailable(false);
    const result = await signup(data.firstName, data.lastName, data.email, data.password);
    if (typeof result === 'string') {
      if (result.toLowerCase().includes('verify')) {
        setSuccessMessage('Account created! Please check your email to verify your account before signing in.');
      } else {
        setServerError(result);
      }
    } else if (result && typeof result === 'object') {
      if (result.isServiceUnavailable) {
        setServiceUnavailable(true);
      } else {
        setServerError(result.message);
      }
    }
  };

  const handleRetry = () => {
    setServiceUnavailable(false);
    handleSubmit(onSubmit)();
  };

  if (serviceUnavailable) {
    return (
      <ServiceUnavailable
        onRetry={handleRetry}
        isRetrying={isLoading}
      />
    );
  }

  if (successMessage) {
    return (
      <View className="flex-1 bg-gray-50 dark:bg-surface justify-center items-center px-6">
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 24 }}
          resizeMode="contain"
        />
        <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Check your email</Text>
        <Text className="text-sm text-gray-500 dark:text-slate-400 text-center leading-6 mb-8">{successMessage}</Text>
        <TouchableOpacity
          className="bg-brand-500 rounded-xl py-3 px-8 items-center w-full"
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text className="text-white font-semibold text-sm">Go to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fields = [
    { name: 'firstName', label: 'First Name', secure: false, keyboard: 'default' as const, capitalize: 'words' as const },
    { name: 'lastName', label: 'Last Name', secure: false, keyboard: 'default' as const, capitalize: 'words' as const },
    { name: 'email', label: 'Email address', secure: false, keyboard: 'email-address' as const, capitalize: 'none' as const },
    { name: 'password', label: 'Password', secure: true, keyboard: 'default' as const, capitalize: 'none' as const },
    { name: 'confirmPassword', label: 'Confirm Password', secure: true, keyboard: 'default' as const, capitalize: 'none' as const },
  ] as const;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-50 dark:bg-surface"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40, gap: 0 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + heading */}
        <View className="items-center mb-8">
          <Image
            source={require('../../assets/logo.png')}
            style={{ width: 56, height: 56, borderRadius: 14, marginBottom: 16 }}
            resizeMode="contain"
          />
          <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Create your account</Text>
          <Text className="text-sm text-gray-500 dark:text-slate-400">Start protecting what matters to you</Text>
        </View>

        {/* Card */}
        <View className="bg-white dark:bg-surface-card border border-gray-200 dark:border-surface-border rounded-2xl p-6" style={{ gap: 16 }}>
          {fields.map(({ name, label, secure, keyboard, capitalize }) => (
            <Controller
              key={name}
              control={control}
              name={name}
              render={({ field: { onChange, onBlur, value } }) => (
                <View className="gap-1.5">
                  <Text className="text-sm font-medium text-gray-700 dark:text-slate-300">{label}</Text>
                  <TextInput
                    className={`bg-gray-50 dark:bg-surface-elevated border rounded-xl px-4 py-3 text-gray-900 dark:text-white text-sm ${
                      errors[name] ? 'border-red-500' : 'border-gray-200 dark:border-surface-border'
                    }`}
                    placeholder={label}
                    placeholderTextColor="#9ca3af"
                    keyboardType={keyboard}
                    autoCapitalize={capitalize}
                    secureTextEntry={secure}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                  />
                  {errors[name] && (
                    <Text className="text-xs text-red-500">{errors[name]?.message}</Text>
                  )}
                </View>
              )}
            />
          ))}

          {serverError && (
            <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-3">
              <Text className="text-red-600 dark:text-red-400 text-sm">{serverError}</Text>
            </View>
          )}

          <TouchableOpacity
            className={`bg-brand-500 rounded-xl py-3 items-center mt-1 ${isLoading ? 'opacity-60' : ''}`}
            onPress={handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-sm">Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Switch link */}
        <TouchableOpacity className="mt-6" onPress={() => router.back()}>
          <Text className="text-center text-gray-500 dark:text-slate-500 text-sm">
            Already have an account?{' '}
            <Text className="text-brand-500 font-semibold">Sign in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

import { Ionicons } from '@/components/Icon';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

interface ServiceUnavailableProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function ServiceUnavailable({ onRetry, isRetrying = false }: ServiceUnavailableProps) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';

  return (
    <View className="flex-1 bg-gray-50 dark:bg-surface justify-center items-center px-6">
      <View className="items-center max-w-sm">
        {/* Icon */}
        <View
          className="w-20 h-20 rounded-full mb-6 items-center justify-center"
          style={{ backgroundColor: dark ? 'rgba(249, 115, 22, 0.15)' : 'rgba(249, 115, 22, 0.1)' }}
        >
          <Ionicons name="warning" size={36} color={dark ? '#f97316' : '#f97316'} />
        </View>

        <Text className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
          Service Unavailable
        </Text>
        <Text className="text-sm text-gray-500 dark:text-slate-400 text-center mb-8">
          We&apos;re having trouble connecting. Please check your internet connection and try again.
        </Text>

        <TouchableOpacity
          className="bg-brand-500 rounded-xl py-3 px-8 min-w-[160px] items-center"
          onPress={onRetry}
          disabled={isRetrying}
          activeOpacity={0.8}
        >
          {isRetrying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-sm">Try Again</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

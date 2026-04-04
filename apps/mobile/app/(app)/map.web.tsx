import { Text, View } from 'react-native';
import { Image } from 'react-native';

export default function MapScreen() {
  return (
    <View className="flex-1 bg-surface">
      <View className="bg-surface-card border-b border-surface-border px-6 pt-14 pb-4 flex-row items-center gap-3">
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 28, height: 28, borderRadius: 7 }}
          resizeMode="contain"
        />
        <Text className="text-lg font-bold text-white">Community Map</Text>
      </View>
      <View className="flex-1 items-center justify-center px-6" style={{ gap: 12 }}>
        <View className="w-16 h-16 rounded-full bg-brand-500/10 border border-brand-500/20 items-center justify-center">
          <Text style={{ fontSize: 28 }}>🗺</Text>
        </View>
        <Text className="text-base font-semibold text-white">Map View</Text>
        <Text className="text-sm text-slate-500 text-center">
          The interactive map is available on iOS and Android devices.
        </Text>
      </View>
    </View>
  );
}

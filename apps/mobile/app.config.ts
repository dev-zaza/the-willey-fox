import type { ConfigContext, ExpoConfig } from 'expo/config';
import appJson from './app.json';

type AndroidConfigWithMaps = NonNullable<ExpoConfig['android']> & {
  config?: {
    googleMaps?: {
      apiKey?: string;
    };
  };
};

export default ({ config }: ConfigContext): ExpoConfig => {
  const baseConfig = (appJson.expo ?? config) as ExpoConfig;
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
    '';

  const androidConfig = (baseConfig.android ?? {}) as AndroidConfigWithMaps;

  return {
    ...baseConfig,
    android: {
      ...androidConfig,
      config: {
        ...(androidConfig.config ?? {}),
        googleMaps: {
          ...(androidConfig.config?.googleMaps ?? {}),
          apiKey: googleMapsApiKey,
        },
      },
    },
  };
};

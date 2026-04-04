const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const path = require('path');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // react-native-maps has no web support — return empty module on web
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return { type: 'empty' };
  }
  // Force axios browser bundle — the default Node.js cjs build requires
  // 'crypto', 'http', etc. which are unavailable in React Native / Hermes
  if (moduleName === 'axios') {
    return context.resolveRequest(context, 'axios/dist/browser/axios.cjs', platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });

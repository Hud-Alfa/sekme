import type { ExpoConfig } from 'expo/config';

/**
 * Single source of truth for identity and versioning.
 *
 * `versionCode` MUST increase on every Play Store upload — Google rejects a
 * bundle whose code is not higher than the last one accepted.
 */
const NAME = 'Sekme';
const SLUG = 'sekme';
const PACKAGE = 'com.ozdas.sekme';
const VERSION = '1.0.0';
const VERSION_CODE = 1;

const config: ExpoConfig = {
  name: NAME,
  slug: SLUG,
  scheme: 'sekme',
  version: VERSION,
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',

  android: {
    package: PACKAGE,
    versionCode: VERSION_CODE,
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Only what the app actually uses. Unused permissions cost review time and
    // make the Data Safety form harder to answer honestly.
    permissions: ['POST_NOTIFICATIONS'],
    blockedPermissions: [
      // React Native's template asks for this so the dev menu can float over
      // other apps. Nothing in a release build uses it, and Play treats
      // "draw over other apps" as sensitive, so it is stripped.
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },

  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-sharing',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B0B0F',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
    [
      'expo-notifications',
      {
        color: '#0C8049',
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;

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
    // The game sends no notifications — that section was removed from Settings
    // and `expo-notifications` with it.
    permissions: [],
    blockedPermissions: [
      // React Native's template asks for this so the dev menu can float over
      // other apps. Nothing in a release build uses it, and Play treats
      // "draw over other apps" as sensitive, so it is stripped.
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.RECORD_AUDIO',
      // expo-audio declares these so an app CAN keep playing in the
      // background. This one deliberately does not (`shouldPlayInBackground:
      // false`), and a foreground-service permission is something Play makes
      // you justify in review — so it is stripped rather than explained.
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },

  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-audio',
    [
      // Shrinking is configured here rather than in `android/gradle.properties`
      // because `android/` is generated — a value written there is lost on the
      // next prebuild, and would never reach an EAS build at all.
      //
      // R8 plus resource shrinking is most of the difference between a ~50 MB
      // and a ~25 MB install: without it the release APK ships five uncompiled
      // dex files and every resource any dependency happens to contain.
      'expo-build-properties',
      {
        android: {
          enableProguardInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#0B0B0F',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;

/**
 * Capacitor Mobile Packaging Configuration for RYFT.io (Android & iOS)
 * Enables packaging the web build (`dist/`) into native Android (.aab / .apk) and iOS (.ipa) bundles.
 */
const config = {
  appId: 'com.ryftio.spacearena',
  appName: 'RYFT.io',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#010306',
      showSpinner: false,
    },
  },
};

export default config;

// app.config.ts
// Inyecta la API key de Google Maps desde variables de entorno.
// Expo carga automáticamente el .env del proyecto en process.env.
import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosKey =
    process.env.GOOGLE_MAPS_API_KEY_IOS ??
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const androidKey =
    process.env.GOOGLE_MAPS_API_KEY_ANDROID ?? iosKey;

  if (!iosKey && !androidKey) {
    console.warn(
      '[app.config] ⚠️  No se encontró GOOGLE_MAPS_API_KEY_IOS ni EXPO_PUBLIC_GOOGLE_MAPS_API_KEY en el entorno. El mapa no renderizará tiles.',
    );
  }

  // ── iOS ────────────────────────────────────────────────────────────────
  if (!config.ios) config.ios = {};
  if (iosKey) {
    config.ios.config = {
      ...config.ios.config,
      googleMapsApiKey: iosKey,
    };
  }

  // ── Android ────────────────────────────────────────────────────────────
  if (!config.android) config.android = {};
  if (androidKey) {
    config.android.config = {
      ...config.android.config,
      googleMaps: {
        ...(config.android.config?.googleMaps ?? {}),
        apiKey: androidKey,
      },
    };
  }

  return config as ExpoConfig;
};

// Native modules that do not exist in a Node test process. Each is replaced
// with the mock its own package ships, so the fake behaves like the real one.
jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en" }],
}));

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })) },
}));

/* ---------------------------------------------------------------------------
 * Rendering a screen
 *
 * The pieces below only exist inside a real app binary — the animation
 * runtime, the fingerprint reader, the blur layer. Stubbing them is what
 * lets a screen render at all in a Node process; everything the tests then
 * assert on is the app's own code.
 * ------------------------------------------------------------------------ */

jest.mock("react-native-reanimated", () => require("react-native-reanimated/mock"));

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  const inset = { top: 44, right: 0, bottom: 34, left: 0 };
  return {
    SafeAreaProvider: View,
    SafeAreaView: View,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: { insets: inset, frame: { x: 0, y: 0, width: 390, height: 844 } },
  };
});

jest.mock("expo-blur", () => ({ BlurView: require("react-native").View }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: require("react-native").View }));

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(), notificationAsync: jest.fn(), selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  authenticateAsync: jest.fn(async () => ({ success: true })),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 18.5204, longitude: 73.8567 } })),
  reverseGeocodeAsync: jest.fn(async () => [{ name: "FC Road", street: "FC Road", city: "Pune" }]),
  Accuracy: { Balanced: 3 },
}));

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
  MediaTypeOptions: { Images: "Images" },
}));

// Thousands of ESM icon files that jest would otherwise transform one by one.
// They are decoration; each renders as a view named after itself, so a test
// can still find one by name if it needs to.
jest.mock("lucide-react-native", () => {
  const React = require("react");
  const { View } = require("react-native");
  return new Proxy({}, {
    get: (_t, name) => {
      if (name === "__esModule") return true;
      const Icon = (props) => React.createElement(View, { ...props, accessibilityLabel: String(name) });
      Icon.displayName = String(name);
      return Icon;
    },
  });
});

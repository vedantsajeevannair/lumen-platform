import { Pressable, StyleSheet, Text } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { googleLogin } from "../api";
import { C, S, R, F } from "../theme";
import { useT } from "../i18n";

// Closes the browser tab left behind after Google redirects back to the app.
WebBrowser.maybeCompleteAuthSession();

/**
 * The OAuth client ids, one per platform, injected at build time.
 *
 * Google issues a separate id for each, and the Android one is bound to the
 * app's package name and signing certificate, so these are configuration
 * rather than constants.
 */
export const GOOGLE_IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
};

/**
 * Whether Google sign-in can work on this build at all.
 *
 * Checked by the caller *before* rendering this component, and that ordering
 * is the whole reason the button lives in its own file. `useIdTokenAuthRequest`
 * throws outright when the id for the running platform is undefined — not a
 * warning, an exception during render — and a hook cannot be called
 * conditionally. A build with no ids configured therefore crashed on the login
 * screen, which is the first screen a signed-out user sees, so the app did not
 * open at all. Keeping the hook inside a component that is only mounted when
 * an id exists is what makes "no ids configured" mean "no button" instead.
 */
export const googleConfigured = Boolean(
  GOOGLE_IDS.androidClientId || GOOGLE_IDS.iosClientId || GOOGLE_IDS.webClientId,
);

export function GoogleButton({ onSignedIn, onError, disabled }: {
  onSignedIn: (user: unknown) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  // `idToken` rather than an access token: an access token says what the app
  // may fetch, an ID token says who the user is and is signed so the server
  // can verify that claim without calling Google itself.
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(GOOGLE_IDS);

  async function go() {
    try {
      const result = await promptAsync();
      // Dismissing the browser is a choice, not a failure — say nothing.
      if (result?.type !== "success") return;
      const idToken = result.params?.id_token;
      if (!idToken) return onError(t("auth.failed"));
      onSignedIn(await googleLogin(idToken));
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : t("auth.failed"));
    }
  }

  return (
    <Pressable
      onPress={go}
      disabled={disabled || !request}
      style={({ pressed }) => [s.google, pressed && { opacity: 0.7 }]}
    >
      {/* Google's mark, drawn rather than fetched: an <Image> would need a
          network round trip on the one screen that must work before anything
          else does. */}
      <Text style={s.googleG}>G</Text>
      <Text style={s.googleText}>{t("auth.google")}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // Google's own guidance: their mark on a white surface with a visible
  // border, never recoloured to match the app.
  google: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: S.sm,
    marginTop: S.lg, paddingVertical: 13, borderRadius: R.md,
    backgroundColor: "#fff", borderWidth: 1, borderColor: C.line,
  },
  googleG: { fontSize: 17, fontWeight: "800", color: "#4285F4" },
  googleText: { ...F.bodyStrong, color: "#3c4043" },
});

import * as Crypto from "expo-crypto";
import * as Device from "expo-device";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import {
  biometricLogin, enableBiometric, revokeBiometric, type BiometricDevice,
} from "./api";

/**
 * Signing in with the phone's own biometric check.
 *
 * The fingerprint or face never leaves the device and is never sent to the
 * server — it cannot be, and pretending otherwise is how apps end up claiming
 * security they do not have. What actually happens:
 *
 *   enrol   the user proves themselves to the phone, the server issues a
 *           random token, and the token goes into SecureStore (the iOS
 *           keychain, the Android keystore — both hardware-backed).
 *   sign in the user proves themselves to the phone again, the phone releases
 *           the token, and the server exchanges it for a session.
 *
 * So the server learns one thing: that this device's secure store opened. That
 * is the strongest honest claim available to it.
 */

const DEVICE_ID_KEY = "lumen_device_id";
const DEVICE_TOKEN_KEY = "lumen_device_token";

/** SecureStore throws on web, where there is no keychain to fall back on. */
const secure = Platform.OS !== "web";

/**
 * A stable id for this install.
 *
 * Generated once and kept, rather than derived from anything about the
 * hardware: a device identifier that follows the phone would let two accounts
 * on the same handset collide, and reinstalling should look like a new device
 * because the old token is gone with it.
 */
export async function deviceId(): Promise<string> {
  if (!secure) return "web";
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const fresh = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, fresh);
  return fresh;
}

/** Hardware present, and the user has actually enrolled a finger or a face. */
export async function biometricAvailable(): Promise<boolean> {
  if (!secure) return false;
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hardware && enrolled;
}

/** Whether this install has a token, i.e. biometric sign-in is set up here. */
export async function biometricEnrolled(): Promise<boolean> {
  if (!secure) return false;
  return Boolean(await SecureStore.getItemAsync(DEVICE_TOKEN_KEY));
}

/** What the phone calls its own check, so the button can say the right thing. */
export async function biometricLabel(): Promise<string> {
  if (!secure) return "Biometrics";
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === "ios" ? "Face ID" : "Face unlock";
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === "ios" ? "Touch ID" : "Fingerprint";
  }
  return "Biometrics";
}

async function prove(prompt: string): Promise<boolean> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    // No PIN fallback: the point of the token is that the phone's own check
    // released it. A passcode fallback would quietly downgrade that to
    // "whoever knows the passcode", which the password login already covers.
    disableDeviceFallback: true,
    cancelLabel: "Cancel",
  });
  return r.success;
}

/**
 * Turn biometric sign-in on for this device. Requires a live session, because
 * the server needs to know whose device it is enrolling.
 */
export async function enrolBiometric(): Promise<{ ok: boolean; error?: string }> {
  if (!(await biometricAvailable())) {
    return { ok: false, error: "This device has no biometric set up." };
  }
  if (!(await prove("Confirm it is you to enable biometric sign-in"))) {
    return { ok: false, error: "Biometric check cancelled." };
  }
  try {
    const id = await deviceId();
    const token = await enableBiometric(id, Device.modelName ?? undefined, Platform.OS);
    await SecureStore.setItemAsync(DEVICE_TOKEN_KEY, token);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Could not enable biometric sign-in." };
  }
}

/** Sign in without a password. Returns the user, or null if it was declined. */
export async function signInWithBiometric(): Promise<any | null> {
  const token = secure ? await SecureStore.getItemAsync(DEVICE_TOKEN_KEY) : null;
  if (!token) return null;
  if (!(await prove("Sign in to LUMEN"))) return null;

  try {
    return await biometricLogin(await deviceId(), token);
  } catch (e: any) {
    // 401 means the server no longer honours this token — the commonest cause
    // is a password reset, which revokes enrolled devices on purpose. Clearing
    // it locally stops the app offering a button that cannot work.
    if (e?.status === 401) await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
    throw e;
  }
}

/** Turn it off here and on the server, so a stale credential is not left behind. */
export async function disableBiometric(): Promise<void> {
  const id = await deviceId();
  try {
    await revokeBiometric(id);
  } finally {
    if (secure) await SecureStore.deleteItemAsync(DEVICE_TOKEN_KEY);
  }
}

export type { BiometricDevice };

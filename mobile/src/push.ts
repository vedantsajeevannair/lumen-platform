import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { API_URL } from "./api";
import { loadToken } from "./api";

/**
 * Push notifications: telling someone their pothole was fixed without making
 * them open the app to find out.
 *
 * The server writes a Notification row and asks Expo to deliver it; this side
 * asks for permission, hands the resulting token to the server, and decides
 * what happens when one arrives or is tapped.
 *
 * Everything is best-effort. A refused permission, a simulator, or no network
 * must not stop someone signing in — the in-app Updates list is the record and
 * push is only a faster way to hear about it.
 */

/** Foreground behaviour: show it. The alternative is a notification that
 *  silently does nothing while the user is looking at the app. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Android needs a channel before anything can be delivered with sound or a
 * banner. Created at launch and named "default", matching what the server
 * sends as channelId.
 */
async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Report updates",
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Ask for permission, get the token, give it to the server.
 *
 * Returns the token so sign-out can tell the server to forget this device —
 * without that, the next person to sign in on a shared phone would keep
 * receiving the previous account's updates.
 */
export async function registerForPush(): Promise<string | null> {
  try {
    // A simulator has no push service and will throw rather than return null.
    if (!Device.isDevice) return null;

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    // Only ask if it has not already been decided. Re-prompting someone who
    // said no is both futile — the OS refuses — and rude.
    if (!granted && existing.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) return null;

    // The project id is required for a standalone build: without it Expo
    // cannot tell which project a token belongs to and the call fails.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    const session = await loadToken();
    if (!session) return null;

    await fetch(`${API_URL}/api/notifications/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` },
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    return token;
  } catch {
    // Permission dialogs, missing services, offline. None of it is fatal.
    return null;
  }
}

/** Tell the server to stop pushing to this device. Called on sign-out. */
export async function unregisterPush(token: string | null): Promise<void> {
  if (!token) return;
  try {
    const session = await loadToken();
    if (!session) return;
    await fetch(`${API_URL}/api/notifications/token`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session}` },
      body: JSON.stringify({ token }),
    });
  } catch {
    /* signing out matters more than tidying up the token */
  }
}

/**
 * Run `onComplaint` when a notification is tapped.
 *
 * Both entry points are covered: `getLastNotificationResponseAsync` for a tap
 * that launched the app from cold, and the listener for one that arrived while
 * it was already running. Handling only the second is the usual bug — the
 * notification opens the app and then appears to do nothing.
 */
export function onNotificationTap(onComplaint: (ref: string) => void) {
  const open = (response: Notifications.NotificationResponse | null) => {
    const ref = response?.notification.request.content.data?.ref;
    if (typeof ref === "string" && ref) onComplaint(ref);
  };

  Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}

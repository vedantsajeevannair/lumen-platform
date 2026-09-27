import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Pressable, SafeAreaView, StatusBar as RNStatusBar,
  StyleSheet, Text, View, Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearToken, loadToken, me, notifications, isStaff } from "./src/api";
import { flushOutbox } from "./src/outbox";
import { registerForPush, unregisterPush, onNotificationTap } from "./src/push";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "./src/design-system/ThemeContext";
import { BottomNavigation } from "./src/design-system/components/BottomNavigation";
import LoginScreen from "./src/screens/LoginScreen";
import ReportScreen from "./src/screens/ReportScreen";
import MyReportsScreen from "./src/screens/MyReportsScreen";
import AlertsScreen from "./src/screens/AlertsScreen";
import DetailScreen from "./src/screens/DetailScreen";
import InsightsScreen from "./src/screens/InsightsScreen";
import ProfileScreen, { LOCK_KEY } from "./src/screens/ProfileScreen";
import OutboxScreen from "./src/screens/OutboxScreen";
import HelpScreen from "./src/screens/HelpScreen";
import OnboardingScreen, { SEEN_KEY } from "./src/screens/OnboardingScreen";
import LockScreen from "./src/screens/LockScreen";
import QueueScreen from "./src/screens/staff/QueueScreen";
import TriageScreen from "./src/screens/staff/TriageScreen";
import OpsScreen from "./src/screens/staff/OpsScreen";
import AssistantScreen from "./src/screens/staff/AssistantScreen";
import MeasureScreen from "./src/screens/staff/MeasureScreen";

// Interactive citizen and staff screens
import { LiveTrackingScreen } from "./src/screens/LiveTrackingScreen";
import { VoiceReportScreen } from "./src/screens/VoiceReportScreen";
import { EmergencySOSScreen } from "./src/screens/EmergencySOSScreen";
import { NotificationCenterScreen } from "./src/screens/NotificationCenterScreen";
import { VerificationScreen } from "./src/screens/staff/VerificationScreen";

// Newly built advanced modules
import { FieldToolkitScreen } from "./src/screens/staff/FieldToolkitScreen";
import { IdentityVerificationScreen } from "./src/screens/IdentityVerificationScreen";
import { AppAssistantScreen } from "./src/screens/AppAssistantScreen";

import { C, S } from "./src/theme";
import { I18nProvider, useT } from "./src/i18n";
import {
  NotificationProvider,
  OfflineQueueProvider,
  EmergencyAlertProvider,
} from "./src/state";
import { Icon, IconName } from "./src/Icon";

export type Tab =
  | "home" | "report" | "alerts" | "profile" | "tracking" | "voice" | "sos" | "insights"
  | "queue" | "ops" | "assistant" | "measure" | "verify" | "toolkit";

export type Sheet =
  | { kind: "detail"; ref: string }
  | { kind: "measure"; ref: string }
  | { kind: "verify"; ref: string }
  | { kind: "tracking"; ref: string }
  | { kind: "voice" }
  | { kind: "sos" }
  | { kind: "toolkit" }
  | { kind: "outbox" }
  | { kind: "help" }
  | { kind: "kyc" }
  | { kind: "aiAssistant" }
  | null;

export default function App() {
  return (
    // The design-system components read their colours from this provider, so
    // it wraps everything. `light` is forced for now: the screens still take
    // their palette from theme.ts, which has no dark variant, and a half-dark
    // interface is worse than an honestly light one.
    <ThemeProvider forcedMode="light">
      <SafeAreaProvider>
        <I18nProvider>
          <OfflineQueueProvider>
            <NotificationProvider>
              <EmergencyAlertProvider>
                <Shell />
              </EmergencyAlertProvider>
            </NotificationProvider>
          </OfflineQueueProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function Shell() {
  const { t } = useT();
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [onboarded, setOnboarded] = useState(true);
  const [locked, setLocked] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [unread, setUnread] = useState(0);
  // Kept so sign-out can tell the server to forget this device. Without it a
  // shared phone keeps receiving the previous account's report updates.
  const [pushToken, setPushToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setOnboarded((await AsyncStorage.getItem(SEEN_KEY)) === "1");
      const token = await loadToken();
      if (token) {
        try {
          const u = await me();
          setUser(u);
          if (isStaff(u?.role)) setTab("queue");
          setLocked((await AsyncStorage.getItem(LOCK_KEY)) === "1");
        } catch {
          await clearToken();
        }
      }
      setChecking(false);
    })();
  }, []);

  useEffect(() => {
    if (!user || locked) return;
    (async () => {
      const { sent } = await flushOutbox();
      if (sent.length) setReloadKey((k) => k + 1);
      try {
        setUnread((await notifications()).unread ?? 0);
      } catch {
        /* offline */
      }
    })();
  }, [user, locked, reloadKey]);

  /**
   * Register for push once someone is signed in — not at launch.
   *
   * The permission prompt then arrives attached to something the person has
   * chosen to do, rather than as the first thing the app ever says, and the
   * token can be sent with a session that actually exists.
   */
  useEffect(() => {
    if (!user || locked) return;
    let cancelled = false;
    registerForPush().then((t) => { if (!cancelled) setPushToken(t); });
    return () => { cancelled = true; };
  }, [user, locked]);

  // Tapping a notification opens that complaint. Registered once, and it also
  // catches the tap that launched the app from cold.
  useEffect(() => {
    if (!user) return;
    return onNotificationTap((ref) => {
      setTab("home");
      setSheet({ kind: "detail", ref });
    });
  }, [user]);

  async function signOut() {
    // Before the token is cleared: the server needs an authenticated request
    // to know which device to forget.
    await unregisterPush(pushToken);
    setPushToken(null);
    await clearToken();
    setUser(null);
    setSheet(null);
    setTab("home");
  }

  if (checking) {
    return (
      <View style={s.boot}>
        <Text style={s.bootLogo}>LUMEN</Text>
        <ActivityIndicator color={C.brand} />
      </View>
    );
  }

  if (!onboarded) {
    return (
      <>
        <StatusBar style="dark" />
        <OnboardingScreen onDone={() => setOnboarded(true)} />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen
          onSignedIn={(u) => {
            setUser(u);
            if (isStaff(u?.role)) setTab("queue");
          }}
        />
      </>
    );
  }

  if (locked) {
    return (
      <>
        <StatusBar style="dark" />
        <LockScreen onUnlock={() => setLocked(false)} />
      </>
    );
  }

  const openDetail = (ref: string) => setSheet({ kind: "detail", ref });
  const openTracking = (ref: string) => setSheet({ kind: "tracking", ref });
  const role = String(user?.role ?? "CITIZEN").toUpperCase();
  const staff = isStaff(role);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.bar}>
        <Pressable onPress={() => { setSheet(null); setTab("home"); }}>
          <Text style={s.wordmark}>LUMEN</Text>
        </Pressable>

        {/* Quick action buttons on citizen top bar */}
        <View style={s.topActions}>
          {!staff ? (
            <>

              <Pressable
                style={s.topIconBtn}
                onPress={() => setSheet({ kind: "aiAssistant" })}
                hitSlop={6}
              >
                <Icon name="cpu" size={17} color={C.accent} />
              </Pressable>

              <Pressable
                style={s.topIconBtn}
                onPress={() => setSheet({ kind: "sos" })}
                hitSlop={6}
              >
                <Icon name="alert-triangle" size={17} color="#EF4444" />
              </Pressable>
            </>
          ) : (
            <Pressable
              style={s.topIconBtn}
              onPress={() => setSheet({ kind: "toolkit" })}
              hitSlop={6}
            >
              <Icon name="tool" size={17} color={C.brand} />
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              setSheet(null);
              setTab("profile");
            }}
            hitSlop={8}
          >
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {String(user?.name ?? "?").trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <View style={s.body}>
        {sheet?.kind === "detail" ? (
          staff ? (
            <TriageScreen
              refCode={sheet.ref}
              role={role}
              onBack={() => setSheet(null)}
              onChanged={() => setReloadKey((k) => k + 1)}
              onMeasure={(ref) => setSheet({ kind: "measure", ref })}
            />
          ) : (
            <DetailScreen refCode={sheet.ref} onBack={() => setSheet(null)} />
          )
        ) : sheet?.kind === "measure" ? (
          <MeasureScreen
            refCode={sheet.ref}
            onBack={() => setSheet({ kind: "detail", ref: sheet.ref })}
            onSaved={() => setReloadKey((k) => k + 1)}
          />
        ) : sheet?.kind === "verify" ? (
          <VerificationScreen navigation={{ goBack: () => setSheet(null) }} />
        ) : sheet?.kind === "tracking" ? (
          <LiveTrackingScreen
            route={{ params: { complaintId: sheet.ref } }}
            navigation={{ goBack: () => setSheet(null) }}
          />
        ) : sheet?.kind === "voice" ? (
          <VoiceReportScreen
            navigation={{
              navigate: (screen: string, params: any) => {
                setSheet(null);
                if (screen === "LiveTracking") openTracking(params?.complaintId || "cmp-001");
              },
            }}
          />
        ) : sheet?.kind === "sos" ? (
          <EmergencySOSScreen onBack={() => setSheet(null)} />
        ) : sheet?.kind === "kyc" ? (
          <IdentityVerificationScreen onBack={() => setSheet(null)} />
        ) : sheet?.kind === "aiAssistant" ? (
          <AppAssistantScreen onBack={() => setSheet(null)} />
        ) : sheet?.kind === "toolkit" ? (
          <FieldToolkitScreen />
        ) : sheet?.kind === "outbox" ? (
          <OutboxScreen onBack={() => setSheet(null)} onSent={() => setReloadKey((k) => k + 1)} />
        ) : sheet?.kind === "help" ? (
          <HelpScreen onBack={() => setSheet(null)} />
        ) : tab === "queue" ? (
          <QueueScreen onOpen={openDetail} reloadKey={reloadKey} />
        ) : tab === "ops" ? (
          <OpsScreen role={role} onOpen={openDetail} reloadKey={reloadKey} />
        ) : tab === "assistant" ? (
          <AssistantScreen />
        ) : tab === "verify" ? (
          <VerificationScreen navigation={{ goBack: () => setTab("queue") }} />
        ) : tab === "report" ? (
          <ReportScreen
            onFiled={(ref) => {
              setReloadKey((k) => k + 1);
              if (ref && !staff) {
                setSheet({ kind: "detail", ref });
              } else {
                setTab(staff ? "queue" : "home");
              }
            }}
          />
        ) : tab === "home" ? (
          <MyReportsScreen onOpen={openDetail} reloadKey={reloadKey} name={user?.name} />
        ) : tab === "insights" ? (
          <InsightsScreen reloadKey={reloadKey} />
        ) : tab === "alerts" ? (
          <AlertsScreen onOpen={openDetail} onRead={() => setReloadKey((k) => k + 1)} />
        ) : (
          <ProfileScreen
            user={user}
            onSignOut={signOut}
            onOpenOutbox={() => setSheet({ kind: "outbox" })}
            onOpenHelp={() => setSheet({ kind: "help" })}
            onOpenKYC={() => setSheet({ kind: "kyc" })}
          />
        )}
      </View>

      {!sheet && (
        <BottomNavigation
          activeTab={tab}
          onTabPress={(name) => {
            setTab(name as Tab);
            setReloadKey((k) => k + 1);
          }}
          fabIcon="add"
          fabOnPress={() => setTab("report")}
          items={
            staff
              ? [
                  { name: "queue", icon: "reportList", label: "Queue" },
                  { name: "ops", icon: "map", label: "Ops" },
                  { name: "report", icon: "add", label: "Report", isFAB: true },
                  { name: "verify", icon: "checkCircle", label: "Verify" },
                  { name: "profile", icon: "profile", label: t("tab.profile") },
                ]
              : [
                  { name: "home", icon: "home", label: t("tab.home") },
                  { name: "report", icon: "add", label: "Report", isFAB: true },
                  { name: "alerts", icon: "notifications", label: t("tab.updates"), badge: unread },
                ]
          }
        />
      )}
    </SafeAreaView>
  );
}


const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight : 0,
  },
  boot: { flex: 1, backgroundColor: C.dark, alignItems: "center", justifyContent: "center" },
  bootLogo: { color: "#fff", fontSize: 28, fontWeight: "800", letterSpacing: 6, marginBottom: S.lg },
  bar: {
    backgroundColor: C.bg,
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wordmark: { color: C.ink, fontWeight: "800", letterSpacing: 4, fontSize: 15 },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  avatarText: { color: C.ink, fontWeight: "800", fontSize: 15 },
  body: { flex: 1, backgroundColor: C.bg },
});

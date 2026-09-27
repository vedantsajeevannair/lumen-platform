import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from "react-native";
import { notifications, markNotificationsRead, Notification } from "../api";
import { C, S, R, F, card, statusLabel, ago, TAB_CLEARANCE } from "../theme";
import { Empty } from "../ui";
import { Icon, IconName } from "../Icon";
import { useT } from "../i18n";

/** An icon and a colour for each kind of update, so the list scans at a glance. */
function look(type: string): { icon: IconName; tint: string; onTint: string } {
  switch (type.toUpperCase()) {
    case "COMPLETED":
    case "CLOSED":
      return { icon: "check", tint: C.ok, onTint: "#fff" };
    case "REJECTED":
    case "VERIFY_FAILED":
      return { icon: "x", tint: C.coral, onTint: "#fff" };
    case "ASSIGNED":
    case "STARTED":
      return { icon: "tool", tint: C.accent, onTint: "#fff" };
    case "REOPENED":
      return { icon: "rotate-ccw", tint: C.brand, onTint: C.ink };
    default:
      return { icon: "bell", tint: C.brand, onTint: C.ink };
  }
}

export default function AlertsScreen({ onOpen, onRead }: {
  onOpen: (ref: string) => void;
  onRead: () => void;
}) {
  const { t } = useT();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems((await notifications()).notifications ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Could not load updates.");
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (items === null) {
    return <View style={s.centre}><ActivityIndicator size="large" color={C.ink} /></View>;
  }

  const unread = items.filter((n) => !n.readAt).length;

  return (
    <FlatList
      data={items}
      keyExtractor={(n) => n.id}
      contentContainerStyle={items.length ? s.list : s.listEmpty}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={C.ink} onRefresh={async () => {
          setRefreshing(true); await load(); setRefreshing(false);
        }} />
      }
      ListHeaderComponent={
        items.length ? (
          <View style={s.head}>
            <View style={s.headText}>
              <Text style={s.h1}>{t("alerts.title")}</Text>
              <Text style={s.sub}>
                {unread ? t("alerts.unread", { n: unread }) : t("alerts.caughtUp")}
              </Text>
            </View>
            {/* A tick rather than the words "Mark all as read": the title is
                display size and the label sat on top of it. The action is
                still named for screen readers and for a long press. */}
            {unread > 0 && (
              <Pressable
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t("alerts.markAll")}
                style={({ pressed }) => [s.readAll, pressed && { opacity: 0.6 }]}
                onPress={async () => { await markNotificationsRead(); await load(); onRead(); }}
              >
                <Icon name="check" size={18} color={C.ink} />
              </Pressable>
            )}
          </View>
        ) : null
      }
      ListEmptyComponent={
        <Empty
          icon={error ? "alert-triangle" : "bell"}
          title={error ? t("common.couldNotLoad") : t("alerts.emptyTitle")}
          body={error ?? t("alerts.emptyBody")}
        />
      }
      renderItem={({ item }) => {
        const l = look(item.type);
        return (
          <Pressable
            style={({ pressed }) => [s.card, !item.readAt && s.unread, pressed && s.pressed]}
            onPress={async () => {
              if (!item.readAt) { await markNotificationsRead(item.id); await load(); onRead(); }
              if (item.complaint?.ref) onOpen(item.complaint.ref);
            }}
          >
            <View style={[s.tile, { backgroundColor: l.tint }]}>
              <Icon name={l.icon} size={18} color={l.onTint} />
            </View>

            <View style={s.body}>
              <View style={s.topRow}>
                <Text style={s.type}>{statusLabel(item.type)}</Text>
                <Text style={s.time}>{ago(item.createdAt)}</Text>
              </View>
              <Text style={s.message}>{item.message}</Text>
              {item.complaint && (
                <Text style={s.ref} numberOfLines={1}>
                  {item.complaint.ref} · {item.complaint.title}
                </Text>
              )}
            </View>

            {!item.readAt && <View style={s.dot} />}
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  list: { padding: S.xl, paddingBottom: S.xxxl + TAB_CLEARANCE, backgroundColor: C.bg },
  listEmpty: { flexGrow: 1, backgroundColor: C.bg, padding: S.xl, paddingBottom: S.xl + TAB_CLEARANCE },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },

  head: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: S.lg,
  },
  // Takes the room it needs and wraps, instead of running under the button.
  headText: { flex: 1, paddingRight: S.md },
  h1: { ...F.display },
  sub: { ...F.caption, marginTop: 2 },
  readAll: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.raised, borderWidth: 1, borderColor: C.line,
  },

  // The row is the card. Padding lives here rather than on the shared `card`
  // token, which carries only surface, radius and border.
  card: {
    ...card,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.md,
    padding: S.lg,
    marginBottom: S.md,
  },
  unread: { borderColor: C.brand, backgroundColor: C.brandSoft },
  pressed: { backgroundColor: C.raised },

  tile: {
    width: 38, height: 38, borderRadius: R.md,
    alignItems: "center", justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  topRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", gap: S.sm,
  },
  type: { ...F.overline, fontSize: 10, color: C.body },
  time: { ...F.caption, fontSize: 11 },
  message: { ...F.bodyStrong, marginTop: 3 },
  ref: { ...F.caption, fontSize: 12, marginTop: 4 },

  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.coral, marginTop: 6,
  },
});

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { myComplaints, Complaint } from "../api";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../design-system/ThemeContext";
import { LumenIcon } from "../design-system/icons/LumenIcon";
import { Avatar } from "../design-system/components/Avatar";
import { StatCard } from "../design-system/components/StatCard";
import { FilterChip } from "../design-system/components/FilterChip";
import { readOutbox, flushOutbox, Queued } from "../outbox";
import { C, S, R, F, card, tone, statusLabel, ago, stageOf, STAGES, TAB_CLEARANCE } from "../theme";
import { Chip, Empty, StatusCard, TileRow, BigStat } from "../ui";
import { useT } from "../i18n";

const FILTERS = ["All", "Open", "Resolved"] as const;
type Filter = (typeof FILTERS)[number];

// What a citizen means by "resolved" is not one status, and they should not
// have to learn the workflow's vocabulary to filter their own reports.
const DONE = ["RESOLVED", "CLOSED", "REJECTED"];

/** Which greeting applies now. The wording itself comes from the dictionary. */
function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? "home.morning" : h < 17 ? "home.afternoon" : "home.evening";
}

export default function MyReportsScreen({ onOpen, reloadKey, name }: {
  onOpen: (ref: string) => void;
  reloadKey: number;
  name?: string;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const [items, setItems] = useState<Complaint[] | null>(null);
  const [queued, setQueued] = useState<Queued[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const load = useCallback(async () => {
    setQueued(await readOutbox());
    try {
      setError(null);
      setItems(await myComplaints());
    } catch (e: any) {
      setError(e?.message ?? "Could not load your reports.");
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  // Anything queued while offline is pushed out on arriving here, which is the
  // natural moment: the user has just asked to see their reports.
  useEffect(() => {
    (async () => {
      if (!(await readOutbox()).length) return;
      const { sent } = await flushOutbox();
      if (sent.length) load();
      else setQueued(await readOutbox());
    })();
  }, [load, reloadKey]);

  const shown = useMemo(() => {
    if (!items) return [];
    const needle = q.trim().toLowerCase();
    return items.filter((c) => {
      const done = DONE.includes((c.status ?? "").toUpperCase());
      if (filter === "Open" && done) return false;
      if (filter === "Resolved" && !done) return false;
      if (!needle) return true;
      return (
        c.title.toLowerCase().includes(needle) ||
        c.ref.toLowerCase().includes(needle) ||
        (c.category ?? "").toLowerCase().includes(needle)
      );
    });
  }, [items, q, filter]);

  if (items === null) {
    return <View style={s.centre}><ActivityIndicator size="large" color={C.brand} /></View>;
  }

  const resolved = items.filter((c) => DONE.includes((c.status ?? "").toUpperCase())).length;

  return (
    <FlatList
      data={shown}
      keyExtractor={(c) => c.id}
      contentContainerStyle={shown.length ? s.list : s.listEmpty}
      refreshControl={
        <RefreshControl refreshing={refreshing} tintColor={C.brand} onRefresh={async () => {
          setRefreshing(true); await flushOutbox(); await load(); setRefreshing(false);
        }} />
      }
      ListHeaderComponent={
        items.length ? (
          <View>
            {/* The backdrop of the design system's dashboard: a soft wash from
                the top-left and one accent orb behind the greeting. Both are
                decoration and carry no information, so neither is announced. */}
            <LinearGradient
              colors={["#E8F4FF", "#F0F7FF", colors.bgBase]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.3, y: 0.5 }}
              style={s.backdrop}
              pointerEvents="none"
            />
            <View pointerEvents="none" style={[s.orb, { backgroundColor: colors.brand + "18" }]} />

            <View style={s.header}>
              <View style={{ flex: 1 }}>
                <View style={s.greetingRow}>
                  <View style={s.liveDot} />
                  <Text style={s.live}>LIVE</Text>
                </View>
                <Text style={s.hello}>
                  {t(greetingKey() as any)}, {(name ?? "there").split(" ")[0]}
                </Text>
                <View style={s.locationRow}>
                  <LumenIcon name="calendar" size="xs" color={colors.textTertiary} />
                  <Text style={s.today}>
                    {new Date().toLocaleDateString(undefined, {
                      weekday: "long", month: "long", day: "numeric",
                    })}
                  </Text>
                </View>
              </View>
              <Avatar name={name ?? "You"} size="md" role="citizen" online />
            </View>

            <Text style={s.section}>{t("home.latest")}</Text>
            <StatusCard
              ref_={items[0].ref}
              title={items[0].title}
              status={items[0].status}
              priority={items[0].priority}
              onPress={() => onOpen(items[0].ref)}
            />

            <Text style={s.section}>{t("home.glance")}</Text>
            <View style={s.statRow}>
              <View style={s.statCell}>
                <StatCard
                  label="Open"
                  value={items.length - resolved}
                  icon="report"
                  variant="brand"
                  compact
                />
              </View>
              <View style={s.statCell}>
                <StatCard
                  label="Resolved"
                  value={resolved}
                  icon="checkCircle"
                  variant="success"
                  compact
                />
              </View>
              <View style={s.statCell}>
                <StatCard
                  label={queued.length ? "Waiting to send" : "Total"}
                  value={queued.length ? queued.length : items.length}
                  icon={queued.length ? "upload" : "reportList"}
                  variant={queued.length ? "warning" : "brand"}
                  compact
                />
              </View>
            </View>

            <Text style={s.section}>{t("home.all")}</Text>
            <View style={s.searchRow}>
              <LumenIcon name="search" size="sm" color={colors.textTertiary} />
              <TextInput style={s.search} value={q} onChangeText={setQ}
                placeholder={t("home.search")} placeholderTextColor={C.muted}
                autoCorrect={false} />
            </View>

            <View style={s.filters}>
              {FILTERS.map((f) => (
                <FilterChip
                  key={f}
                  label={t(("home.filter" + f) as any)}
                  selected={filter === f}
                  onToggle={() => setFilter(f)}
                />
              ))}
            </View>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <Empty
          icon={error ? "alert-triangle" : items.length ? "search" : "camera"}
          title={error ? t("common.couldNotLoad") : items.length ? t("home.noMatchTitle") : t("home.emptyTitle")}
          body={
            error ??
            (items.length
              ? t("home.noMatchBody")
              : t("home.emptyBody"))
          }
        />
      }
      renderItem={({ item }) => {
        const t = tone(item.priority);
        return (
          <Pressable
            onPress={() => onOpen(item.ref)}
            style={({ pressed }) => [card, s.card, pressed && s.cardPressed]}
          >
            <View style={[s.accent, { backgroundColor: t.fg }]} />
            <View style={s.cardBody}>
              <View style={s.rowTop}>
                <Text style={s.ref}>{item.ref}</Text>
                <View style={[s.pill, { backgroundColor: t.bg }]}>
                  <Text style={[s.pillText, { color: t.fg }]}>{statusLabel(item.status)}</Text>
                </View>
              </View>
              <Text style={s.title} numberOfLines={2}>{item.title}</Text>
              <View style={s.metaRow}>
                <Text style={s.meta} numberOfLines={1}>
                  {item.category ?? "Unclassified"}
                  {item.department?.name ? ` · ${item.department.name}` : ""}
                </Text>
                <Text style={s.time}>{ago(item.createdAt)}</Text>
              </View>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const s = StyleSheet.create({
  backdrop: { position: "absolute", top: -60, left: -40, right: -40, height: 320 },
  orb: {
    position: "absolute", top: -70, right: -70,
    width: 240, height: 240, borderRadius: 120,
  },
  header: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", marginBottom: S.xl,
  },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#12B76A" },
  live: { ...F.overline, fontSize: 10, letterSpacing: 1.5 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  statRow: { flexDirection: "row", gap: S.sm, alignItems: "stretch" },
  statCell: { flex: 1 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: S.sm,
    backgroundColor: C.surface, borderRadius: R.pill,
    borderWidth: 1.5, borderColor: C.lineStrong, paddingHorizontal: S.lg,
  },
  list: { padding: S.xl, paddingBottom: S.xxxl + TAB_CLEARANCE, backgroundColor: C.bg },
  listEmpty: { flexGrow: 1, backgroundColor: C.bg, padding: S.xl, paddingBottom: S.xl + TAB_CLEARANCE },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  __dead_blob: {
    position: "absolute", top: -34, left: -42, width: 104, height: 104,
    borderRadius: 52, backgroundColor: C.brand,
  },
  hello: { ...F.display, fontSize: 26 },
  today: { ...F.caption, marginTop: 2, marginBottom: S.xxl },
  section: { ...F.overline, marginTop: S.xxl, marginBottom: S.md },

  search: {
    flex: 1, paddingVertical: 13, fontSize: 15, color: C.ink,
    // No border or background of its own: searchRow draws the field, and a
    // second outline inside the first is the classic double-border look.
    backgroundColor: "transparent", borderWidth: 0,
  },
  filters: { flexDirection: "row", gap: S.sm, marginTop: S.md, marginBottom: S.lg },

  card: { marginBottom: S.md, padding: 0, flexDirection: "row", overflow: "hidden" },
  cardPressed: { backgroundColor: C.raised },
  accent: { width: 4 },
  cardBody: { flex: 1, padding: S.lg },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ref: { ...F.mono },
  pill: { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.pill },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  title: { ...F.heading, marginTop: S.sm },
  metaRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginTop: S.sm,
  },
  meta: { ...F.caption, flex: 1, paddingRight: S.sm },
  time: { ...F.caption, fontSize: 12 },
});

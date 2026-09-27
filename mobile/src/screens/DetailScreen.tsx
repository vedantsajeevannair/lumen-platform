import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Linking, Modal, Platform, Pressable,
  ScrollView, Share, StyleSheet, Text, TextInput, View,
} from "react-native";
import { complaint, mediaUrl, reopenComplaint, API_URL, ComplaintDetail, Detection } from "../api";
import { slaState } from "../utils/sla";
import { C, S, R, F, card, tone, statusLabel, ago } from "../theme";
import { Meter, SectionTitle, StatusCard } from "../ui";
import { Icon } from "../Icon";
import { useT } from "../i18n";

export default function DetailScreen({ refCode, onBack }: {
  refCode: string;
  onBack: () => void;
}) {
  const { t } = useT();
  const [c, setC] = useState<ComplaintDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendReopen() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await reopenComplaint(refCode, reason.trim());
      setReopening(false);
      setReason("");
      // Re-read rather than patch the status locally: reopening also clears
      // the engineer and adds a timeline entry, and showing a half-updated
      // copy of that would be worse than a moment's wait.
      setC(await complaint(refCode));
    } catch (e: any) {
      Alert.alert("Could not reopen", e?.message ?? "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    complaint(refCode).then(setC).catch((e) => setError(e?.message ?? "Could not load."));
  }, [refCode]);

  if (error) {
    return (
      <View style={s.centre}>
        <Text style={s.err}>{error}</Text>
        <Pressable onPress={onBack} hitSlop={10}><Text style={s.back}>← Back</Text></Pressable>
      </View>
    );
  }
  if (!c) return <View style={s.centre}><ActivityIndicator size="large" color={C.ink} /></View>;

  const image = c.images?.[0];
  // The annotated copy is what the detector produced: boxes for potholes and
  // garbage, an outline for a manhole. Falls back to the original if the
  // service was unavailable when the report was filed.
  const shown = mediaUrl(image?.annotated ?? image?.path);
  let detections: Detection[] = [];
  try {
    detections = image?.detections ? JSON.parse(image.detections) : [];
  } catch {
    detections = [];
  }
  const tn = tone(c.priority);

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <View style={s.headRow}>
        <Pressable onPress={onBack} hitSlop={12} style={s.backRow}>
          <View style={s.backInner}>
            <Icon name="chevron-left" size={18} color={C.ink} />
            <Text style={s.back}>{t("detail.back")}</Text>
          </View>
        </Pressable>

        {/* A web link rather than the lumen:// deep link, because a share is
            usually read by someone who does not have the app — a scheme they
            cannot open is a dead end. The site opens the same complaint. */}
        <Pressable
          onPress={() => {
            Share.share({
              message:
                `${c.ref}: ${c.title}\n` +
                `${statusLabel(c.status)}${c.address ? ` · ${c.address}` : ""}\n` +
                `${API_URL}/app/complaints/${c.ref}`,
            }).catch(() => { /* dismissing the sheet is not an error */ });
          }}
          hitSlop={12}
          style={s.shareBtn}
        >
          <Icon name="share-2" size={17} color={C.body} />
        </Pressable>
      </View>

      <StatusCard ref_={c.ref} title={c.title} status={c.status} priority={c.priority} />

      {/* When it is due. The department's target has always been on the
          record; until now the person who filed the report could not see it. */}
      {(() => {
        const sla = slaState(c);
        if (sla.kind === "none") return null;
        const overdue = sla.kind === "overdue";
        return (
          <View style={[s.slaRow, overdue && s.slaRowLate]}>
            <Icon
              name={overdue ? "alert-triangle" : sla.kind === "done" ? "check-circle" : "clock"}
              size={14}
              color={overdue ? C.bad : C.muted}
            />
            <Text style={[s.slaText, overdue && s.slaTextLate]}>{sla.label}</Text>
          </View>
        );
      })()}

      <Text style={[s.meta, { marginTop: S.lg }]}>
        {c.category ?? "Unclassified"}
        {c.department?.name ? `  ·  ${c.department.name}` : ""}
        {c.createdAt ? `  ·  ${ago(c.createdAt)}` : ""}
      </Text>
      {c.address && (
        <Pressable
          style={s.addressRow}
          disabled={c.lat == null || c.lng == null}
          onPress={() => {
            // Handed to whatever map app the phone already has, rather than
            // embedding one: a map view needs an API key per platform, and a
            // key that expires is a screen that breaks in front of an audience.
            const q = `${c.lat},${c.lng}`;
            const url = Platform.select({
              ios: `maps://?q=${encodeURIComponent(c.title)}&ll=${q}`,
              android: `geo:${q}?q=${q}(${encodeURIComponent(c.title)})`,
              default: `https://www.google.com/maps/search/?api=1&query=${q}`,
            })!;
            Linking.openURL(url).catch(() =>
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {}));
          }}
        >
          <Icon name="map-pin" size={13} color={C.muted} />
          <Text style={s.address}>{c.address}</Text>
          {c.lat != null && <Text style={s.openMap}>{t("detail.openMaps")}</Text>}
        </Pressable>
      )}

      {shown && (
        <Pressable onPress={() => setZoom(true)} style={s.imageWrap}>
          <Image source={{ uri: shown }} style={s.image} resizeMode="cover" />
          <View style={s.imageTag}><Text style={s.imageTagText}>MODEL OUTPUT</Text></View>
          <View style={s.expand}><Icon name="maximize-2" size={14} color="#fff" /></View>
        </Pressable>
      )}

      {/* Full screen, because the outline is the evidence and it is worth
          being able to look at it properly. */}
      <Modal visible={zoom} transparent animationType="fade" onRequestClose={() => setZoom(false)}>
        <Pressable style={s.zoomWrap} onPress={() => setZoom(false)}>
          {shown && <Image source={{ uri: shown }} style={s.zoomImage} resizeMode="contain" />}
          <View style={s.zoomClose}><Icon name="x" size={20} color="#fff" /></View>
        </Pressable>
      </Modal>

      <SectionTitle>{t("detail.found")}</SectionTitle>
      {detections.length === 0 ? (
        <View style={[card, s.block]}>
          <Text style={s.body}>
            {t("detail.nothing")}
          </Text>
        </View>
      ) : (
        <View style={[card, s.block, { paddingVertical: S.xs }]}>
          {detections.map((d, i) => (
            <View key={i} style={[s.detRow, i === 0 && { borderTopWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={s.detLabel}>{d.label}</Text>
                <Text style={s.detKind}>{d.polygon ? t("detail.outlined") : t("detail.boxed")}</Text>
              </View>
              <Text style={s.detConf}>{Math.round(d.confidence * 100)}%</Text>
            </View>
          ))}
        </View>
      )}

      {c.severityScore != null && (
        <>
          <SectionTitle>{t("detail.severity")}</SectionTitle>
          <View style={[card, s.block]}>
            <View style={s.sevRow}>
              <Text style={s.sevNum}>{Math.round(c.severityScore)}</Text>
              <Text style={s.sevOf}>/ 100</Text>
              <View style={{ flex: 1 }} />
              <Text style={[s.sevBand, { color: tn.fg }]}>{c.priority ?? ""}</Text>
            </View>
            <View style={{ marginTop: S.md }}>
              <Meter value={c.severityScore} priority={c.priority} />
            </View>
          </View>
        </>
      )}

      <SectionTitle>{t("detail.progress")}</SectionTitle>
      <View style={s.timeline}>
        {(c.events ?? []).slice(0, 8).map((e, i, arr) => (
          <View key={e.id} style={s.event}>
            <View style={s.rail}>
              <View style={[s.node, i === 0 && s.nodeFirst]} />
              {i < arr.length - 1 && <View style={s.line} />}
            </View>
            <View style={s.eventBody}>
              <Text style={s.eventType}>{statusLabel(e.type)}</Text>
              <Text style={s.eventMsg}>{e.message}</Text>
              <Text style={s.eventTime}>{ago(e.createdAt)}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Only for a completed report, and only the person who filed it — the
          server enforces both. Without this the resident whose pothole was
          marked fixed but is still there had nowhere to say so. */}
      {c.status === "CLOSED" && (
        <View style={s.reopenBox}>
          {!reopening ? (
            <>
              <Text style={s.reopenTitle}>Is this actually fixed?</Text>
              <Text style={s.reopenBody}>
                If the problem is still there, say so and it goes back to the department.
              </Text>
              <Pressable onPress={() => setReopening(true)} style={s.reopenBtn}>
                <Text style={s.reopenBtnText}>Still a problem</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={s.reopenTitle}>What is still wrong?</Text>
              <TextInput
                style={s.reopenInput}
                value={reason}
                onChangeText={setReason}
                placeholder="The pothole was filled but has opened again"
                placeholderTextColor={C.muted}
                multiline
                editable={!busy}
              />
              <View style={s.reopenActions}>
                <Pressable
                  onPress={() => { setReopening(false); setReason(""); }}
                  disabled={busy}
                  style={s.reopenCancel}
                >
                  <Text style={s.reopenCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={sendReopen}
                  disabled={busy || !reason.trim()}
                  style={[s.reopenBtn, (busy || !reason.trim()) && s.reopenBtnOff]}
                >
                  <Text style={s.reopenBtnText}>{busy ? "Sending…" : "Reopen report"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: S.xl, paddingBottom: S.xxxl, backgroundColor: C.bg, flexGrow: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: S.xxl, backgroundColor: C.bg },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  shareBtn: { padding: S.sm },
  backRow: { marginBottom: S.lg },
  backInner: { flexDirection: "row", alignItems: "center", marginLeft: -4 },
  back: { color: C.ink, fontWeight: "800", fontSize: 14 },
  err: { color: C.bad, marginBottom: S.lg, textAlign: "center" },

  ref: { ...F.mono },
  pill: { paddingHorizontal: S.md, paddingVertical: 4, borderRadius: R.pill },
  pillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  title: { ...F.title, marginTop: S.sm },
  meta: { ...F.caption, marginTop: 6 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: S.xs },
  address: { ...F.caption },
  openMap: { ...F.caption, fontSize: 12, fontWeight: "800", color: C.ink },
  expand: {
    position: "absolute", top: S.md, right: S.md,
    backgroundColor: "rgba(10,10,10,0.6)", borderRadius: R.sm, padding: 6,
  },
  zoomWrap: {
    flex: 1, backgroundColor: "rgba(10,10,10,0.94)",
    alignItems: "center", justifyContent: "center",
  },
  zoomImage: { width: "100%", height: "80%" },
  zoomClose: { position: "absolute", top: 54, right: S.xl },

  imageWrap: { marginTop: S.lg, borderRadius: R.lg, overflow: "hidden", backgroundColor: C.raised },
  image: { width: "100%", height: 250 },
  imageTag: {
    position: "absolute", top: S.md, left: S.md, backgroundColor: "rgba(10,14,25,0.7)",
    paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.sm,
  },
  imageTagText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.9 },

  block: { padding: S.lg },
  body: { ...F.body },
  detRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: S.md,
    borderTopWidth: 1, borderTopColor: C.line,
  },
  detLabel: { ...F.bodyStrong },
  detKind: { ...F.caption, fontSize: 11, marginTop: 1 },
  detConf: { fontSize: 17, fontWeight: "800", color: C.ink },

  sevRow: { flexDirection: "row", alignItems: "baseline" },
  sevNum: { fontSize: 30, fontWeight: "800", color: C.ink, letterSpacing: -1 },
  sevOf: { ...F.caption, marginLeft: 4 },
  sevBand: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },

  slaRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: S.md, paddingVertical: 8, paddingHorizontal: S.md,
    backgroundColor: C.surface, borderRadius: R.md,
    borderWidth: 1, borderColor: C.line,
  },
  slaRowLate: { borderColor: C.bad, backgroundColor: C.badSoft },
  slaText: { ...F.caption, color: C.body, fontWeight: "600" },
  slaTextLate: { color: C.bad, fontWeight: "700" },

  reopenBox: {
    marginTop: S.xxl, padding: S.lg, backgroundColor: C.surface,
    borderRadius: R.lg, borderWidth: 1, borderColor: C.line,
  },
  reopenTitle: { ...F.body, fontWeight: "700", color: C.ink },
  reopenBody: { ...F.caption, color: C.muted, marginTop: 4, lineHeight: 19 },
  reopenInput: {
    marginTop: S.md, minHeight: 78, textAlignVertical: "top",
    borderWidth: 1.5, borderColor: C.line, borderRadius: R.md,
    backgroundColor: C.bg, padding: S.md, fontSize: 15, color: C.ink,
  },
  reopenActions: { flexDirection: "row", gap: S.sm, marginTop: S.md, alignItems: "center" },
  reopenBtn: {
    marginTop: S.md, alignSelf: "flex-start",
    paddingVertical: 10, paddingHorizontal: S.lg,
    borderRadius: R.pill, backgroundColor: C.ink,
  },
  reopenBtnOff: { opacity: 0.45 },
  reopenBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  reopenCancel: { marginTop: S.md, paddingVertical: 10, paddingHorizontal: S.md },
  reopenCancelText: { ...F.caption, color: C.muted, fontWeight: "600" },

  timeline: { paddingLeft: 2 },
  event: { flexDirection: "row" },
  rail: { width: 22, alignItems: "center" },
  node: {
    width: 9, height: 9, borderRadius: 5, backgroundColor: C.lineStrong, marginTop: 6,
  },
  nodeFirst: { backgroundColor: C.ink, width: 11, height: 11, borderRadius: 6 },
  line: { flex: 1, width: 1.5, backgroundColor: C.line, marginVertical: 3 },
  eventBody: { flex: 1, paddingBottom: S.lg, paddingLeft: S.sm },
  eventType: { ...F.overline, fontSize: 10, color: C.body },
  eventMsg: { ...F.body, marginTop: 3 },
  eventTime: { ...F.caption, fontSize: 12, marginTop: 3 },
});

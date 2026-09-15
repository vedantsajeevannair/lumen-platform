import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, Popup, Tooltip, LayersControl, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useApi } from "../lib/useApi";
import { PageHeader, Card } from "../components/ui";

type C = {
  id: string; ref: string; title: string; lat: number; lng: number; zone: string;
  category: string; civicCategory: string | null; status: string; priority: string;
  severityScore: number | null; severityBand: string | null;
  createdAt: string; slaHours: number | null;
  engineer: { code: string; name: string } | null;
};
type E = {
  id: string; code: string; name: string; zone: string; status: string;
  lat: number; lng: number; skills: string; openJobs: number;
  department: { name: string } | null;
};
type Landmark = {
  name: string; type?: string; lat: number; lng: number;
  radiusM: number; risk?: number;
};

const BAND: Record<string, string> = {
  SEVERE: "#ef4444", SIGNIFICANT: "#f59e0b", MODERATE: "#0ea5e9",
  MINOR: "#94a3b8", NONE: "#cbd5e1",
};

/** Bengaluru centre — where the map opens before it fits to the data. */
const CENTRE: [number, number] = [12.9716, 77.5946];

/**
 * How long a complaint counts as new, and the colour that says so.
 *
 * Magenta because nothing else on the map uses it — severity owns red through
 * slate, engineers own emerald, and the landmark badges own the rest.
 */
const NEW_FOR_HOURS = 24;
const NEW_COLOUR = "#db2777";

/**
 * Leaflet ships its marker icons as separate image files resolved by relative
 * URL, which a bundler rewrites and breaks. Engineers are drawn as an inline
 * SVG pin instead, so nothing has to be fetched.
 */
const engineerIcon = (openJobs: number) =>
  L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="width:26px;height:26px;border-radius:6px;background:#10b981;border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;
      color:#fff;font:600 11px system-ui">${openJobs}</div>`,
  });

/**
 * Landmark kinds, matching lib/landmarks.ts on the backend.
 *
 * Colour carries the kind and the glyph repeats it, so the map stays readable
 * for anyone who cannot separate the hues.
 */
const LANDMARK_KIND: Record<string, { glyph: string; colour: string; label: string }> = {
  HOSPITAL:  { glyph: "H", colour: "#dc2626", label: "Hospital" },
  TRANSPORT: { glyph: "T", colour: "#7c3aed", label: "Transport hub" },
  SCHOOL:    { glyph: "S", colour: "#2563eb", label: "School" },
  MARKET:    { glyph: "M", colour: "#a16207", label: "Market" },
};
const kindOf = (t?: string) => LANDMARK_KIND[t ?? ""] ?? { glyph: "•", colour: "#4f46e5", label: "Landmark" };

/**
 * A landmark needs a permanent, readable label, not a hover tooltip.
 *
 * When a complaint's priority breakdown says "Near School +9", the reviewer's
 * next move is to look for that school on the map. A faint dashed ring with the
 * name hidden behind a hover reads as decoration, so the claim looks unverified.
 * The name and the exact number of points it contributes are drawn on the map.
 */
const landmarkIcon = (name: string, type?: string, risk?: number, withName = true) => {
  const k = kindOf(type);
  const badge = `<span style="width:19px;height:19px;flex:none;border-radius:50%;background:${k.colour};
      color:#fff;display:flex;align-items:center;justify-content:center;font:700 10px system-ui;
      box-shadow:0 1px 4px rgba(0,0,0,.3);border:1.5px solid #fff">${k.glyph}</span>`;

  // Below a useful zoom the names of twenty-two landmarks overlap into an
  // unreadable mess, so only the coloured badge is drawn and the name moves to
  // the tooltip. The full label returns once there is room for it.
  if (!withName) {
    return L.divIcon({
      className: "", iconSize: [0, 0], iconAnchor: [0, 0],
      html: `<div style="position:absolute;transform:translate(-50%,-50%)">${badge}</div>`,
    });
  }

  // The "+N" is dropped rather than rendered as "+undefined" when an older
  // backend is still serving landmarks without their risk weighting.
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    html: `<div style="position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;
      gap:5px;white-space:nowrap;background:#fff;border:1.5px solid ${k.colour};border-radius:999px;
      padding:2px 8px 2px 3px;box-shadow:0 1px 5px rgba(0,0,0,.28)">
      ${badge}
      <span style="font:600 11px system-ui;color:#0f172a">${name}</span>
      ${typeof risk === "number"
        ? `<span style="font:700 10px system-ui;color:${k.colour}">+${risk}</span>`
        : ""}
    </div>`,
  });
};

/** Current zoom, so labels can be shown only when there is room for them. */
function useZoom() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useEffect(() => {
    const on = () => setZoom(map.getZoom());
    map.on("zoomend", on);
    return () => { map.off("zoomend", on); };
  }, [map]);
  return zoom;
}

/**
 * The civic context that drives priority: hospitals, transport interchanges,
 * highway junctions, schools, government offices, markets and lakes.
 *
 * Every one of these is a place `lib/priority.ts` scores against — the map and
 * the rule read the same list — so a complaint's "+12 near a hospital" can be
 * traced to the exact ring it falls inside.
 */
function LandmarkLayer({ landmarks, shown }: { landmarks: Landmark[]; shown: C[] }) {
  const zoom = useZoom();
  // Twenty-two name pills collide at city zoom; badges alone stay legible.
  const withNames = zoom >= 13;

  return (
    <>
      {landmarks.map((l) => {
        const k = kindOf(l.type);
        const inside = shown.filter(
          (c) => metresBetween(c.lat, c.lng, l.lat, l.lng) <= l.radiusM,
        ).length;
        return (
          <Fragment key={l.name}>
            <Circle
              center={[l.lat, l.lng]}
              radius={l.radiusM}
              pathOptions={{
                color: k.colour, weight: 2, fillColor: k.colour,
                fillOpacity: 0.12, dashArray: "6 4",
              }}
            >
              <Tooltip>
                {l.name} · a complaint within {l.radiusM} m scores
                {typeof l.risk === "number" ? ` +${l.risk}` : " higher"} on priority
              </Tooltip>
            </Circle>

            <Marker
              position={[l.lat, l.lng]}
              icon={landmarkIcon(l.name, l.type, l.risk, withNames)}
              zIndexOffset={500}
            >
              {!withNames && <Tooltip>{l.name}</Tooltip>}
              <Popup>
                <div className="min-w-[210px] text-xs">
                  <p className="font-semibold text-slate-900">{l.name}</p>
                  <p className="font-medium" style={{ color: k.colour }}>{k.label}</p>
                  <p className="mt-1.5 text-slate-600">
                    Any open complaint within <b>{l.radiusM} m</b> of here
                    {typeof l.risk === "number" ? <> gains <b>+{l.risk}</b> on</> : " gains a boost to"}{" "}
                    its priority score.
                  </p>
                  <p className="mt-1.5 text-slate-500">
                    <b>{inside}</b> of the complaints shown {inside === 1 ? "is" : "are"} inside this radius.
                  </p>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}

/**
 * Frame the map on the data rather than a fixed zoom.
 *
 * A hardcoded zoom is wrong the moment the complaints move — and on a narrow
 * container Leaflet can size itself before the layout settles and open far too
 * wide. Fitting to the markers' bounds is correct in both cases, and
 * invalidateSize forces a re-measure once the container has its real width.
 */
/**
 * Scrollbars down the right edge and along the bottom of the map.
 *
 * The arrows move in fixed steps; these say where you are. The thumb's
 * position within the track is the view's position within the area the
 * complaints occupy, so a glance answers "how far across the city am I?" —
 * which a map alone cannot tell you once the streets look alike.
 *
 * They are appended to the map container and marked non-propagating, so a
 * drag on a bar moves the bar and not the map underneath it. Both are driven
 * from the same bounds the pan limit uses, and they disappear if those bounds
 * were never set.
 *
 * Range inputs rather than hand-built thumbs: they come with keyboard support,
 * a focus ring and touch handling that would otherwise all need writing.
 */
function PanSliders() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const RES = 1000; // slider steps; finer than any pixel difference on screen

    const track =
      "position:absolute;z-index:900;appearance:none;-webkit-appearance:none;" +
      "background:#ffffff;border:1px solid #e2e8f0;border-radius:9px;" +
      "accent-color:#94a3b8;cursor:pointer;margin:0;padding:0;";

    const vert = document.createElement("input");
    vert.type = "range";
    vert.min = "0";
    vert.max = String(RES);
    vert.title = "Pan north and south";
    vert.setAttribute("aria-label", "Pan north and south");
    vert.style.cssText =
      track + "top:14px;right:8px;width:16px;height:calc(100% - 120px);" +
      // The vertical writing mode is what turns a range input on its side.
      // direction:rtl then puts the maximum at the top, so dragging the thumb
      // up moves the map north rather than south.
      "writing-mode:vertical-lr;direction:rtl;";

    const horiz = document.createElement("input");
    horiz.type = "range";
    horiz.min = "0";
    horiz.max = String(RES);
    horiz.title = "Pan east and west";
    horiz.setAttribute("aria-label", "Pan east and west");
    horiz.style.cssText =
      track + "left:14px;bottom:26px;height:16px;width:calc(100% - 90px);";

    const limits = () => map.options.maxBounds as L.LatLngBounds | undefined;

    // Map slider positions to the centre's place inside the bounds, and back.
    const sync = () => {
      const b = limits();
      if (!b) {
        vert.style.display = horiz.style.display = "none";
        return;
      }
      vert.style.display = horiz.style.display = "";
      const c = map.getCenter();
      const latSpan = b.getNorth() - b.getSouth();
      const lngSpan = b.getEast() - b.getWest();
      if (latSpan > 0) vert.value = String(Math.round(((c.lat - b.getSouth()) / latSpan) * RES));
      if (lngSpan > 0) horiz.value = String(Math.round(((c.lng - b.getWest()) / lngSpan) * RES));
    };

    const panTo = (fromVert: boolean) => {
      const b = limits();
      if (!b) return;
      const c = map.getCenter();
      const lat = fromVert
        ? b.getSouth() + (Number(vert.value) / RES) * (b.getNorth() - b.getSouth())
        : c.lat;
      const lng = fromVert
        ? c.lng
        : b.getWest() + (Number(horiz.value) / RES) * (b.getEast() - b.getWest());
      map.panTo([lat, lng], { animate: false });
    };

    L.DomEvent.on(vert, "input", () => panTo(true));
    L.DomEvent.on(horiz, "input", () => panTo(false));
    for (const el of [vert, horiz]) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);
      container.appendChild(el);
    }

    map.on("move zoomend", sync);
    sync();

    return () => {
      map.off("move zoomend", sync);
      vert.remove();
      horiz.remove();
    };
  }, [map]);

  return null;
}

/**
 * Arrow buttons that pan the map.
 *
 * Leaflet ships zoom buttons but nothing for panning, on the assumption that
 * everyone drags. Dragging is awkward here: the view is covered in markers, a
 * trackpad drag is easily read as a scroll, and on a laptop without a mouse
 * there is no obvious third option.
 *
 * Built as a real L.Control rather than a div positioned over the map. A plain
 * overlay sits inside Leaflet's own event surface, so a press on an arrow
 * would also start a map drag and the click would be swallowed —
 * disableClickPropagation on a control is the supported way out.
 *
 * Each press moves by a third of the visible map, which is far enough to make
 * progress and short enough to keep your bearings.
 */
function PanControl() {
  const map = useMap();

  useEffect(() => {
    const Pan = L.Control.extend({
      options: { position: "topleft" as L.ControlPosition },
      onAdd() {
        const wrap = L.DomUtil.create("div", "leaflet-bar");
        wrap.style.cssText =
          "display:grid;grid-template-columns:repeat(3,26px);grid-template-rows:repeat(3,26px);background:#fff;";

        const arrow = (glyph: string, area: string, dx: number, dy: number, label: string) => {
          const cell = L.DomUtil.create("a", "", wrap);
          cell.href = "#";
          cell.title = label;
          cell.setAttribute("aria-label", label);
          cell.textContent = glyph;
          cell.style.cssText =
            `grid-area:${area};display:flex;align-items:center;justify-content:center;` +
            "font:700 12px system-ui;color:#334155;border:0;";
          L.DomEvent.on(cell, "click", (e) => {
            L.DomEvent.stop(e);
            const { x, y } = map.getSize();
            map.panBy([dx * x * 0.33, dy * y * 0.33]);
          });
        };

        arrow("▲", "1 / 2", 0, -1, "Pan north");
        arrow("◀", "2 / 1", -1, 0, "Pan west");
        arrow("▶", "2 / 3", 1, 0, "Pan east");
        arrow("▼", "3 / 2", 0, 1, "Pan south");

        L.DomEvent.disableClickPropagation(wrap);
        return wrap;
      },
    });

    const control = new Pan();
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map]);

  return null;
}

/**
 * The points worth framing on, with far-flung strays left out.
 *
 * Fitting every point sounds right until one complaint is filed in another
 * city — a test report from Pune against a corpus in Bengaluru forced the
 * frame to span 700 km, and because the zoom floor and the pan limits are
 * derived from that frame, the city itself became a smudge that would not
 * enlarge. One outlier should not decide the view for the other three hundred.
 *
 * The centre is the median rather than the mean, so a stray cannot drag it,
 * and anything beyond a generous radius of that centre is dropped from the
 * framing only — every point is still drawn, and panning still reaches them.
 * If the spread is genuinely wide, everything survives the filter and the
 * behaviour is what it always was.
 */
const FRAME_RADIUS_DEG = 0.75; // ~80 km; a city and its outskirts

function framingPoints(points: [number, number][]): [number, number][] {
  if (points.length < 4) return points;
  const mid = (xs: number[]) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const cLat = mid(points.map((p) => p[0]));
  const cLng = mid(points.map((p) => p[1]));
  const near = points.filter(
    ([lat, lng]) => Math.abs(lat - cLat) <= FRAME_RADIUS_DEG && Math.abs(lng - cLng) <= FRAME_RADIUS_DEG,
  );
  return near.length ? near : points;
}

function FitToData({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    // Whether the reader has taken over. Once they have panned or zoomed,
    // re-framing would yank the map out from under them.
    let touched = false;
    const markTouched = () => { touched = true; };

    const fit = () => {
      map.invalidateSize();
      if (points.length === 0 || touched) return;

      // Refuse to frame against a container that has not finished laying out.
      // Fitting a 40px-wide box picks an absurd zoom, and since the floor below
      // is taken from whatever fitBounds chose, that absurd zoom became the
      // floor — the map opened deep inside one street and would not zoom out.
      // Waiting costs nothing: the resize observer calls this again.
      const size = map.getSize();
      if (size.x < 200 || size.y < 200) return;

      // A little slack around the data so edge markers are not flush against
      // the frame. The opening view follows the bulk of the complaints, not
      // the one filed two cities away.
      const frame = L.latLngBounds(framingPoints(points)).pad(0.12);
      map.fitBounds(frame, { padding: [40, 40], maxZoom: 16 });

      // Panning, though, must still reach every complaint — including the
      // outliers the frame ignored, which would otherwise be drawn on the map
      // and be impossible to scroll to. Confining it to all the points still
      // prevents the other failure: pan far enough on an unbounded map and you
      // are looking at an empty continent with no way back except reloading.
      map.setMaxBounds(L.latLngBounds(points).pad(0.25));

      // The zoom floor comes from the framed view rather than the full extent,
      // so a single distant report cannot force the city to open as a smudge
      // that will not enlarge.
      map.setMinZoom(map.getZoom());
    };

    // A single invalidateSize on mount is not enough. Leaflet builds its tile
    // grid from the container's measured width, and inside a flex card that
    // width is not final on the first paint — so it requested tiles for a
    // narrow strip and left the rest of the map grey and empty, which is
    // exactly where the landmarks happened to be. Re-measuring on the next
    // frame, once layout has settled, fills the whole viewport.
    fit();
    const raf = requestAnimationFrame(fit);

    // And keep it correct afterwards: collapsing the sidebar or resizing the
    // window changes the container without remounting the map. Re-fitting here
    // is also what rescues the first paint, when the container was still too
    // small to frame against — but only until the reader moves the map.
    map.on("dragstart", markTouched);
    map.getContainer().addEventListener("wheel", markTouched, { passive: true });

    const box = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      fit();
    });
    observer.observe(box);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      map.off("dragstart", markTouched);
      box.removeEventListener("wheel", markTouched);
    };
  }, [map, points]);

  return null;
}

const hoursOld = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000;

/** Same haversine the backend scores with, so the counts shown agree with it. */
function metresBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * GIS Map — every open complaint on the real street map.
 *
 * The previous version projected latitude and longitude onto a hand-drawn SVG
 * with decorative curves standing in for roads. The positions were right
 * relative to each other, but there was no way to tell which street a pothole
 * was on, and the "near a hospital" priority rule could not be checked by eye.
 * OpenStreetMap tiles fix both: the markers now sit on the actual roads, and
 * the landmark radii that drive priority are drawn where they really are.
 */
export function Gis() {
  const { data, loading } = useApi<{ complaints: C[]; engineers: E[]; landmarks: Landmark[] }>("/gis");
  const [band, setBand] = useState<string | null>(null);

  const shown = useMemo(
    () => (data?.complaints ?? []).filter((c) => !band || (c.severityBand ?? "NONE") === band),
    [data, band],
  );

  // Frame on everything that has a position — complaints, engineers and the
  // landmarks. Landmarks are included so a priority-raising place can never end
  // up outside the framed area, which would leave "Near School +9" pointing at
  // something off screen.
  const fitPoints = useMemo<[number, number][]>(
    () => [
      ...(data?.complaints ?? []).map((c) => [c.lat, c.lng] as [number, number]),
      ...(data?.engineers ?? []).map((e) => [e.lat, e.lng] as [number, number]),
      ...(data?.landmarks ?? []).map((l) => [l.lat, l.lng] as [number, number]),
    ],
    [data],
  );

  if (loading || !data) return <p className="text-slate-400">Loading map…</p>;
  const { engineers, landmarks } = data;
  const breached = shown.filter((c) => hoursOld(c.createdAt) > (c.slaHours ?? 48)).length;

  return (
    <>
      <PageHeader
        title="GIS Map"
        subtitle={`${shown.length} open complaints on the live street map · marker size by CV severity · ${engineers.length} engineers on duty`}
      />

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Filter</span>
          {["SEVERE", "SIGNIFICANT", "MODERATE", "MINOR"].map((b) => (
            <button
              key={b}
              onClick={() => setBand(band === b ? null : b)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                band === b ? "border-slate-400 bg-slate-100 font-semibold text-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: BAND[b] }} />
              {b.charAt(0) + b.slice(1).toLowerCase()}
            </button>
          ))}
          {band && (
            <button onClick={() => setBand(null)} className="text-xs text-brand-700 underline">clear</button>
          )}
          <span className="ml-auto text-xs text-slate-500">
            {breached} past SLA · click a marker for the complaint
          </span>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          {/* No +/- control: the map opens framed on the data and is locked to
              it, so the buttons only offered ways to end up somewhere useless.
              Scroll and pinch still zoom, between the fitted floor and 18.
              maxBoundsViscosity 1 makes the edge solid rather than springy. */}
          <MapContainer
            center={CENTRE}
            zoom={12}
            scrollWheelZoom
            zoomControl={false}
            // Not 1. At full viscosity the pan limit is a rigid wall: a drag
            // that approaches it stops dead and snaps back, which reads as the
            // map refusing to move rather than as an edge. A low value still
            // keeps the view over the city — it resists and eases back — while
            // leaving ordinary dragging inside it completely free.
            maxBoundsViscosity={0.25}
            maxZoom={18}
            style={{ height: 560, width: "100%" }}
          >
            <FitToData points={fitPoints} />
            {/* Zooming by trackpad alone is awkward on a dense city view, and
                a laptop without a wheel has no other way in. Placed left so it
                does not collide with the base-layer switcher on the right. */}
            <ZoomControl position="topleft" />
            <PanControl />
            <PanSliders />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Street">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Muted">
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
              </LayersControl.BaseLayer>
              {/* Satellite imagery: at close zoom the actual buildings around a
                  complaint are visible, which the drawn basemaps only outline. */}
              <LayersControl.BaseLayer name="Satellite">
                <TileLayer
                  attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            <LandmarkLayer landmarks={landmarks} shown={shown} />

            {shown.map((c) => {
              const sev = c.severityScore ?? 0;
              const colour = BAND[c.severityBand ?? "NONE"];
              const age = hoursOld(c.createdAt);
              const overdue = age > (c.slaHours ?? 48);
              const isNew = age < NEW_FOR_HOURS;
              return (
                <Fragment key={c.id}>
                  {/* Anything reported in the last 24 hours wears a magenta halo
                      so it stands out of a queue of seventy, then drops back to
                      looking like every other complaint once the day is out.
                      The halo sits outside the marker rather than replacing its
                      fill, because the fill is the severity and that is the more
                      important thing to keep readable. */}
                  {isNew && !overdue && (
                    <CircleMarker
                      center={[c.lat, c.lng]}
                      radius={5 + (sev / 100) * 9 + 5}
                      interactive={false}
                      pathOptions={{
                        color: NEW_COLOUR, weight: 2,
                        fillColor: NEW_COLOUR, fillOpacity: 0.15,
                      }}
                    />
                  )}
                <CircleMarker
                  center={[c.lat, c.lng]}
                  radius={5 + (sev / 100) * 9}
                  pathOptions={{
                    // Past its SLA outranks new: a complaint that is both is
                    // already late, and late is the thing to act on.
                    color: overdue ? "#7f1d1d" : isNew ? NEW_COLOUR : "#ffffff",
                    weight: overdue || isNew ? 2.5 : 1.5,
                    fillColor: colour,
                    fillOpacity: 0.85,
                  }}
                >
                  <Popup>
                    <div className="min-w-[210px] text-xs">
                      <Link to={`/app/complaints/${c.ref}`} className="font-mono font-bold text-brand-700 hover:underline">
                        {c.ref}
                      </Link>
                      <p className="mt-1 font-medium text-slate-800">{c.title}</p>
                      <table className="mt-2 w-full">
                        <tbody className="text-slate-600">
                          <tr><td className="pr-2">Damage</td><td className="font-medium text-slate-800">{c.category}</td></tr>
                          <tr><td className="pr-2">Priority</td><td className="font-medium text-slate-800">{c.priority}</td></tr>
                          <tr><td className="pr-2">Severity</td><td className="font-medium text-slate-800">{sev.toFixed(1)} / 100</td></tr>
                          <tr><td className="pr-2">Status</td><td className="font-medium text-slate-800">{c.status}</td></tr>
                          <tr><td className="pr-2">Zone</td><td className="font-medium text-slate-800">{c.zone}</td></tr>
                          <tr><td className="pr-2">Engineer</td><td className="font-medium text-slate-800">{c.engineer ? `${c.engineer.name} (${c.engineer.code})` : "Unassigned"}</td></tr>
                        </tbody>
                      </table>
                      {isNew && !overdue && (
                        <p className="mt-1.5 font-semibold" style={{ color: NEW_COLOUR }}>
                          New · reported {age < 1 ? "under an hour" : `${Math.floor(age)} h`} ago
                        </p>
                      )}
                      {overdue && <p className="mt-1.5 font-semibold text-red-700">Past its {c.slaHours ?? 48} h SLA</p>}
                    </div>
                  </Popup>
                </CircleMarker>
                </Fragment>
              );
            })}

            {engineers.map((e) => (
              <Marker key={e.id} position={[e.lat, e.lng]} icon={engineerIcon(e.openJobs)}>
                <Popup>
                  <div className="min-w-[190px] text-xs">
                    <p className="font-semibold text-slate-900">{e.name}</p>
                    <p className="font-mono text-[10px] text-slate-500">{e.code}</p>
                    <table className="mt-2 w-full">
                      <tbody className="text-slate-600">
                        <tr><td className="pr-2">Department</td><td className="font-medium text-slate-800">{e.department?.name ?? "—"}</td></tr>
                        <tr><td className="pr-2">Zone</td><td className="font-medium text-slate-800">{e.zone}</td></tr>
                        <tr><td className="pr-2">Open jobs</td><td className="font-medium text-slate-800">{e.openJobs}</td></tr>
                        <tr><td className="pr-2">Skills</td><td className="font-medium text-slate-800">{e.skills}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-400">Legend</span>
          {["SEVERE", "SIGNIFICANT", "MODERATE", "MINOR"].map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: BAND[b] }} />
              {b.charAt(0) + b.slice(1).toLowerCase()}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded-sm border-2 border-white bg-emerald-500 text-[8px] font-bold text-white shadow">n</span>
            Engineer, showing open jobs
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-full border-2"
              style={{ borderColor: NEW_COLOUR, background: `${NEW_COLOUR}26` }}
            />
            New · last {NEW_FOR_HOURS} h
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2 border-red-900" /> Past SLA
          </span>
          <span className="text-slate-400">Marker radius ∝ severity score</span>
        </div>

        {/* The civic context the priority rule scores against. Each badge is a
            real place, and the number is the points a complaint inside its
            radius gains — so the legend doubles as the scoring table. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <span className="font-semibold uppercase tracking-wide text-slate-400">
            Priority landmarks
          </span>
          {Object.entries(LANDMARK_KIND).map(([key, k]) => {
            const points = landmarks.find((l) => l.type === key)?.risk;
            return (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-white text-[8px] font-bold text-white shadow"
                  style={{ background: k.colour }}
                >
                  {k.glyph}
                </span>
                {k.label}
                {typeof points === "number" && (
                  <b style={{ color: k.colour }}>+{points}</b>
                )}
              </span>
            );
          })}
          <span className="text-slate-400">
            Names appear as you zoom in · location risk is capped at +18
          </span>
        </div>
      </Card>
    </>
  );
}

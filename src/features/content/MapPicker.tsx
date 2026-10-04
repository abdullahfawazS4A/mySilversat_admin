/**
 * A map to pick a point on, for the tower form.
 *
 * Typing a coordinate pair by hand is how a tower ends up in the sea, so the
 * operator can click the map (or drag the pin) and the form gets both numbers.
 * It stays two-way: typing into the fields moves the pin.
 *
 * Plain Leaflet on OpenStreetMap tiles — no key, no account. The pin is a CSS
 * dot rather than Leaflet's default image icon, which Vite does not bundle.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Iraq, for a tower that has no coordinates yet. */
const DEFAULT_CENTER: L.LatLngTuple = [33.3, 44.0];
const DEFAULT_ZOOM = 6;
const PICKED_ZOOM = 13;

const pin = L.divIcon({ className: 'map-pin', iconSize: [18, 18], iconAnchor: [9, 9] });

/** Six decimals is about ten centimetres — more is noise. */
const round = (value: number) => Math.round(value * 1e6) / 1e6;

const isSet = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);

export function MapPicker({
  latitude,
  longitude,
  onPick,
}: {
  latitude: number;
  longitude: number;
  onPick: (latitude: number, longitude: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const place = useRef<(at: L.LatLng) => void>(() => {});
  // The map's handlers are bound once; read the latest callback through a ref.
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!host.current) return;
    const start = isSet(latitude, longitude);
    const view = L.map(host.current, {
      center: start ? [latitude, longitude] : DEFAULT_CENTER,
      zoom: start ? PICKED_ZOOM : DEFAULT_ZOOM,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(view);

    place.current = (at: L.LatLng) => {
      if (marker.current) {
        marker.current.setLatLng(at);
        return;
      }
      marker.current = L.marker(at, { icon: pin, draggable: true })
        .addTo(view)
        .on('dragend', (event) => {
          const where = (event.target as L.Marker).getLatLng();
          pick.current(round(where.lat), round(where.lng));
        });
    };
    if (start) place.current(L.latLng(latitude, longitude));

    view.on('click', (event: L.LeafletMouseEvent) => {
      place.current(event.latlng);
      pick.current(round(event.latlng.lat), round(event.latlng.lng));
    });

    // The dialog sizes itself after mount; without this the tiles load for a
    // zero-sized box and the map comes up grey.
    const resize = new ResizeObserver(() => view.invalidateSize());
    resize.observe(host.current);

    map.current = view;
    return () => {
      resize.disconnect();
      view.remove();
      map.current = null;
      marker.current = null;
    };
    // Mount once; the effect below follows the fields.
  }, []);

  // Typed coordinates move the pin, and bring it into view if it left.
  useEffect(() => {
    const view = map.current;
    if (!view || !isSet(latitude, longitude)) return;
    const at = L.latLng(latitude, longitude);
    if (marker.current?.getLatLng().equals(at)) return;
    place.current(at);
    if (!view.getBounds().contains(at)) view.setView(at, Math.max(view.getZoom(), PICKED_ZOOM));
  }, [latitude, longitude]);

  return <div ref={host} className="map-picker" dir="ltr" />;
}

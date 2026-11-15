<script setup lang="ts">
import { Map as MlMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
// MapLibre 6 carga su worker desde un archivo aparte: se lo damos ya empaquetado por Vite.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

setWorkerUrl(workerUrl);

/**
 * Mapa (MapLibre + teselas de OpenStreetMap).
 * - discover: pide a la API las sedes con partidos activos del área visible.
 * - pick: al pulsar el mapa se elige una ubicación (v-model = { lat, lng }).
 */
const props = defineProps<{ center: [number, number]; zoom?: number; discover?: boolean; pick?: boolean; modelValue?: { lat: number; lng: number } | null }>();
const emit = defineEmits<{ select: [venue: any]; 'update:modelValue': [v: { lat: number; lng: number }] }>();

const el = ref<HTMLElement>();
const api = useApi();
let map: MlMap | undefined;
let markers: Marker[] = [];
let pickMarker: Marker | undefined;

const dot = (cls = '') => Object.assign(document.createElement('div'), { className: `marker ${cls}` });

async function loadVenues() {
  if (!map || !props.discover) return;
  const b = map.getBounds();
  if (b.getEast() - b.getWest() > 5 || b.getNorth() - b.getSouth() > 5) return; // demasiado lejos: la API lo rechaza
  try {
    const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((n) => n.toFixed(5)).join(',');
    const { venues } = await api(`/map/venues?bbox=${bbox}`);
    markers.forEach((m) => m.remove());
    markers = venues.map((v: any) => {
      const node = dot();
      node.title = v.name;
      node.addEventListener('click', (e) => { e.stopPropagation(); emit('select', v); });
      return new Marker({ element: node }).setLngLat([v.lng, v.lat]).addTo(map!);
    });
  } catch { /* sin conexión: el mapa sigue siendo usable */ }
}

function setPick(v?: { lat: number; lng: number } | null) {
  if (!map || !v) return;
  pickMarker ??= new Marker({ element: dot('pick') });
  pickMarker.setLngLat([v.lng, v.lat]).addTo(map);
}

const unsupported = ref(false);

onMounted(() => {
  try { init(); } catch { unsupported.value = true; } // dispositivo sin WebGL: la app sigue funcionando sin mapa
});

function init() {
  map = new MlMap({
    container: el.value!,
    center: [props.center[1], props.center[0]],
    zoom: props.zoom ?? 11.5,
    attributionControl: { compact: true },
    style: {
      version: 8,
      sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap' } },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
    },
  });
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  map.on('load', loadVenues);
  map.on('moveend', loadVenues);
  if (props.pick) {
    map.on('click', (e: any) => {
      const v = { lat: +e.lngLat.lat.toFixed(6), lng: +e.lngLat.lng.toFixed(6) };
      setPick(v); emit('update:modelValue', v);
    });
    setPick(props.modelValue);
  }
}
watch(() => props.center, (c) => map?.flyTo({ center: [c[1], c[0]], zoom: props.zoom ?? 11.5 }));
onBeforeUnmount(() => map?.remove());
</script>

<template>
  <div ref="el" class="map">
    <p v-if="unsupported" class="muted small" style="padding: 24px; text-align: center">Este dispositivo no puede mostrar el mapa. Tienes todos los eventos en la lista de abajo.</p>
  </div>
</template>

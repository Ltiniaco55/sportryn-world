<script setup lang="ts">
const api = useApi();
const cities = ref<any[]>([]);
const city = ref<any>(null);
const events = ref<any[]>([]);
const venue = ref<any>(null);
const loading = ref(true);
const failed = ref(false);

async function loadEvents() {
  events.value = (await api(`/events?city=${city.value.slug}`)).events;
}
onMounted(async () => {
  try {
    cities.value = (await api('/cities')).cities;
    city.value = cities.value[0] ?? null;
    if (city.value) await loadEvents();
  } catch { failed.value = true; } finally { loading.value = false; }
});
const live = computed(() => events.value.filter((e) => e.status === 'active'));
const open = computed(() => events.value.filter((e) => e.status === 'registration'));
</script>

<template>
  <div class="page wide">
    <header class="stack">
      <p class="eyebrow">Fútbol amateur cerca de ti</p>
      <h1>Dónde se juega <span class="lime">hoy</span></h1>
      <div v-if="cities.length > 1" class="tabs">
        <button v-for="c in cities" :key="c.id" :class="{ on: c.id === city?.id }" @click="city = c; venue = null; loadEvents()">{{ c.name }}</button>
      </div>
    </header>

    <div v-if="failed" class="error-box">No se pudo conectar con el servidor. Comprueba que la API está arrancada.</div>

    <section v-if="city" class="mapwrap">
      <MapView :center="[city.lat, city.lng]" discover @select="venue = $event" />
      <div v-if="venue" class="card sheet stack">
        <div class="row between">
          <div><h3>{{ venue.name }}</h3><p class="small muted">{{ venue.address }}</p></div>
          <button class="btn sm ghost" aria-label="Cerrar" @click="venue = null">Cerrar</button>
        </div>
        <NuxtLink v-for="e in venue.events" :key="e.id" :to="`/eventos/${e.id}`" class="row between venue-event">
          <span class="grow truncate">{{ e.name }}</span>
          <span class="small muted">{{ e.next_match_at ? `Próximo: ${fmtDay(e.next_match_at)}` : `${e.matches_count} partidos` }}</span>
        </NuxtLink>
      </div>
    </section>

    <section v-if="live.length" class="stack">
      <h2>En juego</h2>
      <div class="cards"><EventCard v-for="e in live" :key="e.id" :event="e" /></div>
    </section>

    <section v-if="open.length" class="stack">
      <h2>Inscripción abierta</h2>
      <div class="cards"><EventCard v-for="e in open" :key="e.id" :event="e" /></div>
    </section>

    <div v-if="!loading && !failed && !events.length" class="empty">
      Todavía no hay ligas ni torneos publicados en {{ city?.name ?? 'tu ciudad' }}.
    </div>
  </div>
</template>

<style scoped>
.mapwrap { position: relative; height: min(52vh, 460px); }
.sheet { position: absolute; left: 12px; right: 12px; bottom: 12px; box-shadow: var(--shadow); max-height: 70%; overflow: auto; }
.venue-event { padding: 10px 0; border-top: 1px solid var(--line); }
.cards { display: grid; gap: var(--s-3); grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
</style>

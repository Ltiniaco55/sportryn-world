<script setup lang="ts">
const route = useRoute();
const api = useApi();
const match = ref<any>(null);
const missing = ref(false);
const stickerOf = ref<number | null>(null);

onMounted(async () => {
  try { match.value = (await api(`/matches/${route.params.id}`)).match; } catch { missing.value = true; }
});
const closed = computed(() => match.value?.report_status === 'closed');
const goals = computed(() => (match.value?.events ?? []).filter((e: any) => e.type === 'goal'));
const label: Record<string, string> = { goal: 'Gol', yellow: 'Amarilla', red: 'Roja' };
</script>

<template>
  <div v-if="missing" class="page"><div class="empty">Este partido no existe o ya no está disponible.</div></div>
  <div v-else-if="match" class="page">
    <NuxtLink :to="`/eventos/${match.event_id}`" class="eyebrow">← {{ match.event_name }}</NuxtLink>

    <section class="card stack board">
      <p class="small muted">{{ fmtLong(match.scheduled_at) }}<template v-if="match.venue"> · {{ match.venue.name }}</template></p>
      <div class="match big">
        <NuxtLink :to="`/equipos/${match.home.id}`" class="home"><h2>{{ match.home.name }}</h2></NuxtLink>
        <span class="mid score">{{ closed ? `${match.home_score}–${match.away_score}` : 'vs' }}</span>
        <NuxtLink :to="`/equipos/${match.away.id}`"><h2>{{ match.away.name }}</h2></NuxtLink>
      </div>
      <span class="badge" :class="closed ? 'active' : 'registration'">{{ closed ? 'Final' : 'Por jugar' }}</span>
    </section>

    <template v-if="closed">
      <section v-if="match.events.length" class="stack">
        <h2>Acta</h2>
        <div class="card list">
          <div v-for="e in match.events" :key="e.id" class="row">
            <span class="score lime" style="width: 40px">{{ e.minute }}'</span>
            <span class="tag" :class="e.type">{{ label[e.type] }}</span>
            <span class="grow truncate">{{ e.first_name }} {{ e.last_name }}</span>
            <span class="small muted truncate">{{ e.team_id === match.home.id ? match.home.name : match.away.name }}</span>
          </div>
        </div>
      </section>

      <section class="stack">
        <h2>Stickers para tus historias</h2>
        <StickerShare :path="`/matches/${match.id}/sticker`" :filename="`sportryn-resultado-${match.id}`" title="Resultado del partido" />
        <div v-if="goals.length" class="card stack">
          <h3>¿Marcaste tú? Llévate tu +1</h3>
          <div class="row wrap">
            <button v-for="g in goals" :key="g.id" class="btn sm" :class="{ ghost: stickerOf !== g.id }" @click="stickerOf = g.id">
              {{ g.first_name }} {{ g.last_name }} · {{ g.minute }}'
            </button>
          </div>
        </div>
        <StickerShare v-if="stickerOf" :key="stickerOf" :path="`/match-events/${stickerOf}/sticker`" :filename="`sportryn-gol-${stickerOf}`" title="+1 gol" />
      </section>
    </template>
    <p v-else class="note">Cuando el árbitro cierre el acta verás aquí el resultado, los goles y los stickers para compartir.</p>
  </div>
</template>

<style scoped>
.board { text-align: center; justify-items: center; padding: var(--s-5) var(--s-4); }
.match.big { width: 100%; } .match.big .mid { font-size: clamp(2rem, 9vw, 3.2rem); color: var(--lime); min-width: 96px; }
.match.big h2 { font-size: clamp(1rem, 4vw, 1.35rem); }
.tag { font-size: .7rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 2px 8px; border-radius: 6px; background: var(--surface-2); }
.tag.goal { background: var(--lime); color: var(--lime-ink); } .tag.yellow { background: var(--warn); color: #201800; } .tag.red { background: var(--danger); color: #fff; }
</style>

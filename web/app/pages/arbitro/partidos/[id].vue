<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const route = useRoute();
const api = useApi();
const id = route.params.id;
const data = ref<any>(null);
const denied = ref(false);
const minute = ref(1);
const confirmClose = ref(false);
const reason = ref('');
const { busy, error, run } = useAction();

async function load() {
  try { data.value = await api(`/matches/${id}/report`); } catch { denied.value = true; }
}
onMounted(load);

const match = computed(() => data.value?.match);
const closed = computed(() => match.value?.report_status === 'closed');
const playersOf = (teamId: number) => data.value.players.filter((p: any) => p.team_id === teamId);
const label: Record<string, string> = { goal: 'Gol', yellow: 'Amarilla', red: 'Roja' };
const audit: Record<string, string> = { closed: 'Acta cerrada', reopened: 'Acta reabierta' };

const add = (player: any, type: string) => run(async () => {
  await api(`/matches/${id}/events`, { method: 'POST', body: { type, player_id: player.id, minute: Number(minute.value) } });
  await load();
}, `${label[type]}: ${player.first_name} ${player.last_name} (${minute.value}')`);
const remove = (e: any) => run(async () => { await api(`/matches/${id}/events/${e.id}`, { method: 'DELETE' }); await load(); });
const close = () => run(async () => { await api(`/matches/${id}/report/close`, { method: 'POST' }); confirmClose.value = false; await load(); }, 'Acta cerrada. Clasificación y stickers actualizados.');
const reopen = () => run(async () => { await api(`/matches/${id}/report/reopen`, { method: 'POST', body: { reason: reason.value } }); reason.value = ''; await load(); }, 'Acta reabierta.');
</script>

<template>
  <div v-if="denied" class="page"><div class="empty">No tienes este partido asignado.</div></div>
  <div v-else-if="data" class="page">
    <header class="stack">
      <p class="eyebrow">Acta · {{ match.event_name }}</p>
      <div class="card board">
        <div class="match">
          <h2 class="home">{{ match.home.name }}</h2>
          <span class="mid score lime" style="font-size: 2.4rem">{{ match.home_score }}–{{ match.away_score }}</span>
          <h2>{{ match.away.name }}</h2>
        </div>
        <p class="small muted" style="text-align: center">{{ fmtLong(match.scheduled_at) }} · <strong :class="closed ? 'lime' : ''">{{ closed ? 'Acta cerrada' : 'Borrador' }}</strong></p>
      </div>
    </header>

    <div v-if="error" class="error-box">{{ error }}</div>

    <template v-if="!closed">
      <section class="card row minute">
        <label class="field grow"><span>Minuto de la jugada</span><input v-model="minute" class="input" type="number" min="0" max="130" inputmode="numeric"></label>
        <button class="btn ghost" type="button" @click="minute = Math.max(0, Number(minute) - 1)">−</button>
        <button class="btn ghost" type="button" @click="minute = Math.min(130, Number(minute) + 1)">+</button>
      </section>

      <section v-for="team in [match.home, match.away]" :key="team.id" class="stack">
        <h2>{{ team.name }}</h2>
        <div v-if="playersOf(team.id).length" class="card list">
          <div v-for="p in playersOf(team.id)" :key="p.id" class="row">
            <span class="score muted" style="width: 28px">{{ p.number ?? '–' }}</span>
            <span class="grow truncate">{{ p.first_name }} {{ p.last_name }}</span>
            <button class="act goal" :disabled="busy" :aria-label="`Gol de ${p.first_name} ${p.last_name}`" @click="add(p, 'goal')">Gol</button>
            <button class="act yellow" :disabled="busy" :aria-label="`Amarilla a ${p.first_name} ${p.last_name}`" @click="add(p, 'yellow')" />
            <button class="act red" :disabled="busy" :aria-label="`Roja a ${p.first_name} ${p.last_name}`" @click="add(p, 'red')" />
          </div>
        </div>
        <div v-else class="empty">Este equipo no tiene jugadores en su plantilla. El capitán debe añadirlos.</div>
      </section>
    </template>

    <section class="stack">
      <h2>Incidencias</h2>
      <div v-if="data.events.length" class="card list">
        <div v-for="e in data.events" :key="e.id" class="row">
          <span class="score lime" style="width: 40px">{{ e.minute }}'</span>
          <span class="grow truncate"><strong>{{ label[e.type] }}</strong> · {{ e.first_name }} {{ e.last_name }}</span>
          <button v-if="!closed" class="btn sm danger" :disabled="busy" @click="remove(e)">Borrar</button>
        </div>
      </div>
      <div v-else class="empty">Sin incidencias: si cierras ahora, el resultado será 0–0.</div>
    </section>

    <section v-if="!closed" class="card stack">
      <h2>Cerrar acta</h2>
      <p class="small muted">Resultado final: <strong>{{ match.home.name }} {{ match.home_score }}–{{ match.away_score }} {{ match.away.name }}</strong>. Al cerrar se actualiza la clasificación y se generan los stickers. Después no podrás modificarla.</p>
      <button v-if="!confirmClose" class="btn" @click="confirmClose = true">Cerrar acta</button>
      <div v-else class="row wrap">
        <button class="btn" :disabled="busy" @click="close">Confirmar {{ match.home_score }}–{{ match.away_score }}</button>
        <button class="btn ghost" @click="confirmClose = false">Revisar</button>
      </div>
    </section>

    <section v-else class="stack">
      <NuxtLink :to="`/partidos/${id}`" class="btn">Ver partido y stickers</NuxtLink>
      <form v-if="data.can_reopen" class="card stack" @submit.prevent="reopen">
        <h2>Reabrir acta</h2>
        <p class="small muted">Solo tú como organizador puedes reabrirla. Queda registrado quién, cuándo y por qué.</p>
        <label class="field"><span>Motivo</span><input v-model="reason" class="input" required minlength="5" maxlength="500" placeholder="Gol asignado al jugador equivocado"></label>
        <button class="btn danger" :disabled="busy">Reabrir acta</button>
      </form>
    </section>

    <section v-if="data.audits.length" class="stack">
      <h2>Historial</h2>
      <div class="card list">
        <div v-for="a in data.audits" :key="a.id">
          <p>{{ audit[a.action] }} por {{ a.user_name }}<template v-if="a.snapshot?.home != null"> · {{ a.snapshot.home }}–{{ a.snapshot.away }}</template></p>
          <p class="small muted">{{ fmtLong(a.created_at) }}<template v-if="a.reason"> · Motivo: {{ a.reason }}</template></p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.board { padding: var(--s-5) var(--s-4); display: grid; gap: var(--s-3); }
.minute { position: sticky; top: calc(var(--topbar-h) + env(safe-area-inset-top) + 8px); z-index: 5; align-items: end; box-shadow: var(--shadow); }
.act { min-width: 44px; height: 44px; border-radius: 10px; border: 0; cursor: pointer; font-weight: 700; }
.act:disabled { opacity: .5; }
.act.goal { background: var(--lime); color: var(--lime-ink); padding: 0 14px; }
.act.yellow { background: var(--warn); width: 34px; min-width: 34px; } .act.red { background: var(--danger); width: 34px; min-width: 34px; }
</style>

<script setup lang="ts">
const route = useRoute();
const api = useApi();
const auth = useAuth();
const team = ref<any>(null);
const missing = ref(false);
const form = reactive({ first_name: '', last_name: '', number: null as number | null });
const { busy, error, run } = useAction();

const load = async () => {
  try { team.value = (await api(`/teams/${route.params.id}`)).team; } catch { missing.value = true; }
};
onMounted(load);
const mine = computed(() => auth.user.value && team.value?.captain_id === auth.user.value.id);

const add = () => run(async () => {
  await api(`/teams/${team.value.id}/players`, { method: 'POST', body: { ...form, number: form.number === null || (form.number as any) === '' ? null : Number(form.number) } });
  Object.assign(form, { first_name: '', last_name: '', number: null });
  await load();
}, 'Jugador añadido.');
const remove = (p: any) => run(async () => {
  await api(`/teams/${team.value.id}/players/${p.id}`, { method: 'DELETE' });
  await load();
});
</script>

<template>
  <div v-if="missing" class="page"><div class="empty">Este equipo no existe.</div></div>
  <div v-else-if="team" class="page">
    <header class="row">
      <span class="dot" :style="{ background: team.color, width: '40px', height: '40px', borderRadius: '12px' }" />
      <div><p class="eyebrow">Equipo{{ mine ? ' · eres capitán' : '' }}</p><h1>{{ team.name }}</h1></div>
    </header>

    <section class="stack">
      <h2>Plantilla</h2>
      <div v-if="team.players.length" class="card list">
        <div v-for="p in team.players" :key="p.id" class="row">
          <span class="score muted" style="width: 32px">{{ p.number ?? '–' }}</span>
          <span class="grow">{{ p.first_name }} {{ p.last_name }}</span>
          <button v-if="mine" class="btn sm danger" :disabled="busy" @click="remove(p)">Quitar</button>
        </div>
      </div>
      <div v-else class="empty">Este equipo aún no tiene jugadores.</div>
    </section>

    <form v-if="mine" class="card stack" @submit.prevent="add">
      <h2>Añadir jugador</h2>
      <p class="small muted">El nombre y apellido aparecerán en el acta y en los stickers de gol.</p>
      <div class="grid-2">
        <label class="field"><span>Nombre</span><input v-model="form.first_name" class="input" required maxlength="60"></label>
        <label class="field"><span>Apellido</span><input v-model="form.last_name" class="input" required maxlength="60"></label>
        <label class="field"><span>Dorsal (opcional)</span><input v-model="form.number" class="input" type="number" min="0" max="99"></label>
      </div>
      <div v-if="error" class="error-box">{{ error }}</div>
      <button class="btn" :disabled="busy">Añadir a la plantilla</button>
    </form>
  </div>
</template>

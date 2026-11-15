<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const api = useApi();
const cities = ref<any[]>([]);
const form = reactive({ name: '', type: 'league', format: 'f7', city_id: null as number | null, description: '', starts_on: '' });
const { busy, error, run } = useAction();

onMounted(async () => {
  cities.value = (await api('/cities')).cities;
  form.city_id = cities.value[0]?.id ?? null;
});
const submit = () => run(async () => {
  const { event } = await api('/events', { method: 'POST', body: { ...form, description: form.description || null, starts_on: form.starts_on || null } });
  await navigateTo(`/organizador/eventos/${event.id}`);
});
</script>

<template>
  <div class="page">
    <header class="stack"><NuxtLink to="/organizador" class="eyebrow">← Mis eventos</NuxtLink><h1>Crear evento</h1></header>
    <p class="note">Crear el evento y abrir la inscripción es gratis. Al cerrar la inscripción pagas una tarifa por cada equipo inscrito; sin equipos, no pagas.</p>
    <form class="stack" @submit.prevent="submit">
      <label class="field"><span>Nombre</span><input v-model="form.name" class="input" required minlength="3" maxlength="120" placeholder="Liga de Otoño Arganzuela"></label>
      <div class="grid-2">
        <label class="field"><span>Tipo</span><select v-model="form.type" class="input"><option value="league">Liga</option><option value="tournament">Torneo</option></select></label>
        <label class="field"><span>Modalidad</span>
          <select v-model="form.format" class="input"><option value="f5">Fútbol 5</option><option value="f7">Fútbol 7</option><option value="f11">Fútbol 11</option><option value="futsal">Fútbol sala</option></select>
        </label>
        <label class="field"><span>Ciudad</span><select v-model="form.city_id" class="input"><option v-for="c in cities" :key="c.id" :value="c.id">{{ c.name }}</option></select></label>
        <label class="field"><span>Fecha de inicio (opcional)</span><input v-model="form.starts_on" class="input" type="date"></label>
      </div>
      <label class="field"><span>Descripción (opcional)</span><textarea v-model="form.description" class="input" maxlength="2000" placeholder="Días de juego, precio para los equipos, premios…" /></label>
      <div v-if="error" class="error-box">{{ error }}</div>
      <button class="btn" :disabled="busy">Crear y abrir inscripción</button>
    </form>
  </div>
</template>

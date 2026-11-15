<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const api = useApi();
const matches = ref<any[]>([]);
const loaded = ref(false);
onMounted(async () => { matches.value = (await api('/me/matches')).matches; loaded.value = true; });
const pending = computed(() => matches.value.filter((m) => m.report_status !== 'closed'));
const done = computed(() => matches.value.filter((m) => m.report_status === 'closed').reverse());
</script>

<template>
  <div class="page">
    <header class="stack"><p class="eyebrow">Árbitro</p><h1>Mis partidos</h1></header>
    <section v-if="pending.length" class="stack">
      <h2>Pendientes de acta</h2>
      <NuxtLink v-for="m in pending" :key="m.id" :to="`/arbitro/partidos/${m.id}`" class="card link stack">
        <p class="eyebrow">{{ m.event_name }}</p><MatchRow :match="m" />
      </NuxtLink>
    </section>
    <section v-if="done.length" class="stack">
      <h2>Actas cerradas</h2>
      <NuxtLink v-for="m in done" :key="m.id" :to="`/arbitro/partidos/${m.id}`" class="card link stack">
        <p class="eyebrow">{{ m.event_name }}</p><MatchRow :match="m" />
      </NuxtLink>
    </section>
    <div v-if="loaded && !matches.length" class="empty">No tienes partidos asignados. El organizador de la liga es quien te asigna cada partido.</div>
  </div>
</template>

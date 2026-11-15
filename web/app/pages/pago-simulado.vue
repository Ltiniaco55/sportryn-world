<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const route = useRoute();
const api = useApi();
const id = route.query.event;
const event = ref<any>(null);
const { busy, error, run } = useAction();

onMounted(async () => { event.value = (await api(`/events/${id}/manage`).catch(() => null))?.event ?? null; });
const pay = () => run(async () => {
  await api(`/events/${id}/simulate-payment`, { method: 'POST' });
  await navigateTo(`/organizador/eventos/${id}`);
}, 'Pago simulado correcto: evento activo.');
</script>

<template>
  <div class="page" style="max-width: 480px">
    <header class="stack"><p class="eyebrow">Entorno de pruebas</p><h1>Pago simulado</h1></header>
    <p class="note">Esta pantalla sustituye a Stripe mientras desarrollas (PAYMENTS_DRIVER=fake). No se cobra nada. En producción el organizador verá aquí la pasarela real de Stripe.</p>
    <section v-if="event" class="card stack">
      <h3>{{ event.name }}</h3>
      <p class="score lime" style="font-size: 2.4rem">{{ money(event.amount_cents, event.currency) }}</p>
      <p class="small muted">{{ event.teams_count }} equipos × {{ money(event.team_fee_cents, event.currency) }}</p>
      <div v-if="error" class="error-box">{{ error }}</div>
      <button class="btn block" :disabled="busy" @click="pay">Simular pago correcto</button>
      <NuxtLink :to="`/organizador/eventos/${id}`" class="btn ghost block">Volver sin pagar</NuxtLink>
    </section>
    <div v-else class="empty">No se encontró el evento.</div>
  </div>
</template>

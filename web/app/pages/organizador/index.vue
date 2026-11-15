<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const api = useApi();
const auth = useAuth();
const events = ref<any[]>([]);
const loaded = ref(false);

onMounted(async () => {
  if (auth.isOrganizer.value) events.value = (await api('/me/events')).events;
  loaded.value = true;
});
const next: Record<string, string> = {
  registration: 'Comparte el enlace y cierra la inscripción cuando estén todos.',
  pending_payment: 'Paga para desbloquear calendario, actas, fotos y stickers.',
  active: 'Gestiona partidos, árbitros y publicaciones.',
  cancelled: 'Evento cancelado.',
};
</script>

<template>
  <div class="page">
    <header class="row between">
      <div><p class="eyebrow">Panel de organizador</p><h1>Mis eventos</h1></div>
      <NuxtLink v-if="auth.isOrganizer.value" to="/organizador/nuevo" class="btn">Crear evento</NuxtLink>
    </header>

    <p v-if="!auth.isOrganizer.value" class="note">
      Tu cuenta todavía no es de organizador. Durante el lanzamiento las activamos a mano: escríbenos con el email
      <strong>{{ auth.user.value?.email }}</strong> y te damos acceso.
    </p>

    <template v-else-if="loaded">
      <NuxtLink v-for="e in events" :key="e.id" :to="`/organizador/eventos/${e.id}`" class="card link stack">
        <div class="row between"><h3>{{ e.name }}</h3><StatusBadge :status="e.status" /></div>
        <p class="small muted">{{ e.city_name }} · {{ e.teams_count }} equipos</p>
        <p class="small">{{ next[e.status] }}</p>
        <p v-if="e.status === 'pending_payment'" class="small" style="color: var(--warn)">
          {{ money(e.amount_cents, e.currency) }} · paga antes del {{ fmtLong(e.payment_due_at) }}
        </p>
      </NuxtLink>
      <div v-if="!events.length" class="empty">
        Aún no has creado ningún evento. Crear una liga es gratis: solo pagas por equipo inscrito cuando cierras la inscripción.
      </div>
    </template>
  </div>
</template>

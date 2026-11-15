<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const api = useApi();
const auth = useAuth();
const { locale, setLocale, t } = useT();
const teams = ref<any[]>([]);
const following = ref<any[]>([]);
const form = reactive({ name: '', color: '#C6F432' });
const { busy, error, run } = useAction();

const load = async () => {
  const [a, b] = await Promise.all([api('/me/teams'), api('/me/following')]);
  teams.value = a.teams; following.value = b.events;
};
onMounted(load);

const createTeam = () => run(async () => {
  const { team } = await api('/teams', { method: 'POST', body: form });
  await navigateTo(`/equipos/${team.id}`);
});
async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => {});
  auth.clear();
  await navigateTo('/');
}
</script>

<template>
  <div class="page">
    <header class="stack">
      <p class="eyebrow">Tu cuenta</p>
      <h1>{{ auth.user.value?.name }}</h1>
      <p class="muted">{{ auth.user.value?.email }}</p>
      <div class="row wrap">
        <NuxtLink v-if="auth.isOrganizer.value" to="/organizador" class="btn sm">Panel de organizador</NuxtLink>
        <NuxtLink v-if="auth.isReferee.value" to="/arbitro" class="btn sm ghost">Mis partidos como árbitro</NuxtLink>
        <NuxtLink v-if="auth.isAdmin.value" to="/admin" class="btn sm ghost">Administración</NuxtLink>
      </div>
    </header>

    <p v-if="!auth.isOrganizer.value" class="note">
      ¿Organizas una liga o un torneo? Las cuentas de organizador se activan a mano durante el lanzamiento.
      Escríbenos con el email de esta cuenta y te damos acceso.
    </p>

    <section class="stack">
      <h2>Mis equipos</h2>
      <div v-if="teams.length" class="card list">
        <NuxtLink v-for="tm in teams" :key="tm.id" :to="`/equipos/${tm.id}`" class="row">
          <span class="dot" :style="{ background: tm.color }" /><span class="grow">{{ tm.name }}</span>
          <span class="small muted">{{ tm.players_count }} jugadores</span>
        </NuxtLink>
      </div>
      <form class="card stack" @submit.prevent="createTeam">
        <h3>Crear un equipo</h3>
        <p class="small muted">Serás su capitán: podrás gestionar la plantilla e inscribirlo en ligas y torneos.</p>
        <div class="row">
          <label class="field grow"><span>Nombre del equipo</span><input v-model="form.name" class="input" required minlength="2" maxlength="80"></label>
          <label class="field"><span>Color</span><input v-model="form.color" class="input" type="color" style="padding: 4px; width: 64px"></label>
        </div>
        <div v-if="error" class="error-box">{{ error }}</div>
        <button class="btn" :disabled="busy">Crear equipo</button>
      </form>
    </section>

    <section v-if="following.length" class="stack">
      <h2>Siguiendo</h2>
      <EventCard v-for="e in following" :key="e.id" :event="e" />
    </section>

    <section class="row between">
      <div class="tabs" style="margin: 0; padding: 0">
        <button :class="{ on: locale === 'es' }" @click="setLocale('es')">Español</button>
        <button :class="{ on: locale === 'en' }" @click="setLocale('en')">English</button>
      </div>
      <button class="btn ghost" @click="logout">{{ t('common.logout') }}</button>
    </section>
  </div>
</template>

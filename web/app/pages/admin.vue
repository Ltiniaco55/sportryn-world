<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const api = useApi();
const auth = useAuth();
const q = ref('');
const users = ref<any[]>([]);
const waitlist = ref<any[]>([]);
const { busy, error, run } = useAction();

const search = () => run(async () => { users.value = (await api(`/admin/users?q=${encodeURIComponent(q.value)}`)).users; });
onMounted(async () => {
  if (!auth.isAdmin.value) return;
  await search();
  waitlist.value = (await api('/admin/waitlist')).waitlist;
});
const patchUser = (u: any, body: object) => run(async () => { Object.assign(u, (await api(`/admin/users/${u.id}`, { method: 'PATCH', body })).user); }, 'Usuario actualizado.');
</script>

<template>
  <div class="page">
    <header class="stack"><p class="eyebrow">Administración</p><h1>Usuarios y lista de espera</h1></header>
    <div v-if="!auth.isAdmin.value" class="empty">Solo para administradores.</div>
    <template v-else>
      <form class="row" @submit.prevent="search"><input v-model="q" class="input grow" placeholder="Buscar por nombre o email"><button class="btn" :disabled="busy">Buscar</button></form>
      <div v-if="error" class="error-box">{{ error }}</div>
      <div class="card list">
        <div v-for="u in users" :key="u.id" class="row wrap">
          <div class="grow"><p>{{ u.name }} <span class="small muted">· {{ u.role }}{{ u.is_referee ? ' · árbitro' : '' }}</span></p><p class="small muted">{{ u.email }}</p></div>
          <template v-if="u.role !== 'admin'">
            <button class="btn sm" :class="{ ghost: u.role !== 'organizer' }" :disabled="busy" @click="patchUser(u, { role: u.role === 'organizer' ? 'user' : 'organizer' })">{{ u.role === 'organizer' ? 'Quitar organizador' : 'Hacer organizador' }}</button>
            <button class="btn sm ghost" :disabled="busy" @click="patchUser(u, { is_referee: !u.is_referee })">{{ u.is_referee ? 'Quitar árbitro' : 'Hacer árbitro' }}</button>
          </template>
        </div>
      </div>
      <section class="stack">
        <h2>Lista de espera ({{ waitlist.length }})</h2>
        <div v-if="waitlist.length" class="card list">
          <div v-for="w in waitlist" :key="w.id"><p>{{ w.name }} · {{ w.email }}</p><p class="small muted">{{ w.league_name || 'Sin liga' }} · {{ w.city || 'Sin ciudad' }} · {{ w.teams_count ?? '?' }} equipos · {{ fmtLong(w.created_at) }}</p></div>
        </div>
        <div v-else class="empty">Nadie apuntado todavía.</div>
      </section>
    </template>
  </div>
</template>

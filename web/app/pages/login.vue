<script setup lang="ts">
const api = useApi();
const auth = useAuth();
const route = useRoute();
const form = reactive({ email: '', password: '' });
const { busy, error, run } = useAction();

const submit = () => run(async () => {
  const r = await api('/auth/login', { method: 'POST', body: form });
  auth.set(r.token, r.user);
  await navigateTo(String(route.query.next ?? '/cuenta'));
});
</script>

<template>
  <div class="page" style="max-width: 440px">
    <header class="stack"><p class="eyebrow">Tu cuenta</p><h1>Entrar</h1></header>
    <form class="stack" @submit.prevent="submit">
      <label class="field"><span>Email</span><input v-model="form.email" class="input" type="email" autocomplete="email" required></label>
      <label class="field"><span>Contraseña</span><input v-model="form.password" class="input" type="password" autocomplete="current-password" required></label>
      <div v-if="error" class="error-box">{{ error }}</div>
      <button class="btn block" :disabled="busy">Entrar</button>
    </form>
    <p class="muted small">¿Aún no tienes cuenta? <NuxtLink :to="{ path: '/registro', query: route.query }" class="lime">Crear cuenta</NuxtLink></p>
  </div>
</template>

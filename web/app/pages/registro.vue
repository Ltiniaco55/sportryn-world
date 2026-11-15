<script setup lang="ts">
const api = useApi();
const auth = useAuth();
const route = useRoute();
const form = reactive({ name: '', email: '', password: '' });
const { busy, error, run } = useAction();

const submit = () => run(async () => {
  const r = await api('/auth/register', { method: 'POST', body: form });
  auth.set(r.token, r.user);
  await navigateTo(String(route.query.next ?? '/cuenta'));
});
</script>

<template>
  <div class="page" style="max-width: 440px">
    <header class="stack"><p class="eyebrow">Únete</p><h1>Crear cuenta</h1></header>
    <form class="stack" @submit.prevent="submit">
      <label class="field"><span>Nombre y apellidos</span><input v-model="form.name" class="input" autocomplete="name" required minlength="2"></label>
      <label class="field"><span>Email</span><input v-model="form.email" class="input" type="email" autocomplete="email" required></label>
      <label class="field"><span>Contraseña (mínimo 8 caracteres)</span><input v-model="form.password" class="input" type="password" autocomplete="new-password" required minlength="8"></label>
      <div v-if="error" class="error-box">{{ error }}</div>
      <button class="btn block" :disabled="busy">Crear cuenta</button>
    </form>
    <p class="muted small">¿Ya tienes cuenta? <NuxtLink :to="{ path: '/login', query: route.query }" class="lime">Entrar</NuxtLink></p>
  </div>
</template>

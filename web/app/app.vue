<script setup lang="ts">
const auth = useAuth();
const { t } = useT();
const { toast } = useToast();
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <NuxtLink to="/" class="brand" aria-label="Sportryn, inicio"><i /> Sportryn <small>Madrid</small></NuxtLink>
      <NuxtLink v-if="!auth.token.value" to="/login" class="btn sm ghost">{{ t('common.login') }}</NuxtLink>
      <NuxtLink v-else to="/cuenta" class="small muted truncate" style="max-width: 40vw">{{ auth.user.value?.name }}</NuxtLink>
    </header>

    <main><NuxtPage /></main>

    <nav class="tabbar" aria-label="Navegación principal">
      <NuxtLink to="/" :class="{ 'router-link-active': $route.path === '/' || $route.path.startsWith('/eventos') || $route.path.startsWith('/partidos') }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.800-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
        {{ t('nav.discover') }}
      </NuxtLink>
      <NuxtLink v-if="auth.isOrganizer.value" to="/organizador">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 10h18M8 2v4M16 2v4" /></svg>
        {{ t('nav.organize') }}
      </NuxtLink>
      <NuxtLink v-if="auth.isReferee.value" to="/arbitro">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M10 8h4M10 12h4" /></svg>
        {{ t('nav.referee') }}
      </NuxtLink>
      <NuxtLink :to="auth.token.value ? '/cuenta' : '/login'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.600-6 8-6s8 2 8 6" /></svg>
        {{ t('nav.account') }}
      </NuxtLink>
    </nav>

    <div v-if="toast" class="toast" :class="{ err: toast.err }" role="status">{{ toast.text }}</div>
  </div>
</template>

export default defineNuxtRouteMiddleware((to) => {
  if (!useAuth().token.value) return navigateTo({ path: '/login', query: { next: to.fullPath } });
});

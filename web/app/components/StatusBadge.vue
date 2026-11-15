<script setup lang="ts">
defineProps<{ status: string }>();
const { t } = useT();
</script>

<template><span class="badge" :class="status">{{ t(`status.${status}`) }}</span></template>

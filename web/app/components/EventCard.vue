<script setup lang="ts">
defineProps<{ event: any; to?: string }>();
const { t } = useT();
</script>

<template>
  <NuxtLink :to="to ?? `/eventos/${event.id}`" class="card link stack">
    <div class="row between">
      <span class="eyebrow truncate">{{ t(`type.${event.type}`) }} · {{ t(`format.${event.format}`) }}</span>
      <StatusBadge :status="event.status" />
    </div>
    <h3>{{ event.name }}</h3>
    <p class="small muted">
      {{ event.city?.name ?? event.city_name }} · {{ event.teams_count }} {{ t('common.teams') }}
      <template v-if="event.organizer_name"> · {{ event.organizer_name }}</template>
    </p>
  </NuxtLink>
</template>

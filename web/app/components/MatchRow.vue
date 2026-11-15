<script setup lang="ts">
defineProps<{ match: any; to?: string }>();
</script>

<template>
  <component :is="to ? resolveComponent('NuxtLink') : 'div'" :to="to" class="stack" style="gap: 6px">
    <div class="match">
      <span class="home truncate">{{ match.home.name }}</span>
      <span class="mid">
        <span v-if="match.report_status === 'closed'" class="score">{{ match.home_score }}–{{ match.away_score }}</span>
        <span v-else class="time">{{ fmtTime(match.scheduled_at) }}</span>
      </span>
      <span class="truncate">{{ match.away.name }}</span>
    </div>
    <p class="small muted" style="text-align: center">
      {{ fmtDay(match.scheduled_at) }}<template v-if="match.venue"> · {{ match.venue.name }}</template>
    </p>
  </component>
</template>

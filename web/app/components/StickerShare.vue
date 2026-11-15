<script setup lang="ts">
// Vista previa de un sticker (PNG 1080×1920) con botones para compartirlo o descargarlo.
const props = defineProps<{ path: string; filename: string; title: string }>();
const { show } = useToast();
const transparent = ref(false);
const busy = ref(false);
const src = computed(() => apiUrl(props.path) + (transparent.value ? '?bg=transparent' : ''));

async function file() {
  const blob = await (await fetch(src.value)).blob();
  return new File([blob], `${props.filename}.png`, { type: 'image/png' });
}
async function share() {
  busy.value = true;
  try {
    const f = await file();
    if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: props.title });
    else download(f);
  } catch (e: any) {
    if (e?.name !== 'AbortError') show('No se pudo compartir el sticker.', true);
  } finally { busy.value = false; }
}
function download(f: File) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(f); a.download = f.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  show('Sticker descargado.');
}
</script>

<template>
  <div class="card stack">
    <div class="row between">
      <h3>{{ title }}</h3>
      <label class="row small muted" style="gap: 6px"><input v-model="transparent" type="checkbox"> Fondo transparente</label>
    </div>
    <img :src="src" :alt="title" width="1080" height="1920" loading="lazy" class="preview">
    <div class="row">
      <button class="btn grow" :disabled="busy" @click="share">Compartir en historias</button>
      <button class="btn ghost" :disabled="busy" @click="file().then(download)">Descargar</button>
    </div>
  </div>
</template>

<style scoped>
.preview { width: min(260px, 70%); height: auto; margin: 0 auto; border-radius: var(--r-md); border: 1px solid var(--line); background: repeating-conic-gradient(#1a2220 0 25%, #121816 0 50%) 0 0 / 20px 20px; }
</style>

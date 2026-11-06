<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useData, withBase } from 'vitepress';

const { lang } = useData();
const fr = computed(() => lang.value.startsWith('fr'));
const video = ref<HTMLVideoElement>();
const muted = ref(true);
const playing = ref(false);

onMounted(() => {
  const v = video.value!;
  v.addEventListener('play', () => (playing.value = true));
  v.addEventListener('pause', () => (playing.value = false));
  // Autoplay (muted, as browsers require), unless the visitor asked for less motion.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) v.play().catch(() => {});
});

function toggleSound() {
  const v = video.value!;
  v.muted = !v.muted;
  muted.value = v.muted;
  if (!v.muted) {
    v.currentTime = 0; // with sound, start from the top
    v.play().catch(() => {});
  }
}
function play() {
  video.value?.play().catch(() => {});
}
</script>

<template>
  <figure class="hd-video">
    <video
      ref="video"
      :src="withBase('/video/huddle.mp4')"
      :poster="withBase('/video/huddle-poster.jpg')"
      muted
      loop
      playsinline
      preload="metadata"
      width="1280"
      height="720"
      :aria-label="fr ? 'Huddle en 20 secondes : un prono, le classement en direct, les trophées' : 'Huddle in 20 seconds: making a pick, live standings, trophies'"
    />
    <button v-if="!playing" type="button" class="hd-play" @click="play">▶ {{ fr ? 'Lecture' : 'Play' }}</button>
    <button v-else type="button" class="hd-sound" @click="toggleSound">
      {{ muted ? (fr ? '🔇 Activer le son' : '🔇 Sound on') : fr ? '🔊 Couper le son' : '🔊 Sound off' }}
    </button>
  </figure>
</template>

<style scoped>
.hd-video {
  position: relative;
  margin: 0;
  width: min(100%, 640px);
}
video {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  border-radius: 18px;
  border: 1px solid var(--vp-c-divider);
  background: #0d131d;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}
button {
  position: absolute;
  font-family: var(--vp-font-family-base);
  font-weight: 600;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(13, 19, 29, 0.78);
  color: #f1efe8;
  backdrop-filter: blur(6px);
  cursor: pointer;
}
.hd-sound {
  right: 12px;
  bottom: 12px;
  padding: 6px 12px;
  font-size: 13px;
}
.hd-play {
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 12px 22px;
  font-size: 17px;
  background: #39c97a;
  color: #0d131d;
  border: none;
}
button:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
</style>

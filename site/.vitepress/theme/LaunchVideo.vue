<script setup lang="ts">
import { computed, ref } from 'vue';
import { useData, withBase } from 'vitepress';

const { lang } = useData();
const fr = computed(() => lang.value.startsWith('fr'));
const video = ref<HTMLVideoElement>();
const started = ref(false);

/** Played only on request, once (no autoplay, no loop), sound off: the controls turn it on. */
function play() {
  const v = video.value;
  if (!v) return;
  started.value = true;
  v.muted = true;
  v.play().catch(() => {});
}
</script>

<template>
  <section class="hd-launch" :aria-label="fr ? 'Huddle en vidéo' : 'Huddle on video'">
    <div class="hd-launch-frame">
      <video
        ref="video"
        :src="withBase('/video/huddle.mp4')"
        :poster="withBase('/video/huddle-poster.jpg')"
        :controls="started"
        muted
        playsinline
        preload="none"
        width="1280"
        height="720"
        @play="started = true"
      />
      <button v-if="!started" type="button" class="hd-launch-play" @click="play">
        <span class="hd-launch-icon" aria-hidden="true">▶</span>
        {{ fr ? 'Huddle en 20 secondes' : 'Huddle in 20 seconds' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.hd-launch {
  padding: 8px 24px 32px;
}
@media (min-width: 640px) {
  .hd-launch {
    padding: 8px 48px 40px;
  }
}
@media (min-width: 960px) {
  .hd-launch {
    padding: 16px 64px 48px;
  }
}
.hd-launch-frame {
  position: relative;
  max-width: 960px;
  margin: 0 auto;
}
video {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 16 / 9;
  border-radius: 20px;
  border: 1px solid var(--vp-c-divider);
  background: #0d131d;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}
.hd-launch-play {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 22px 12px 14px;
  border: none;
  border-radius: 999px;
  background: #39c97a;
  color: #0d131d;
  font-family: var(--vp-font-family-base);
  font-size: 17px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}
@media (max-width: 639px) {
  .hd-launch-play {
    bottom: 10px;
    gap: 8px;
    padding: 7px 14px 7px 8px;
    font-size: 14px;
  }
  .hd-launch-icon {
    width: 24px;
    height: 24px;
    font-size: 10px;
  }
}
.hd-launch-play:hover {
  background: #5ad690;
}
.hd-launch-play:focus-visible {
  outline: 3px solid #f1efe8;
  outline-offset: 3px;
}
.hd-launch-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #0d131d;
  color: #39c97a;
  font-size: 13px;
  padding-left: 2px;
}
</style>

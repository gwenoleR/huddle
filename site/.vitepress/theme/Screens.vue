<script setup lang="ts">
import { withBase } from 'vitepress';

const screens = [
  { src: '/screens/games.jpg', title: 'One tap per game', text: 'Pick before kickoff, see who went where.' },
  { src: '/screens/game.jpg', title: 'Live and after', text: 'Win probability, scoring plays, team stats.' },
  { src: '/screens/standings.jpg', title: 'Live standings', text: '"If it ends like this", updated during games.' },
  { src: '/screens/recap.jpg', title: 'The weekly recap', text: 'An image made for the group chat.' },
  { src: '/screens/trophies.jpg', title: 'Season trophies', text: 'Sharpshooter, Black cat, Nostradamus…' }
];
</script>

<template>
  <div class="hd-screens">
    <figure v-for="s in screens" :key="s.src" class="hd-screen">
      <img :src="withBase(s.src)" :alt="s.title" loading="lazy" width="390" height="844" />
      <figcaption>
        <strong>{{ s.title }}</strong>
        <span>{{ s.text }}</span>
      </figcaption>
    </figure>
  </div>
</template>

<style scoped>
.hd-screens {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(200px, 1fr);
  gap: 20px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: 4px 4px 16px;
}
.hd-screen {
  margin: 0;
  scroll-snap-align: start;
}
.hd-screen img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 24px;
  border: 6px solid #222c3d;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
}
figcaption {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 14px;
  font-size: 14px;
  color: var(--vp-c-text-2);
  line-height: 1.4;
}
figcaption strong {
  font-family: var(--hd-display);
  font-size: 18px;
  color: var(--vp-c-text-1);
}
</style>

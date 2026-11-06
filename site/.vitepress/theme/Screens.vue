<script setup lang="ts">
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';

const { lang } = useData();
const captions = {
  en: [
    ['One tap per game', 'Pick before kickoff, see who went where.'],
    ['Live and after', 'Win probability, scoring plays, team stats.'],
    ['Live standings', '"If it ends like this", updated during games.'],
    ['The weekly recap', 'An image made for the group chat.'],
    ['Season trophies', 'Sharpshooter, Black cat, Nostradamus…']
  ],
  fr: [
    ['Un prono en un tap', 'Avant le coup d’envoi, et on voit qui a pris quoi.'],
    ['En direct et après', 'Chances de victoire, actions, stats des équipes.'],
    ['Le classement en direct', '« Si ça finit comme ça », pendant les matchs.'],
    ['Le récap de la semaine', 'Une image faite pour le groupe.'],
    ['Les trophées de la saison', 'Sniper, Chat noir, Nostradamus…']
  ]
};
const files = ['games', 'game', 'standings', 'recap', 'trophies'];
const screens = computed(() =>
  (lang.value.startsWith('fr') ? captions.fr : captions.en).map(([title, text], i) => ({ src: `/screens/${files[i]}.jpg`, title, text }))
);
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

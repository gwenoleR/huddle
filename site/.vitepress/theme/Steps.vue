<script setup lang="ts">
const steps = [
  {
    n: '1',
    title: 'Run it',
    text: 'One Docker Compose file on a home server, a NAS, a Raspberry Pi or a small VPS. Amd64 or arm64.',
    code: 'docker compose up -d'
  },
  {
    n: '2',
    title: 'Create your group',
    text: 'The first person to open the app picks a name and a PIN and becomes the admin, then adds everyone else.'
  },
  {
    n: '3',
    title: 'Share the link',
    text: 'Everyone installs it on their home screen. Games, scores and results sync from ESPN by themselves.'
  }
];
</script>

<template>
  <ol class="hd-steps">
    <li v-for="s in steps" :key="s.n">
      <span class="hd-step-n">{{ s.n }}</span>
      <strong>{{ s.title }}</strong>
      <p>{{ s.text }}</p>
      <code v-if="s.code">{{ s.code }}</code>
    </li>
  </ol>
</template>

<style scoped>
.hd-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 16px;
}
@media (min-width: 768px) {
  .hd-steps {
    grid-template-columns: repeat(3, 1fr);
  }
}
.hd-steps li {
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hd-step-n {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  font-family: var(--hd-display);
  font-weight: 800;
  font-size: 20px;
  display: grid;
  place-items: center;
}
.hd-steps strong {
  font-family: var(--hd-display);
  font-size: 22px;
}
.hd-steps p {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.55;
}
.hd-steps code {
  align-self: flex-start;
  margin-top: 4px;
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-brand-1);
}
</style>

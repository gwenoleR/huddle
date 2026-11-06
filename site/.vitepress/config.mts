import { defineConfig } from 'vitepress';

const repo = 'https://github.com/gwenoleR/huddle';

// Project site served by GitHub Pages at https://gwenoler.github.io/huddle/
export default defineConfig({
  base: '/huddle/',
  lang: 'en-US',
  title: 'Huddle',
  description: 'NFL picks with your crew: a self-hosted app for a group of friends. No ads, no betting.',
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',
  head: [
    ['link', { rel: 'icon', href: '/huddle/favicon.ico', sizes: '48x48' }],
    ['link', { rel: 'icon', href: '/huddle/logo.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#0d131d' }],
    ['meta', { property: 'og:title', content: 'Huddle — NFL picks with your crew' }],
    ['meta', { property: 'og:description', content: 'A self-hosted app to pick every NFL game with your friends.' }],
    ['meta', { property: 'og:image', content: 'https://gwenoler.github.io/huddle/screens/standings.jpg' }]
  ],
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'Changelog', link: `${repo}/blob/main/CHANGELOG.md` },
      { text: 'Releases', link: `${repo}/releases` }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting started',
          items: [
            { text: 'Install', link: '/guide/' },
            { text: 'HTTPS', link: '/guide/https' },
            { text: 'On your phones', link: '/guide/phones' }
          ]
        },
        {
          text: 'Running it',
          items: [
            { text: 'Settings', link: '/guide/settings' },
            { text: 'Your group', link: '/guide/group' },
            { text: 'Updating', link: '/guide/updating' },
            { text: 'Backups & data', link: '/guide/data' }
          ]
        },
        {
          text: 'More',
          items: [
            { text: 'Translating', link: '/guide/translating' },
            { text: 'FAQ', link: '/guide/faq' }
          ]
        }
      ]
    },
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: { pattern: `${repo}/edit/main/site/:path`, text: 'Edit this page on GitHub' },
    search: { provider: 'local' },
    footer: {
      message: 'MIT licensed. Not affiliated with the NFL or ESPN.',
      copyright: 'Made for a group of friends, shared with yours.'
    }
  }
});

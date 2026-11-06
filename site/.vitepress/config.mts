import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type HeadConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';

const repo = 'https://github.com/gwenoleR/huddle';
const origin = 'https://gwenoler.github.io';
const base = '/huddle/';
/** Absolute URL of a page or file of the site. */
const abs = (p = '') => `${origin}${base}${p.replace(/^\//, '')}`;

const description =
  'Huddle is a free, open-source NFL pick’em app you host yourself for your group of friends: pick every game, live scores, standings and trophies. No ads, no betting.';
const ogImage = abs('og.png');

/** The launch video in the home pages' header (schema.org, so search engines can show it). */
const videoJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'VideoObject',
  name: 'Huddle in 20 seconds',
  description: 'Making a pick in one tap, live standings that move during games, and season trophies: Huddle, the self-hosted NFL pick’em app for friends.',
  thumbnailUrl: [abs('video/huddle-poster.jpg')],
  contentUrl: abs('video/huddle.mp4'),
  uploadDate: '2026-11-06',
  duration: 'PT20S'
};

/** The home pages in each language, linked to one another (hreflang). */
const homes = [
  { lang: 'en', href: abs() },
  { lang: 'fr', href: abs('fr/') }
];

/** The FAQ page, read from its Markdown: each "## question" and the paragraphs under it. */
function faqJsonLd() {
  const md = readFileSync(path.resolve(__dirname, '../guide/faq.md'), 'utf8');
  const items = md
    .split(/^## /m)
    .slice(1)
    .map((block) => {
      const [question, ...rest] = block.split('\n');
      const answer = rest
        .join('\n')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
        .replace(/[`*_]/g, '')
        .trim()
        .replace(/\s+/g, ' ');
      return { '@type': 'Question', name: question.trim(), acceptedAnswer: { '@type': 'Answer', text: answer } };
    });
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items };
}

/** What the app is, for search engines and AI assistants (schema.org). */
const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Huddle',
  alternateName: 'Huddle NFL pick’em',
  description,
  url: abs(),
  image: ogImage,
  screenshot: ['games', 'game', 'standings', 'recap', 'trophies'].map((s) => abs(`screens/${s}.jpg`)),
  applicationCategory: 'SportsApplication',
  applicationSubCategory: 'NFL pick’em',
  operatingSystem: 'Any (web app); server: Docker on Linux (amd64, arm64)',
  softwareVersion: JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')).version,
  license: 'https://opensource.org/licenses/MIT',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  inLanguage: ['en', 'fr'],
  codeRepository: repo,
  downloadUrl: `${repo}/releases`,
  author: { '@type': 'Person', name: 'Gwénolé', url: 'https://github.com/gwenoleR' },
  keywords: 'NFL pick’em, NFL picks, self-hosted, open source, friends league, office pool, pronostics NFL, Docker, PWA'
};

export default defineConfig({
  base,
  lang: 'en-US',
  title: 'Huddle',
  titleTemplate: ':title · Huddle',
  description,
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',
  sitemap: { hostname: abs() },

  head: [
    ['link', { rel: 'icon', href: `${base}favicon.ico`, sizes: '48x48' }],
    ['link', { rel: 'icon', href: `${base}logo.svg`, type: 'image/svg+xml' }],
    ['link', { rel: 'apple-touch-icon', href: `${base}apple-touch-icon.png` }],
    ['meta', { name: 'theme-color', content: '#0d131d' }],
    ['meta', { name: 'author', content: 'Gwénolé' }],
    ['meta', { property: 'og:site_name', content: 'Huddle' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: ogImage }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: 'Huddle: NFL picks with your crew, on your phone' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: ogImage }],
    // Plain-text versions of the docs for AI assistants (llmstxt.org).
    ['link', { rel: 'alternate', type: 'text/markdown', href: `${base}llms.txt`, title: 'LLM-friendly summary' }]
  ],

  /** Per page: canonical URL, social title and description, structured data. */
  transformPageData(page) {
    const route = page.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
    const url = abs(route);
    const title = page.frontmatter.title ?? page.title;
    const desc = page.frontmatter.description ?? page.description ?? description;
    const fullTitle = page.frontmatter.layout === 'home' ? title : `${title} · Huddle`;
    const head: HeadConfig[] = [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: fullTitle }],
      ['meta', { property: 'og:description', content: desc }],
      ['meta', { name: 'twitter:title', content: fullTitle }],
      ['meta', { name: 'twitter:description', content: desc }]
    ];
    if (page.frontmatter.layout === 'home') {
      for (const h of homes) head.push(['link', { rel: 'alternate', hreflang: h.lang, href: h.href }]);
      head.push(['link', { rel: 'alternate', hreflang: 'x-default', href: abs() }]);
      head.push(['meta', { property: 'og:locale', content: route.startsWith('fr') ? 'fr_FR' : 'en_US' }]);
      head.push(['script', { type: 'application/ld+json' }, JSON.stringify(softwareJsonLd)]);
      head.push(['script', { type: 'application/ld+json' }, JSON.stringify(videoJsonLd)]);
    }
    if (route === 'guide/faq') head.push(['script', { type: 'application/ld+json' }, JSON.stringify(faqJsonLd())]);
    page.frontmatter.head = [...(page.frontmatter.head ?? []), ...head];
  },

  /** VitePress's home layout has no main landmark: mark its content as the page's main region. */
  transformHtml(html) {
    return html.replace('<div class="VPHome"', '<div class="VPHome" role="main"');
  },

  vite: {
    plugins: [
      llmstxt({
        domain: origin,
        title: 'Huddle',
        description: 'A free, open-source NFL pick’em app that a group of friends hosts itself (Docker).',
        details:
          'Huddle is a self-hosted progressive web app for picking the winners of every NFL game with your friends: one tap per game, picks lock at kickoff, live scores and win probability, season and weekly standings, trophies, a shareable weekly recap image, push notifications, an end-of-season bonus. One Docker container with SQLite; game data comes from ESPN’s public API. MIT licensed, available in English and French, no ads and no betting.',
        ignoreFiles: ['fr/**']
      })
    ]
  },

  locales: {
    root: { label: 'English', lang: 'en-US' },
    fr: {
      label: 'Français',
      lang: 'fr-FR',
      title: 'Huddle',
      description:
        'Huddle, l’appli gratuite et open source de pronostics NFL entre potes, à héberger soi-même : un prono par match, scores en direct, classement et trophées. Sans pub ni paris.',
      themeConfig: {
        nav: [
          { text: 'Documentation (en anglais)', link: '/guide/' },
          { text: 'GitHub', link: repo }
        ],
        footer: {
          message: 'Licence MIT. Sans lien avec la NFL ni ESPN.',
          copyright: 'Fait pour une bande de potes, partagé avec la vôtre.'
        },
        darkModeSwitchLabel: 'Thème',
        returnToTopLabel: 'Retour en haut',
        langMenuLabel: 'Langue'
      }
    }
  },

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'Huddle' },
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
            { text: 'Huddle vs. other pick’em apps', link: '/guide/alternatives' },
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

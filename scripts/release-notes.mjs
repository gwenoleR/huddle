#!/usr/bin/env node
/**
 * Prints the CHANGELOG.md section of a version (used as the GitHub release notes), and checks
 * that package.json has that same version. Exits with an error otherwise, which stops the release.
 *
 *   node scripts/release-notes.mjs 1.2.0
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The notes of `version` in a Keep a Changelog file; throws if they are missing or empty. */
export function releaseNotes(changelog, version) {
  // A section starts at "## [1.2.0]" (or "## 1.2.0") and runs until the next "## ".
  const start = changelog.search(new RegExp(`^## \\[?${version.replaceAll('.', '\\.')}\\]?(\\s|$)`, 'm'));
  if (start < 0) throw new Error(`CHANGELOG.md has no section for ${version}.`);
  const rest = changelog.slice(start);
  const next = rest.slice(3).search(/^## /m);
  const section = (next < 0 ? rest : rest.slice(0, next + 3))
    .split('\n')
    .slice(1)
    // Link references ("[1.0.0]: https://…") sit at the end of the file, not in a section.
    .filter((line) => !/^\[[^\]]+\]: /.test(line))
    .join('\n')
    .trim();
  if (!section) throw new Error(`The CHANGELOG.md section for ${version} is empty.`);
  return section;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const version = process.argv[2] ?? '';
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Usage: node scripts/release-notes.mjs <x.y.z>');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    if (pkg.version !== version) throw new Error(`package.json is at ${pkg.version}, not ${version}: bump it before tagging.`);
    console.log(releaseNotes(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), version));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

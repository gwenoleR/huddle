import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JavaScript script, no type declarations
import { releaseNotes } from '../../scripts/release-notes.mjs';

const CHANGELOG = `# Changelog

## [Unreleased]

## [1.1.0] - 2027-01-10

### Added
- Something new.

## [1.0.10] - 2026-12-01

- A fix.

## [1.0.1] - 2026-11-20

## [1.0.0] - 2026-11-06

- First release.

[1.1.0]: https://example.com/v1.1.0
[1.0.0]: https://example.com/v1.0.0
`;

describe('release notes from the changelog', () => {
  it('the section of a version, without its heading', () => {
    expect(releaseNotes(CHANGELOG, '1.1.0')).toBe('### Added\n- Something new.');
  });

  it('1.0.1 is not 1.0.10', () => {
    expect(() => releaseNotes(CHANGELOG, '1.0.1')).toThrow('section for 1.0.1 is empty');
    expect(releaseNotes(CHANGELOG, '1.0.10')).toBe('- A fix.');
  });

  it('the last section stops before the link references', () => {
    expect(releaseNotes(CHANGELOG, '1.0.0')).toBe('- First release.');
  });

  it('a version without a section stops the release', () => {
    expect(() => releaseNotes(CHANGELOG, '2.0.0')).toThrow('no section for 2.0.0');
  });

  it('the real changelog has notes for the version in package.json', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version)).toContain('###');
  });
});

# Updating

```bash
docker compose pull && docker compose up -d
```

The database migrates by itself on start. A copy beforehand never hurts — see
[Backups](./data#backups). The app notices when the server is newer and offers players to reload.

## Versions

What changed in each version is in the
[changelog](https://github.com/gwenoleR/huddle/blob/main/CHANGELOG.md) and on the
[releases page](https://github.com/gwenoleR/huddle/releases). Versions follow semver:

- a **major** version (2.0.0) may need something from you, and its changelog says exactly what;
- minor and patch versions never do.

Every release is tested against the databases left by all the previous ones, so an update never
loses your data.

## Image tags

The image is `ghcr.io/gwenoler/huddle`, for amd64 and arm64.

| Tag | What you get |
| --- | --- |
| `latest` | The last release (default in `docker-compose.yml`) |
| `1`, `1.1`, `1.1.0` | Pinned to a major, minor or exact version |
| `edge` | The tip of `main`, between releases |
| `sha-abc1234` | One exact build, to roll back |

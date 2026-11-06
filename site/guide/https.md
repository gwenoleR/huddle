---
title: "HTTPS: Caddy, Cloudflare Tunnel or your reverse proxy"
description: "Serve your Huddle NFL pick’em app over HTTPS with Caddy, a Cloudflare Tunnel, Traefik or nginx, so phones can install it and get notifications."
---

# HTTPS

Phones only install web apps and receive push notifications over HTTPS. Pick the option that fits
your setup; in every case, set `PUBLIC_URL` to the final `https://` address.

## Caddy — a domain name and ports 80/443 open

The simplest: Caddy gets and renews the certificate by itself. Use the
[`examples/docker-compose.caddy.yml`](https://github.com/gwenoleR/huddle/blob/main/examples/docker-compose.caddy.yml)
file instead of the default one:

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/gwenoleR/huddle/main/examples/docker-compose.caddy.yml
echo "DOMAIN=huddle.example.com" > .env
docker compose up -d
```

Point your domain's DNS to the server first. `PUBLIC_URL` is derived from `DOMAIN`.

## Cloudflare Tunnel — nothing to open on your router

In Cloudflare Zero Trust › Networks › Tunnels › your tunnel › *Public Hostname*, add your hostname →
service `HTTP`, URL `<server-ip>:3000` (or `huddle:3000` if cloudflared runs on the same Docker
network).

## Your own reverse proxy

Traefik, nginx, Nginx Proxy Manager…: forward the hostname to port 3000. The app trusts the
`X-Forwarded-*` headers, so the real client address is used for the login rate limit.

## Just trying it on your LAN

`PUBLIC_URL=http://192.168.1.10:3000` works to log in and make picks in a browser — the session
cookie isn't restricted to HTTPS when `PUBLIC_URL` is plain http. But phones won't install the app
nor get notifications until you serve it over HTTPS.

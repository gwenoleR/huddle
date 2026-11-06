# Install

Huddle runs as a single Docker container. You need:

- a machine that runs **Docker**: a home server, a NAS, a Raspberry Pi, a small VPS — amd64 or arm64;
- a **web address in HTTPS** pointing to it: phones need HTTPS to install the app and receive
  notifications ([options](./https)).

## 1. A folder with two files

```bash
mkdir -p ~/huddle && cd ~/huddle
curl -O https://raw.githubusercontent.com/gwenoleR/huddle/main/docker-compose.yml
echo "PUBLIC_URL=https://huddle.example.com" > .env
```

`PUBLIC_URL` is the address everyone will type on their phone. It's the only required setting; the
others are [optional](./settings).

## 2. Start it

```bash
docker compose up -d
```

The app listens on port **3000**. On first start it downloads the 32 teams, their logos and the
season's 272 games, which takes about 30 seconds. `docker compose logs huddle` then tells you there
are no players yet.

## 3. Put it behind HTTPS

Make `PUBLIC_URL` reach port 3000: with [Caddy, a Cloudflare Tunnel or your own reverse proxy](./https).

## 4. Create the group

Open the address. The first person to do so picks a first name and a 4-digit PIN, and **becomes the
admin** of the group. Do it right after the first start: until the group exists, anyone reaching the
address could create it.

Then add everyone else from **Profile › Administration** — see [Your group](./group).

## 5. Share the link

Send the address to the group. Each player taps their name and chooses their PIN the first time
(the first PIN they type becomes theirs), then installs the app on their home screen:
[on your phones](./phones).

::: tip Already halfway through the season?
The admin can import the picks of the weeks you played elsewhere, from a CSV file —
see [Your group](./group#import-past-weeks).
:::

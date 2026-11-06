# Security

## Reporting a vulnerability

Please report it privately through GitHub: *Security › Report a vulnerability* on this repository.
Don't open a public issue. You'll get an answer within a few days; this is a hobby project
maintained by one person.

## What to expect from the app

Huddle is made for a group of friends, and its security matches that:

- Players log in with their first name and a **4-digit PIN**. Five wrong attempts lock that name for
  15 minutes, and 20 wrong attempts from the same address lock it for an hour. That stops guessing,
  but a PIN is not a password: don't reuse a PIN that protects anything else.
- Sessions are long-lived (one year) cookies, `HttpOnly` and `SameSite=Lax`, `Secure` when
  `PUBLIC_URL` is HTTPS.
- Until the group is created, anyone reaching the address can create it and become its admin:
  create it right after the first start.
- Serve the app over HTTPS (see the README). Everything else is your server's job: updates,
  firewall, backups of the `/data` volume.

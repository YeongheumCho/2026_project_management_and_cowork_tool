# Hostname Reverse Proxy Deployment

This project can be published behind a simple server hostname without exposing
application ports directly.

## Recommended topology

- Users access `http://cowork-server`
- The server PC name is set to `cowork-server`
- Office PCs resolve that hostname on the same network, or map it in `hosts`
- Caddy listens on port `80`
- Caddy proxies requests to `frontend:3000`
- Frontend proxies API traffic to backend containers using Next.js rewrites
- Backend, realtime, AI chatbot, PostgreSQL, and Redis stay bound to `127.0.0.1`

## Name resolution setup

Choose one of these:

- Preferred for a small office network:
  - Rename the Windows server PC to `cowork-server`
  - Verify other 5th-floor PCs can resolve `cowork-server`
- Fallback:
  - Add a `hosts` entry on each client PC:
  - `192.168.0.50 cowork-server`

## Windows computer name

Set the server PC name to:

- `cowork-server`

Reboot after changing the computer name.

## Server ports

- Public to the 5th-floor network: `80`
- Localhost only: `3000`, `8000`, `8001`, `8002`, `5432`, `6379`

## Required .env values

```env
APP_HOSTNAME=cowork-server
NEXT_PUBLIC_API_BASE_URL=/backend
NEXT_PUBLIC_AI_CHATBOT_URL=/ai
```

## Start

```powershell
docker compose down
docker compose up --build -d
docker compose ps
```

## Access

From another office PC:

```text
http://cowork-server
```

## HTTPS note

For `https://cowork-server`, browser trust is harder than plain internal HTTP.
If you later need HTTPS, use one of these:

- your company's internal CA and trusted certificate distribution
- a reverse proxy managed by your corporate infrastructure

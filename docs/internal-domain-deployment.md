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

## Client IP restriction

The default `Caddyfile` only allows clients in `10.10.222.0/24` plus localhost.
Users outside that C-class range receive `403 Forbidden` even if they can reach
the server IP through VPN.

For stronger host-level enforcement on the Windows server, restrict inbound TCP
80 to the same remote address range in Windows Defender Firewall:

```powershell
New-NetFirewallRule -DisplayName "KPI Cowork HTTP 80 - 10.10.222 only" -Direction Inbound -Protocol TCP -LocalPort 80 -RemoteAddress 10.10.222.0/24 -Action Allow
```

## Required .env values

```env
APP_HOSTNAME=cowork-server
NEXT_PUBLIC_API_BASE_URL=/backend
NEXT_PUBLIC_AI_CHATBOT_URL=/ai
BACKEND_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://cowork-server
REALTIME_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://cowork-server
```

If you also want to allow access by server IP during setup, add it to both
origin variables.

Example:

```env
BACKEND_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://cowork-server,http://192.168.0.50
REALTIME_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://cowork-server,http://192.168.0.50
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

Temporary fallback during setup:

```text
http://192.168.0.50
```

## Expected problems and fixes

- `CORS blocked` when opening the service from another PC:
  Set `BACKEND_CORS_ORIGINS` and `REALTIME_ALLOWED_ORIGINS` to include the
  hostname or server IP that client PCs actually use.
- `Site does not open by IP`:
  Caddy now listens on port `80` for any host, so users can connect by
  hostname or raw IP on the local network.
- `cowork-server` does not resolve on client PCs:
  Rename the server PC or add a `hosts` entry on each client PC.
- `Connection timed out` from another PC:
  Open inbound TCP port `80` in Windows Defender Firewall on the server PC.
- `Multiple browsers show different timer state`:
  This is expected for local browser state such as access tokens. Each user
  should sign in on their own PC, but all project time is still accumulated in
  the shared database on the server.

## HTTPS note

For `https://cowork-server`, browser trust is harder than plain internal HTTP.
If you later need HTTPS, use one of these:

- your company's internal CA and trusted certificate distribution
- a reverse proxy managed by your corporate infrastructure

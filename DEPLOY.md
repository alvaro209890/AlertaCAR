# Deploy — AlertaCAR

## Ambiente

- **Servidor**: `server-desktop` (este PC)
- **OS**: Linux (6.17.0-35-generic)
- **Node**: 20+
- **Package manager**: pnpm

## Estrutura de deploy

```
AlertaCAR/
├── app/dist/           # Build do frontend app (Vite)
├── admin/dist/         # Build do frontend admin (Vite)
├── backend/dist/       # Build do backend (esbuild)
│   └── index.js        # Entry point
└── backend/data/
    └── alertacar.db    # SQLite (gitignored)
```

O backend serve ambos os frontends via `express.static()`:

```typescript
// backend/src/index.ts
app.use('/app', express.static('../app/dist'))
app.use('/admin', express.static('../admin/dist'))
// Redireciona raiz para /app
app.get('/', (req, res) => res.redirect('/app'))
```

## Systemd Service

```ini
# /home/server/.config/systemd/user/alertacar-backend.service
[Unit]
Description=AlertaCAR Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR/backend
ExecStart=/usr/bin/node dist/index.js
Environment=PORT=3002
Environment=NODE_ENV=production
EnvironmentFile=/home/server/.config/alertacar/backend.env
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
```

**Porta**: 3002 (não conflita com GeoForest:3001, Nexus, Auracore, etc.)

## Cloudflare Tunnel

**Usar túnel EXISTENTE** — criar novo domínio no túnel `geoserver-wms` (ou qualquer túnel ativo) sem derrubar os que já rodam.

### Domínios

| Domínio | Serviço | Rota |
|---------|---------|------|
| `alertacar.cursar.space` | App Usuário | `localhost:3002/app` |
| `alertacar-admin.cursar.space` | Painel Admin | `localhost:3002/admin` |
| `alertacar-api.cursar.space` | API | `localhost:3002/api` |

Alternativa: rotear pelo path:
```
alertacar.cursar.space/*        → localhost:3002/*
alertacar.cursar.space/api/*    → localhost:3002/api/*
```

### Comandos Cloudflare

```bash
# Adicionar rota no túnel existente (ex: geoserver-wms)
cloudflared tunnel route dns geoserver-wms alertacar.cursar.space
cloudflared tunnel route dns geoserver-wms alertacar-admin.cursar.space
cloudflared tunnel route dns geoserver-wms alertacar-api.cursar.space

# OU criar novo túnel dedicado
cloudflared tunnel create alertacar
cloudflared tunnel route dns alertacar alertacar.cursar.space
cloudflared tunnel route dns alertacar alertacar-admin.cursar.space
cloudflared tunnel route dns alertacar alertacar-api.cursar.space
```

### Config do túnel (`~/.cloudflared/config.yml`)

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/server/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: alertacar-api.cursar.space
    service: http://localhost:3002
  - hostname: alertacar.cursar.space
    service: http://localhost:3002
  - hostname: alertacar-admin.cursar.space
    service: http://localhost:3002
  - service: http_status:404
```

### CUIDADO: Não derrubar túneis existentes

- Verificar túneis ativos: `cloudflared tunnel list`
- NUNCA usar `cloudflared tunnel delete` sem confirmação
- Adicionar domínios ao túnel existente, não criar conflito

## Pipeline de Build + Deploy

```bash
cd "/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR"

# 1. Build app usuário
cd app && pnpm run build && cd ..

# 2. Build admin
cd admin && pnpm run build && cd ..

# 3. Build backend
cd backend && pnpm exec esbuild src/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && cd ..

# 4. Restart backend
systemctl --user restart alertacar-backend.service

# 5. Verificar
sleep 3
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3002/api/health
```

**Build frontend-only (sem alterar backend)**:
```bash
cd app && pnpm run build && cd ..
# NÃO precisa restart — express.static() serve do disco
```

## Verificação pós-deploy

```bash
# Healthcheck
curl https://alertacar-api.cursar.space/api/health

# App carregando
curl -s -o /dev/null -w "HTTP %{http_code}" https://alertacar.cursar.space

# Admin carregando
curl -s -o /dev/null -w "HTTP %{http_code}" https://alertacar-admin.cursar.space

# Logs
journalctl --user -u alertacar-backend.service --since "1 min ago" --no-pager -o cat
```

## Checklist de deploy inicial

- [ ] Domínios DNS configurados no Cloudflare (`alertacar.cursar.space`, etc.)
- [ ] Rotas do túnel apontando para `localhost:3002`
- [ ] `.env` de produção criado (`/home/server/.config/alertacar/backend.env`)
  - `PORT=3002`
  - `FIREBASE_SERVICE_ACCOUNT_PATH=...`
  - `DATABASE_PATH=...`
  - etc.
- [ ] Firebase Admin SDK JSON no lugar
- [ ] `systemctl --user enable alertacar-backend.service`
- [ ] `systemctl --user start alertacar-backend.service`
- [ ] Verificar `ss -tlnp | grep 3002`
- [ ] Verificar `curl localhost:3002/api/health`
- [ ] Testar domínios via HTTPS
- [ ] Verificar se túneis existentes continuam funcionando

# Deploy — AlertaCAR

## Ambiente

- **Servidor**: `server-desktop`
- **OS**: Linux 6.17
- **Node**: 20+
- **Banco**: `/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/`

## Estrutura de deploy

```
# CÓDIGO (GitHub)
/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR/
├── app/dist/           # Build Vite
├── admin/dist/         # Build Vite Admin
├── backend/dist/       # esbuild bundle
│   └── index.js
└── ...

# DADOS (fora do repo, backup separado)
/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/
└── alertacar.db        # SQLite
```

O backend serve os frontends:

```typescript
app.use('/', express.static('../app/dist'))
app.use('/admin', express.static('../admin/dist'))
app.use('/api', apiRouter)
// SPA fallback
```

## Variáveis de ambiente

```bash
# /home/server/.config/alertacar/backend.env
PORT=3002
NODE_ENV=production

# Auth local (NÃO comitar!)
JWT_SECRET=<openssl rand -hex 64>

# Database (PASTA DE SERVIDORES, não no repo!)
DATABASE_PATH=/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/alertacar.db

# SCCON
SCCON_ORG_UUID=597953b9-ee78-4113-80f9-803dbbaa60a0
SCCON_START_DATE=2019-07-22

# WFS SEMA
WFS_BASE_URL=https://geo.sema.mt.gov.br/geoserver/ows
WFS_AUTHKEY=541085...n
# Admin (primeiro usuário cadastrado pode ser promovido)
ADMIN_EMAILS=seu@email.com
```

## Systemd

```ini
# /home/server/.config/systemd/user/alertacar-backend.service
[Unit]
Description=AlertaCAR Backend
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR/backend
ExecStart=/usr/bin/node dist/index.js
Environment=PORT=3002
Environment=NODE_ENV=production
EnvironmentFile=/home/server/.config/alertacar/backend.env
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

## Cloudflare Tunnel

```bash
# Criar registros DNS (uma vez)
cloudflared tunnel route dns <TUNNEL> alertacar.cursar.space
cloudflared tunnel route dns <TUNNEL> alertacar-admin.cursar.space
cloudflared tunnel route dns <TUNNEL> alertacar-api.cursar.space
```

## Pipeline de Build + Deploy

```bash
#!/bin/bash
cd "/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR"

# Build frontends
cd app && pnpm run build && cd ..
cd admin && pnpm run build && cd ..

# Build backend
cd backend && pnpm exec esbuild src/index.ts \
  --platform=node --packages=external --bundle --format=esm \
  --outdir=dist && cd ..

# Restart
systemctl --user restart alertacar-backend.service
sleep 3
curl -s http://localhost:3002/api/health
```

## Checklist de Deploy Inicial

### Setup único
- [ ] `mkdir -p "/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/"`
- [ ] `openssl rand -hex 64` → salvar como `JWT_SECRET` no `.env`
- [ ] Configurar Cloudflare DNS
- [ ] Criar `alertacar-backend.service`
- [ ] `systemctl --user enable alertacar-backend.service`

### Deploy
- [ ] `pnpm install` (app + admin + backend)
- [ ] Build app + admin + backend
- [ ] `systemctl --user start alertacar-backend.service`
- [ ] Verificar porta 3002
- [ ] Verificar HTTPS nos 3 domínios

### Smoke test
- [ ] `curl -X POST https://alertacar-api.cursar.space/api/auth/register` → JWT
- [ ] `curl -X POST https://alertacar-api.cursar.space/api/auth/login` → JWT
- [ ] `curl https://alertacar-api.cursar.space/api/cars` → 200
- [ ] `curl https://alertacar.cursar.space` → 200 (app)
- [ ] `curl https://alertacar-admin.cursar.space` → 200 (admin)
- [ ] Túneis existentes OK (GeoForest, Nexus, etc.)

## Promover primeiro admin

Após registrar o primeiro usuário:

```sql
UPDATE users SET role = 'admin' WHERE email = 'seu@email.com';
```

Admin tem acesso ao painel `/admin` e endpoints `/api/admin/*`.

## Backup

```bash
# Banco (diário)
cp "/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/alertacar.db" \
   "/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/alertacar.db.$(date +%Y%m%d).bak"

# Código (git)
cd "/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR"
git push origin main
```

## Rollback

```bash
git checkout HEAD~1
# rebuild + restart
```

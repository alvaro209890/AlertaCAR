# Deploy — AlertaCAR

## Ambiente

- **Servidor**: `server-desktop` (este PC)
- **OS**: Linux 6.17.0-35-generic
- **Node**: 20+
- **Package manager**: pnpm

## Estrutura de deploy

```
AlertaCAR/
├── app/dist/           # Build Vite (SPA)
├── admin/dist/         # Build Vite Admin (SPA)
├── backend/
│   ├── dist/           # esbuild bundle
│   │   └── index.js   # Entry point
│   └── data/
│       └── alertacar.db
```

O backend serve os frontends:

```typescript
// backend/src/index.ts
app.use('/', express.static(path.join(__dirname, '../../app/dist')))
app.use('/admin', express.static(path.join(__dirname, '../../admin/dist')))

// API routes
app.use('/api', apiRouter)

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    res.sendFile(path.join(__dirname, '../../admin/dist/index.html'))
  } else {
    res.sendFile(path.join(__dirname, '../../app/dist/index.html'))
  }
})
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

### Comandos systemd

```bash
# Ativar e iniciar
systemctl --user enable alertacar-backend.service
systemctl --user start alertacar-backend.service

# Status
systemctl --user status alertacar-backend.service

# Logs
journalctl --user -u alertacar-backend.service --since "1 min ago" --no-pager -o cat

# Restart (após rebuild)
systemctl --user restart alertacar-backend.service

# Parar
systemctl --user stop alertacar-backend.service
```

## Cloudflare Tunnel

### Opção A: Adicionar ao túnel existente

Usar um túnel já ativo (ex: `geoserver-wms`):

```bash
# Criar registros DNS
cloudflared tunnel route dns geoserver-wms alertacar.cursar.space
cloudflared tunnel route dns geoserver-wms alertacar-admin.cursar.space
cloudflared tunnel route dns geoserver-wms alertacar-api.cursar.space
```

### Opção B: Túnel dedicado (recomendado)

```bash
cloudflared tunnel create alertacar
cloudflared tunnel route dns alertacar alertacar.cursar.space
cloudflared tunnel route dns alertacar alertacar-admin.cursar.space
cloudflared tunnel route dns alertacar alertacar-api.cursar.space
```

### Config (`~/.cloudflared/config.yml`)

Adicionar entrada `alertacar`:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: /home/server/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: alertacar-api.cursar.space
    service: http://localhost:3002
  - hostname: alertacar.cursar.space
    service: http://localhost:3002
  - hostname: alertacar-admin.cursar.space
    service: http://localhost:3002
  - service: http_status:404
```

Rodar (se for túnel separado):

```bash
cloudflared tunnel run alertacar &
```

**Ou**, se usar config.yml global já existente, adicionar ao `ingress` do túnel ativo e **restartar o cloudflared**:

```bash
sudo systemctl restart cloudflared.service
```

## Pipeline de Build + Deploy

```bash
#!/bin/bash
# deploy.sh
set -e

REPO="/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR"
cd "$REPO"

echo "📦 Build app..."
cd app && pnpm install && pnpm run build && cd ..

echo "📦 Build admin..."
cd admin && pnpm install && pnpm run build && cd ..

echo "📦 Build backend..."
cd backend && pnpm install && pnpm exec esbuild src/index.ts \
  --platform=node --packages=external --bundle --format=esm \
  --outdir=dist && cd ..

echo "🔄 Restart backend..."
systemctl --user restart alertacar-backend.service

sleep 3

echo "✅ Verificando..."
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3002/api/health

echo "🚀 Deploy concluído!"
```

### Build frontend-only (sem mexer no backend)

```bash
cd "/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR"
cd app && pnpm run build && cd ..
# NÃO precisa restart — express.static serve do disco
```

## Checklist de Deploy Inicial

### Pré-deploy

- [ ] Domínios DNS criados no Cloudflare: `alertacar.cursar.space`, `alertacar-admin.cursar.space`, `alertacar-api.cursar.space`
- [ ] Firebase Admin SDK JSON salvo em `/home/server/.config/alertacar/firebase-admin.json`
- [ ] `.env` de produção: `/home/server/.config/alertacar/backend.env`
- [ ] Firebase Auth configurado (email/senha)
- [ ] Admin UID adicionado na variável `ADMIN_UIDS`

### Deploy

- [ ] `pnpm install` em `app/`, `admin/`, `backend/`
- [ ] Build app: `cd app && pnpm run build`
- [ ] Build admin: `cd admin && pnpm run build`
- [ ] Build backend: esbuild
- [ ] `systemctl --user enable alertacar-backend.service`
- [ ] `systemctl --user start alertacar-backend.service`

### Verificação

- [ ] `ss -tlnp | grep 3002` — porta 3002 em LISTEN
- [ ] `curl http://localhost:3002/api/health` → `{"status":"ok"}`
- [ ] `curl https://alertacar-api.cursar.space/api/health` → `{"status":"ok"}`
- [ ] App carrega via HTTPS: `curl -s -o /dev/null -w "%{http_code}" https://alertacar.cursar.space` → 200
- [ ] Admin carrega: `curl -s -o /dev/null -w "%{http_code}" https://alertacar-admin.cursar.space` → 200
- [ ] Login Firebase funcional
- [ ] Cadastro + adicionar CAR funcional
- [ ] WhatsApp QR Code funciona
- [ ] Túneis existentes NÃO foram derrubados (verificar GeoForest, Nexus, etc.)

### Smoke test pós-deploy

```bash
# Healthcheck
curl https://alertacar-api.cursar.space/api/health

# Auth (registrar usuário)
curl -X POST https://alertacar-api.cursar.space/api/auth/register \
  -H "Authorization: Bearer $(firebase_token)" \
  -H "Content-Type: application/json" \
  -d '{"whatsappNumber":"+5565999999999"}'

# Adicionar CAR
curl -X POST https://alertacar-api.cursar.space/api/cars \
  -H "Authorization: Bearer $(firebase_token)" \
  -H "Content-Type: application/json" \
  -d '{"carNumber":"MT27827/2017"}'

# Status WhatsApp
curl https://alertacar-api.cursar.space/api/admin/whatsapp/status \
  -H "Authorization: Bearer $(admin_token)"

# Logs
journalctl --user -u alertacar-backend.service --since "1 min ago" --no-pager -o cat
```

## Rollback

```bash
# Reverter para commit anterior
cd "/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR"
git checkout HEAD~1

# Rebuild e restart
cd app && pnpm run build && cd ..
cd admin && pnpm run build && cd ..
cd backend && pnpm exec esbuild src/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist && cd ..
systemctl --user restart alertacar-backend.service
```

## Backup

```bash
# Backup do banco
cp "/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR/backend/data/alertacar.db" \
   "/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR/backend/data/alertacar.db.$(date +%Y%m%d).bak"
```

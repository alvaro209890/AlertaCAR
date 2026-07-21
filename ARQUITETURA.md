# Arquitetura — AlertaCAR

## Visão geral

```
┌──────────────────────────────────────────────────────────┐
│                   Cloudflare Tunnel                       │
│  alertacar.cursar.space       → localhost:3002 (app)       │
│  alertacar-admin.cursar.space → localhost:3002 (admin)    │
│  alertacar-api.cursar.space   → localhost:3002 (api)      │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│  App (React/Vite)          Admin (React/Vite)             │
│  Servido via express.static  Servido via express.static   │
│  Auth: Firebase Auth         Auth: Firebase Auth           │
│  Mapa: Leaflet                Whois: UID whitelist         │
│                                                           │
│  Funcionalidades:             Funcionalidades:            │
│  - Login/Cadastro (WhatsApp)  - Dashboard métricas        │
│  - CRUD de CARs               - QR Code WhatsApp          │
│  - Dashboard com cards        - Gerenciar usuários         │
│  - Mapa com polígono+alertas  - Log de notificações       │
│  - Timeline de alertas        - Configurações             │
│  - Perfil                     - Executar cron manual       │
└────────────────────┬─────────────────────────────────────┘
                     │ /api/*
┌────────────────────▼─────────────────────────────────────┐
│  Backend (Node/Express) — Porta 3002                      │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Middleware   │  │  Services     │  │  Cron           │  │
│  │  requireAuth  │  │               │  │                  │  │
│  │  requireAdmin │  │  wfs-sema.ts  │  │  Diário 06:00   │  │
│  └──────────────┘  │  sccon.ts      │  │  - Varre CARs    │  │
│                     │  whatsapp.ts   │  │  - Token SCCON   │  │
│  ┌──────────────┐  │  notification  │  │  - WFS bbox       │  │
│  │  Routes       │  │  car-import   │  │  - Detalhes       │  │
│  │  /api/auth    │  └──────────────┘  │  - Spatial join   │  │
│  │  /api/cars    │                     │  - Salva novos    │  │
│  │  /api/alerts  │                     │  - Envia WhatsApp │  │
│  │  /api/admin   │                     └────────────────┘  │
│  └──────────────┘                                         │
│                                                           │
│  ┌──────────────────────────────────┐                    │
│  │  SQLite (better-sqlite3)         │                    │
│  │  data/alertacar.db               │                    │
│  │                                  │                    │
│  │  users ← cars ← alerts           │                    │
│  │  whatsapp_sessions               │                    │
│  │  cron_logs                       │                    │
│  └──────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────┘

         ┌─────────────────────┐
         │   APIs Externas      │
         │                     │
         │  ┌───────────────┐  │
         │  │ WFS SEMA-MT    │  │
         │  │ 135 camadas    │  │
         │  │ Auth key func  │  │
         │  └───────┬───────┘  │
         │          │          │
         │  ┌───────▼───────┐  │
         │  │ SCCON          │  │
         │  │ Token público  │  │
         │  │ WFS Alertas    │  │
         │  │ API Detalhes   │  │
         │  └───────────────┘  │
         │                     │
         │  ┌───────────────┐  │
         │  │ WhatsApp       │  │
         │  │ (Baileys)      │  │
         │  │ WebSocket      │  │
         │  └───────────────┘  │
         └─────────────────────┘
```

## Fluxo de dados

### 1. Cadastro de CAR
```
Usuário → nº CAR → Backend → converter formato (MTXXXXX/YYYY)
  → WFS SEMA CQL_FILTER → GeoJSON polígono → cache SQLite
  → Área (ha), município → exibir no dashboard
```

### 2. Monitoramento diário (Cron 06:00)
```
Para cada CAR ativo:
  Carregar polígono (cache < 30d ou WFS)
  → getPublicToken() SCCON
  → getUserId(token)
  → WFS SCCON com bbox do polígono + viewparams
  → Lista de idt_local_alert
  → fetchAlertDetails(ids) em paralelo (12 workers)
  → Para cada alerta: intersects(polígono_CAR, geometria_alerta)?
    → SIM: é novo? (não está em alerts.alert_local_id)
      → SIM: salvar em alerts, enfileirar WhatsApp
      → NÃO: ignorar
    → NÃO: ignorar
```

### 3. Notificação WhatsApp
```
Fila de notificações → para cada alerta novo:
  Verificar rate limit (1/CAR/h, 10/user/dia)
  → Formatar template
  → Baileys.sendMessage(user.whatsapp_number, texto)
  → Sucesso: alert.sent_to_whatsapp = 1
  → Falha: retry 3x
```

## Sistema de arquivos

### systemd

```
alertacar-backend.service
  Type: simple
  ExecStart: node dist/index.js
  WorkingDirectory: /media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR/backend
  Environment: PORT=3002
  EnvironmentFile: /home/server/.config/alertacar/backend.env
  Restart: always
  RestartSec: 5
```

### Variáveis de ambiente

```bash
# /home/server/.config/alertacar/backend.env
PORT=3002
NODE_ENV=production

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=/home/server/.config/alertacar/firebase-admin.json

# Database
DATABASE_PATH=/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR/backend/data/alertacar.db

# SCCON
SCCON_ORG_UUID=597953b9-ee78-4113-80f9-803dbbaa60a0
SCCON_START_DATE=2019-07-22
SCCON_HTTP_CONCURRENCY=12
SCCON_HTTP_TIMEOUT_MS=60000

# WFS SEMA
WFS_BASE_URL=https://geo.sema.mt.gov.br/geoserver/ows
WFS_AUTHKEY=541085de-9a2e-454e-bdba-eb3d57a2f492
WFS_TIMEOUT_MS=60000

# Admin UIDs (separados por vírgula)
ADMIN_UIDS=uid1,uid2
```

## Portas em uso (server-desktop)

| Porta | Serviço |
|-------|---------|
| 3000 | GeoForest (fallback, não usado) |
| 3001 | GeoForest API ⚡ |
| **3002** | **AlertaCAR** 🆕 |
| 3003 | Nexus |
| 4000 | Auracore |
| 8081 | GeoServer WMS |
| 8082 | GeoServer public proxy |

3002 não conflita com nenhum serviço existente.

## Segurança

- **Auth**: Firebase ID token verificado no backend (`firebase-admin.verifyIdToken()`)
- **Admin**: whitelist de UIDs no `.env` (`ADMIN_UIDS`)
- **API**: rate limiting via `express-rate-limit`
- **WhatsApp**: credenciais baileys criptografadas no SQLite
- **SCCON**: token público (não expõe credenciais de usuário real)

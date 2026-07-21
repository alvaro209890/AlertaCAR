# Arquitetura — AlertaCAR

## Visão geral

```
┌──────────────────────────────────────────────────────────┐
│                   Cloudflare Tunnel                       │
│  alertacar.cursar.space       → localhost:3002            │
│  alertacar-admin.cursar.space → localhost:3002            │
│  alertacar-api.cursar.space   → localhost:3002            │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│  Backend (Node/Express) — Porta 3002                      │
│                                                           │
│  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │  Auth local   │  │  Services                        │  │
│  │  bcrypt+JWT   │  │  sccon.ts      — token + search  │  │
│  │  /api/auth    │  │  wfs-sema.ts    — 135 camadas    │  │
│  └──────────────┘  │  whatsapp.ts    — baileys         │  │
│                     │  car-importer.ts — nº→polígono   │  │
│  ┌──────────────┐  │  notification.ts — fila msg       │  │
│  │  Routes       │  └──────────────────────────────────┘  │
│  │  /api/auth    │                                        │
│  │  /api/cars    │  ┌──────────────────────────────────┐  │
│  │  /api/alerts  │  │  Cron Diário (06:00 BRT)          │  │
│  │  /api/admin   │  │                                   │  │
│  └──────────────┘  │  Para cada CAR ativo:              │  │
│                     │  1. Busca SCCON (POST search)     │  │
│                     │  2. WFS Embargos SEMA             │  │
│  ┌──────────────┐  │  3. WFS Licenciamento             │  │
│  │  SQLite       │  │  4. WFS Infrações                │  │
│  │  Local        │  │  5. Sobreposição UC/TI/INCRA     │  │
│  │  autenticação │  │  6. Novos → enfileira WhatsApp   │  │
│  └──────────────┘  └──────────────────────────────────┘  │
│                                                           │
│  serve estáticos: app/dist/ + admin/dist/                 │
└──────────────────────────────────────────────────────────┘

         ┌─────────────────────────────────────┐
         │   APIs Externas                      │
         │                                      │
         │  ┌──────────────────────────────┐   │
         │  │ SCCON                          │   │
         │  │ Token público + Search paginado│   │
         │  │ 11 classes de alerta           │   │
         │  │ Busca por CAR (cdCars)         │   │
         │  └──────────────────────────────┘   │
         │                                      │
         │  ┌──────────────────────────────┐   │
         │  │ WFS SEMA-MT (135 camadas)      │   │
         │  │ • Embargos (8 camadas)         │   │
         │  │ • Licenciamento (7)            │   │
         │  │ • Autorizações (3)             │   │
         │  │ • CAR (9 camadas)              │   │
         │  │ • Fundiário (5)                │   │
         │  │ • Histórico desmate (7)        │   │
         │  └──────────────────────────────┘   │
         │                                      │
         │  ┌──────────────────────────────┐   │
         │  │ WhatsApp (Baileys)             │   │
         │  │ WebSocket + sessão SQLite      │   │
         │  └──────────────────────────────┘   │
         └─────────────────────────────────────┘
```

## Autenticação (100% local)

**Sem Firebase. Sem Supabase. Sem serviço externo.**

```
Registro:
  email + senha + nome + whatsapp
  → bcrypt(senha, 12 rounds)
  → INSERT INTO users
  → JWT (HS256, 7 dias)

Login:
  email + senha
  → SELECT user WHERE email = ?
  → bcrypt.compare(senha, hash)
  → JWT (HS256, 7 dias)

Middleware:
  Authorization: Bearer <jwt>
  → jwt.verify(token, SECRET)
  → req.user = { id, email, role }
```

### Tabela users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,               -- UUID
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,       -- bcrypt
  name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,     -- +55XXXXXXXXXXX
  role TEXT DEFAULT 'user',          -- 'user' | 'admin'
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### JWT Secret
Variável de ambiente `JWT_SECRET` (gerar com `openssl rand -hex 64`).

## Schema SQLite

Localização: `/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/alertacar.db`

```sql
-- Usuários (auth local)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- CARs monitorados
CREATE TABLE cars (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  car_number TEXT NOT NULL,
  car_number_wfs TEXT,
  import_type TEXT DEFAULT 'car',    -- 'car' | 'matricula' | 'coordenadas'
  import_value TEXT,                 -- Nº matrícula ou coordenadas
  polygon_json TEXT,
  area_ha REAL,
  municipality TEXT,
  last_polygon_fetch TEXT,
  last_check_at TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, car_number)
);

-- Alertas detectados (qualquer fonte)
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL REFERENCES cars(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL,              -- 'sccon' | 'sema_embargo' | 'sema_infracao' | 'sema_licenca' | 'fundiario' | 'cadastral'
  source_id TEXT,                    -- ID externo (idt_local_alert, nº auto)
  class_type TEXT,                   -- CUT, EMBARGO, LP, etc.
  title TEXT NOT NULL,
  description TEXT,
  detected_date TEXT NOT NULL,
  area_ha REAL,
  geometry_json TEXT,
  sent_to_whatsapp INTEGER DEFAULT 0,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sessão WhatsApp Baileys
CREATE TABLE whatsapp_sessions (
  id TEXT PRIMARY KEY DEFAULT 'default',
  creds_json TEXT,
  connected INTEGER DEFAULT 0,
  phone_number TEXT,
  last_connected TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Log do cron
CREATE TABLE cron_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  cars_processed INTEGER DEFAULT 0,
  alerts_found INTEGER DEFAULT 0,
  alerts_sent INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running'
);
```

## Cron de Monitoramento (06:00 BRT)

```
FOR each active CAR:
  ┌─ 1. SCCON (POST /alerts/search, cdCars)  → alertas desmate
  ├─ 2. WFS Embargos SEMA (BBOX intersect)     → novos embargos
  ├─ 3. WFS Autos Infração (BBOX)              → novas infrações
  ├─ 4. WFS Licenciamento (BBOX)               → novas licenças
  ├─ 5. WFS Desembargos (BBOX)                 → áreas liberadas
  ├─ 6. WFS UC/TI/Assentamentos (BBOX)         → sobreposições
  └─ 7. Para cada NOVO alerta → enfileirar WhatsApp
```

Cada fonte é **independente** — falha em uma não bloqueia as outras.

## Portas em uso

| Porta | Serviço |
|-------|---------|
| 3001 | GeoForest API |
| **3002** | **AlertaCAR** 🆕 |
| 8081 | GeoServer WMS |

## Variáveis de ambiente

```bash
# /home/server/.config/alertacar/backend.env
PORT=3002
NODE_ENV=production
JWT_SECRET=<openssl rand -hex 64>
DATABASE_PATH=/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/alertacar.db
SCCON_ORG_UUID=597953b9-ee78-4113-80f9-803dbbaa60a0
SCCON_START_DATE=2019-07-22
WFS_BASE_URL=https://geo.sema.mt.gov.br/geoserver/ows
WFS_AUTHKEY=541085...n
```

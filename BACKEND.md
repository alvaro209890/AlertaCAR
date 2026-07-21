# Backend — AlertaCAR

## Stack

- **Runtime**: Node.js 20+ com TypeScript
- **Servidor**: Express
- **Banco**: SQLite via `better-sqlite3`
- **Auth**: Firebase Admin SDK
- **Cron**: `node-cron`
- **Geo**: Turf.js (área, bbox, interseção) + proj4 (reprojeção)
- **WhatsApp**: Baileys (`@whiskeysockets/baileys`)
- **Build**: esbuild (bundle ESM, mesmo padrão GeoForest)

## Estrutura

```
backend/
├── src/
│   ├── index.ts                   # Express, middleware, CORS, static serve
│   ├── middleware/
│   │   ├── auth.ts                # requireAuth (Firebase token)
│   │   └── admin.ts               # requireAdmin (UID whitelist)
│   ├── routes/
│   │   ├── auth.ts                # /api/auth/register, /api/auth/me
│   │   ├── cars.ts                # /api/cars CRUD + WFS lookup
│   │   ├── alerts.ts              # /api/alerts (listagem)
│   │   └── admin.ts               # /api/admin/* (stats, users, whatsapp)
│   ├── services/
│   │   ├── wfs-sema.ts            # Buscar polígono CAR (WFS SEMA-MT)
│   │   ├── sccon.ts               # Token + WFS + detalhes de alertas
│   │   ├── whatsapp.ts            # Sessão Baileys + envio
│   │   ├── notification.ts        # Fila + dispatch
│   │   └── car-import.ts          # Conversão nº CAR → formato WFS
│   ├── cron/
│   │   └── monitor.ts             # Diário 06:00 → varre CARs → SCCON → WhatsApp
│   ├── db/
│   │   ├── connection.ts          # SQLite singleton
│   │   ├── schema.ts              # CREATE TABLE
│   │   └── queries.ts             # Funções de acesso
│   └── lib/
│       ├── firebase.ts            # Firebase Admin init
│       └── config.ts              # Variáveis de ambiente tipadas
├── data/
│   └── alertacar.db               # SQLite (gitignored)
├── package.json
└── tsconfig.json
```

## Schema SQLite

```sql
-- Usuários (Firebase uid)
CREATE TABLE users (
  id TEXT PRIMARY KEY,               -- Firebase Auth uid
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,     -- +55XXXXXXXXXXX
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- CARs monitorados
CREATE TABLE cars (
  id TEXT PRIMARY KEY,               -- UUID
  user_id TEXT NOT NULL REFERENCES users(id),
  car_number TEXT NOT NULL,          -- Nº no formato original
  car_number_wfs TEXT,               -- Nº no formato WFS (MTXXXXX/YYYY)
  polygon_json TEXT,                 -- GeoJSON Polygon
  area_ha REAL,
  municipality TEXT,
  status_car TEXT,                   -- status atual do CAR
  last_polygon_fetch TEXT,           -- ISO timestamp
  last_check_at TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, car_number)
);

-- Alertas detectados
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,               -- UUID
  car_id TEXT NOT NULL REFERENCES cars(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  alert_local_id INTEGER,            -- idt_local_alert da SCCON
  source TEXT NOT NULL,              -- 'sccon' | 'sema_embargo' | 'sema_status'
  class_type TEXT,                   -- CUT, SELECTIVE_EXTRACTION, etc.
  detected_date TEXT NOT NULL,       -- Data da detecção (ISO)
  area_ha REAL,
  title TEXT NOT NULL,
  description TEXT,
  geometry_json TEXT,                -- GeoJSON da geometria do alerta
  sent_to_whatsapp INTEGER DEFAULT 0,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sessão WhatsApp Baileys
CREATE TABLE whatsapp_sessions (
  id TEXT PRIMARY KEY DEFAULT 'default',
  creds_json TEXT,                   -- Credenciais do baileys
  connected INTEGER DEFAULT 0,
  phone_number TEXT,
  last_connected TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Log de execução do cron
CREATE TABLE cron_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  cars_processed INTEGER DEFAULT 0,
  alerts_found INTEGER DEFAULT 0,
  alerts_sent INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  status TEXT DEFAULT 'running'      -- 'running' | 'completed' | 'failed'
);

-- Índices
CREATE INDEX idx_cars_user ON cars(user_id, active);
CREATE INDEX idx_alerts_car ON alerts(car_id, detected_date);
CREATE INDEX idx_alerts_user ON alerts(user_id, created_at);
CREATE INDEX idx_alerts_local_id ON alerts(alert_local_id);
```

## Endpoints da API

### Públicos

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/health` | Não | `{status:"ok", uptime:123}` |

### Autenticados (usuário)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/register` | Firebase | Criar registro local (uid + WhatsApp) |
| GET | `/api/auth/me` | Firebase | Dados do usuário |
| PUT | `/api/auth/me` | Firebase | Atualizar WhatsApp |
| GET | `/api/cars` | Firebase | Listar CARs do usuário |
| POST | `/api/cars` | Firebase | Adicionar CAR → busca WFS |
| GET | `/api/cars/:id` | Firebase | Detalhes + polígono |
| DELETE | `/api/cars/:id` | Firebase | Parar monitoramento |
| GET | `/api/cars/:id/alerts` | Firebase | Alertas do CAR |
| POST | `/api/cars/:id/check` | Firebase | Forçar consulta agora |

### Admin (requireAdmin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/stats` | Cards do dashboard |
| GET | `/api/admin/users` | Lista usuários |
| PUT | `/api/admin/users/:id` | Ativar/desativar |
| GET | `/api/admin/cron/status` | Último cron |
| POST | `/api/admin/cron/run` | Executar cron agora |
| GET | `/api/admin/notifications` | Log de envios |
| GET | `/api/admin/whatsapp/status` | Status conexão |
| GET | `/api/admin/whatsapp/qr` | QR Code (base64) |
| POST | `/api/admin/whatsapp/reconnect` | Reconectar |
| POST | `/api/admin/whatsapp/disconnect` | Desconectar |

## Serviço WFS SEMA (`wfs-sema.ts`)

```typescript
interface CarPolygon {
  carNumber: string
  carNumberWfs: string
  geometry: GeoJSON.Polygon
  areaHa: number
  properties: {
    codigo: number
    municipio: string
    situacao: string
    abertura?: string
  }
}

async function fetchCarPolygon(carNumber: string): Promise<CarPolygon | null>
```

**Método**: Converter nº para formato WFS (`MTXXXXX/YYYY`) → CQL_FILTER na camada `CAR_ATP` → parsear geometria → reprojetar SIRGAS 2000 → WGS84.

**Cache**: Polígono cacheado 30 dias. Se falhar, mantém cache antigo.

## Serviço SCCON (`sccon.ts`)

```typescript
interface ScconAlert {
  localId: number
  classType: string          // CUT, SELECTIVE_EXTRACTION, etc.
  date: Date
  areaHa: number
  feature: Feature<Polygon>
}

async function getPublicToken(): Promise<string>
async function fetchAlertsForGeometry(geometry: Polygon): Promise<ScconAlert[]>
```

**Fluxo**: Token público → userId → WFS com bbox do polígono → IDs de alertas → detalhes em paralelo → spatial join (quais intersectam o polígono?).

**Paralelismo**: 12 workers HTTP simultâneos para buscar detalhes.

**Detecção de novos**: `alert_local_id` não existente no banco = novo alerta.

## Cron (`cron/monitor.ts`)

```
06:00 BRT diário:
  FOR each active CAR:
    1. Carregar polígono (cache ou fetch WFS SEMA)
    2. fetchAlertsForGeometry(polygon) → SCCON
    3. Filtrar apenas alertas NOVOS (não estão no banco)
    4. Salvar novos alertas
    5. Se novos > 0 → enfileirar WhatsApp
    6. Se falhar → logar erro, continuar próximo CAR
  END FOR
  Gravar cron_log
```

## WhatsApp (`whatsapp.ts`)

```typescript
async function connect(): Promise<void>
function getQrCode(): string | null
function getStatus(): { connected: boolean; phone?: string; uptime?: number }
async function sendAlert(to: string, carNumber: string, alerts: Alert[]): Promise<boolean>
```

## Deploy

Ver `DEPLOY.md` para systemd, Cloudflare Tunnel e variáveis de ambiente.

## Pitfalls

- **Baileys desconecta**: handler `connection.update` + reconexão automática
- **WFS SEMA timeout**: retry 3x, cache agressivo, não usar `startIndex`
- **SCCON token expira**: renovar automaticamente, cache 23h
- **INTERSECTS WFS não confiável**: usar CQL_FILTER ou BBOX + clip local
- **NUNCA usar kill**: backend com `Restart=always`, usar `systemctl --user restart`
- **Porta 3002**: não conflita com GeoForest (3001), Nexus, Auracore, VendaFácil

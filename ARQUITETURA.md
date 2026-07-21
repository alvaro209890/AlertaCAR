# Arquitetura — AlertaCAR

## Visão geral

```
┌──────────────────────────────────────────────────────────┐
│                   Cloudflare Tunnel                       │
│  alertacar.cursar.space      → localhost:5173 (app)       │
│  alertacar-admin.cursar.space → localhost:5174 (admin)    │
│  alertacar-api.cursar.space   → localhost:3002 (backend)  │
└────────────────────┬─────────────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────────────┐
│  App (React/Vite)          Admin (React/Vite)             │
│  Porta 5173 dev            Porta 5174 dev                 │
│  Auth: Firebase Auth       Auth: Firebase Auth             │
│  Público: clientes          Público: dono/admin            │
│                                                           │
│  Funcionalidades:           Funcionalidades:              │
│  - Cadastro/login           - Dashboard de estatísticas    │
│  - CRUD de CARs             - Gerenciar usuários           │
│  - Dashboard de alertas     - Conectar WhatsApp (QR Code)  │
│  - Histórico                - Logs de notificações         │
│  - Perfil (WhatsApp)        - Configurações gerais         │
└────────────────────┬─────────────────────────────────────┘
                     │ /api/*
┌────────────────────▼─────────────────────────────────────┐
│  Backend (Node/Express) — Porta 3002                      │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Routes      │  │  Services     │  │  Cron            │  │
│  │              │  │               │  │                  │  │
│  │ /api/auth    │  │ sccon.ts      │  │ Diário 06:00     │  │
│  │ /api/cars    │  │ wfs-sema.ts   │  │ - Varre CARs     │  │
│  │ /api/alerts  │  │ whatsapp.ts   │  │ - Consulta SCCON │  │
│  │ /api/admin   │  │               │  │ - Consulta WFS   │  │
│  └─────────────┘  └──────────────┘  │ - Enfileira msg   │  │
│                                      └──────────────────┘  │
│  ┌─────────────┐                                           │
│  │  SQLite DB   │                                          │
│  │  - users     │                                          │
│  │  - cars      │                                          │
│  │  - alerts    │                                          │
│  │  - whatsapp_sessions                                      │
│  └─────────────┘                                           │
└──────────────────────────────────────────────────────────┘
```

## Domínios (Cloudflare Tunnel)

| Domínio | Serviço | Porta Local |
|---------|---------|-------------|
| `alertacar.cursar.space` | Frontend App | 5173 (dev) / servido pelo backend em prod |
| `alertacar-admin.cursar.space` | Frontend Admin | 5174 (dev) / servido pelo backend em prod |
| `alertacar-api.cursar.space` | Backend API | 3002 |

Todos usando o mesmo túnel Cloudflare, sem derrubar nenhum túnel existente.

## Banco de dados (SQLite)

Um único arquivo `backend/data/alertacar.db`:

```sql
-- Usuários (sincronizado com Firebase Auth uid)
users (
  id TEXT PRIMARY KEY,        -- Firebase Auth uid
  email TEXT NOT NULL,
  name TEXT,
  whatsapp_number TEXT NOT NULL,  -- +55XXXXXXXXXXX
  created_at TEXT DEFAULT (datetime('now')),
  active INTEGER DEFAULT 1
)

-- CARs monitorados
cars (
  id TEXT PRIMARY KEY,        -- UUID
  user_id TEXT NOT NULL REFERENCES users(id),
  car_number TEXT NOT NULL,   -- Número do CAR (ex: 271442)
  polygon_json TEXT,          -- GeoJSON do polígono (WFS SEMA)
  last_polygon_fetch TEXT,    -- Última busca do polígono
  area_ha REAL,               -- Área em hectares
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, car_number)
)

-- Alertas detectados
alerts (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL REFERENCES cars(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  source TEXT NOT NULL,       -- 'sccon' | 'sema_embargo' | 'sema_status'
  type TEXT NOT NULL,         -- 'desmatamento' | 'degradacao' | 'embargo' | 'status_change'
  title TEXT NOT NULL,
  description TEXT,
  detected_at TEXT NOT NULL,  -- Quando foi detectado
  sent_to_whatsapp INTEGER DEFAULT 0,
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)

-- Sessão WhatsApp (baileys)
whatsapp_sessions (
  id TEXT PRIMARY KEY DEFAULT 'default',
  creds_json TEXT,            -- Credenciais criptografadas do baileys
  connected INTEGER DEFAULT 0,
  last_connected TEXT
)
```

## Integrações Externas

### 1. WFS da SEMA-MT

- **URL Base**: `https://geoportal.sema.mt.gov.br/geoserver/SEMA/ows`
- **Método**: `GetFeature` com `BBOX` (NÃO usar INTERSECTS — não confiável)
- **Objetivo**: Buscar polígono do CAR informado e extrair área/geometria
- **Cache**: Polígono cacheado por 30 dias (não muda com frequência)

### 2. SCCON (Sistema de Comercialização e Controle)

- **Objetivo**: Detectar alertas de desmatamento e degradação para os polígonos monitorados
- **Método**: A definir — consulta por coordenadas do polígono ou número do CAR
- **Frequência**: Diária (cron 06:00)
- **Integração atual no GeoForest**: AUAS (Análise Unificada de Alertas SCCON) — reutilizar lógica

### 3. WhatsApp (Baileys)

- **Método**: Baileys WebSocket (sem API paga, mesmo padrão SaldoPro)
- **Conexão**: QR Code escaneado uma vez pelo admin
- **Envio**: Backend enfileira mensagens e dispara via sessão conectada
- **Formato**: Mensagem curta e direta com dados do alerta

## Sistema de arquivos (systemd)

Serviço rodando como `systemd --user` com `Restart=always`:

```
alertacar-backend.service
  ExecStart: node dist/index.js
  WorkingDirectory: /media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR/backend
  Environment: PORT=3002
  Restart: always
```

Frontends servidos estaticamente pelo backend (Express `express.static()`), mesmo padrão GeoForest.

## Segurança

- Auth: Firebase Authentication (já configurado no projeto Firebase existente)
- Admin: Middleware que verifica se `uid` está na whitelist de admins
- WhatsApp: Sessão baileys criptografada, credenciais nunca expostas
- API: Rate limiting por IP nas rotas públicas

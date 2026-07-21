# Backend — AlertaCAR

## Stack

- **Runtime**: Node.js 20+ com TypeScript
- **Servidor**: Express
- **Banco**: SQLite via `better-sqlite3`
- **Auth**: Firebase Admin SDK (verificar tokens JWT do frontend)
- **Cron**: `node-cron`
- **WhatsApp**: Baileys (WebSocket, sessão persistente)
- **Build**: `esbuild` (bundle ESM, mesmo padrão GeoForest)

## Estrutura

```
backend/
├── src/
│   ├── index.ts              # Servidor Express, middleware, CORS
│   ├── middleware/
│   │   ├── auth.ts           # requireAuth (Firebase token)
│   │   └── admin.ts          # requireAdmin (whitelist)
│   ├── routes/
│   │   ├── auth.ts           # /api/auth/*
│   │   ├── cars.ts           # /api/cars/*
│   │   ├── alerts.ts         # /api/alerts/*
│   │   └── admin.ts          # /api/admin/*
│   ├── services/
│   │   ├── wfs-sema.ts       # Buscar polígono CAR no WFS da SEMA-MT
│   │   ├── sccon.ts          # Consultar alertas SCCON (AUAS)
│   │   ├── whatsapp.ts       # Gerenciar sessão Baileys + enviar msg
│   │   └── notification.ts   # Fila de notificações + dispatcher
│   ├── cron/
│   │   └── monitor.ts        # Cron diário: varre CARs → SCCON → alertas
│   ├── db/
│   │   ├── connection.ts     # Conexão SQLite (singleton)
│   │   ├── schema.ts         # Criação de tabelas
│   │   └── migrations/       # Migrações futuras
│   └── lib/
│       ├── firebase.ts       # Firebase Admin init
│       └── config.ts         # Configurações (PORT, paths, etc.)
├── data/
│   └── alertacar.db          # Arquivo SQLite (gitignored)
├── package.json
├── tsconfig.json
└── .env
```

## Endpoints da API

### Públicos (sem auth)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Healthcheck |
| GET | `/api/admin/whatsapp/qr` | QR Code do WhatsApp (admin only via token) |

### Autenticados (usuário)

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Registrar usuário (Firebase uid + WhatsApp) |
| GET | `/api/auth/me` | Dados do usuário logado |
| PUT | `/api/auth/me` | Atualizar perfil (WhatsApp) |
| GET | `/api/cars` | Listar CARs do usuário |
| POST | `/api/cars` | Adicionar CAR (nº CAR → busca polígono WFS) |
| GET | `/api/cars/:id` | Detalhes do CAR |
| DELETE | `/api/cars/:id` | Remover CAR do monitoramento |
| GET | `/api/cars/:id/alerts` | Listar alertas do CAR |
| POST | `/api/cars/:id/check` | Forçar re-consulta agora |

### Admin

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/stats` | Estatísticas gerais |
| GET | `/api/admin/users` | Listar usuários |
| PUT | `/api/admin/users/:id` | Ativar/desativar usuário |
| GET | `/api/admin/notifications` | Log de notificações enviadas |
| GET | `/api/admin/whatsapp/status` | Status da conexão WhatsApp |
| POST | `/api/admin/whatsapp/reconnect` | Reconectar WhatsApp |

## Serviço WFS SEMA-MT

```typescript
// services/wfs-sema.ts
interface CarPolygon {
  carNumber: string
  geometry: GeoJSON.Polygon
  areaHa: number
  properties: {
    cod_imovel: string
    municipio: string
    status: string
    // ...
  }
}

// Busca polígono do CAR e faz cache por 30 dias
async function fetchCarPolygon(carNumber: string): Promise<CarPolygon>
```

**Método**: WFS `GetFeature` com `BBOX` para a área do CAR. INTERSECTS não é confiável no GeoServer da SEMA (retorna subconjunto sem erro).

**Cache**: Polígono cacheado no SQLite. Se última busca < 30 dias, usa cache. Se falhar, mantém o cache antigo (não invalida em falha).

**Pitfalls**:
- Paginação quebrada no GeoServer da SEMA — `startIndex` causa timeout
- Timeout frequente — implementar retry (3 tentativas)
- INTERSECTS retorna subconjunto — usar sempre BBOX + clip local com Turf.js

## Serviço SCCON

```typescript
// services/sccon.ts
interface ScconAlert {
  id: string
  type: 'desmatamento' | 'degradacao'
  date: string
  areaHa: number
  description: string
}

// Consulta alertas SCCON para uma geometria
async function fetchScconAlerts(geometry: GeoJSON.Polygon): Promise<ScconAlert[]>
```

**Método**: A definir durante implementação — reutilizar lógica do GeoForest (AUAS×SCCON). Possivelmente consulta por coordenadas do centróide ou envio do polígono completo.

**Detecção de novos alertas**: Comparar `id` do alerta SCCON com os já salvos no banco. Só criar registro se for novo.

## Cron de Monitoramento

```typescript
// cron/monitor.ts
// Executa diariamente às 06:00
async function dailyMonitor() {
  const activeCars = getAllActiveCars()
  let alertsFound = 0

  for (const car of activeCars) {
    try {
      const polygon = getCachedOrFetch(car)
      const scconAlerts = await fetchScconAlerts(polygon)
      const newAlerts = filterNewAlerts(car.id, scconAlerts)

      if (newAlerts.length > 0) {
        saveAlerts(car.id, newAlerts)
        enqueueWhatsApp(car.user_id, car.car_number, newAlerts)
        alertsFound += newAlerts.length
      }
    } catch (err) {
      logError(`Falha ao processar CAR ${car.car_number}: ${err.message}`)
    }
  }

  logInfo(`Monitoramento concluído: ${activeCars.length} CARs, ${alertsFound} alertas novos`)
}
```

## Serviço WhatsApp (Baileys)

```typescript
// services/whatsapp.ts
import makeWASocket from '@whiskeysockets/baileys'

// Singleton da conexão
let sock: WASocket | null = null

// Em produção, usar SQLite para auth state
async function connect(): Promise<void>
async function disconnect(): Promise<void>
function getStatus(): 'connected' | 'disconnected' | 'connecting'
function getQrCode(): string | null  // base64 do QR

// Envia mensagem de alerta formatada
async function sendAlert(to: string, alert: AlertData): Promise<boolean>

// Formato da mensagem:
// 🔔 *AlertaCAR — Novo alerta detectado*
// CAR: 271442
// Tipo: Desmatamento
// Data: 21/07/2026
// Área: 12.5 ha
// —
// Acesse alertacar.cursar.space para mais detalhes
```

**Persistência da sessão**: Auth state do baileys salvo no SQLite (`whatsapp_sessions`). Reconexão automática em caso de queda.

**Conexão única**: Apenas 1 número de WhatsApp conectado (o do admin/dono). Todos os alertas são enviados por esse número para os WhatsApps cadastrados dos usuários.

## Deploy

Ver `DEPLOY.md`.

## Pitfalls

- **Baileys desconecta sozinho** — Implementar `connection.update` handler com reconexão automática
- **WFS SEMA é lento** — Timeout de 30s, retry 3x, cache agressivo
- **SCCON pode mudar API** — Abstrair em serviço isolado, fácil de trocar
- **NUNCA usar kill no processo** — Backend roda com `Restart=always`, usar `systemctl --user restart`

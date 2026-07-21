# Backend — AlertaCAR

## Stack

- **Runtime**: Node.js 20+ com TypeScript
- **Servidor**: Express
- **Auth**: bcrypt + JWT (HS256, 7 dias) — **100% local**
- **Banco**: SQLite via `better-sqlite3`
- **Cron**: `node-cron`
- **Geo**: Turf.js + proj4js
- **WhatsApp**: Baileys
- **Build**: esbuild (bundle ESM)

## Estrutura

```
backend/
├── src/
│   ├── index.ts                   # Express + CORS + static serve
│   ├── middleware/
│   │   ├── auth.ts                # requireAuth: JWT verify
│   │   └── admin.ts               # requireAdmin: role check
│   ├── routes/
│   │   ├── auth.ts                # register, login, me
│   │   ├── cars.ts                # CRUD + WFS lookup
│   │   ├── alerts.ts              # listagem por CAR
│   │   └── admin.ts               # stats, users, whatsapp
│   ├── services/
│   │   ├── sccon.ts               # Token + search + detalhes
│   │   ├── wfs-sema.ts            # 135 camadas: CAR, embargo, licença, infração
│   │   ├── whatsapp.ts            # Baileys connect + send
│   │   ├── notification.ts        # Fila + rate limiting
│   │   └── car-importer.ts        # nº CAR → formato WFS → polígono
│   ├── cron/
│   │   └── monitor.ts             # Diário 06:00 multicamada
│   ├── db/
│   │   ├── connection.ts          # SQLite singleton
│   │   ├── schema.ts              # CREATE TABLES
│   │   └── queries.ts             # CRUD helpers
│   └── lib/
│       ├── jwt.ts                 # sign + verify
│       ├── bcrypt.ts              # hash + compare
│       └── config.ts              # env vars tipadas
├── package.json
└── tsconfig.json
```

## Schema SQLite

**Localização**: `/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/alertacar.db`

Ver `ARQUITETURA.md` para schema completo.

## Endpoints

### Auth (público)

| Método | Rota | Body | Retorno |
|--------|------|------|---------|
| POST | `/api/auth/register` | `{email, password, name, whatsapp}` | `{token, user}` |
| POST | `/api/auth/login` | `{email, password}` | `{token, user}` |

### Auth (autenticado)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/auth/me` | Dados do usuário |
| PUT | `/api/auth/me` | Atualizar nome/whatsapp |
| PUT | `/api/auth/password` | Trocar senha |

### CARs (autenticado)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cars` | Listar CARs (com último alerta) |
| POST | `/api/cars` | `{carNumber}` → busca WFS → salva |
| GET | `/api/cars/:id` | Detalhes + GeoJSON + alertas |
| DELETE | `/api/cars/:id` | Parar monitoramento |
| POST | `/api/cars/:id/check` | Forçar consulta agora |

### Alertas (autenticado)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cars/:id/alerts` | Listar alertas (filtro por source, período) |

### Admin (requireAdmin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/stats` | Cards do dashboard |
| GET | `/api/admin/users` | Listar usuários |
| PUT | `/api/admin/users/:id` | Ativar/desativar |
| GET | `/api/admin/cron/status` | Último cron |
| POST | `/api/admin/cron/run` | Executar agora |
| GET | `/api/admin/notifications` | Log envios WhatsApp |
| GET | `/api/admin/whatsapp/status` | `{connected, phone, uptime}` |
| GET | `/api/admin/whatsapp/qr` | QR Code base64 |
| POST | `/api/admin/whatsapp/reconnect` | Forçar reconexão |

## Serviço SCCON (`sccon.ts`)

```typescript
// Token público (cache 23h, renova automaticamente)
async function getPublicToken(): Promise<string>

// ⭐ Busca alertas por CAR (API paginada — 1 chamada!)
async function searchAlertsByCar(
  carNumber: string,
  classes?: string[],
  fromDate?: string,
  toDate?: string
): Promise<ScconAlert[]>

interface ScconAlert {
  id: number                  // idt_local_alert
  classType: string           // CUT, SELECTIVE_EXTRACTION, etc.
  alertDetectedDate: string   // ISO datetime
  area: number                // m²
  geometry: GeoJSON.Polygon   // EPSG:4674
}
```

**Vantagem**: `POST /api-v2/alerts/search` com `cdCars` já retorna geometria + data. Não precisa mais do fluxo WFS → IDs → detalhes (N+1 chamadas).

## Serviço WFS SEMA (`wfs-sema.ts`)

```typescript
// Buscar polígono do CAR
async function fetchCarPolygon(carNumber: string): Promise<CarPolygon | null>

// Monitoramento (todos usam BBOX + intersect local)
async function fetchEmbargos(polygon: Polygon): Promise<EmbargoAlert[]>
async function fetchInfracoes(polygon: Polygon): Promise<InfracaoAlert[]>
async function fetchLicenciamento(polygon: Polygon): Promise<LicencaAlert[]>
async function fetchSobreposicoes(polygon: Polygon): Promise<SobreposicaoAlert[]>
async function fetchDesembargos(polygon: Polygon): Promise<DesembargoAlert[]>
```

Camadas usadas:

| Função | Camada(s) |
|--------|-----------|
| `fetchCarPolygon` | `CAR_ATP` (CQL_FILTER por NUMERO_CAR) |
| `fetchEmbargos` | `AREAS_EMBARGADAS_SEMA`, `AREA_EMBARGADA_SIGA_POLIGONO` |
| `fetchInfracoes` | `TDAD_FISCALIZACAO_AUTO_DE_INFRACAO`, `AUTOS_DE_INFRACAO_SIGA_POLIGONO` |
| `fetchLicenciamento` | `SIMLAMGEO_LP_ATIVA`, `SIMLAMGEO_LI_ATIVA`, `SIMLAMGEO_LO_ATIVA` |
| `fetchSobreposicoes` | `TERRAS_INDIGENAS`, `UNIDADES_CONSERVACAO`, `ASSENTAMENTOS_INCRA` |
| `fetchDesembargos` | `AREAS_DESEMBARGADAS_SEMA` |

## Cron (`cron/monitor.ts`)

```
06:00 BRT (09:00 UTC) diário:

FOR each active CAR:
  TRY:
    polygon = getCachedOrFetch(car)

    // 1. SCCON desmatamento/degradacao
    scconAlerts = searchAlertsByCar(car.number)
    saveNew('sccon', scconAlerts)

    // 2. SEMA Embargos
    embargos = fetchEmbargos(polygon)
    saveNew('sema_embargo', embargos)

    // 3. SEMA Infrações
    infracoes = fetchInfracoes(polygon)
    saveNew('sema_infracao', infracoes)

    // 4. SEMA Licenciamento
    licencas = fetchLicenciamento(polygon)
    saveNew('sema_licenca', licencas)

    // 5. Fundiário
    sobreposicoes = fetchSobreposicoes(polygon)
    saveNew('fundiario', sobreposicoes)

    // Enfileirar WhatsApp para novos alertas
    enqueueWhatsApp(car.user_id, car.id, newAlerts)

  CATCH err:
    logError(car.number, err.message)
    CONTINUE  // não bloqueia outros CARs

salvar cron_log
```

## WhatsApp (`whatsapp.ts`)

- Baileys com auth state em SQLite (`whatsapp_sessions`)
- QR Code via endpoint admin
- Reconexão automática
- Template: `🔔 *AlertaCAR — {tipo}*\n📍 CAR: {numero}\n...`

## Notificações (`notification.ts`)

- Fila em memória + fallback SQLite
- Rate limiting: 1/CAR/h, 10/user/dia
- Retry 3x com backoff
- Agrupa múltiplos alertas do mesmo CAR

## Pitfalls

- **Baileys desconecta** → handler `connection.update` + reconexão
- **WFS SEMA timeout** → retry 3x, 30s cada
- **SCCON token expira** → renovar automático, margem 1h
- **INTERSECTS quebrado** → sempre BBOX + clip local com Turf.js
- **NUNCA usar kill** → `systemctl --user restart`
- **Banco fora do repo** → `Banco_de_dados/AlertaCAR/`, backup separado
- **JWT_SECRET** → gerar com `openssl rand -hex 64`, nunca comitar

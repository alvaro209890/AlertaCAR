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
│   │   ├── cars.ts                # CRUD + WFS lookup + PATCH nickname
│   │   ├── alerts.ts              # 🆕 GET filtrado+paginado, PATCH status/notas (Fase 5.4)
│   │   ├── sema-monitor.ts        # 🆕 Força verificação multicamada (Fase 4)
│   │   ├── satellite.ts           # 🆕 Capabilities/frame/NDVI/tendência (Fase 6)
│   │   └── admin.ts               # stats, users, whatsapp
│   ├── services/
│   │   ├── sccon.ts               # Token + search + detalhes
│   │   ├── wfs-sema.ts            # CAR_ATP: nº CAR → polígono
│   │   ├── wfs-intersection.ts    # 🆕 Motor genérico WFS (capabilities/describe/INTERSECTS/paginação) — Fase 4
│   │   ├── wfs-car-layers.ts      # 🆕 Camadas do CAR (ARL/APP/AVN/AUAS/...) + bioma + conformidade ARL — Fase 4
│   │   ├── wfs-sema-monitor.ts    # 🆕 Embargos/desembargos/infrações/notificações/licenças/autorizações/fundiário — Fase 4
│   │   ├── car-monitor.ts         # 🆕 Orquestra todas as fontes Fase 4 por CAR (independente, dedup, upsert)
│   │   ├── satellite.ts           # 🆕 Catálogo de satélites + NDVI real via GetFeatureInfo (Fase 6)
│   │   ├── whatsapp.ts            # Baileys connect + send (Fase 10 — não implementado)
│   │   ├── notification.ts        # Fila + rate limiting (Fase 10 — não implementado)
│   │   └── car-importer.ts        # nº CAR → formato WFS → polígono
│   ├── cron/
│   │   └── monitor.ts             # Diário 06:00: SCCON + Fase 4 multicamada
│   ├── db/
│   │   ├── connection.ts          # SQLite singleton
│   │   ├── schema.ts              # CREATE TABLES
│   │   └── queries.ts             # CRUD helpers
│   └── lib/
│       ├── jwt.ts                 # sign + verify
│       ├── bcrypt.ts              # hash + compare
│       ├── config.ts              # env vars tipadas
│       └── severity.ts            # 🆕 computeSeverity() — classe base × área (Fase 5.4)
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
| GET | `/api/cars/:id` | Detalhes + GeoJSON + alertas + layers/licenses/sobreposicoes/conformidade (Fase 4) |
| PATCH | `/api/cars/:id` | 🆕 `{nickname}` — apelido (Fase 5.5) |
| DELETE | `/api/cars/:id` | Parar monitoramento (soft delete) |
| PATCH | `/api/cars/:id/refresh` | Forçar re-consulta WFS |

### Downloads (autenticado) 🆕

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cars/:id/export?format=shp` | Baixar polígono do CAR (Shapefile .zip) |
| GET | `/api/cars/:id/alerts/export?format=csv\|geojson\|json` | Baixar alertas |
| GET | `/api/cars/:id/report?format=pdf\|html` | Relatório da propriedade |

### Satélite (autenticado) 🛰️ — Fase 6 ✅ core pronto

A SEMA disponibiliza **53 camadas WMS de satélite** via GeoServer: Landsat 5 (1984–2011, exceto
2001/2002), Landsat 7 (2002), Landsat 8 (2013–2018), Sentinel-2 RGB (2016–2025), SPOT, RESOURCESAT
(catálogo real em `backend/src/services/satellite.ts`, `SATELLITE_CATALOG`).

⚠️ **Não existe Sentinel-2 NIR de verdade neste servidor** — o que a Fase 6 original chamava de "layer
NIR" é na verdade um *style* que devolve a mesma imagem RGB (confirmado por hash MD5 idêntico), e o WCS
(que daria banda bruta em GeoTIFF) está desabilitado no GeoServer. O NDVI abaixo é calculado por
amostragem de pixel via `GetFeatureInfo` (banda 3 = NIR, banda 2 = RED, confirmado ao vivo), não por
um layer de falsa-cor. Ver [CAMADAS-SEMA.md §3](./CAMADAS-SEMA.md) para os detalhes da descoberta.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cars/:id/satellite/capabilities` | Catálogo real de satélites/anos + bbox do imóvel (com margem) |
| GET | `/api/cars/:id/satellite/frame?sat=&year=` | Monta a URL do WMS `GetMap` recortado no bbox (sempre PNG) |
| GET | `/api/cars/:id/satellite/ndvi?year=&force=` | NDVI amostrado (grade de pontos + `GetFeatureInfo`, cache em `car_ndvi`; `force=true` recalcula) |
| GET | `/api/cars/:id/satellite/ndvi-trend?years=2016,2019,2021,2023,2025` | Tendência multi-ano + `deltaNdvi` + `classificacao` (`recuperando`/`estavel`/`perdendo_vegetacao`) |

**Não implementado nesta rodada**: GIF/MP4 de timelapse (o front já resolve isso com slider+play trocando
de camada WMS ao vivo, sem precisar gerar vídeo no servidor), endpoint dedicado de `compare` (o split-view
é só duas `WMSTileLayer` lado a lado no front, não precisa de rota própria), downloads (PNG/GeoTIFF/CSV),
`analysis` com parecer de IA (adiado pra Fase 7, que ainda não existe).

### Alertas (autenticado) — Fase 5.4 ✅

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cars/:id/alerts?source=&status=&classType=&limit=&offset=` | Timeline paginada com filtros; cada alerta traz `severity` (calculada) |
| PATCH | `/api/alerts/:id` | Atualiza `status` (`novo`/`em_analise`/`validado`/`falso_positivo`/`resolvido`) e/ou `notes` — triagem do consultor |

`GET /api/cars/:id` continua retornando os 20 alertas mais recentes embutidos (para o dashboard e a
aba Mapa); a aba Alertas da página de detalhes usa o endpoint dedicado acima.

### SEMA Multicamada (autenticado) — Fase 4 🆕

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/sema-monitor/check/:carId` | Força verificação de todas as fontes SEMA expandidas (embargos, desembargos, infrações, notificações, autorizações, fundiário, licenças, camadas do CAR + conformidade) para um CAR |
| POST | `/api/sema-monitor/check-all` | Admin: força verificação de todos os CARs |

`GET /api/cars/:id` agora também retorna `layers` (camadas do CAR com área), `licenses`
(licenças ativas com urgência de vencimento), `sobreposicoes` (TI/UC/Assentamentos) e
`conformidade` (bioma, % de ARL exigida, déficit de Reserva Legal).

### SCCON (autenticado)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/sccon/config` | Classes de alerta disponíveis |
| POST | `/api/sccon/check/:carId` | Forçar verificação manual de um CAR |
| POST | `/api/sccon/check-all` | Admin: forçar verificação de todos |

### Admin (requireAdmin)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/stats` | Cards do dashboard |
| GET | `/api/admin/users` | Listar usuários |
| PUT | `/api/admin/users/:id` | Ativar/desativar |
| GET | `/api/admin/sccon/logs` | Log de execuções do cron |
| POST | `/api/admin/sccon/cron/start` | Iniciar cron |
| POST | `/api/admin/sccon/cron/stop` | Parar cron |
| GET | `/api/admin/cars/export?format=shp` | Exportar CARs (Shapefile .zip) 🆕 |
| GET | `/api/admin/alerts/export?format=csv\|geojson` | Exportar alertas 🆕 |
| GET | `/api/admin/users/export?format=csv` | Exportar usuários 🆕 |
| GET | `/api/admin/notifications` | Log envios WhatsApp |
| GET | `/api/admin/whatsapp/status` | `{connected, phone, uptime}` |
| GET | `/api/admin/whatsapp/qr` | QR Code base64 |
| POST | `/api/admin/whatsapp/reconnect` | Forçar reconexão |
| POST | `/api/admin/reports/generate` | Gerar relatório PDF 🆕 |
| GET | `/api/admin/database/backup` | Backup do banco (.db) 🆕

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

## Serviços WFS multicamada (Fase 4) 🆕

### `wfs-intersection.ts` — motor genérico
Portado de `GeoForest-IA/backend/wfs-intersection.ts` (ver [REUSO-GEOFOREST.md](./REUSO-GEOFOREST.md)):
`getCapabilitiesCached`, `getGeometryFieldForLayer` (DescribeFeatureType — o campo de geometria
varia por camada), `fetchIntersectingFeatures` (INTERSECTS + paginação + fallback + clip via
Turf), `computeIntersectionHectares` (ha e % de cobertura por camada). Testado com 16 testes
unitários (`wfs-intersection.test.ts`) e validado ao vivo contra o WFS da SEMA.

### `wfs-car-layers.ts` — camadas do próprio CAR + conformidade
```typescript
fetchAllCarLayers(carNumberWfs)     // ARL/APP/APPD/APPRL/AVN/AUAS/AU/NASCENTE/AREA_CONSOLIDADA
detectBioma(polygon)                // interseção com Geoportal:BIOMAS_MT (Amazônia/Cerrado/Pantanal)
calcularConformidade({ areaTotalHa, arlDeclaradaHa, bioma })
  // → { arlExigidaPercent, arlExigidaHa, deficitArlHa }  (Art. 12, Lei 12.651/2012 — MT 100% Amazônia Legal)
```
Filtra por atributo (`NUMERO_CAR='...'`), não espacialmente — muito mais rápido e exato que BBOX.
⚠️ **Simplificação legal**: não considera exceções (pequena propriedade, posse de boa-fé,
campos gerais). Sempre confirmar com o RT.

### `wfs-sema-monitor.ts` — fiscalização, licenciamento, autorizações, fundiário
```typescript
fetchEmbargos(polygon)        // Geoportal:AREAS_EMBARGADAS_SEMA (polígono)
fetchDesembargos(polygon)     // Geoportal:AREAS_DESEMBARGADAS_SEMA (polígono)
fetchInfracoes(polygon)       // Geoportal:TDAD_FISCALIZACAO_AUTO_DE_INFRACAO (ponto, BBOX + point-in-polygon)
fetchNotificacoes(polygon)    // Geoportal:TDAD_FISCALIZACAO_NOTIFICACAO (ponto)
fetchLicenciamento(polygon)   // SIMLAMGEO_LP/LI/LO/LOP_ATIVA (ponto) + classificarUrgenciaLicenca()
fetchAutorizacoes(polygon)    // AUTORIZACAO_DESMATE_SEMA + AUTEX_PMFS_SEMA (polígono)
fetchSobreposicoes(polygon)   // TI/UC/Assentamentos/Corredores — % de cobertura
alertaTemAutorizacao(alertGeometry, autorizacoes)  // cruzamento p/ triagem (Fase 5/7)
```
Camadas e campos reais confirmados ao vivo em 21/07/2026 — ver [CAMADAS-SEMA.md](./CAMADAS-SEMA.md).

### `car-monitor.ts` — orquestrador por CAR
`monitorCarMultilayer(carId)` roda todas as fontes acima para um CAR (cada uma em try/catch
independente), salva achados como `alerts` com dedup por `(car_id, source, source_id)`, faz
upsert em `car_layers`/`car_licenses`/`car_sobreposicoes`, e recalcula a conformidade de ARL
na tabela `cars`. `monitorAllCarsMultilayer()` roda para todos os CARs ativos (uso do cron).

## Serviço de satélite/NDVI (Fase 6) 🆕

### `satellite.ts`
```typescript
SATELLITE_CATALOG              // catálogo real (id, label, years[], layerForYear) — 6 satélites
bboxForGeometry(geometry, pad) // bbox do polígono + margem (padrão 15%)
buildFrameUrl(layer, bbox)     // URL do WMS GetMap recortado (front usa direto, mas útil p/ debug/export futuro)
sampleNdviForYear(geometry, year, opts?)
  // 1. gera grade de pontos dentro do bbox (padrão 8×8, teto 40 pontos)
  // 2. mantém só os pontos DENTRO do polígono (turf booleanPointInPolygon)
  // 3. GetFeatureInfo por ponto (concorrência 5, bbox de ~30m ao redor do ponto)
  // 4. parseBandsFromFeatureInfo() casa bandas pelo SUFIXO numérico (_0.._3) — a chave muda de
  //    nome por ano (MOSAICO_SENTINEL2_2016_N vs MOSAICO_SENTINEL_2_2024_N), confirmado ao vivo
  // 5. ndviFromBands(): NDVI = (banda3 − banda2) / (banda3 + banda2)  — NIR=banda3, RED=banda2
  // 6. agrega: meanNdvi, minNdvi, maxNdvi, pctVegetacao (% de pontos com NDVI > 0,3)
classifyTrend(deltaNdvi)       // 'recuperando' (>+0,05) / 'perdendo_vegetacao' (<-0,05) / 'estavel' / 'indeterminado'
```
Resultado por ano é cacheado na tabela `car_ndvi` (`UNIQUE(car_id, year)`) pela rota — evitar reamostrar
o mesmo ano toda vez é importante porque o servidor da SEMA é lento/instável sob carga repetida (mesmo
padrão de flakiness já observado na Fase 4). 18 testes unitários (`satellite.test.ts`) cobrem parsing
de bandas, cálculo de NDVI (com valores reais de floresta vs. urbano capturados ao vivo) e classificação
de tendência. Validado ao vivo: ver tabela de testes de integração no [README](./README.md).

## Cron (`cron/monitor.ts`)

```
06:00 BRT (09:00 UTC) diário — runDailyMonitor():

1. checkAllActiveCars()          // SCCON (Fase 3)
2. monitorAllCarsMultilayer()    // Fase 4: para cada CAR ativo, independente:
   FOR each active CAR:
     TRY: embargos, desembargos, infrações, notificações, autorizações,
          fundiário, licenciamento (c/ urgência de vencimento),
          camadas do CAR + conformidade de ARL
     CATCH err: registra erro na fonte, CONTINUA (não bloqueia as outras)

3. grava cron_logs (sources_json com contagem por fonte)

// WhatsApp (Fase 10) ainda não enfileira envios
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
- **WFS SEMA timeout** → retry 2-3x, 30s cada (WFS real é instável sob carga — algumas
  camadas do CAR chegam a abortar mesmo com retry; cada camada falha isoladamente sem
  derrubar as outras)
- **CQL_FILTER com `AND` sem parênteses derruba a conexão** ⚠️ — confirmado ao vivo
  21/07/2026: `NUMERO_CAR='X' AND SITUACAO='ATIVO'` falha (HTTP 000); `(NUMERO_CAR='X')AND(SITUACAO='ATIVO')`
  funciona. Sempre parentetizar cada condição. Ver [CAMADAS-SEMA.md](./CAMADAS-SEMA.md).
- **SCCON token expira** → renovar automático, margem 1h
- **INTERSECTS quebrado** → sempre BBOX + clip local com Turf.js, ou `DescribeFeatureType`
  para achar o campo de geometria real (varia por camada)
- **NUNCA usar kill** → `systemctl --user restart`
- **Banco fora do repo** → `Banco_de_dados/AlertaCAR/`, backup separado
- **JWT_SECRET** → gerar com `openssl rand -hex 64`, nunca comitar
- **`pnpm-workspace.yaml` do backend precisa de `packages:`** — sem isso, `pnpm add` falha
  com "packages field missing or empty" (corrigido 21/07/2026)
- **`tsconfig.json` sem `declaration: true`** — o build real é via esbuild (bundle), não
  `tsc`; deixar `declaration` ligado só gera erros de portabilidade (`TS2742`/`TS4023`) do
  `pnpm` sem benefício algum

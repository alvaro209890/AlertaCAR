# Plano — AlertaCAR

> **Norte do produto:** o "vigia ambiental" definitivo para **consultores e engenheiros florestais** que
> monitoram carteiras inteiras de imóveis rurais. Técnico, GIS-first, com IA de apoio à decisão.
> Tudo **grátis / self-hosted** — sem planos pagos, sem gating, sem SaaS externo.

---

## 0. Estado real (auditado em 21/07/2026, atualizado após Fases 4, 5 e 6)

O que está **de fato implementado em código** (não só documentado):

| Camada | Implementado | Ainda não existe |
|--------|--------------|------------------|
| **Backend** | Auth local, CRUD de CARs (+ apelido), SCCON, cron diário (SCCON + Fase 4), `/api/admin/stats`. **Fase 4**: motor WFS de interseção, camadas do CAR + conformidade de ARL, embargos/desembargos/infrações/notificações/autorizações/licenciamento (urgência)/sobreposições fundiárias. **Fase 5**: severidade calculada (`lib/severity.ts`), workflow de status/notas por alerta (`PATCH /api/alerts/:id`), listagem paginada+filtrada (`GET /api/cars/:id/alerts`). **Fase 6**: catálogo real de satélites, `frame` (URL de GetMap recortado), NDVI real amostrado via `GetFeatureInfo` (com cache) e tendência multi-ano. **Fase 7** (IA DeepSeek): chat/threads, score de risco, triagem, RAG jurídico, minuta de laudo. **Fase 8.1** (organização): clientes/tags/cores. **Fase 9** (21/07, backend completo): laudo/carteira/histórico em PDF (PDFKit), exports GIS (SHP/GeoJSON/KML/KMZ/CSV/GPKG), API Key, GeoJSON ao vivo p/ QGIS, Webhooks HMAC — 101 testes no total, tudo validado ao vivo (incl. GDAL/ogrinfo) | Importação em massa, tabela/mapa consolidado da carteira, ações em massa (Fase 8), WhatsApp/Baileys, fila de notificação (Fase 10), ferramentas GIS de conformidade (Fase 13) |
| **App cliente** | Login, Cadastro, Dashboard (carteira simples, link p/ detalhe). **Fase 5**: página `/dashboard/cars/:id` real com 5 abas (Visão Geral, Alertas, Mapa, Camadas, Config) — reestruturado em `lib/`/`components/`/`pages/`, mapa Leaflet com camadas SEMA ao vivo, workflow de triagem de alertas, apelido. **Fase 6**: 6ª aba **Satélite** — timelapse por slider+play, split-view, gráfico de tendência NDVI (Recharts) | IA, documentos, exports, PWA, carteira avançada |
| **Admin** | Placeholder mínimo (154 linhas) | Todo o painel |

**Tradução:** Fases 1–6 com backend e frontend core funcionando de ponta a ponta contra dados reais.
O restante da documentação é **visão** das Fases 7–13, ainda não codificada.

### Persona-alvo (decisão do produto)
**Consultor / Engenheiro florestal** — profissional que gerencia dezenas/centenas de imóveis de clientes.
Prioriza: mapa e camadas do CAR, NDVI/satélite, laudos PDF, exports GIS (SHP/GeoJSON/KML/GPKG),
workflow de triagem de alertas, e IA que resume, pontua risco e minuta pareceres.

### Princípios de design
1. **Tudo grátis / self-hosted** — nenhuma feature atrás de paywall.
2. **GIS-first** — todo dado geográfico é exportável e abre no QGIS/ArcGIS.
3. **IA de apoio, não de decisão** — DeepSeek V4 Flash resume, pontua e minuta; o RT decide e assina.
4. **Carteira em primeiro lugar** — a tela inicial pensa em N imóveis, não em 1.
5. **Cada fonte é independente** — falha na SEMA não derruba SCCON nem IA.
6. **Reusar o que já existe** — o GeoForest (mesma pasta de servidores) resolve engine WFS, viewer WMS,
   satélite, validação de geometria e RAG jurídico. Portar, não reinventar.

### Fontes de verdade (ler antes de codar)
- **[CAMADAS-SEMA.md](./CAMADAS-SEMA.md)** — catálogo WFS/WMS **verificado ao vivo** (135 camadas WFS,
  53 de satélite), quais monitorar, e **como exibir camadas SEMA no navegador**.
- **[REUSO-GEOFOREST.md](./REUSO-GEOFOREST.md)** — inventário do que trazer do GeoForest, mapeado por fase.
- **[IA-ASSISTENTE.md](./IA-ASSISTENTE.md)** — pilar de IA (DeepSeek V4 Flash).

---

## Resumo das fases

| Fase | Tema | Status | Dias |
|------|------|--------|------|
| 1 | Fundação — monorepo, auth local, backend base | ✅ 15/15 | — |
| 2 | CRUD CARs — WFS SEMA polígono, dashboard | ✅ 12/12 | — |
| 3 | SCCON — alertas de desmate, cron diário | ✅ 10/10 | — |
| **4** | **Fontes expandidas** — SEMA multicamada + camadas do CAR + INPE + vizinho | 22 itens | 3 |
| **5** | **Detalhes do CAR + Mapa + Workflow de alertas** | 26 itens | 3-4 |
| **6** | **Satélite / NDVI / Timelapse** | 20 itens | 3 |
| **7** | **IA robusta (DeepSeek V4 Flash)** | 24 itens | 3-4 |
| **8** | **Gestão de Carteira (consultor)** | ✅ (21/07) | 2-3 |
| **9** | **Relatórios + Exportações + Interoperabilidade GIS** | ✅ backend pronto (21/07) | 3 |
| **10** | **Notificações multicanal + WhatsApp** | 18 itens | 2-3 |
| **11** | **Plataforma / UX / Modo Campo (mobile)** | 20 itens | 2-3 |
| **12** | **Admin avançado + Segurança + Deploy + Backup** | 20 itens | 2 |
| **13** | **Ferramentas GIS de conformidade** (reúso GeoForest) | ✅ backend (21/07) | 3 |

**Total estimado do novo escopo: ~28-33 dias** para a plataforma completa e polida.

> **Aceleradores de reúso:** Fases 4, 5, 6, 7 e 13 aproveitam módulos prontos do GeoForest
> (engine WFS, viewer WMS, satélite, RAG, validação de geometria) — o prazo real cai bastante
> em relação a construir do zero. Ver [REUSO-GEOFOREST.md](./REUSO-GEOFOREST.md).

---

## Fase 1 — Fundação ✅

- [x] Monorepo `app/` + `admin/` + `backend/`, Vite + React 19 + TS + Tailwind
- [x] Express + TS + esbuild
- [x] Auth local: `register` / `login` / `me`, bcrypt 12 rounds, JWT HS256 7d
- [x] Middleware `requireAuth` / `requireAdmin`, `JWT_SECRET` no `.env`
- [x] `AuthContext` + rota protegida + dashboard vazio

## Fase 2 — CRUD de CARs ✅

- [x] `wfs-sema.ts`: `fetchCarPolygon` (typeNames `Geoportal:CAR_ATP`, `CQL_FILTER NUMEROESTADUAL`)
- [x] Nº simplificado → `MTXXXXX/YYYY` (varredura 2015→ano atual), cache 30d, retry 3x
- [x] `POST/GET/GET:id/DELETE /api/cars` + `PATCH :id/refresh`
- [x] Dashboard: cards, stats (CARs/área/alertas), empty state, form add

## Fase 3 — SCCON ✅

- [x] `getPublicToken` (cache 23h), `searchAlertsByCar` (POST `/alerts/search` com `cdCars`)
- [x] Dedup por `source_id`, 8 classes padrão
- [x] Cron `node-cron` 06:00 BRT, `checkAllActiveCars`
- [x] Timeline inline no card + status WhatsApp (placeholder)

---

## Fase 4 — Fontes de dados expandidas 🛰️

Objetivo: transformar o AlertaCAR de "monitor de desmate" em **monitor ambiental completo** do imóvel.

> **Base:** portar o engine WFS do GeoForest (`backend/wfs-intersection.ts`) em vez do BBOX ingênuo atual.
> Ele faz `GetCapabilities` (valida camada) → `DescribeFeatureType` (acha o campo de geometria, que **varia
> por camada**) → `INTERSECTS(<geom>,<WKT>)` com `resultType=hits` → paginação com fallback p/ camadas sem PK
> → `turf.intersect/union` = **ha e % de cada camada dentro do imóvel**. Camadas reais confirmadas ao vivo em
> [CAMADAS-SEMA.md](./CAMADAS-SEMA.md).

### 4.0 Engine WFS (portar do GeoForest) ✅
- [x] Portado `getCapabilitiesCached`, `getGeometryFieldForLayer`, `fetchIntersectingFeatures`/`computeIntersectionHectares` (equivalente a `computeIntersectionForLayer`), helpers de WKT — `backend/src/services/wfs-intersection.ts`
- [ ] Rotas HTTP `GET /api/wfs/health` e `POST /api/map/intersection-hectares` (engine já existe e é usado internamente por `fetchSobreposicoes`; expor como rota pública fica para quando o front precisar testar camadas ad-hoc)
- [x] Concorrência limitada (3), timeout 30 s + retry, `authkey` via env — 16 testes unitários, validado ao vivo

### 4.1 SEMA multicamada (fiscalização) ✅
- [x] `fetchEmbargos(polygon)` — `Geoportal:AREAS_EMBARGADAS_SEMA` (polígono, rico em campos — preferido a `TDAD_FISCALIZACAO_TERMO_DE_EMBARGO`, que tem só 9 registros pontuais)
- [x] `fetchInfracoes(polygon)` — `Geoportal:TDAD_FISCALIZACAO_AUTO_DE_INFRACAO` (ponto, BBOX + point-in-polygon)
- [x] `fetchNotificacoes(polygon)` — `Geoportal:TDAD_FISCALIZACAO_NOTIFICACAO` (ponto)
- [x] `fetchDesembargos(polygon)` — `Geoportal:AREAS_DESEMBARGADAS_SEMA`
- [x] INTERSECTS + clip local com Turf.js (polígonos) / BBOX + `booleanPointInPolygon` (pontos); dedup por `(car_id, source, source_id)` — `backend/src/services/wfs-sema-monitor.ts` + `car-monitor.ts`

### 4.2 Licenciamento e autorizações ✅
- [x] `fetchLicenciamento(polygon)` — `SIMLAMGEO_LP/LI/LO/LOP_ATIVA` (ponto; `SIGA_LAC_ATIVA` ainda não coberto)
- [x] Detectar **vencimento** de licença — `classificarUrgenciaLicenca()`: `vencida` / `critica_30d` / `atencao_60d` / `atencao_90d` / `ok`, persistido em `car_licenses`
- [x] `fetchAutorizacoes(polygon)` — `AUTORIZACAO_DESMATE_SEMA` + `AUTEX_PMFS_SEMA` (`AUTORIZACAO_EXPLORACAO_SEMA` ainda não coberta)
- [x] `alertaTemAutorizacao(alertGeometry, autorizacoes)` — helper pronto para o **cruzamento com alertas** (ver 5.4), ainda não ligado ao fluxo de triagem

### 4.3 Camadas do próprio CAR (ouro para o eng. florestal) ⭐ — parcial
- [x] `fetchAllCarLayers(carNumberWfs)` — `CAR_ARL`, `CAR_APP`, `CAR_APPD`, `CAR_APPRL`, `CAR_AVN`, `CAR_AUAS`, `CAR_AU`, `CAR_NASCENTE`, `SIMCAR_CAR_AREA_CONSOLIDADA` (filtro por atributo `NUMERO_CAR`, não espacial — mais rápido e exato; `CAR_ATP` já coberto por `fetchCarPolygon`)
- [x] Calcular **déficit de Reserva Legal** — `detectBioma()` (interseção com `Geoportal:BIOMAS_MT`) + `calcularConformidade()` (Art. 12, Lei 12.651/2012; MT 100% Amazônia Legal) — validado ao vivo (CAR real: bioma Amazônia, 80% exigido, sem déficit)
- [ ] Calcular **passivo em APP** (uso consolidado sobreposto a APP) — precisa geração de buffer/geometria, fica para a Fase 13 (ProcessarGeo)
- [x] Rastreio do ano de abertura mais recente (`ABERTURA` da AUAS) — indicador de antropização; classificação "pós-2008" ainda não aplicada como alerta específico

### 4.4 Sobreposições fundiárias ✅
- [x] `fetchSobreposicoes(polygon)` — `TERRAS_INDIGENAS`, `UNIDADES_CONSERVACAO`, `ASSENTAMENTOS_INCRA`, `ASSENTAMENTOS_INTERMAT`, `CORREDORES_BIODIVERSIDADE`
- [x] Alerta quando surge **nova** sobreposição (% e nome), com histórico em `car_sobreposicoes`

### 4.5 Novas integrações (INPE) 🆕
- [ ] **PRODES INPE** — desmatamento oficial anual: WFS `terrabrasilis.dpi.inpe.br/geoserver/ows`, camada `prodes-legal-amz:yearly_deforestation` (endpoint já usado pelo GeoForest)
- [ ] **DETER INPE** — alertas quase-real-time (mesmo TerraBrasilis)
- [ ] **BDQueimadas INPE** — focos de calor/queimadas por imóvel (complementa `BURN_SCAR`)
- [ ] **Hidrografia SFB** — `Geoportal:SFB_HIDRO_APP_HIDRICA` / `_TRECHO_DRENAGEM` (confere APP hídrica no mapa)
- [ ] Normalizar tudo no mesmo schema `alerts` (source `inpe_prodes` / `inpe_deter` / `inpe_queimada`)

### 4.6 Inteligência de vizinhança 🆕
- [ ] `fetchDesmateVizinho(polygon, bufferKm)` — desmatamento em imóveis **lindeiros** (risco de avanço/invasão)
- [ ] Mudança cadastral no próprio CAR (retificação, alteração de área) via re-fetch e diff

### 4.7 Cron multicamada ✅
- [x] Estendido `monitor.ts` (`runDailyMonitor`): SCCON + `monitorAllCarsMultilayer()` — cada fonte independente, try/catch por fonte, cada CAR isolado do resto
- [x] Registrado em `cron_logs.sources_json` (contagem agregada SCCON vs SEMA multicamada); granularidade por sub-fonte (embargo/infração/licença/...) fica no retorno de `monitorCarMultilayer`, ainda não persistida individualmente no log do cron

---

## Fase 5 — Detalhes do CAR + Mapa + Workflow de Alertas 🗺️

A página mais rica do app. Rota `/dashboard/cars/:id` com abas:
**Visão Geral · Alertas · Mapa · Satélite · Camadas · IA · Documentos · Config**

### 5.1 Página de Detalhes (shell + Visão Geral) ✅ parcial
- [x] Header: nº CAR/apelido, município, área, último check, ação rápida "Forçar verificação" — `pages/CarDetailPage.tsx`
- [x] Aba **Visão Geral**: cards por severidade (crítico/alto/médio), conformidade de ARL, sobreposições, status das integrações — [ ] score de risco (IA, Fase 7), [ ] gráfico 12 meses, [ ] passivo em APP
- [ ] Lazy-load por aba (code splitting) — abas trocam por estado local, sem `React.lazy` ainda

### 5.2 Mapa interativo (Leaflet) + camadas SEMA no navegador ⭐⭐ ✅ parcial
> Implementado com catálogo **curado estático** (`lib/sema-layers.ts`), não o parser dinâmico de
> `GetCapabilities` do GeoForest — mais simples e já cobre o essencial; portar `parseLayersFromCapabilities`
> fica para quando o catálogo dinâmico completo (135 camadas) for necessário. Ver [CAMADAS-SEMA.md §4](./CAMADAS-SEMA.md).
- [x] Polígono do CAR (emerald, fill 15%) sempre visível — `components/CarMap.tsx`
- [x] Alertas como `CircleMarker` coloridos por severidade — [ ] cluster acima de 50
- [x] **Camadas SEMA ao vivo via `WMSTileLayer`** direto do navegador (sem proxy): embargos, desembargos, autorizações, TI/UC, assentamentos, camadas do CAR (ARL/APP/AVN/AUAS), desmate histórico — catálogo curado de 12 camadas (não as 135 dinamicamente)
- [x] Controle de camadas por categoria (checkboxes) + slider de **opacidade global**; [ ] catálogo dinâmico via `/api/map/capabilities`, [ ] opacidade por overlay individual
- [x] Base layers: OSM + 2 mosaicos de satélite (Sentinel-2 2024, Landsat 5 2011) — [ ] relevo DEM
- [ ] `POST /api/cars/:id/map/snapshot` — ainda não portado (fica para quando o laudo PDF da Fase 9 precisar)
- [x] Popup com dados do alerta (título, data, área, severidade) — [ ] link "ver detalhes"
- [x] Auto-fit do zoom ao polígono do CAR — [ ] mini-mapa overview, [ ] botões "Zoom to alerts"
- [ ] Ferramenta de medição (distância/área) e de desenho

### 5.3 Aba Camadas (novo) ⭐ ✅ parcial
> Fonte: camadas `CAR_*` já buscadas na Fase 4 (área exata por atributo, não por interseção espacial).
- [x] Listar todas as camadas do CAR com área e nº de feições — tabela em `pages/CarDetailPage.tsx`
- [x] Toggle de visibilidade por camada no mapa (via overlay do catálogo curado)
- [x] Quadro de conformidade: ARL exigida vs declarada e déficit (aba Visão Geral) — [ ] passivo em APP, [ ] indicador visual de área antropizada pós-2008 (dado já existe em `extra.maisRecenteAberturaAno`, falta exibir)

### 5.4 Workflow profissional de alertas ⭐⭐ ✅ parcial
- [x] **Ciclo de vida**: `novo → em_analise → validado → falso_positivo → resolvido` — `PATCH /api/alerts/:id`, dropdown em `AlertsPanel.tsx`
- [x] **Severidade calculada**: classe base × área (`lib/severity.ts`, 8 testes) — [ ] ainda não pondera recência nem sobreposição com APP/ARL/áreas restritas
- [ ] **Cruzamento automático com autorizações**: helper `alertaTemAutorizacao()` já existe no backend (Fase 4) mas **não está ligado** à triagem/severidade ainda
- [x] **Notas** por alerta (textarea com autosave) — [ ] anexos/fotos (precisa de infra de upload, ainda não existe)
- [ ] **Atribuir** responsável
- [ ] **Agrupamento** de alertas próximos
- [x] Filtros por fonte e status — [ ] filtro por classe/período/severidade, [ ] saved views
- [ ] Mini-mapa por alerta expandido; [ ] botões copiar coords / baixar GeoJSON individual

### 5.5 Config do CAR ✅ parcial
- [x] Apelido (`PATCH /api/cars/:id`) — [ ] cliente/pasta, tags, cor (Fase 8 — carteira)
- [ ] Preferências de notificação por classe/severidade/canal (Fase 10)
- [ ] Frequência de verificação (diária/semanal/manual)
- [x] Zona de perigo: remover do monitoramento (reusa `DELETE /api/cars/:id` já existente)

---

## Fase 6 — Satélite / NDVI / Timelapse 🛰️🌿 ✅ core pronto (validado ao vivo em 21/07/2026)

> **Verificado ao vivo:** WMS SEMA tem **53 camadas de imagem** — Landsat 5 **1984–2011** (exceto
> 2001/2002), Landsat 7 (2002), Landsat 8 **2013–2018**, Sentinel-2 RGB **2016–2025** (10 anos, não só
> até 2020), SPOT, RESOURCESAT 2012, ALOS PALSAR DEM. Isso dá **~40 anos** de timelapse. Catálogo real
> embutido em `backend/src/services/satellite.ts` (`SATELLITE_CATALOG`).
>
> ⚠️ **Descoberta importante durante a implementação — corrige a Fase 6 original:**
> 1. **WCS está desabilitado** no GeoServer da SEMA (`Service WCS is disabled`) — não dá pra baixar banda
>    bruta em GeoTIFF como o plano original presumia.
> 2. O suposto "layer NIR" (`Mosaicos:Geoportal_Sentinel_2_<ano>_NIR`) **não é um layer separado — é um
>    STYLE** do layer RGB normal, e esse style **retorna a MESMA imagem** do estilo padrão (confirmado
>    comparando hash MD5 do PNG com/sem `STYLES=..._NIR` — idênticos). Ou seja, **não existe falsa-cor NIR
>    de verdade nesse servidor**, ao contrário do que a Fase 6 original assumia.
> 3. **Alternativa real que funciona**: `GetFeatureInfo` no layer Sentinel-2 RGB devolve as **4 bandas
>    brutas por pixel** (ex.: `MOSAICO_SENTINEL2_2016_0..3`). Testado ao vivo: pixel de floresta densa →
>    banda 3 (2338) muito acima das demais (938–989) = NIR; pixel urbano → bandas quase iguais (1393–1521).
>    Isso permite **NDVI real por amostragem de pixel** (banda 3 = NIR, banda 2 = RED), só que é um índice
>    relativo/não-calibrado (o mosaico já vem processado 8/16-bit pela SEMA) — bom para comparar o MESMO
>    imóvel ano a ano, não pra comparar com NDVI de outra fonte.
> 4. A nomenclatura das propriedades do `GetFeatureInfo` **muda de ano pra ano**
>    (`MOSAICO_SENTINEL2_2016_N` vs `MOSAICO_SENTINEL_2_2024_N`) — o parser casa pelo **sufixo numérico**
>    (`_0`.._3`), não pelo prefixo, pra não quebrar com essa inconsistência do servidor.
>
> Isso também muda a arquitetura: como o navegador já renderiza WMS ao vivo (Leaflet `WMSTileLayer`,
> igual à Fase 5), **não existe endpoint de "frame" no sentido de imagem-servida-pelo-backend para o
> timelapse/comparação** — o front pede a camada direto da SEMA, como a aba Mapa já faz. O backend só
> entra onde é insubstituível: **cálculo de NDVI** (precisa de valor de pixel, que só sai por
> `GetFeatureInfo`, não por um tile já renderizado).

### 6.1 Backend satélite
- [x] `GET /api/cars/:id/satellite/capabilities` — catálogo real de satélites/anos + bbox do imóvel
- [x] `GET .../satellite/frame?sat=&year=` — monta a URL do WMS `GetMap` recortado no bbox (formato simplificado: sempre PNG; sem GeoTIFF)
- [x] `GET .../satellite/ndvi?year=&force=` — amostra NDVI real via grade de pontos + `GetFeatureInfo` dentro do polígono do CAR (cache em `car_ndvi`, `force=true` ignora cache)
- [x] `GET .../satellite/ndvi-trend?years=` — tendência multi-ano (default: 2016/2019/2021/2023/2025) + classificação (recuperando/estável/perdendo vegetação)
- [ ] `GET .../satellite/timelapse` (GIF/MP4 animado) — **não implementado**: o timelapse "ao vivo" no front (slider + play trocando de camada WMS) cobre o mesmo caso de uso sem precisar gerar/armazenar vídeo no servidor
- [ ] `GET .../satellite/compare` como endpoint dedicado — **não necessário**: o split-view é 100% front-end (duas `WMSTileLayer` lado a lado), não precisa de rota própria
- [ ] `GET .../satellite/analysis` (diff de NDVI com parecer da IA) — adiado pra Fase 7 (depende da fundação de IA)

### 6.2 Frontend satélite (aba `🛰️ Satélite` na página do CAR)
- [x] **Timelapse por slider**: seleciona satélite (Landsat 5/7/8, Sentinel-2, RESOURCESAT, SPOT), slider de índice de ano (lida com anos não-contínuos, ex. Landsat 5 pula 2001/2002), ▶️ play trocando de ano a cada ~900ms, polígono do CAR sobreposto
- [x] **Comparação split-view**: dois mapas lado a lado (mesmo satélite, anos diferentes) — sem sincronização de zoom/pan entre os dois (cada mapa é independente; sincronizar arrasto ficou fora do escopo desta rodada)
- [x] **NDVI real**: gráfico de tendência (Recharts) com NDVI médio por ano, linha de referência do limiar de vegetação, badge de classificação (recuperando/estável/perdendo vegetação) + disclaimer de metodologia (pontos amostrados, não é NDVI calibrado)
- [ ] **Falsa-cor NIR** — **não implementável** neste servidor (ver descoberta acima: o style não existe de fato)
- [ ] **Overlay multi-camada** dentro da aba satélite (embargos/TI/UC sobre o timelapse) — a aba Mapa (Fase 5) já cobre isso; não duplicado aqui
- [ ] Downloads (PNG/GeoTIFF/GIF/CSV) — não implementado nesta rodada

### 6.3 Página de Análise Temporal dedicada (`/dashboard/timelapse/:id`)
- [ ] Não implementada como página própria — o timelapse e a tendência de NDVI vivem dentro da aba Satélite da página do CAR (mais simples de navegar, sem rota nova)
- [ ] Linha do tempo de eventos cruzada com satélite / laudo PDF — depende da Fase 9 (relatórios)

**Testes**: 18 testes novos (`satellite.test.ts`) cobrindo catálogo, bbox com margem, parsing de bandas
(incluindo a inconsistência de nomenclatura por ano), cálculo de NDVI (floresta vs. urbano), grade de
amostragem e classificação de tendência — **74 testes no total** no backend, todos passando.

**Validado ao vivo** (CAR real MT8019/2017, 1160 ha, bioma Amazônia): NDVI médio 2024 = 0,74 (88,9% dos
pontos amostrados acima do limiar de vegetação — consistente com imóvel majoritariamente florestado);
tendência 2016→2025 com 27/27 pontos amostrados com sucesso em cada ano, classificada "estável"
(+0,046); cache confirmado (1ª chamada ~5,4s, repetição ~0,05s); `force=true` recalcula ignorando cache.

---

## Fase 7 — IA robusta (DeepSeek) 🤖

> Modelo configurável via `DEEPSEEK_MODEL` (padrão atual: **`deepseek-chat`**) em `api.deepseek.com/v1` (`DEEPSEEK_API_KEY`).
> Detalhes de arquitetura, prompts e endpoints em **[IA-ASSISTENTE.md](./IA-ASSISTENTE.md)**.

### 7.1 Fundação de IA
- [x] `services/ai.ts` — cliente DeepSeek (base URL, chave, timeout, retry e streaming SSE)
- [x] `services/ai-context.ts` — **context builder**: monta contexto do CAR (dados cadastrais + camadas + alertas + sobreposições + autorizações + NDVI) em JSON compacto, sem PII do cliente
- [x] **RAG jurídico-ambiental**: 39 documentos do GeoForest portados em `backend/knowledge/`; seletor local carrega só trechos relevantes por pergunta, com teto de contexto configurável
- [x] Guardrails + disclaimer obrigatório ("análise preliminar, consulte o RT")
- [x] Cache de respostas SQLite + rate limiting por usuário (60 chamadas/h por processo)

### 7.2 Assistente conversacional
- [x] `POST /api/ai/chat` — chat por CAR ("o que aconteceu esse mês?", "esse alerta é grave?", "tem autorização?")
- [x] Chat de **carteira** ("quais imóveis têm mais risco?", "resuma a semana de todos os clientes")
- [x] Threads persistentes (`ai_threads` / `ai_messages`) e streaming SSE no front

### 7.3 Inteligência sobre os dados
- [x] `GET /api/cars/:id/risk-score` — **score 0–100** determinístico + explicação (histórico, tendência NDVI, sobreposições e conformidade disponíveis)
- [x] `POST /api/cars/:id/ai/summary` — resumo em linguagem natural dos alertas do período
- [x] `POST /api/cars/:id/ai/ndvi-analysis` — interpreta a tendência NDVI amostrada (diff espacial por polígonos ainda depende de uma fonte de mudança)
- [x] `POST /api/ai/triage` — sugere se um alerta é **verdadeiro / falso positivo / provável legal**
- [x] `POST /api/cars/:id/ai/recomendacoes` — próximos passos conforme o achado

### 7.4 Gerador de laudo/parecer ⭐⭐
- [x] `POST /api/cars/:id/ai/laudo` — minuta de laudo técnico em Markdown, salva como rascunho
- [ ] Editor no front com blocos (introdução, análise, conclusão, recomendações) + inserir mapas/NDVI — editor Markdown com salvar rascunho já entregue; blocos e mídias pendentes
- [ ] Exporta para o PDF da Fase 9

### 7.5 UX de IA no app
- [x] Aba **IA** na página do CAR (chat + score + botões de resumo, próximos passos e minuta de laudo)
- [x] Widget "Pergunte sobre sua carteira" no dashboard
- [x] Badge de score de risco nos cards da carteira (cálculo determinístico em lote; tabela da Fase 8 ainda pendente)
- [x] Botão **Triagem IA** em cada alerta (sugestão e justificativa; a IA não altera o status)

---

## Fase 8 — Gestão de Carteira (consultor) 📂 ✅ (21/07/2026)

O consultor não tem 1 imóvel: tem uma **carteira**. Toda a navegação assume isso.

### 8.1 Organização ✅
- [x] **Clientes/Pastas**: agrupar CARs por cliente final (proprietário)
- [x] **Tags** e **cores** por imóvel; filtro e busca por cliente/tag/município
- [x] Renomear/apelidar imóvel

### 8.2 Importação em massa 🆕 ✅ parcial
- [x] Colar lista de nº de CAR (um por linha, máx. 50) → cria vários — `POST /api/cars/bulk-import`
- [x] Upload **CSV** (texto colado: nº CAR, apelido, cliente, tags separadas por `;`) — cria cliente/tags
  automaticamente se não existirem — `POST /api/cars/bulk-import-csv`
- [x] **Relatório de importação** (quais acharam polígono, quais falharam e por quê) — retornado na
  resposta e exibido na UI (`▸ Importação em massa` no topo de `/dashboard/carteira`)
- [ ] Upload **Shapefile (.zip) / KML / GeoJSON** com múltiplos polígonos → cria CARs por geometria —
  **não implementado nesta rodada**: exigiria um parser de shapefile binário reverso (o repo só tem o
  *writer*, portado na Fase 9.2) e ficaria desproporcional ao valor imediato; por ora a importação em
  massa sempre resolve o polígono via WFS pelo número do CAR (mesmo caminho do cadastro manual)
- [ ] Barra de progresso granular — a importação é síncrona (até 50 itens por vez); a UI mostra
  spinner + relatório final, não progresso item-a-item em tempo real (evitou a complexidade de
  job assíncrono + SSE para um lote desse tamanho)

### 8.3 Visão consolidada ✅
Nova página `/dashboard/carteira` (link "📂 Carteira" no dashboard), 3 abas:
- [x] **Tabela da carteira**: colunas ordenáveis (imóvel, cliente, município, área, alertas, score,
  último check), busca, checkboxes de seleção — `pages/PortfolioPage.tsx`
- [x] **Mapa geral da carteira**: todos os polígonos coloridos por banda de risco (Leaflet), clique → detalhe
- [x] **Ranking de risco**: já existia no dashboard (cards de prioridade)
- [x] **Dashboard analítico** (aba própria): total ha monitorados, imóveis, alertas por classe e por
  município (BarChart), tendência mensal de 12 meses (LineChart) — `GET /api/portfolio/analytics`
- [x] **Ações em massa**: verificar selecionados (SCCON+SEMA em paralelo), exportar selecionados/todos
  (dropdown de formato, reusa o engine da Fase 9.2), gerar relatório da carteira em PDF — validado
  interativamente (Playwright + Chrome real: seleção, botões reativos, refresh pós-ação, gráficos
  populados com dados reais)
- [ ] Paginação — carteiras de consultor cabem inteiras na tela por ora (dezenas de imóveis); pode virar
  necessário se a base de usuários crescer para centenas de CARs por conta

---

## Fase 9 — Relatórios + Exportações + Interoperabilidade GIS 📄📥 ✅ backend pronto (21/07/2026)

> **Desvio do plano original:** a Fase 9.1 previa "template HTML → Puppeteer/Playwright → PDF".
> Implementado com **PDFKit** (mesma lib do laudo/relatório de importação do GeoForest) em vez
> disso — gera o PDF por desenho vetorial direto (sem headless Chromium, sem HTML intermediário),
> mais leve pra rodar no servidor e sem dependência de binário externo. O esboço do perímetro do
> imóvel na capa do laudo também é vetorial (polígono real normalizado à página + pontos de
> alerta coloridos por severidade) — não é um mapa georreferenciado com tiles; o mapa interativo
> completo continua sendo a aba **Mapa** (Fase 5.2).

### 9.1 Laudos e relatórios PDF ✅
- [x] **Laudo técnico por imóvel**: capa, dados cadastrais, conformidade de ARL, esboço vetorial do
  perímetro + alertas, camadas do CAR, licenciamento, sobreposições, score de risco, timeline de
  alertas, análise/recomendações da IA (Markdown → PDF), disclaimer e espaço para assinatura do RT
  — `services/pdf-report.ts` (`buildLaudoPdf`), `GET /api/cars/:id/report/laudo.pdf`
- [x] **Relatório de carteira consolidado** (todos os imóveis do usuário, com filtro opcional por
  `clientId`/`tagId`): resumo + ranking de risco — `buildPortfolioReportPdf`, `GET /api/portfolio/report.pdf`
- [x] **Relatório histórico** (NDVI por ano do cache `car_ndvi` + alertas agrupados por ano) —
  `buildHistoricoPdf`, `GET /api/cars/:id/report/historico.pdf`
- [x] **Templates com marca própria**: logo (base64) e rodapé por usuário — `PATCH/GET /api/users/me/branding`
- [x] **Link temporário de compartilhamento** (24–72h, token aleatório, sem auth) —
  `POST /api/cars/:id/report/laudo/share`, `GET /api/public/reports/:token`
- [x] **Agendamento** (semanal/mensal, por carteira ou por imóvel) — `POST/GET/DELETE /api/report-schedules`,
  cron diário `cron/reports.ts` gera o link de compartilhamento automaticamente quando o agendamento
  vence — [ ] **entrega automática por Email/WhatsApp fica pendente da Fase 10** (por ora o link fica
  disponível em `GET /api/report-schedules/files` pro usuário baixar)
- [ ] Editor de blocos (introdução/análise/conclusão com mapas embutidos) no front — o laudo Markdown
  da Fase 7.4 já é renderizado automaticamente na seção "Análise e recomendações (IA)" do PDF, mas
  não há tela dedicada de edição de blocos
- [ ] Botões/telas no app para disparar os downloads acima (ficou só a API por ora)

### 9.2 Exportações GIS ⭐ ✅
> Portado `GeoForest/backend/shapefile-writer.ts` sem alterações de lógica (`backend/src/services/shapefile-writer.ts`).
- [x] Polígono do CAR e alertas em **SHP (.zip), GeoJSON, KML, KMZ, CSV, GPKG** — `services/gis-export.ts`
  (GPKG escrito à mão sobre `better-sqlite3.serialize()` + WKB, sem lib externa; todos os formatos
  validados com `ogrinfo`/GDAL real, não só round-trip próprio)
- [x] Exportar **todas as camadas do CAR** (ATP/ARL/APP/…) num pacote — `target=layers|all` (zip
  multi-arquivo p/ SHP/GeoJSON/CSV, multi-tabela/multi-folder p/ GPKG/KML)
- [x] `GET /api/cars/:id/export?format=&target=` e `GET /api/cars/:id/alerts/export?format=`
- [x] Exportação em massa da carteira — `GET /api/portfolio/export?format=&carIds=` (todos ou
  selecionados), botão na aba Tabela da carteira (Fase 8.3)

### 9.3 Interoperabilidade ✅
- [x] **API Key** por usuário (`alertacar_live_…`, hash SHA-256, `Bearer <key>` ou header `X-Api-Key`,
  até 10 por usuário) — `services/api-keys.ts`, `POST/GET/DELETE /api/interop/api-keys`
- [x] Endpoint **GeoJSON ao vivo** dos polígonos e alertas p/ abrir no QGIS/ArcGIS via "Add Vector
  Layer from URL" — `GET /api/gis/cars.geojson`, `GET /api/gis/alerts.geojson` (WFS/WMS *padrão OGC*
  completo com `GetCapabilities` XML não foi implementado — GeoJSON direto cobre o caso de uso real
  de "abrir no QGIS" com bem menos esforço)
- [x] **Webhooks** — HMAC-SHA256 (`X-AlertaCAR-Signature: sha256=…`), dispara `alert.created` nos
  3 pontos onde alertas novos são salvos (SCCON, SEMA multicamada, sobreposições fundiárias), fire-and-forget
  — `services/webhooks.ts`, `POST/GET/PATCH/DELETE /api/interop/webhooks`

---

## Fase 10 — Notificações multicanal + WhatsApp 🔔

### 10.1 WhatsApp (Baileys)
- [ ] Sessão persistente em SQLite, QR no admin, reconexão automática
- [ ] `sendAlert(to, car, alerts)` com template customizável
- [ ] Rate limiting (1 msg/CAR/h, 10/user/dia), agrupamento, fila com retry 3x

### 10.2 Canais adicionais 🆕
- [ ] **Email** (SMTP/self-hosted) — fallback e digests HTML
- [ ] **Telegram** (bot) — alertas e comandos
- [ ] **Push no browser** (Service Worker / PWA)

### 10.3 Preferências e destinatários
- [ ] Config fina: por CAR, por classe, por severidade, horário silencioso
- [ ] **Resumo diário/semanal** (imediato vs digest) — o consultor recebe consolidado da carteira
- [ ] **Destinatários extras**: adicionar WhatsApp/email do cliente final para receber cópia
- [ ] Log de envios e status (enviado/pendente/falhou) por canal

---

## Fase 11 — Plataforma / UX / Modo Campo 📱

### 11.1 PWA e mobile
- [ ] **PWA instalável** + offline básico (cache da carteira e último estado)
- [ ] **Modo Campo** 🆕: GPS "estou aqui" no mapa, **foto geolocalizada** anexada ao CAR/alerta
- [ ] Responsivo mobile-first; sidebar → bottom nav

### 11.2 Produtividade
- [ ] **Busca global (Cmd/Ctrl+K)**: achar CAR, cliente, alerta, município
- [ ] Atalhos de teclado; navegação por tabs
- [ ] Onboarding guiado (3 passos) no primeiro acesso
- [ ] Perfil (`/dashboard/profile`): dados, WhatsApp, preferências globais, API key, estatísticas

### 11.3 Polimento
- [ ] Dark/light toggle; glassmorphism consistente
- [ ] Skeleton loaders, toasts (Sonner), empty/error states
- [ ] Animações (fadeIn, pulse em crítico), acessibilidade
- [ ] **Página de status das fontes** (SCCON/SEMA/INPE online?) + histórico de verificações por CAR
- [ ] i18n (PT-BR default; EN/ES futuros)

---

## Fase 12 — Admin avançado + Segurança + Deploy + Backup 🛠️

### 12.1 Painel Admin
- [ ] Páginas: Usuários, CARs, Alertas, Relatórios, Métricas do servidor
- [ ] WhatsApp Connect (QR), status, reconexão
- [ ] Gráficos (Recharts): alertas/dia, distribuição por classe, crescimento de usuários/CARs
- [ ] Config do cron (horário), templates de notificação, manutenção (limpar alertas antigos)

### 12.2 Segurança
- [ ] `express-rate-limit` nas rotas públicas, validação com **Zod**, **Helmet**
- [ ] Log de auditoria (quem fez o quê, quando)
- [ ] Nunca commitar segredos; `JWT_SECRET` via `openssl rand -hex 64`

### 12.3 Deploy
- [ ] `alertacar-backend.service` (systemd user, Restart=always, porta 3002)
- [ ] Cloudflare Tunnel: `alertacar` / `alertacar-admin` / `alertacar-api` `.cursar.space`
- [ ] Script build (app+admin+backend) → restart → smoke test
- [ ] **Backup diário** do banco (`.db`) fora do repo

---

## Fase 13 — Ferramentas GIS de conformidade 🧰 (reúso GeoForest) ✅ backend pronto (21/07/2026)

O consultor não quer só ser avisado — quer **validar e processar** o CAR. O GeoForest já é, na prática, um
validador SIMCAR/SEMA. Trazer como aba **"Ferramentas"** transforma o AlertaCAR de monitor em plataforma de
trabalho. Ver [REUSO-GEOFOREST.md §6](./REUSO-GEOFOREST.md).

> **Desvio do plano original:** o texto original previa "cada ferramenta segue o padrão job assíncrono +
> SSE" do GeoForest (upload → processa → progresso → ZIP), com armazenamento de arquivo do usuário
> (`local-storage.ts`) e fila de job (`processing-jobs.ts`). Como o caso de uso do AlertaCAR é validar um
> shapefile que o consultor sobe manualmente (não o pipeline de importação em massa do GeoForest), os 4
> endpoints (`/api/tools/validate-geometry`, `/vertices-proximas`, `/containment`, `/processar-geo`) foram
> implementados **síncronos** (upload multipart → JSON de resposta direto), sem essa infraestrutura.
>
> ⚠️ **Descoberta importante durante a implementação:** testando com Projetos Geográficos REAIS (fixtures
> do GeoForest — CAR Santa Clara, ~28 camadas), `detectGaps`/`detectOverlaps`/`detectSimcarContainment`
> (comparação par-a-par de feições/vértices, sem índice espacial) **travaram o processo por 5+ minutos**
> numa única camada densa (ex.: 88 feições / 9.899 vértices levaram 35s só no `detectGaps`; o Projeto
> inteiro, com ARL/AVN de 242 feições cada, nunca terminou). Como o Node é single-thread, isso travaria a
> API **inteira para todos os usuários** durante o processamento — inaceitável num endpoint síncrono.
> Mitigação aplicada (`backend/src/routes/tools.ts`): limites de complexidade calibrados empiricamente
> (por camada: 50 feições / 3.000 vértices; total do projeto: 300 feições / 15.000 vértices) — acima
> disso, os checks par-a-par são **pulados com aviso explícito** (nunca silenciosamente "aprovados"), mas
> os checks O(vértices) por feição (auto-interseção, vértices duplicados) continuam rodando sempre. O
> `processar-geo` reforça isso no gate: se qualquer check foi pulado por complexidade, o gate recusa
> processar (não pode garantir conformidade sem ter rodado tudo). Validado ao vivo: fixture real de 815
> feições/86mil vértices que antes travava indefinidamente agora responde em ~9,7s com os avisos corretos;
> fixture pequeno (3 erros esperados) responde em 16ms sem falso-positivo de aviso. **Isso é uma limitação
> de escala conhecida, não um bug oculto** — Projetos Geográficos muito densos precisam de processamento
> assíncrono de verdade (worker/fila), que fica para uma iteração futura caso vire gargalo real de uso.

### 13.1 Validação de geometria (importador SEMA) ✅
- [x] Portado `geometry-errors.ts` + `simcar-rules.ts` (verbatim, cortado por linha exata — não
  retranscrito à mão): borda se cruza, pontos repetidos, contenção/sobreposição do Anexo 01, soma AIR×ATP
- [x] Tolerâncias preservadas exatamente do original (`SIMCAR_IMPORT_DUP_TOLERANCE_M = 0.1`,
  `SIMCAR_IMPORT_COLLAPSE_WIDTH_M = 0.02` etc. — verificado igual ao GeoForest)
- [x] `POST /api/tools/validate-geometry` (upload .zip) — relatório JSON de erros/camadas/avisos, com
  export opcional (`?format=shp|csv|geojson|kml|kmz|gpkg`) dos pontos problemáticos via `gis-export.ts`

### 13.2 Vértices próximas ✅
- [x] Portado `vertices-proximas.ts`: pares de vértices coincidentes por camada/feição/parte/anel
- [x] `POST /api/tools/vertices-proximas` — mesmo padrão de export opcional

### 13.3 Áreas não contidas (containment) ✅
- [x] Portado `containment-analysis.ts`: `alvo − união(continentes)` (erro "deve ser contido por AVN/AUAS/AC")
- [x] `POST /api/tools/containment` — alvo/continentes por nome de camada no body, área mínima configurável

### 13.4 ProcessarGeo (buffers do Código Florestal) ✅
- [x] Portado `simcar-processar-geo.ts` → `processar-geo.ts`: gera APP/APPD/APPRL/AURD/ARLDR por buffers
  hídricos e de relevo
- [x] `POST /api/tools/processar-geo` com **gate de importação** real (só processa se 13.1 passar E não
  tiver pulado nenhum check por complexidade)

### 13.5 Recorte de camadas do CAR — não portado (decisão consciente)
- [ ] `simcar-clip.ts` (10.536 linhas, majoritariamente infra de upload+SSE+Gemini+Excel pra clipar
  camadas WFS da SEMA contra um polígono enviado) **não foi portado** — o AlertaCAR já cobre o mesmo caso
  de uso via `fetchAllCarLayers`/`fetchCarLayerFeatures` (Fase 4, `wfs-car-layers.ts`) + o export de
  camadas (Fase 9.2, `target=layers` em `/api/cars/:id/export`)

### 13.6 UX — pendente (frontend)
- [ ] Aba **Ferramentas** no app; drag-and-drop de ZIP (shp/dbf/prj) — endpoints prontos, falta a tela
- [ ] Vincular o resultado a um CAR da carteira (anexa laudo/erros ao imóvel)

---

## Catálogo de funcionalidades do cliente (índice cruzado)

Referência rápida do que o **usuário cliente** ganha, agrupado por valor:

**Ver e entender o imóvel**
- Mapa com todas as camadas do CAR (ATP/ARL/APP/AUAS/nascentes) · Satélite multi-ano · NDVI + tendência · Timelapse · Comparador antes/depois · Análise temporal de desmate · Déficit de Reserva Legal / passivo em APP.

**Ser avisado do que importa**
- Alertas SCCON + DETER/PRODES + queimadas INPE · Embargos, autos, notificações, licenças (com vencimento) · Sobreposição com TI/UC/assentamentos · Desmate em imóvel vizinho · Mudança cadastral · Notificação por WhatsApp/Email/Telegram/Push com preferências finas e digests.

**Trabalhar os alertas (consultor)**
- Triagem (verdadeiro/falso positivo/legal) · Severidade automática · Cruzamento com autorizações · Notas, anexos e fotos de campo · Atribuição · Filtros e saved views.

**Decidir com IA (DeepSeek Flash)**
- Chat sobre o CAR e a carteira · Resumos automáticos · Score de risco explicável · Interpretação de NDVI · Recomendações de ação e implicações legais · Minuta de laudo/parecer.

**Ver camadas SEMA no navegador**
- Qualquer das 135 camadas WFS/WMS como overlay ao vivo no mapa (embargos, autos, licenças, autorizações, TI/UC, hidrografia, desmate histórico) · controle de camadas dinâmico · opacidade · snapshot PNG para laudo.

**Validar e processar (GIS — reúso GeoForest)**
- Validação de geometria (borda se cruza, pontos repetidos, Anexo 01) · vértices próximas · áreas não contidas · ProcessarGeo (APP/APPD/ARL por buffers) · recorte de todas as camadas do CAR.

**Gerar entregáveis**
- Laudo técnico PDF (com marca do consultor) · Relatório de carteira · Relatório histórico · Exports SHP/GeoJSON/KML/GPKG/CSV · API Key + WMS/WFS + Webhooks · Link de compartilhamento.

**Gerir escala**
- Carteira com pastas/tags/clientes · Importação em massa (lista/CSV/shapefile) · Tabela e mapa consolidados · Ranking de risco · Dashboard analítico · Ações em massa.

**Usar em qualquer lugar**
- PWA instalável · Modo campo (GPS + foto geolocalizada) · Busca global · Dark/light · Onboarding.

---

## Backlog / Futuro (pós-plano)

- Múltiplos usuários por imóvel com papéis (dono/editor/leitor) e convites
- Detecção de mudança por ML próprio (além do diff NDVI)
- Integração com calendário (prazos de licença/embargo)
- Créditos de carbono (integração CarbonLink) e camada de elegibilidade
- 2FA para admin (TOTP)
- Migração SQLite → PostgreSQL se a escala exigir
- EN/ES (i18n completo)

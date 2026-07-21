# Plano — AlertaCAR

> **Norte do produto:** o "vigia ambiental" definitivo para **consultores e engenheiros florestais** que
> monitoram carteiras inteiras de imóveis rurais. Técnico, GIS-first, com IA de apoio à decisão.
> Tudo **grátis / self-hosted** — sem planos pagos, sem gating, sem SaaS externo.

---

## 0. Estado real (auditado em 21/07/2026, atualizado após início da Fase 4)

O que está **de fato implementado em código** (não só documentado):

| Camada | Implementado | Ainda não existe |
|--------|--------------|------------------|
| **Backend** | Auth local (bcrypt+JWT), CRUD de CARs, `fetchCarPolygon` (WFS `CAR_ATP`), serviço SCCON, cron diário 06:00 (SCCON + Fase 4), `/api/admin/stats`. **Fase 4**: motor WFS genérico de interseção, camadas do CAR (ARL/APP/APPD/APPRL/AVN/AUAS/AU/NASCENTE/AREA_CONSOLIDADA) com conformidade de Reserva Legal, embargos/desembargos/infrações/notificações/autorizações/licenciamento (com urgência de vencimento)/sobreposições fundiárias — tudo testado (61 testes) e validado ao vivo contra o WFS real | Downloads, satélite/NDVI, WhatsApp/Baileys, fila de notificação, IA |
| **App cliente** | Login, Cadastro, Dashboard (lista de CARs, 3 stats, add/remove, "Verificar SCCON", timeline expansível) — arquivo único `App.tsx`. Backend da Fase 4 pronto mas **ainda sem UI** que o consuma | Página de Detalhes, mapa Leaflet, satélite, workflow de alertas, carteira, IA, perfil, exports, PWA |
| **Admin** | Placeholder mínimo (154 linhas) | Todo o painel |

**Tradução:** Fases 1–3 concluídas; Fase 4 (backend) concluída e validada ao vivo em 21/07/2026 — falta
só a UI que exiba os novos dados. O restante da documentação era **visão**, não código.
Este plano reorganiza e **amplia muito** essa visão, com foco no consultor e em IA robusta.

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
| **8** | **Gestão de Carteira (consultor)** | 18 itens | 2-3 |
| **9** | **Relatórios + Exportações + Interoperabilidade GIS** | 22 itens | 3 |
| **10** | **Notificações multicanal + WhatsApp** | 18 itens | 2-3 |
| **11** | **Plataforma / UX / Modo Campo (mobile)** | 20 itens | 2-3 |
| **12** | **Admin avançado + Segurança + Deploy + Backup** | 20 itens | 2 |
| **13** | **Ferramentas GIS de conformidade** (reúso GeoForest) | 18 itens | 3 |

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

### 5.1 Página de Detalhes (shell + Visão Geral)
- [ ] Header: nº CAR, município, área, status, último check, ações rápidas
- [ ] Aba **Visão Geral**: score de risco (IA), cards por classe, gráfico 12 meses, status das integrações, déficit ARL/APP
- [ ] Lazy-load por aba (code splitting)

### 5.2 Mapa interativo (Leaflet) + camadas SEMA no navegador ⭐⭐
> Reusar o viewer WMS do GeoForest: `/api/map/capabilities` (catálogo de camadas classificado) +
> `parseLayersFromCapabilities`. Ver [CAMADAS-SEMA.md §4](./CAMADAS-SEMA.md).
- [ ] Polígono do CAR (emerald, fill 15%) sempre visível
- [ ] Alertas como `CircleMarker` coloridos por classe; cluster acima de 50
- [ ] **Camadas SEMA ao vivo via `WMSTileLayer`** (GetMap direto no WMS SEMA c/ `authkey`): embargos, autos, licenças, autorizações, TI/UC/assentamentos, desmate histórico, hidrografia — **qualquer uma das 135 camadas WFS/WMS**
- [ ] **Controle de camadas dinâmico** populado por `/api/map/capabilities`; slider de **opacidade** por overlay
- [ ] Base layers: satélite (mosaicos SEMA) / OSM / relevo (`SEMAMT:ALOS_PALSAR_DEM`)
- [ ] `POST /api/cars/:id/map/snapshot` — GetMap (base + até 8 overlays + bbox) → PNG p/ laudo/IA/thumbnail (portar `/api/map/snapshot`)
- [ ] Popup com dados do alerta + link "ver detalhes"
- [ ] Mini-mapa overview, botões "Zoom to CAR" / "Zoom to alerts"
- [ ] Ferramenta de medição (distância/área) e de desenho (marcar ponto de interesse)

### 5.3 Aba Camadas (novo) ⭐
> Fonte: 44 camadas `CAR_*`/`SIMCAR_*` no WFS (ver [CAMADAS-SEMA.md §2](./CAMADAS-SEMA.md)); área exata por
> interseção (Fase 4.0). Recorte completo pode reusar `GeoForest/backend/simcar-clip.ts` (TEMPLATE_LAYERS).
- [ ] Listar todas as camadas do CAR (ATP/ARL/APP/APPD/APPRL/AUAS/AVN/AU/nascentes/consolidada) com área de cada
- [ ] Toggle de visibilidade por camada no mapa (WMS overlay)
- [ ] Quadro de conformidade: ARL exigida vs declarada, passivo em APP, área antropizada (`ABERTURA` da AUAS)

### 5.4 Workflow profissional de alertas ⭐⭐
- [ ] **Ciclo de vida**: `novo → em análise → validado → falso positivo → resolvido` (o consultor triagem)
- [ ] **Severidade calculada**: classe × área × recência × sobreposição com APP/ARL/áreas restritas
- [ ] **Cruzamento automático com autorizações**: alerta dentro de AUTEX/autorização → marca "provável legal"
- [ ] **Notas e anexos** por alerta (parecer, fotos de campo, PDFs)
- [ ] **Atribuir** alerta a um responsável (nome livre no modo uso-próprio)
- [ ] **Agrupamento** de alertas próximos no tempo/espaço
- [ ] Filtros avançados (classe, período, severidade, status, fonte) + **saved views**
- [ ] Cada alerta expansível com mini-mapa; botões copiar coords / baixar GeoJSON

### 5.5 Config do CAR
- [ ] Apelido, cliente/pasta, tags, cor
- [ ] Preferências de notificação por classe/severidade/canal
- [ ] Frequência de verificação (diária/semanal/manual)
- [ ] Zona de perigo: remover do monitoramento

---

## Fase 6 — Satélite / NDVI / Timelapse 🛰️🌿

> **Verificado ao vivo:** WMS SEMA tem **53 camadas de imagem** — Landsat 5 desde **1984**, Sentinel-2
> RGB 2016–2025, Sentinel-2 **NIR** 2016–2020 (NDVI), SPOT, RESOURCESAT 2012, ALOS PALSAR DEM. Isso dá
> **~40 anos** de timelapse (não só 2016+). Detalhes em [CAMADAS-SEMA.md §3](./CAMADAS-SEMA.md).
>
> **Alta resolução extra:** consumir também o acervo próprio do GeoForest — **CBERS-4A/WPM 2 m** e Landsat
> publicados em `https://wms.cursar.space/geoserver/cbers/wms` (mesmo protocolo WMS). Ver [REUSO-GEOFOREST.md §3](./REUSO-GEOFOREST.md).

### 6.1 Backend satélite
- [ ] `GET /api/cars/:id/satellite/capabilities` — satélites e anos disponíveis
- [ ] `GET .../satellite/frame?sat=&year=&format=png|geotiff` — frame único (WMS `GetMap` recortado no bbox do CAR)
- [ ] `GET .../satellite/timelapse?sat=&from=&to=` — GIF/MP4 animado
- [ ] `GET .../satellite/compare?sat1=&year1=&sat2=&year2=` — split-view
- [ ] `GET .../satellite/ndvi?year=` — mapa NDVI + estatística por polígono
- [ ] `GET .../satellite/analysis?from=&to=` — diff de NDVI (delega score/parecer à IA — Fase 7)

### 6.2 Frontend satélite (aba)
- [ ] **Timelapse profundo (1984→2025)**: slider de anos, play 1-5 fps, miniaturas por ano, polígono sobreposto; alternar entre Landsat 5, Sentinel-2 e **CBERS-4A 2 m** (acervo GeoForest)
- [ ] **Comparação split-view**: satélites/anos diferentes por lado, slider arrastável, zoom sincronizado
- [ ] **NDVI**: usa `Mosaicos:Geoportal_Sentinel_2_<ano>_NIR` → NDVI=(NIR−RED)/(NIR+RED); falsa-cor + gráfico de tendência + estatísticas (médio 2016 vs atual, % de perda)
- [ ] **Overlay multi-camada**: base + polígono + alertas + embargos + TI/UC + desmate histórico SEMA (2012–2018)
- [ ] Downloads: PNG / GeoTIFF / GIF / laudo NDVI (CSV)

### 6.3 Página de Análise Temporal (`/dashboard/timelapse/:id`)
- [ ] Gráfico de área desmatada por ano + recordes + tendência/projeção
- [ ] Linha do tempo de eventos (cadastro, queimadas, cortes) cruzada com satélite
- [ ] Botão "Gerar laudo histórico (PDF)" (usa Fase 9)

---

## Fase 7 — IA robusta (DeepSeek V4 Flash) 🤖

> Modelo: **`deepseek-v4-flash`** via `api.deepseek.com/v1` (`DEEPSEEK_API_KEY`), raciocínio médio.
> Detalhes de arquitetura, prompts e endpoints em **[IA-ASSISTENTE.md](./IA-ASSISTENTE.md)**.

### 7.1 Fundação de IA
- [ ] `services/ai.ts` — cliente DeepSeek (base URL, chave, timeout, retry, streaming)
- [ ] `services/ai-context.ts` — **context builder**: monta contexto do CAR (dados cadastrais + camadas + alertas + sobreposições + autorizações + NDVI) em JSON compacto
- [ ] **RAG jurídico-ambiental**: portar `GeoForest/backend/knowledge-base.ts` + `banco_de_dados/` (29 arquivos: Código Florestal, SNUC, Código Ambiental MT, APP/RL/PMFS, matrizes de decisão) para aterrar recomendações e implicações legais — carregar só docs relevantes por pergunta
- [ ] Guardrails + disclaimer obrigatório ("análise preliminar, consulte o RT")
- [ ] Cache de respostas + rate limiting por usuário

### 7.2 Assistente conversacional
- [ ] `POST /api/ai/chat` — chat por CAR ("o que aconteceu esse mês?", "esse alerta é grave?", "tem autorização?")
- [ ] Chat de **carteira** ("quais imóveis têm mais risco?", "resuma a semana de todos os clientes")
- [ ] Threads persistentes (`ai_threads` / `ai_messages`), streaming no front (aba IA)

### 7.3 Inteligência sobre os dados
- [ ] `GET /api/cars/:id/risk-score` — **score 0–100** de risco de desmate + explicação (features: histórico, tendência NDVI, vizinho, sobreposições, uso consolidado)
- [ ] `POST /api/cars/:id/ai/summary` — resumo em linguagem natural dos alertas do período
- [ ] `POST /api/cars/:id/ai/ndvi-analysis` — interpreta o diff NDVI (Fase 6): polígonos com perda, área, severidade, parecer
- [ ] `POST /api/ai/triage` — sugere se um alerta é **verdadeiro / falso positivo / provável legal**
- [ ] `POST /api/cars/:id/ai/recomendacoes` — próximos passos conforme o achado (embargo → defesa/prazo; desmate sem AUTEX → alerta; licença vencendo → renovar)

### 7.4 Gerador de laudo/parecer ⭐⭐
- [ ] `POST /api/cars/:id/ai/laudo` — minuta de laudo técnico (contexto completo → texto estruturado editável)
- [ ] Editor no front com blocos (introdução, análise, conclusão, recomendações) + inserir mapas/NDVI
- [ ] Exporta para o PDF da Fase 9

### 7.5 UX de IA no app
- [ ] Aba **IA** na página do CAR (chat + botões "explicar este alerta", "gerar resumo", "gerar laudo")
- [ ] Widget "Pergunte sobre sua carteira" no dashboard
- [ ] Badge de score de risco nos cards e na tabela da carteira

---

## Fase 8 — Gestão de Carteira (consultor) 📂

O consultor não tem 1 imóvel: tem uma **carteira**. Toda a navegação assume isso.

### 8.1 Organização
- [ ] **Clientes/Pastas**: agrupar CARs por cliente final (proprietário)
- [ ] **Tags** e **cores** por imóvel; filtro e busca por cliente/tag/município
- [ ] Renomear/apelidar imóvel

### 8.2 Importação em massa 🆕
- [ ] Colar lista de nº de CAR (um por linha) → cria vários
- [ ] Upload **CSV** (nº CAR, apelido, cliente, tags)
- [ ] Upload **Shapefile (.zip) / KML / GeoJSON** com múltiplos polígonos → cria CARs por geometria
- [ ] Barra de progresso + relatório de importação (quais acharam polígono)

### 8.3 Visão consolidada
- [ ] **Tabela da carteira**: colunas ordenáveis (cliente, município, área, nº alertas, score de risco, último check), filtros, busca, paginação
- [ ] **Mapa geral da carteira**: todos os polígonos, coloridos por status/risco, clique → detalhe
- [ ] **Ranking de risco**: imóveis que precisam de atenção primeiro
- [ ] **Dashboard analítico**: total ha monitorados, ha desmatados no período, alertas por classe/município, tendência (Recharts)
- [ ] Ações em massa: verificar selecionados, exportar selecionados, gerar relatório da carteira

---

## Fase 9 — Relatórios + Exportações + Interoperabilidade GIS 📄📥

### 9.1 Laudos e relatórios PDF
- [ ] **Laudo técnico por imóvel**: capa, dados cadastrais, mapa, camadas do CAR, timeline de alertas, NDVI, análise IA, recomendações, espaço para ART/assinatura do RT
- [ ] **Relatório de carteira consolidado** (todos os imóveis de um cliente/tag)
- [ ] **Relatório histórico** (análise temporal por ano)
- [ ] Geração via template HTML → Puppeteer/Playwright → PDF
- [ ] **Templates com marca própria** (logo/rodapé do consultor — faz sentido mesmo sem white-label pago)
- [ ] **Agendamento** (semanal/mensal) por email/WhatsApp
- [ ] **Link temporário** de compartilhamento (expira em 24-72h) para enviar ao cliente final

### 9.2 Exportações GIS ⭐
> Reusar `GeoForest/backend/shapefile-writer.ts` (escreve `.shp`/`.shx`/`.dbf`/`.prj`, corrige orientação ESRI, trata MultiPolygon/pontos) — sem lib externa.
- [ ] Polígono do CAR e alertas em **SHP (.zip), GeoJSON, KML, KMZ, CSV, GPKG**
- [ ] Exportar **todas as camadas do CAR** (ATP/ARL/APP/…) num pacote
- [ ] `GET /api/cars/:id/export?format=...` e `/alerts/export?format=...`
- [ ] Exportação em massa da carteira (Fase 8)

### 9.3 Interoperabilidade
- [ ] **API Key** por usuário para acesso programático (QGIS/ArcGIS/scripts)
- [ ] Endpoint **WMS/WFS** próprio (ou link "abrir no QGIS") dos polígonos e alertas
- [ ] **Webhooks** — dispara POST quando surge novo alerta (integra com outros sistemas do consultor)

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

## Fase 13 — Ferramentas GIS de conformidade 🧰 (reúso GeoForest)

O consultor não quer só ser avisado — quer **validar e processar** o CAR. O GeoForest já é, na prática, um
validador SIMCAR/SEMA. Trazer como aba **"Ferramentas"** transforma o AlertaCAR de monitor em plataforma de
trabalho. Cada ferramenta segue o padrão job assíncrono + SSE (upload → processa → progresso → ZIP).
Ver [REUSO-GEOFOREST.md §6](./REUSO-GEOFOREST.md).

### 13.1 Validação de geometria (importador SEMA)
- [ ] Portar `geometry-errors.ts` + `simcar-rules.ts`: borda se cruza, pontos repetidos, contenção/sobreposição do Anexo 01
- [ ] Tolerâncias calibradas contra o PDF oficial (snap 0,05 m; dups 0,1 m)
- [ ] Relatório de erros (tabela + shapefile de pontos/áreas problemáticas)

### 13.2 Vértices próximas
- [ ] Portar `vertices-proximas.ts`: pares de vértices coincidentes por camada/feição/parte/anel
- [ ] Saídas `pontos_vertices_proximas.shp`, `resumo_vertices.csv`

### 13.3 Áreas não contidas (containment)
- [ ] Portar `containment-analysis.ts`: `alvo − união(continentes)` (erro "deve ser contido por AVN/AUAS/AC")
- [ ] Alvo/continentes configuráveis; área mínima (padrão 1 m²); saída em SHP + CSV

### 13.4 ProcessarGeo (buffers do Código Florestal)
- [ ] Portar `simcar-processar-geo.ts`: gera APP / APPD / APPRL / AURD / ARLDR por buffers hídricos e de relevo
- [ ] Gate de importação (só processa se a geometria passar na 13.1, igual à SEMA)

### 13.5 Recorte de camadas do CAR
- [ ] Portar `simcar-clip.ts` (TEMPLATE_LAYERS): recorta ARL/APP/AUAS/AVN/nascentes/rios ao polígono do imóvel
- [ ] Alimenta a **aba Camadas** (Fase 5.3) e o pacote de export (Fase 9.2)

### 13.6 UX
- [ ] Aba **Ferramentas** no app; drag-and-drop de ZIP (shp/dbf/prj)
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

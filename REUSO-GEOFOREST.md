# Reúso do GeoForest — o que trazer para o AlertaCAR

> O **GeoForest-IA** (mesma pasta `Servidores_NAO_MEXA/`) é um sistema maduro de geoprocessamento SIMCAR/SEMA
> com muito código diretamente reaproveitável. Este documento inventaria o que portar, para onde, e como.
>
> ⚠️ **Não editar o GeoForest.** Copiar/adaptar módulos para o AlertaCAR; manter o GeoForest intacto.

Repo de origem: `/media/server/HD Backup/Servidores_NAO_MEXA/GeoForest-IA/`

---

## Mapa de reúso (resumo)

| Ativo GeoForest | Arquivo(s) | Vai para (fase AlertaCAR) | Valor |
|-----------------|-----------|---------------------------|-------|
| **Engine WFS SEMA** (capabilities + describe + INTERSECTS + paginação) | `backend/wfs-intersection.ts` | **Fase 4** | Substitui o WFS ingênuo atual; interseção real e robusta |
| **Viewer WMS no navegador** (catálogo + snapshot) | `backend/index.ts` (`/api/map/capabilities`, `/api/map/snapshot`, `parseLayersFromCapabilities`) | **Fase 5** | "Ver camadas SEMA no navegador" |
| **Acervo satélite próprio** (CBERS-4A 2 m, Landsat) | GeoServer `wms.cursar.space` + `cbers-wpm.ts`, `landsat.ts` | **Fase 6** | Imagem de altíssima resolução, além dos mosaicos SEMA |
| **Base de conhecimento RAG** (SEMA, Cód. Florestal, sensoriamento) | `backend/knowledge-base.ts` + `banco_de_dados/` (29 arquivos) | **Fase 7 (IA)** | Aterra as respostas/laudos da IA em legislação real |
| **Writer de Shapefile** (polygon/point + shx/dbf/prj) | `backend/shapefile-writer.ts` | **Fase 9 (exports)** | Export SHP nativo, sem lib externa |
| **Validação de geometria SIMCAR** (borda se cruza, pontos repetidos, Anexo 01) | `backend/geometry-errors.ts`, `simcar-rules.ts` | **Fase 13** | Ferramenta "valide seu CAR" |
| **Vértices próximas** | `backend/vertices-proximas.ts` | **Fase 13** | Diagnóstico de topologia |
| **Áreas não contidas** (alvo − união(continentes)) | `backend/containment-analysis.ts` | **Fase 13** | Erro clássico do validador SEMA |
| **ProcessarGeo** (buffers APP/APPD/ARL do Cód. Florestal) | `backend/simcar-processar-geo.ts`, `processar-projeto.ts` | **Fase 13** | Motor de conformidade ambiental |
| **Recorte de camadas do CAR** (TEMPLATE_LAYERS) | `backend/simcar-clip.ts` | **Fase 5.3 / 13** | Todas as camadas do imóvel recortadas |
| **Padrão job assíncrono + SSE** (upload→processa→progresso→ZIP) | vários (`/api/*/jobs/:id/events`) | **Fases 8/9/13** | Operações longas (batch, relatórios, exports) |
| **Auto-update do frontend** (buildId + version.json) | `client/src/lib/autoUpdate.ts`, `vite.config.ts` | **Fase 11** | Recarrega app novo sem Ctrl+F5 |
| **Métricas do servidor** | `/api/server/metrics` | **Fase 12 (admin)** | CPU/RAM/disco no painel |

---

## Detalhamento

### 1. Engine WFS (Fase 4) — `wfs-intersection.ts`
Padrão comprovado em produção. Funções a portar:
- `getCapabilitiesCached()` — lista de camadas com TTL.
- `getGeometryFieldForLayer()` — `DescribeFeatureType` → nome do campo de geometria (varia por camada!).
- `computeIntersectionForLayer()` — `INTERSECTS(<geom>, <WKT>)` + `resultType=hits` + paginação + fallback + clip turf.
- `polygonToWkt()`, `normalizePolygonGeometry()`, `normalizeRing()` — helpers de geometria.
- Rotas: `GET /api/wfs/health`, `POST /api/map/intersection-hectares`.

No AlertaCAR isso vira: para cada CAR, cruzar o polígono com embargos/infrações/licenças/autorizações/TI/UC
e gravar **quantos ha e % incidem** — muito melhor que o BBOX ingênuo atual.

### 2. Viewer WMS (Fase 5) — `index.ts`
- `parseLayersFromCapabilities()` — parseia a árvore `<Layer>` (name/title/CRS/ano/grupo).
- `toImageryLayers()` / `toShapeLayers()` / `toSimcarDigitalLayers()` — classifica em satélite / vetor / CAR.
- `GET /api/map/capabilities` — devolve o catálogo pronto para o controle de camadas.
- `POST /api/map/snapshot` — `GetMap` (base + até 8 overlays + bbox) → PNG data-URL, com cache.

→ Habilita "ver camadas SEMA no navegador" (overlay ao vivo) e snapshot para PDF/IA. Ver **[CAMADAS-SEMA.md](./CAMADAS-SEMA.md)**.

### 3. Satélite (Fase 6) — acervo próprio
O GeoForest já baixa (STAC INPE/USGS), processa e **publica no GeoServer** cenas CBERS-4A/WPM (2 m) e Landsat,
servidas por `https://wms.cursar.space/geoserver/cbers/wms`. O AlertaCAR **consome** essas camadas WMS no
mapa/timelapse — não precisa reimplementar o pipeline de download para ter alta resolução.
(Se um dia quiser gerar imagem nova sob demanda, os módulos `cbers-wpm.ts`/`landsat.ts` estão prontos.)

### 4. IA aterrada (Fase 7) — `knowledge-base.ts`
RAG próprio com 29 arquivos (SEMA-MT, SIMCAR, Código Florestal, SNUC, crimes ambientais, Código Ambiental MT,
engenharia florestal — APP/RL/PMFS/PRAD, matrizes de decisão, sensoriamento remoto, TR SEMA 2024).
→ As **recomendações** e **implicações legais** da IA do AlertaCAR (Fase 7) devem usar esse conhecimento como
contexto, para não "alucinar" a legislação. Carregar só os documentos relevantes por pergunta (economia de tokens).

### 5. Exports GIS (Fase 9) — `shapefile-writer.ts`
Escreve `.shp` (ShapeType 5 Polygon / 1 Point) + `.shx` + `.dbf` + `.prj`, corrige orientação de anéis (ESRI),
trata MultiPolygon e buracos. → Base do export SHP do AlertaCAR (polígono do CAR, alertas, camadas).

### 6. Ferramentas GIS de conformidade (Fase 13 — nova)
O GeoForest praticamente **é** um validador SIMCAR. Trazer como aba "Ferramentas" no AlertaCAR:
- **Validação de geometria** (`geometry-errors.ts`, `simcar-rules.ts`): borda se cruza, pontos repetidos,
  contenção/sobreposição do Anexo 01, tolerâncias calibradas contra o PDF oficial da SEMA.
- **Vértices próximas** (`vertices-proximas.ts`): pares de vértices coincidentes por camada/feição/anel.
- **Áreas não contidas** (`containment-analysis.ts`): `alvo − união(continentes)` (erro "deve ser contido por AVN/AUAS/AC").
- **ProcessarGeo** (`simcar-processar-geo.ts`): gera APP/APPD/APPRL/AURD/ARLDR por buffers do Código Florestal.
- **Recorte de camadas** (`simcar-clip.ts`): recorta todas as `TEMPLATE_LAYERS` do CAR ao polígono do imóvel.

Isso transforma o AlertaCAR de "monitor" em **plataforma de trabalho do consultor** (monitorar + validar + processar + exportar).

### 7. Infra reutilizável
- **SSE jobs**: upload → job → `GET …/jobs/:id/events` (progresso) → download ZIP. Usar em batch da carteira,
  geração de relatórios e exports pesados (Fases 8/9/13).
- **Auto-update**: `buildId` + `version.json` + recarregar ao focar a aba (Fase 11).
- **`/api/server/metrics`**: CPU/RAM/disco para o painel admin (Fase 12).

---

## Cuidados

- **Licenças/segredos:** não copiar `authkey`/chaves para o repositório — usar `.env` (a `authkey` da SEMA é pública, mas mantenha em env).
- **Billing:** o GeoForest cobra por operação (`billing.ts`); o AlertaCAR é **grátis** — **não** portar billing.
- **Firebase:** o GeoForest usa Firebase Auth/Hosting; o AlertaCAR é auth local + self-hosted — portar só a lógica geográfica, não a infra Firebase.
- **Datum:** confirmar EPSG (SEMA usa 4674/SIRGAS-2000; reprojeções para 4326 são ~cm). Reaproveitar os helpers do GeoForest quando houver conversão.

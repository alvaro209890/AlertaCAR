# Camadas SEMA-MT — Catálogo WFS/WMS e como exibir no navegador

> **Verificado ao vivo em 21/07/2026** contra `https://geo.sema.mt.gov.br/geoserver/ows`.
> WFS: **135 camadas** renderizáveis · WMS: **215 camadas** (53 de imagem/satélite).
> Auth key pública da SEMA: `541085de-9a2e-454e-bdba-eb3d57a2f492` (mesma usada pelo GeoForest).

Este documento é a fonte de verdade das camadas que o AlertaCAR consome — o que **monitorar** (WFS,
interseção), o que **desenhar no mapa** (WMS overlay) e o que usar de **satélite** (mosaicos).

---

## 1. Endpoints base

| Serviço | URL | Uso |
|---------|-----|-----|
| WFS (vetorial) | `…/geoserver/ows?service=WFS&version=2.0.0` | Interseção, feições, geometria |
| WMS (raster/render) | `…/geoserver/ows?service=WMS&version=1.3.0` | Desenhar camada no mapa, snapshot PNG |
| GetCapabilities | `…?service=WFS|WMS&request=GetCapabilities` | Descobrir camadas disponíveis |
| DescribeFeatureType | `…?service=WFS&request=DescribeFeatureType&typeNames=<layer>` | Achar o campo de geometria |

Todas as chamadas levam `&authkey=541085de-…`. Sem `authkey`, várias camadas retornam vazio/403.

---

## 2. Catálogo WFS — camadas monitoráveis (135)

### 🔵 CAR / SIMCAR — camadas do próprio imóvel (44)
As **camadas do CAR** são ouro para o eng. florestal: permitem ver ARL, APP, AUAS, reserva, nascentes etc.

| Camada | Conteúdo |
|--------|----------|
| `Geoportal:CAR_ATP` | **Área Total do imóvel** (polígono base) — chave `NUMEROESTADUAL='MTxxxxx/aaaa'` |
| `Geoportal:CAR_ARL` | Reserva Legal |
| `Geoportal:CAR_AVN` | Vegetação Nativa |
| `Geoportal:CAR_APP` / `CAR_APPD` / `CAR_APPRL` | APP / APP degradada / APP de RL |
| `Geoportal:CAR_AUAS` | Uso Antrópico (campo `ABERTURA` = ano de supressão) |
| `Geoportal:CAR_AU` | Área Úmida |
| `Geoportal:CAR_NASCENTE` | Nascentes (**pontos**) |
| `Geoportal:SIMCAR_CAR_AREA_CONSOLIDADA` | Área consolidada |
| `Geoportal:SIMCAR_ARLD` | ARL a recompor |
| `Geoportal:MVW_REQUERIMENTO_ATP` / `_TAC` | Requerimentos / TAC |
| `Geoportal:SIMCAR_D_*` (≈25 camadas) | Demonstrativos: `D_APP`, `D_ARL`, `D_AUAS`, `D_AVN`, `D_AURD`, `D_AREA_CONSOLIDADA`, `D_RIO_10_A_50`/`_50_A_200`/`_200_A_600`, `D_NASCENTE`, `D_RESERVATORIO_ARTIFICIAL`, `D_LAGOA_NATURAL`, `D_AREA_DECLIVIDADE`, `D_AREA_TOPO_MORRO`, `D_BORDA_CHAPADA`, `D_MANGUEZAL`, `D_RESTINGA`, `D_INTERESSE_SOCIAL`, `D_AREA_UMIDA`, `D_AREA_INUNDADA`, `D_APPD_*` (faixas de módulos fiscais) |

### 🔴 Fiscalização — embargos, autos, termos (20)
| Camada | Alerta |
|--------|--------|
| `Geoportal:TDAD_FISCALIZACAO_TERMO_DE_EMBARGO` ⭐ | Embargo (polígono) |
| `Geoportal:AREAS_EMBARGADAS_SEMA`, `AREA_EMBARGADA_SIGA_POLIGONO`, `_PONTO` | Áreas embargadas |
| `Geoportal:AREAS_DESEMBARGADAS_SEMA`, `_SIGA_POLIGONO`, `_PONTO` | Desembargo (área liberada) |
| `Geoportal:TDAD_FISCALIZACAO_AUTO_DE_INFRACAO`, `AUTOS_DE_INFRACAO_SIGA_POLIGONO`/`_PONTO` | Auto de infração |
| `Geoportal:TDAD_FISCALIZACAO_AUTO_DE_INSPECAO`, `AUTOS_TERMOS_AUTO_INSPECAO` | Inspeção |
| `Geoportal:TDAD_FISCALIZACAO_NOTIFICACAO`, `AUTOS_TERMOS_NOTIFICACAO` | Notificação |
| `Geoportal:AUTOS_TERMOS_TERMO_APREENSAO` / `_DEPOSITO` / `_DEST_INUT` / `_SOLTURA` | Termos de apreensão/depósito/destruição/soltura |
| `Geoportal:TDAD_FISCALIZACAO`, `TDAD_FISCALIZACAO_LAS` | Fiscalização geral / LAS |

### 🟡 Licenciamento (14)
| Camada | Tipo |
|--------|------|
| `Geoportal:SIMLAMGEO_LP` / `_LP_ATIVA` | Licença Prévia (ativa) |
| `Geoportal:SIMLAMGEO_LI` / `_LI_ATIVA` | Licença de Instalação |
| `Geoportal:SIMLAMGEO_LO` / `_LO_ATIVA` | Licença de Operação |
| `Geoportal:SIMLAMGEO_LOP` / `_LOP_ATIVA` | Licença de Operação Provisória |
| `Geoportal:SIGA_LAC` / `_ATIVA` | Licença Ambiental (SIGA) |
| `Geoportal:TDAD_LICENCIAMENTO`, `_LICENCA_PREVIA`, `_LICENCA_DE_INSTALACAO`, `_LICENCA_DE_OPERACAO` | TDAD |

> As camadas `_ATIVA` são as que interessam para alertar **vencimento** (usar atributo de validade).

### 🟢 Autorizações (3)
`Geoportal:AUTORIZACAO_DESMATE_SEMA` · `Geoportal:AUTORIZACAO_EXPLORACAO_SEMA` · `Geoportal:AUTEX_PMFS_SEMA`
→ usadas no **cruzamento com alertas**: desmate SCCON dentro de uma dessas ≈ provavelmente legal.

### 🟣 Fundiário / sobreposições (5)
`Geoportal:TERRAS_INDIGENAS` · `Geoportal:UNIDADES_CONSERVACAO` · `Geoportal:ASSENTAMENTOS_INCRA` ·
`Geoportal:ASSENTAMENTOS_INTERMAT` · `Geoportal:CORREDORES_BIODIVERSIDADE`

### ⚫ Desmatamento histórico SEMA (8)
`Geoportal:DESMATAMENTO_SEMA_2012` … `_2018` · `Geoportal:USO_CONSOLIDADO`

### 💧 Hidrografia (17)
`Geoportal:HID_MASSA_DAGUA` · `SFB_HIDRO_APP_HIDRICA` · `SFB_HIDRO_CATEGORIZADA` · `SFB_HIDRO_MASSA_DAGUA` ·
`SFB_HIDRO_TRECHO_DRENAGEM` · `SFB_HIDRO_TRECHO_MASSA_DAGUA` · `HIDRO_COORDENADA_*`
→ úteis para conferir APP hídrica e traçado de drenagem no mapa.

---

## 3. Catálogo WMS — imagem/satélite (53)

Alimenta a **aba Satélite** (timelapse, comparador, NDVI). Todas com `authkey` e recorte por bbox do CAR.

| Satélite | Camadas | Período | Uso |
|----------|---------|---------|-----|
| **Landsat 5** | `Mosaicos:LANDSAT_5_1984` … `_2011` | 1984–2011 (28 anos!) | Base histórica profunda |
| **Landsat 7/8** | `Mosaicos:LANDSAT_7_*`, `LANDSAT_8_*`, `semamt:LANDSAT_5` | 2002, 2013–2018 | Transição |
| **Sentinel-2 RGB** | `Mosaicos:SENTINEL_2_2016` … `_2025` | 2016–2025 (10 m) | Timelapse recente |
| **Sentinel-2 NIR** ⭐ | `Mosaicos:Geoportal_Sentinel_2_2016_NIR` … `_2020_NIR` | 2016–2020 | **NDVI** (NIR/RED) |
| **SPOT** | `Mosaicos:MOSAICO_SPOT_SEPLAN` | mosaico estadual (5 m) | Detalhe |
| **RESOURCESAT** | `Mosaicos:RESOURCESAT_2012` | 2012 (23 m) | Complemento |
| **DEM** | `SEMAMT:ALOS_PALSAR_DEM` | — | Relevo/declividade |

> **Timelapse profundo:** com Landsat 5 desde 1984 + Sentinel-2 até 2025, dá para mostrar **~40 anos**
> de evolução do imóvel — muito além do que a documentação antiga (só 2016+) prometia.

### Acervo próprio de alta resolução (via GeoForest) 🆕
Além do WMS da SEMA, o **GeoForest** publica acervo próprio no GeoServer local, exposto em
`https://wms.cursar.space/geoserver/cbers/wms`:
- **CBERS-4A/WPM 2 m** (fusão pancromática) — resolução muito superior aos mosaicos SEMA.
- **Landsat** processado/publicado por órbita-ponto/ano.
- Árvore: `RASTER → CBERS-4A-Apos_2019 → orbit_* → ano → layer` e `RASTER → LANDSAT → …`.

O AlertaCAR pode **consumir** essas camadas WMS no mapa como qualquer outra (mesmo protocolo GetMap).

---

## 4. Como exibir camadas SEMA no navegador

Três modos, do mais simples ao mais completo:

### 4.1 Overlay WMS ao vivo no mapa (Leaflet) — recomendado
Adicionar a camada como `WMSTileLayer` apontando direto para o WMS da SEMA:

```tsx
<WMSTileLayer
  url="https://geo.sema.mt.gov.br/geoserver/ows"
  params={{
    layers: 'Geoportal:CAR_ARL',   // ou embargo, TI, sentinel, etc.
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    authkey: '541085de-…',
  }}
  opacity={0.7}
/>
```
- O **controle de camadas** é populado pelo catálogo de `/api/map/capabilities` (ver 4.3).
- Slider de opacidade por camada; ligar/desligar overlays (CAR, embargos, TI/UC, satélite).
- Satélite entra como **base layer** (`transparent:false`), vetoriais como **overlay** (`transparent:true`).

### 4.2 Snapshot PNG (para PDF/relatório/IA)
Endpoint no backend que faz `GetMap` (base + até 8 overlays + bbox) e devolve PNG/data-URL — reaproveitar
o padrão de `GeoForest/backend/index.ts` (`/api/map/snapshot`):

```
POST /api/cars/:id/map/snapshot
{ layerName: 'Mosaicos:SENTINEL_2_2024',
  overlayLayers: ['Geoportal:CAR_ATP','Geoportal:AREAS_EMBARGADAS_SEMA'],
  bbox: [minX,minY,maxX,maxY], crs:'EPSG:4326', width:1200, height:800 }
→ { dataUrl, sourceUrl, mapContext }
```
Usado para: imagem estática no **laudo PDF**, thumbnail do card, e contexto visual para a **IA**.

### 4.3 Catálogo dinâmico de camadas (`/api/map/capabilities`)
Buscar o `GetCapabilities` do WMS, parsear a árvore de `<Layer>` (name/title/CRS/ano) e classificar em:
- **imagery** (spot/landsat/sentinel/resourcesat/mosaico) → base layers da aba Satélite;
- **vector/shape** (embargos, TI, licenças…) → overlays;
- **SIMCAR/CAR** (`geoportal:car_*`, `geoportal:simcar_*`) → camadas do imóvel.

O parser já existe pronto no GeoForest (`parseLayersFromCapabilities`, `toImageryLayers`,
`toShapeLayers`, `toSimcarDigitalLayers`) — portar direto. Cachear 2–10 min.

---

## 5. Interseção espacial (WFS) — quanto de cada camada incide no imóvel

Para **quantificar** (não só desenhar): "quantos ha do CAR estão embargados?", "% em TI?".
Reaproveitar o engine de `GeoForest/backend/wfs-intersection.ts`:

1. `GetCapabilities` → valida se a camada existe.
2. `DescribeFeatureType` → descobre o campo de geometria.
3. `CQL_FILTER=INTERSECTS(<geom>, <WKT do polígono>)` com `resultType=hits` → conta feições.
4. Busca paginada (`startIndex`/`count`) com **fallback** para camadas sem primary key.
5. `turf.intersect` + `union` → área de interseção (ha) e % de cobertura do imóvel.

Endpoints prontos para portar: `GET /api/wfs/health`, `POST /api/map/intersection-hectares`
(recebe `polygon` GeoJSON + `layerNames[]`, devolve ha e % por camada). Concorrência limitada a 3.

**Pitfalls confirmados** (do GeoForest):
- `INTERSECTS` só funciona com o **nome real do campo de geometria** (varia por camada) → sempre `DescribeFeatureType`.
- Camadas sem PK quebram paginação com `startIndex` → detectar erro "natural order without a primary key" e cair para uma página única grande.
- Timeout alto (60 s) + retry; `authkey` obrigatória.

---

## 6. Outras fontes úteis (não-SEMA)

| Fonte | Endpoint | Uso |
|-------|----------|-----|
| **PRODES/INPE** | `https://terrabrasilis.dpi.inpe.br/geoserver/ows` — `prodes-legal-amz:yearly_deforestation` | Desmatamento oficial federal (anual) |
| **DETER/INPE** | idem TerraBrasilis | Alertas quase-real-time |
| **BDQueimadas/INPE** | portal INPE | Focos de calor |
| **STAC INPE (CBERS)** | `https://data.inpe.br/bdc/stac/v1` — `CB4A-WPM-L4-DN-1` | Busca de cenas CBERS-4A 2 m |
| **STAC USGS (Landsat)** | `https://landsatlook.usgs.gov/stac-server` — `landsat-c2l2-sr` | Busca Landsat Collection 2 |
| **SFB Hidrografia** | `Geoportal:SFB_HIDRO_*` (mesmo WFS SEMA) | APP hídrica / drenagem |

---

## 7. Scripts de verificação

Reproduzir o catálogo (rodar do servidor, que tem IP BR):
```bash
node scripts/inspect-sema-wfs.mjs   # lista 135 camadas WFS por categoria
node scripts/inspect-sema-wms.mjs   # lista 53 camadas de imagem por satélite/ano
```
(Modelos desses scripts existem no GeoForest: `_inspect_wms.mjs`.)

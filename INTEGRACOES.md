# Integrações — AlertaCAR

> ✅ Todas as integrações testadas em 21/07/2026. Dados reais, endpoints funcionais.

---

## 1. SCCON — Alertas de Desmatamento e Degradação

### Fonte da documentação
Documentação completa em `Automacao_AUAS/` do GeoForest:
- `ENDPOINTS.md`: 9 endpoints catalogados
- `FLUXO.md`: Pipeline AUAS → SCCON
- `SCHEMA.md`: Contratos de dados

### Endpoints

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Token | `POST plataforma.sccon.com.br/gama-api/auth/token-public-layer?organizationUUID=...` | JWT público |
| User | `GET plataforma-alertas.sccon.com.br/gama-api/users/user` | userId para viewparams |
| WFS Alertas | `GET geoserver-dashboard-mt.sccon.com.br/geoserver/dashboards/wfs` | Alertas no bbox |
| Detalhe | `GET deforestation-data-mt.sccon.com.br/api-v2/localAlerts/{id}` | Geometria + data |
| **Busca paginada** ⭐ | `POST deforestation-data-mt.sccon.com.br/api-v2/alerts/search` | Com `cdCars`, paginação |
| Layers | `POST deforestation-data-mt.sccon.com.br/api-v2/alerts/layers` | Metadados WMS/WFS |
| Organização | `GET plataforma-alertas.sccon.com.br/gama-api/organizations/uuid/{uuid}` | Classes de alerta |

### ⭐ Busca por CAR (NOVO)

```json
POST /api-v2/alerts/search
{
  "classTypes": ["CUT", "SELECTIVE_EXTRACTION", "BURN_SCAR"],
  "selectedFilters": [{"localType": "STATE", "localIds": null, "parentLocalIds": []}],
  "rangeDate": [{"start": "2019-07-22", "end": "2026-07-21"}],
  "organizationUUID": "597953b9-ee78-4113-80f9-803dbbaa60a0",
  "cdCars": ["27827/2017"],
  "page": 0,
  "pageSize": 10
}
```

**Resposta**: Array de alertas com `alertDetectedDate`, `geometry` (Polygon), `area`, `classType`.

### Classes de alerta (11 tipos)

| Classe | Tradução | Prioridade |
|--------|----------|------------|
| `CUT` | Desmatamento - Corte Raso | 🔴 Crítica |
| `SELECTIVE_EXTRACTION` | Degradação | 🟠 Alta |
| `DEGRADATION_SELECTIVE_CUT` | Corte Seletivo | 🟠 Alta |
| `BURN_SCAR` | Cicatriz de Queimada | 🟡 Média |
| `FOCUS_OF_BURN` | Foco de Queimada | 🟡 Média |
| `MINERAL_EXTRACTION` | Extração Mineral | 🔴 Crítica |
| `DEGRADATION_CHEMICAL_AGENT` | Degradação Química | 🔴 Crítica |
| `LANDSLIDES` | Deslizamentos | 🟢 Baixa |
| `BLOW_DOWN` | Derrubada por Vento | 🟢 Baixa |
| `AIRSTRIP_OPENING` | Abertura de Pista | 🟡 Média |
| `ACCESS` | Abertura de Acesso | 🟡 Média |

### Fluxo otimizado (3 passos)

```
1. Token público (JWT, 24h)
2. POST /api-v2/alerts/search com cdCars=[numero_car]
   → Retorna geometria + data em uma única chamada
3. Filtrar alertas NOVOS (comparar com DB local)
```

**Vantagem vs WFS+Detalhes**: 1 chamada em vez de N+1. A SCCON já retorna geometria e data no search.

### Headers obrigatórios
```
User-Agent: Mozilla/5.0 ... Chrome/126.0.0.0 ...
Origin: https://alertas.sccon.com.br
Referer: https://alertas.sccon.com.br/matogrosso/
```

Sem `User-Agent` de browser → Cloudflare 403.

---

## 2. WFS da SEMA-MT — 135 Camadas Mapeadas

### Credenciais

| Campo | Valor |
|-------|-------|
| URL Base | `https://geo.sema.mt.gov.br/geoserver/ows` |
| Auth Key | `541085de-9a2e-454e-bdba-eb3d57a2f492` |
| Timeout | 15-30s |

### Camadas por categoria (monitoráveis pelo AlertaCAR)

#### 🔴 Embargos e Fiscalização (8 camadas)
| Camada | Tipo |
|--------|------|
| `TDAD_FISCALIZACAO_TERMO_DE_EMBARGO` | Polígono ⭐ |
| `TDAD_FISCALIZACAO_AUTO_DE_INFRACAO` | Polígono |
| `TDAD_FISCALIZACAO_AUTO_DE_INSPECAO` | Polígono |
| `TDAD_FISCALIZACAO_NOTIFICACAO` | Polígono |
| `TDAD_FISCALIZACAO` | Polígono |
| `AREAS_EMBARGADAS_SEMA` | Polígono |
| `AREA_EMBARGADA_SIGA_POLIGONO` | Polígono |
| `AREA_EMBARGADA_SIGA_PONTO` | Ponto |
| `AUTOS_DE_INFRACAO_SIGA_POLIGONO` | Polígono |

#### 🟠 Desembargos (2 camadas)
| `AREAS_DESEMBARGADAS_SEMA` | Polígono |
| `AREAS_DESEMBARGADAS_SIGA_POLIGONO` | Polígono |

#### 🟡 Licenciamento Ambiental (7 camadas)
| `TDAD_LICENCIAMENTO_LICENCA_PREVIA` | LP |
| `TDAD_LICENCIAMENTO_LICENCA_DE_INSTALACAO` | LI |
| `TDAD_LICENCIAMENTO_LICENCA_DE_OPERACAO` | LO |
| `SIMLAMGEO_LP` / `_ATIVA` | LP ativa |
| `SIMLAMGEO_LI` / `_ATIVA` | LI ativa |
| `SIMLAMGEO_LO` / `_ATIVA` | LO ativa |
| `SIGA_LAC` / `_ATIVA` | Licença ambiental |

#### 🟢 Autorizações (3 camadas)
| `AUTORIZACAO_DESMATE_SEMA` | Autorização de desmate |
| `AUTORIZACAO_EXPLORACAO_SEMA` | Autorização de exploração |
| `AUTEX_PMFS_SEMA` | PMFS |

#### 🔵 Cadastral / CAR (9 camadas)
| Camada | Campo chave |
|--------|-------------|
| `CAR_ATP` | Área Total — polígono base |
| `CAR_AUAS` | Uso Antrópico (coluna `ABERTURA`) |
| `CAR_AVN` | Vegetação Nativa |
| `CAR_ARL` | Reserva Legal |
| `CAR_APP` | Preservação Permanente |
| `CAR_APPD` | APP Degradada |
| `CAR_AU` | Área Úmida |
| `CAR_NASCENTE` | Nascentes |
| `SIMCAR_CAR_AREA_CONSOLIDADA` | Área Consolidada |

#### 🟣 Sobreposições Fundiárias (5 camadas)
| `ASSENTAMENTOS_INCRA` | Assentamentos INCRA |
| `ASSENTAMENTOS_INTERMAT` | Assentamentos INTERMAT |
| `TERRAS_INDIGENAS` | Terras Indígenas |
| `UNIDADES_CONSERVACAO` | Unidades de Conservação |
| `CORREDORES_BIODIVERSIDADE` | Corredores ecológicos |

#### ⚪ Outros (6 camadas)
| `DESMATAMENTO_SEMA_2012` a `_2018` | Histórico desmate (7 anos) |
| `FLORESTA_PLANTADA` | Silvicultura |
| `VEGETACAO_IBGE` | Vegetação IBGE |
| `BIOMAS_MT` | Biomas |
| `USO_CONSOLIDADO` | Uso consolidado |
| `MVW_REQUERIMENTO_ATP` | Requerimentos ATP |

### Método de busca

**Por número do CAR** (`NUMERO_CAR` em formato `MTXXXXX/YYYY`):
```
CQL_FILTER=NUMERO_CAR='MT27827/2017'
```

**Por interseção espacial** (BBOX + clip local):
```
bbox=minx,miny,maxx,maxy,EPSG:4674
```

### Pitfalls
1. **INTERSECTS não confiável** — usar CQL_FILTER ou BBOX + clip local
2. **Paginação quebrada** — `startIndex` causa timeout
3. **Timeout** — retry 3x, 30s cada, cache agressivo
4. **Formato do número** — converter nº simplificado (`271442`) para formato WFS (`MT271442/YYYY`)

---

## 3. WhatsApp (Baileys)

### Arquitetura

- Baileys como cliente WhatsApp Web
- **1 número** conectado (admin)
- Envio: admin → WhatsApp do usuário
- Sessão persistente em SQLite
- Reconexão automática

### Conexão
1. Admin → painel → "Conectar WhatsApp"
2. QR Code gerado via baileys
3. Admin escaneia com celular
4. Sessão salva — reconecta automaticamente

### Template

```
🔔 *AlertaCAR — {tipo_alerta}*

📍 CAR: {numero_car} — {municipio}/MT
🏷️ {classe} • 📅 {data} • 📐 {area} ha

Acesse: alertacar.cursar.space
```

### Rate limiting
- Máx 1 msg/CAR/hora
- Máx 10 msgs/usuário/dia
- Agrupa múltiplos alertas do mesmo CAR

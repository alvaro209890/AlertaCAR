# Integrações — AlertaCAR

> ✅ Todas as integrações testadas em 21/07/2026. Dados reais, endpoints funcionais.

---

## 1. WFS da SEMA-MT

### Credenciais

| Campo | Valor |
|-------|-------|
| URL Base | `https://geo.sema.mt.gov.br/geoserver/ows` |
| Auth Key | `541085de-9a2e-454e-bdba-eb3d57a2f492` |
| Total camadas | 135 |
| Timeout típico | 10-30s |

### Camadas relevantes para AlertaCAR

#### 🔴 Camadas de CAR (todas com `NUMERO_CAR`)

| Camada | Descrição | Útil para |
|--------|-----------|-----------|
| `Geoportal:CAR_ATP` | Área Total do Imóvel (polígono principal) | Polígono base do CAR |
| `Geoportal:CAR_AUAS` | Área de Uso Antrópico do Solo | Datação de desmate (coluna `ABERTURA`) |
| `Geoportal:CAR_AVN` | Área de Vegetação Nativa | Monitorar perda de vegetação |
| `Geoportal:CAR_ARL` | Área de Reserva Legal | Conformidade legal |
| `Geoportal:CAR_APP` | Área de Preservação Permanente | Conformidade ambiental |
| `Geoportal:CAR_APPD` | APP Degradada | Recuperação necessária |
| `Geoportal:CAR_APPRL` | APP em RL | Compensação |
| `Geoportal:CAR_AU` | Área Úmida | Restrições |
| `Geoportal:CAR_NASCENTE` | Nascentes (pontos) | Restrições |

#### 🟠 Camadas de Embargo e Fiscalização

| Camada | Descrição |
|--------|-----------|
| `Geoportal:TDAD_FISCALIZACAO_TERMO_DE_EMBARGO` | **Embargos ativos** — polígonos ⭐ |
| `Geoportal:TDAD_FISCALIZACAO_AUTO_DE_INFRACAO` | Autos de infração |
| `Geoportal:TDAD_FISCALIZACAO_NOTIFICACAO` | Notificações |
| `Geoportal:TDAD_FISCALIZACAO` | Fiscalizações gerais |

#### 🟡 Desmatamento Autorizado

| Camada | Descrição |
|--------|-----------|
| `Geoportal:AUTORIZACAO_DESMATE_SEMA` | Autorizações de desmate emitidas |
| `Geoportal:AUTORIZACAO_EXPLORACAO_SEMA` | Autorizações de exploração |
| `Geoportal:DESMATAMENTO_SEMA_2012` a `_2018` | Desmatamento histórico |

### Método de busca

**CQL_FILTER via `NUMERO_CAR`:**
```
typeName=Geoportal:CAR_ATP
CQL_FILTER=NUMERO_CAR='MT27827/2017'
```

Formato do número: `MT<digitos>/<ano>` (ex: `MT27827/2017`).

**Para busca por número simplificado** (ex: `271442`):
1. Tentar formatos: `MT271442/YYYY`, `MT0271442/YYYY`
2. Se falhar, buscar via API SIMCAR (REST) que converte número simplificado → completo
3. Fallback: usar `maxFeatures` maior + filtrar no cliente

### Pitfalls conhecidos (GeoForest)

1. **INTERSECTS não confiável** — retorna subconjunto sem erro. Sempre usar CQL_FILTER ou BBOX.
2. **Paginação quebrada** — `startIndex` causa timeout. Fazer requisição única.
3. **Timeout frequente** — implementar retry com backoff exponencial (3 tentativas, 30s cada).
4. **Cache agressivo** — polígono não muda com frequência. Cache de 30 dias.

---

## 2. SCCON (Sistema de Comercialização e Controle de Produtos de Origem Florestal)

### ✅ Testado e Funcional

### Endpoints

| Serviço | URL | Método |
|---------|-----|--------|
| Token público | `https://plataforma.sccon.com.br/gama-api/auth/token-public-layer?organizationUUID=597953b9-ee78-4113-80f9-803dbbaa60a0` | GET |
| User info | `https://plataforma-alertas.sccon.com.br/gama-api/users/user` | GET (Bearer) |
| WFS Alertas | `https://geoserver-dashboard-mt.sccon.com.br/geoserver/dashboards/wfs` | GET (Bearer) |
| Detalhe alerta | `https://deforestation-data-mt.sccon.com.br/api-v2/localAlerts/{id}` | GET (Bearer) |

### Fluxo de consulta

```
1. GET token público (JWT, ~24h validade)
2. GET userId (precisa do token)
3. Montar viewparams com userId + orgToken + classes + datas
4. WFS GetFeature no bbox do CAR → retorna ids (idt_local_alert)
5. GET /localAlerts/{id} em paralelo → classType, alertDetectedDate, geometry (Polygon)
6. Spatial join: quais alertas intersectam o polígono do CAR?
```

### Formato dos dados

**WFS** (camada `dashboards:vw_v2_dashboard_alerts_all_defo-data_prod-mt`):
```json
{
  "idt_local_alert": 1470111,
  "qualification": "...",
  "area_m2": 12345.67,
  "area_ha": 1.23,
  "area_ha_tx": "1.23"
}
```

**Detalhe** (`/localAlerts/{id}`):
```json
{
  "alert": {
    "classType": "CUT",
    "alertDetectedDate": "2019-12-27T13:04:09",
    "geometry": { "type": "Polygon", "coordinates": [...] },
    "areaHa": 12.5,
    "city": "Cuiabá",
    "state": "MT"
  }
}
```

### Classes de alerta

| Classe | Descrição | Prioridade |
|--------|-----------|------------|
| `CUT` | Corte raso (desmatamento total) | 🔴 Alta |
| `SELECTIVE_EXTRACTION` | Extração seletiva | 🟠 Média |
| `DEGRADATION_SELECTIVE_CUT` | Degradação por corte seletivo | 🟠 Média |
| `BURN_SCAR` | Cicatriz de queimada | 🟡 Baixa |
| `MINERAL_EXTRACTION` | Extração mineral | 🔴 Alta |
| `DEGRADATION_CHEMICAL_AGENT` | Degradação química | 🔴 Alta |
| `FOCUS_OF_BURN` | Foco de calor | 🟡 Baixa |
| `LANDSLIDES` | Deslizamentos | 🟡 Baixa |
| `BLOW_DOWN` | Derrubada por vento | 🟡 Baixa |

### Parâmetros do viewparams

```
viewparams=
  userToken:'{userId}';
  orgToken:'597953b9-ee78-4113-80f9-803dbbaa60a0';
  fromDate:'2019-07-22';
  toDate:'{data_atual}';
  parentLocalType1:'STATE';
  classes:'CUT'\,'SELECTIVE_EXTRACTION'\,'DEGRADATION_SELECTIVE_CUT';
  inspectionFilter:'ALL'
```

### Desempenho testado

- Token: < 1s
- WFS com bbox 0.5°×0.5°: ~4s para 5 alertas
- Detalhe de 1 alerta: ~1s
- Paralelismo: 12 workers (configurável via `SCCON_HTTP_CONCURRENCY`)

---

## 3. WhatsApp (Baileys)

### Arquitetura

Mesmo padrão do SaldoPro:
- **Baileys** (`@whiskeysockets/baileys`) como cliente WhatsApp Web
- **1 número conectado** (do dono/admin)
- **Envio**: número do admin → número do usuário cadastrado
- **Persistência**: auth state salvo no SQLite
- **Reconexão**: automática em caso de queda

### Conexão

1. Admin acessa painel → "Conectar WhatsApp"
2. Backend gera QR Code via baileys
3. Admin escaneia com WhatsApp do celular
4. Sessão persiste no SQLite — reconecta automaticamente após restart

### Template da mensagem

```
🔔 *AlertaCAR — Novo alerta*

CAR: {numero_car}
🏷️ {classe_traduzida}
📅 {data_formatada}
📐 {area} ha

📍 {municipio} - MT

Acesse: alertacar.cursar.space
```

### Rate limiting

- Máx 1 msg por CAR por hora
- Máx 10 msgs por usuário por dia
- Agrupa múltiplos alertas do mesmo CAR na mesma execução

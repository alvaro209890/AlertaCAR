# Integrações — AlertaCAR

## 1. WFS da SEMA-MT

### Objetivo
Buscar o polígono oficial do CAR registrado na SEMA-MT. Esse polígono é usado para consultar a SCCON e também exibido no mapa do dashboard.

### URL Base
```
https://geoportal.sema.mt.gov.br/geoserver/SEMA/ows
```

### Método
WFS `GetFeature` 1.1.0. O GeoServer da SEMA tem várias camadas de CAR. A camada principal usada no GeoForest:

```
SEMA:limite_car_requerido
```

### Parâmetros da requisição

```
service=WFS
version=1.1.0
request=GetFeature
typeName=SEMA:limite_car_requerido
srsName=EPSG:4674
outputFormat=application/json
CQL_FILTER=cod_imovel='XXXXXXXXXX'
```

Onde `cod_imovel` é derivado do número do CAR.

### Pitfalls conhecidos (do GeoForest)

1. **INTERSECTS não é confiável**: Retorna subconjunto de features sem erro. Usar sempre `CQL_FILTER` por `cod_imovel` quando possível, ou BBOX.

2. **Paginação quebrada**: `startIndex` causa timeout. O GeoServer declara `PagingIsTransactionSafe=FALSE`. Fazer requisição única sem paginação.

3. **Timeout frequente**: O GeoServer da SEMA é lento. Implementar retry (3 tentativas) com backoff exponencial.

4. **SRID**: As features vêm em EPSG:4674 (SIRGAS 2000). Converter para EPSG:4326 (WGS84) via proj4js se necessário.

### Cache

- Polígono cacheado no SQLite por 30 dias
- Se falhar a consulta, mantém cache antigo (não invalida)
- Check manual via botão "Forçar verificação"

### Código de referência (GeoForest)

O GeoForest implementa essa integração em `backend/simcar-clip.ts` e `backend/wfs-intersection.ts`. Reutilizar a lógica de fetch WFS com fallback de timeout.

---

## 2. SCCON (AUAS)

### Objetivo
Detectar alertas de desmatamento e degradação emitidos pela SCCON (Sistema de Comercialização e Controle de Produtos de Origem Florestal) para os polígonos monitorados.

### O que é AUAS
AUAS = Análise Unificada de Alertas SCCON. É o método que o GeoForest usa/planeja usar para cruzar dados de alertas com os polígonos do CAR. A SCCON disponibiliza camadas WMS/WFS com alertas de desmatamento (PRODES, DETER) e degradação.

### Método (a confirmar na implementação)

Possíveis abordagens:
1. **WFS SCCON**: Se a SCCON tiver endpoint WFS público, consultar por BBOX do polígono do CAR
2. **API REST**: Se existir API REST da SCCON para consulta por coordenadas
3. **Download + clip local**: Baixar shapefiles de alertas e clipar localmente com Turf.js

A definir durante a Fase 3, reutilizando o conhecimento do GeoForest (AUAS×SCCON).

### Dados extraídos de cada alerta

| Campo | Descrição | Exemplo |
|-------|-----------|---------|
| `id` | Identificador único do alerta | `DETER_2026_07_12345` |
| `type` | Tipo do alerta | `desmatamento` / `degradacao` |
| `date` | Data da detecção | `2026-07-15` |
| `area_ha` | Área detectada (hectares) | `12.5` |
| `system` | Sistema de origem | `DETER` / `PRODES` |

### Detecção de novidade

- Salvar `id` do alerta SCCON na tabela `alerts`
- Na próxima consulta, comparar IDs — só criar registro se for novo
- Isso evita notificar o mesmo alerta duas vezes

### Frequência

- Cron diário às 06:00 (horário de Brasília)
- Forçar verificação manual via botão no dashboard

---

## 3. WhatsApp (Baileys)

### Objetivo
Enviar notificações de alertas diretamente no WhatsApp dos usuários cadastrados.

### Biblioteca
`@whiskeysockets/baileys` — cliente WhatsApp Web não-oficial, sem custo de API.

### Arquitetura

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Admin        │     │  Backend      │     │  WhatsApp     │
│  Escaneia QR  │────▶│  Baileys      │────▶│  WebSocket    │
│               │     │  Session      │     │               │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                     ┌──────▼───────┐
                     │  Fila de msg  │
                     │  (em memória) │
                     └──────┬───────┘
                            │
              ┌─────────────▼──────────────┐
              │  Para cada alerta:          │
              │  - Número do usuário        │
              │  - Template formatado       │
              │  - Enviar via baileys       │
              │  - Registrar no log         │
              └────────────────────────────┘
```

### Número de WhatsApp

- **Apenas 1 número** conectado: o do dono/admin (você)
- Todas as notificações são enviadas DESTE número PARA o número do usuário
- O usuário cadastra o número dele no ato do registro

### Persistência da sessão

- Auth state do baileys salvo no SQLite (`whatsapp_sessions.creds_json`)
- Em reinicialização, tenta reconectar com credenciais existentes (sem QR Code)
- Se falhar, gera novo QR Code (admin precisa escanear de novo)

### Reconexão automática

- `connection.update` handler escuta por `close` e `connection.update`
- Em caso de desconexão, tenta reconectar automaticamente
- Se falhar após N tentativas, notifica admin para escanear QR novamente

### Template da mensagem

```
🔔 *AlertaCAR — Novo alerta detectado*

CAR: {car_number}
Tipo: {type} ({system})
Data: {date}
Área: {area_ha} ha

Acesse o dashboard para mais detalhes:
alertacar.cursar.space
```

### Rate limiting

- Máximo de 1 mensagem por CAR por hora
- Máximo de 10 mensagens por usuário por dia
- Evita spam se houver muitos alertas de uma vez
- Agrupar múltiplos alertas do mesmo CAR em uma mensagem se detectados na mesma execução

### Referência de implementação

O SaldoPro (`/media/server/HD Backup/Servidores_NAO_MEXA/SaldoPro/backend/`) implementa o mesmo padrão com baileys. Reutilizar a lógica de conexão, QR Code e envio de mensagens.

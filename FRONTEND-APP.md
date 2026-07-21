# Frontend — App do Usuário

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS + shadcn/ui (mesmo padrão GeoForest)
- Auth local: email/senha → JWT no localStorage
- Wouter (roteamento leve)
- Leaflet + react-leaflet (mapa)
- Sonner (toast notifications)
- Recharts (gráficos de timeline)
- file-saver + jszip (downloads)

## Design System

### Tema
- **Dark mode por padrão** (background: `#0a0f0d`, cards: glass/`rgba(255,255,255,0.03)`)
- **Paleta**:
  - Primary: emerald-500 (#10b981)
  - Alertas: red-500 (#ef4444), amber-500 (#f59e0b)
  - Texto: slate-100 (claro), slate-400 (secundário)
  - Cards: `bg-slate-900/40 backdrop-blur-md border border-slate-800/50`

### Tipografia
- Headings: `font-bold tracking-tight`
- Dados: `font-mono` para números (CAR, área)
- Badges: `text-xs font-medium uppercase tracking-wider`

### Componentes padrão
- **Cards**: `rounded-2xl shadow-lg hover:shadow-xl transition-shadow`
- **Botões**: `bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.97] transition-all`
- **Inputs**: `bg-slate-800 border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/20`
- **Badges**: `px-2.5 py-0.5 rounded-full text-xs font-semibold`

---

## Páginas

### 1. Login (`/login`)

```
┌──────────────────────────────────────┐
│                                      │
│         🌿 AlertaCAR                │
│    Monitore seus CARs sem sair       │
│         do WhatsApp                  │
│                                      │
│  ┌──────────────────────────────┐    │
│  │  Email                        │    │
│  │  ┌──────────────────────────┐ │    │
│  │  │ joao@email.com           │ │    │
│  │  └──────────────────────────┘ │    │
│  │  Senha                        │    │
│  │  ┌──────────────────────────┐ │    │
│  │  │ ••••••••                  │ │    │
│  │  └──────────────────────────┘ │    │
│  │                                │    │
│  │  [ Entrar ]                    │    │
│  │                                │    │
│  │  Não tem conta? Cadastre-se →  │    │
│  └──────────────────────────────┘    │
│                                      │
└──────────────────────────────────────┘
```

### 2. Cadastro (`/register`)

Campos:
- Nome completo
- Email
- Senha (com confirmação)
- **WhatsApp** (`+55XXXXXXXXXXX`) — obrigatório, com máscara
- Checkbox "Li e aceito os termos"

---

### 3. Dashboard (`/dashboard`)

```
┌──────────────────────────────────────────────────────────┐
│  👤 Álvaro                            [ + Adicionar CAR ]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ 🌿 CARs  │ │ 📐 Área   │ │ 🔔 Alertas│ │ 🕐 Último  │  │
│  │    4     │ │ 846 ha   │ │    12    │ │ check: 2h  │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
│                                                          │
│  Seus CARs monitorados                                   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🔵 MT27827/2017              [🔍] [📋] [✕]        │  │
│  │ 📍 Cuiabá - MT  •  📐 2.847 ha                    │  │
│  │ 🕐 Último check: 2h atrás                          │  │
│  │ 🔴 3 novos alertas  |  🟠 1 embargo               │  │
│  │ ░░░░░░░░ Timeline resumida (últimos 3 alertas)     │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 🟢 MT8019/2017               [🔍] [📋] [✕]        │  │
│  │ 📍 Várzea Grande - MT  •  📐 156.3 ha             │  │
│  │ 🕐 Último check: 2h atrás                          │  │
│  │ ✅ Nenhum alerta novo                              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ⚡ Dica: Clique no card para ver detalhes completos      │
└──────────────────────────────────────────────────────────┘
```

**Ações em cada card (hover):**
- 🔍 **Verificar agora** → POST /sccon/check/:id (força consulta SCCON)
- 📋 **Ver alertas** → expande timeline inline ou abre página de detalhes
- ✕ **Remover** → soft delete com confirmação

**Mini-timeline inline no card** (últimos 3 alertas):
- 🔴 CUT — 15/07/2026 — 12.5 ha
- 🟠 DEGRADATION — 10/06/2026 — 3.2 ha
- 🟡 BURN_SCAR — 05/05/2026 — 8.1 ha
- ... [Ver todos os 47 alertas →]

**Estado do card baseado em alertas:**
- 🔴 Borda red pulsante: alertas críticos novos (CUT, MINERAL_EXTRACTION nas últimas 24h)
- 🟠 Borda amber: alertas de atenção (DEGRADATION, BURN_SCAR recentes)
- 🟢 Borda emerald sutil: tudo ok, badge "Monitorado ✅"

### 4. Adicionar CAR (modal ou `/dashboard/add`)

```
┌──────────────────────────────────────┐
│  Adicionar novo imóvel                │
│                                       │
│  Como deseja identificar seu imóvel?  │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ ● Número do CAR (recomendado)    │  │
│  │   ┌───────────────────────────┐ │  │
│  │   │ MT-271442/2026            │ │  │
│  │   └───────────────────────────┘ │  │
│  │                                  │  │
│  │ ○ Matrícula do imóvel            │  │
│  │   ┌──────────────────────────┐   │  │
│  │   │ 12345 - Cartório XYZ     │   │  │
│  │   └──────────────────────────┘   │  │
│  │                                  │  │
│  │ ○ Coordenadas (lat/lng)          │  │
│  │   ┌──────────┐ ┌──────────┐     │  │
│  │   │ -15.601  │ │ -56.098  │     │  │
│  │   └──────────┘ └──────────┘     │  │
│  │   [📍 Abrir mapa para selecionar]│  │
│  └─────────────────────────────────┘  │
│                                       │
│  Apelido (opcional):                   │
│  ┌─────────────────────────────────┐  │
│  │ Fazenda São João               │  │
│  └─────────────────────────────────┘  │
│                                       │
│  [ Buscar dados na SEMA ]             │
│                                       │
│  ⏳ Buscando dados...                  │
│                                       │
│  ┌─ Resultado encontrado ──────────┐  │
│  │ ✅ CAR MT27827/2017              │  │
│  │ 📍 Cuiabá - MT                   │  │
│  │ 📐 2.847,32 hectares             │  │
│  │ 📋 Status: Ativo                 │  │
│  │ 🗺️ Polígono: disponível WFS      │  │
│  │                                   │  │
│  │ [✓ Confirmar monitoramento]      │  │
│  └──────────────────────────────────┘  │
└──────────────────────────────────────┘
```

**3 modos de cadastro:**
1. **Nº CAR** (principal): busca WFS automática → polígono + área + município
2. **Matrícula**: busca cartorial futura (fase 4+)
3. **Coordenadas**: mapa interativo para clicar/desenhar o polígono manualmente

---

### 5. Detalhes do CAR (`/dashboard/cars/:id`) ⭐ NOVA

**A página mais rica do app.** Layout com abas laterais (ou tabs superiores):

```
┌──────────────────────────────────────────────────────────────┐
│  ← Voltar                                                    │
│                                                              │
│  🏷️ MT27827/2017                                             │
│  📍 Cuiabá, MT  •  📐 2.847,32 ha  •  📋 Status: Ativo      │
│  🕐 Última verificação: 21/07/2026 06:00                     │
│                                                              │
│  [🔄 Forçar verificação] [📥 Baixar polígono] [📄 Relatório] │
│                                                              │
├────────────┬─────────────────────────────────────────────────┤
│  Abas      │  Conteúdo da aba selecionada                     │
│            │                                                  │
│  📊 Visão  │  (ver abaixo)                                    │
│    Geral   │                                                  │
│            │                                                  │
│  🔔        │                                                  │
│  Alertas   │                                                  │
│            │                                                  │
│  🗺️        │                                                  │
│  Mapa      │                                                  │
│            │                                                  │
│  🛰️        │                                                  │
│  Satélite  │                                                  │
│            │                                                  │
│  📄        │                                                  │
│  Documen-  │                                                  │
│  tos       │                                                  │
│            │                                                  │
│  ⚙️        │                                                  │
│  Config    │                                                  │
└────────────┴─────────────────────────────────────────────────┘
```

#### Aba 1: 📊 Visão Geral

```
┌──────────────────────────────────────────────────────────────┐
│  Resumo da propriedade                                        │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────┐ │
│  │ 🔴 Corte    │ │ 🟠 Degrad.  │ │ 🟡 Queimada │ │ 🟢 OK  │ │
│  │ Raso        │ │ Seletiva    │ │             │ │         │ │
│  │   23        │ │    12       │ │     8       │ │ últ 30d│ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────┘ │
│                                                              │
│  📈 Timeline de atividade (últimos 12 meses)                  │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  ██                                                       ││
│  │  ██ ██    ██                                              ││
│  │  ██ ██ ██ ██ ██    ██ ██                                  ││
│  │  ██ ██ ██ ██ ██ ██ ██ ██ ██    ██                         ││
│  │  Jan Fev Mar Abr Mai Jun Jul Ago Set Out Nov Dez          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  📋 Status das integrações:                                  │
│  ✅ SCCON (último: 21/07 06:00) • 47 alertas totais          │
│  ⏳ Embargos SEMA (em breve)                                  │
│  ⏳ Licenciamento (em breve)                                   │
│  ⏳ Fundiário (em breve)                                      │
│                                                              │
│  📱 Notificações WhatsApp:                                   │
│  ● Conectado (+55 65 99999-8888)                             │
│  12 alertas enviados  •  3 pendentes                          │
│                                                              │
│  [📥 Exportar dados (CSV)] [📄 Gerar relatório PDF]          │
└──────────────────────────────────────────────────────────────┘
```

#### Aba 2: 🔔 Alertas (Timeline completa)

```
┌──────────────────────────────────────────────────────────────┐
│  Filtros: [Todos ▼] [🔴 CUT] [🟠 DEGRAD] [🟡 BURN] [...]   │
│  Período: [Últimos 30 dias ▼]  Ordenar: [Mais recente ▼]    │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 🔴 21/07/2026 — Desmatamento — Corte Raso                ││
│  │ 📍 -15.601, -56.098  •  📐 12.5 ha                      ││
│  │ 🆔 SCCON #458932  •  📱 WhatsApp: ✅ Enviado 08:32       ││
│  │                                                          ││
│  │ ░░░░░░░░░░░░ Mapa pequeno do polígono do alerta ░░░░░░░░ ││
│  │                                                          ││
│  │ [🗺️ Ver no mapa] [📥 Baixar GeoJSON] [📋 Copiar coords] ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 🟠 15/06/2026 — Degradação — Extração Seletiva           ││
│  │ 📐 3.2 ha  •  🆔 SCCON #451203  •  📱 ✅ Enviado        ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 🟡 10/05/2026 — Queimada — Cicatriz de Queimada          ││
│  │ 📐 8.1 ha  •  🆔 SCCON #449871  •  📱 ✅ Enviado        ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ... + 44 alertas anteriores                                 │
│                                                              │
│  [📥 Exportar todos (CSV)] [📥 Exportar todos (GeoJSON)]     │
└──────────────────────────────────────────────────────────────┘
```

**Features da timeline:**
- Cada alerta é expansível (clique → mostra mini-mapa + detalhes)
- Badge de status WhatsApp (✅ enviado, ⏳ pendente, ❌ falhou)
- Botão individual para baixar geometria do alerta (GeoJSON)
- Paginação infinita (scroll → carrega mais)

#### Aba 3: 🗺️ Mapa Interativo

```
┌──────────────────────────────────────────────────────────────┐
│  Camadas: [☑ Satélite] [☑ Polígono CAR] [☑ Alertas] [...] │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                                                          ││
│  │                    MAPA LEAFLET                          ││
│  │                    Full-width                             ││
│  │                                                          ││
│  │  ┌──────────────────┐                                    ││
│  │  │  Polígono CAR    │   🔴 🔴                             ││
│  │  │  (emerald, 15%)  │   🟠                               ││
│  │  │                  │        🔴                          ││
│  │  │     🟡           │                                    ││
│  │  │           🔴     │                                    ││
│  │  └──────────────────┘                                    ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  Legenda:                                                    │
│  🟩 Polígono CAR  •  🔴 CUT  •  🟠 DEGRAD  •  🟡 BURN      │
│                                                              │
│  Ao clicar num marcador de alerta → popup:                   │
│  ┌─────────────────────┐                                     │
│  │ 🔴 Corte Raso        │                                     │
│  │ 📅 21/07/2026        │                                     │
│  │ 📐 12.5 ha           │                                     │
│  │ [Ver detalhes →]     │                                     │
│  └─────────────────────┘                                     │
│                                                              │
│  [📥 Baixar polígono (Shapefile .zip)]                         │
└──────────────────────────────────────────────────────────────┘
```

**Features do mapa:**
- Controle de camadas (toggle): satélite, relevo, político
- Polígono do CAR sempre visível como overlay base
- Alertas como CircleMarkers coloridos (cluster acima de 50)
- Popup com dados resumidos ao clicar
- Mini-mapa no canto (overview)
- Botão "Zoom to CAR" / "Zoom to alerts"
- Ferramenta de medição (distância e área)

#### Aba 4: 🛰️ Satélite (Linha do Tempo Visual) ⭐⭐

**A aba mais poderosa do app.** A SEMA-MT disponibiliza via GeoServer WMS décadas de imagens de satélite:

| Satélite | Período | Resolução | Bandas |
|----------|---------|-----------|--------|
| Landsat 5 | 1984-2011 (28 anos) | 30m | RGB + NIR |
| Landsat 7 | 2002 | 30m | RGB + NIR |
| Landsat 8 | 2013-2018 | 15-30m | RGB + NIR + PAN |
| Sentinel-2 | 2016-2025 (10 anos) | 10m | RGB + NIR (índice NDVI) |
| SPOT | Mosaico estadual | 5m | RGB |
| RESOURCESAT | 2012 | 23m | RGB |

**Total: 43 camadas WMS de satélite** disponíveis no GeoServer da SEMA.

##### 🎞️ Modo Timelapse

```
┌──────────────────────────────────────────────────────────────┐
│  🎞️ Timelapse — MT27827/2017                                 │
│                                                              │
│  Satélite: [Sentinel-2 ▼]  Período: [2016 ▼] a [2025 ▼]    │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                                                          ││
│  │              ░░░░  MAPA PRINCIPAL  ░░░░                  ││
│  │                                                          ││
│  │      Satélite atual: Sentinel-2 2024                     ││
│  │      Resolução: 10m/pixel                                ││
│  │                                                          ││
│  │  ┌──────────────────────────────────┐                    ││
│  │  │ Polígono CAR sobreposto          │                    ││
│  │  │ (borda emerald, fill 15%)       │                    ││
│  │  └──────────────────────────────────┘                    ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ⏮️ ◀️ ▶️ ⏭️   Ano: 2024                                     │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Timeline de miniaturas (2016-2025)                       ││
│  │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        ││
│  │ │2016 │ │2017 │ │2018 │ │2019 │ │2020 │ │2021 │ ...     ││
│  │ │ 🟩  │ │ 🟩  │ │🟩🟫 │ │🟩🟫 │ │🟫🟫 │ │🟫🟫 │        ││
│  │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘        ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  🎬 [▶️ Reproduzir animação (2 fps)]                         │
│  📥 [Baixar GIF animado] [Baixar frame atual (PNG)]          │
└──────────────────────────────────────────────────────────────┘
```

**Player de timelapse:**
- Slider de anos: arrasta para esquerda/direita
- Botões ⏮️ ◀️ ▶️ ⏭️ para navegar ano a ano
- ▶️ Reproduzir: animação automática (1-5 fps configurável)
- Miniaturas abaixo: preview de cada ano, clique para pular
- **Indicador visual**: a miniatura muda de cor quando há desmatamento visível (verde→marrom)
- Detecção automática: se o alerta SCCON tem data X, destaca os anos próximos

##### 🔬 Modo Comparação (Split View)

```
┌──────────────────────────────────────────────────────────────┐
│  🔬 Comparar — Antes vs Depois                               │
│                                                              │
│  ┌──────────────────────┬──────────────────────────────────┐ │
│  │   ANTES              │   DEPOIS                          │ │
│  │   Satélite:          │   Satélite:                       │ │
│  │   [Landsat 8 ▼]     │   [Sentinel-2 ▼]                 │ │
│  │   Ano: [2017 ▼]     │   Ano: [2025 ▼]                  │ │
│  │                      │                                   │ │
│  │  ┌────────────────┐  │  ┌────────────────────────────┐  │ │
│  │  │                │  │  │                            │  │ │
│  │  │  🟩🟩🟩🟩🟩🟩 │  │  │  🟩🟩🟫🟫🟫🟩🟩            │  │ │
│  │  │  🟩🟩🟩🟩🟩🟩 │  │  │  🟩🟫🟫🟫🟫🟫🟩            │  │ │
│  │  │  🟩🟩🟩🟩🟩🟩 │  │  │  🟩🟩🟫🟫🟫🟩🟩            │  │ │
│  │  │                │  │  │                            │  │ │
│  │  └────────────────┘  │  └────────────────────────────┘  │ │
│  └──────────────────────┴──────────────────────────────────┘ │
│                                                              │
│  ◄━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━►  (slider arrastável) │
│                                                              │
│  📊 Diferença detectada: 12.5 ha de desmate                  │
│  📅 Período: 2017 → 2025 (8 anos)                           │
│  📈 Taxa: 1.56 ha/ano                                        │
│                                                              │
│  [📸 Salvar comparação (PNG)]  [📥 Baixar ambas imagens]     │
└──────────────────────────────────────────────────────────────┘
```

**Split view:**
- Slider vertical/horizontal arrastável para revelar antes/depois
- Satélites diferentes em cada lado (ex: Landsat vs Sentinel)
- Anos diferentes em cada lado
- Sincronização de zoom/pan entre os dois mapas

##### 🌿 Modo NDVI (Índice de Vegetação)

```
┌──────────────────────────────────────────────────────────────┐
│  🌿 NDVI — Índice de Vegetação por Diferença Normalizada     │
│                                                              │
│  Satélite: [Sentinel-2 NIR ▼]  Ano: [2024 ▼]                │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              ░░░░  MAPA NDVI  ░░░░                        ││
│  │                                                          ││
│  │  Escala:                                                  ││
│  │  🔴 -1.0 (água/solo exposto)                              ││
│  │  🟠 -0.2 (vegetação rala)                                 ││
│  │  🟡  0.2 (pastagem)                                       ││
│  │  🟢  0.5 (vegetação densa)                                ││
│  │  🟩  0.8+ (floresta preservada)                           ││
│  │                                                          ││
│  │  ┌──────────────────────────────────┐                    ││
│  │  │ Área desmatada: NDVI caiu de     │                    ││
│  │  │ 0.72 → 0.15 entre 2023 e 2024   │                    ││
│  │  └──────────────────────────────────┘                    ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  📈 Gráfico de tendência NDVI:                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 0.8┤     ●──●──●                                         ││
│  │ 0.6┤                ●──●                                 ││
│  │ 0.4┤                      ●                              ││
│  │ 0.2┤                          ●──●──●                    ││
│  │ 0.0┤                                                    ││
│  │    2016  2018  2020  2022  2024  2026                    ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  📊 Estatísticas:                                            │
│  NDVI médio 2024: 0.42  |  NDVI médio 2016: 0.68            │
│  Perda de vegetação: 38% em 8 anos                           │
│                                                              │
│  [📥 Exportar dados NDVI (CSV)]  [📊 Gerar laudo técnico]    │
└──────────────────────────────────────────────────────────────┘
```

**NDVI usa as camadas NIR (infravermelho próximo):**
- `Mosaicos:Geoportal_Sentinel_2_20XX_NIR` (2016-2025)
- Cálculo: NDVI = (NIR - RED) / (NIR + RED)
- Visualização em falsa-cor (gradiente vermelho→verde)
- Gráfico de tendência ao longo dos anos
- Estatísticas por polígono do CAR

##### 🗺️ Multi-camada (Overlay)

```
┌──────────────────────────────────────────────────────────────┐
│  🗺️ Overlay de camadas                                       │
│                                                              │
│  ☑ Satélite base: Sentinel-2 2024                           │
│  ☑ Polígono do CAR (emerald, 20%)                           │
│  ☑ Alertas SCCON (marcadores coloridos)                     │
│  ☐ Embargos SEMA (hachura vermelha)                         │
│  ☐ Terras Indígenas (hachura laranja)                       │
│  ☐ Unidades de Conservação (hachura verde)                  │
│  ☐ Assentamentos INCRA (hachura azul)                       │
│  ☐ Desmatamento histórico SEMA (2012-2018)                  │
│  ☐ Autorizações de desmate (polígonos amarelos)             │
│                                                              │
│  Transparência do overlay: ████████░░ 80%                    │
│                                                              │
│  [🔄 Atualizar mapa]  [📸 Salvar visualização]               │
└──────────────────────────────────────────────────────────────┘
```

##### 📥 Downloads da aba Satélite

| Recurso | Formato | Descrição |
|---------|---------|-----------|
| Frame atual | PNG, GeoTIFF | Imagem de satélite com polígono sobreposto |
| Timelapse | GIF, MP4 | Animação dos anos selecionados |
| Comparação | PNG | Imagem lado a lado com slider |
| NDVI | PNG, CSV | Mapa NDVI + dados numéricos |
| Laudo técnico | PDF | Relatório com imagens, NDVI, análise de desmate |

##### 🧠 Análise Inteligente (Futuro)

```
┌──────────────────────────────────────────────────────────────┐
│  🤖 Análise automática de desmatamento                        │
│                                                              │
│  Comparando: Sentinel-2 2023 vs 2024                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 🔴 Áreas com perda de vegetação: 3 polígonos             ││
│  │    ▸ Polígono A: 8.2 ha (NDVI: 0.71 → 0.12)             ││
│  │    ▸ Polígono B: 3.1 ha (NDVI: 0.65 → 0.18)             ││
│  │    ▸ Polígono C: 1.2 ha (NDVI: 0.58 → 0.22)             ││
│  │                                                          ││
│  │ 🟢 Áreas com regeneração: 1 polígono                     ││
│  │    ▸ Polígono D: 0.8 ha (NDVI: 0.15 → 0.41)             ││
│  │                                                          ││
│  │ 📊 Total desmatado: 12.5 ha | Regenerado: 0.8 ha         ││
│  │ 📅 Período analisado: 01/2023 a 12/2024                  ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ⚠️ Disclaimer: Análise preliminar. Consulte engenheiro      │
│  florestal para laudo oficial.                               │
└──────────────────────────────────────────────────────────────┘
```

Algoritmo: diferença de NDVI entre dois anos, threshold de 0.3, clusterização dos pixels alterados, cálculo de área.

---

### 8. Página de Análise Temporal (`/dashboard/timelapse/:id`) 🆕

Página dedicada para análise histórica completa:

```
┌──────────────────────────────────────────────────────────────┐
│  📅 Análise Temporal — Fazenda São João (MT27827/2017)       │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 📊 Dashboard de desmatamento histórico                    ││
│  │                                                          ││
│  │  ┌──────────────────────────────────────────────────┐   ││
│  │  │ Gráfico: Área desmatada por ano (ha)              │   ││
│  │  │                                                    │   ││
│  │  │  ██                                                │   ││
│  │  │  ██ ██    ██                                       │   ││
│  │  │  ██ ██ ██ ██ ██    ██ ██ ████                     │   ││
│  │  │  16 17 18 19 20 21 22 23 24 25                    │   ││
│  │  └──────────────────────────────────────────────────┘   ││
│  │                                                          ││
│  │  ┌──────────────────────┐ ┌────────────────────────────┐ ││
│  │  │ 🏆 Recordes          │ │ 📈 Tendência                │ ││
│  │  │ Maior desmate: 2024  │ │ ↑ Acelerando                │ ││
│  │  │ 12.5 ha              │ │ Média: 5.2 ha/ano           │ ││
│  │  │ Menor: 2017 (0 ha)   │ │ Projeção 2026: ~18 ha       │ ││
│  │  └──────────────────────┘ └────────────────────────────┘ ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 🛰️ Satélite: Sentinel-2 | Linha do tempo 2016-2025      ││
│  │                                                          ││
│  │  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐              ││
│  │  │ 2016 ││ 2018 ││ 2020 ││ 2022 ││ 2024 │ ...          ││
│  │  │🟩🟩🟩││🟩🟩🟩││🟩🟫🟩││🟫🟫🟩││🟫🟫🟫│              ││
│  │  │🟩🟩🟩││🟩🟩🟩││🟩🟫🟫││🟫🟫🟫││🟫🟫🟫│              ││
│  │  └──────┘└──────┘└──────┘└──────┘└──────┘              ││
│  │  Click em qualquer ano para ampliar                      ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 📋 Linha do tempo de eventos                              ││
│  │                                                          ││
│  │  2016 ─── CAR cadastrado (3.200 ha)                      ││
│  │  2018 ─── 🟡 2.1 ha queimada (BURN_SCAR)                ││
│  │  2019 ─── 🔴 5.3 ha desmate (CUT) detectado             ││
│  │  2020 ─── 🟠 1.8 ha degradação                          ││
│  │  2021 ─── ✅ ano sem ocorrências                         ││
│  │  2022 ─── 🔴 8.7 ha desmate (CUT) detectado             ││
│  │  2023 ─── 🟡 4.2 ha queimada                            ││
│  │  2024 ─── 🔴🔴 12.5 ha + 3.2 ha desmate                ││
│  │  2025 ─── 🔴 6.1 ha desmate (até julho)                ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  [📄 Gerar Laudo Histórico (PDF)]  [📥 Exportar dados]       │
└──────────────────────────────────────────────────────────────┘
```

---

### 9. Widget de Satélite no Dashboard 🆕

Mini-visualização inline nos cards do dashboard:

```
┌────────────────────────────────────────────────────────────┐
│  🔵 MT27827/2017                                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌─────┐ │  │
│  │ │🟩 2020 │→│🟩 2021 │→│🟫 2022 │→│🟫 2023 │→│🟫24 │ │  │
│  │ └────────┘ └────────┘ └────────┘ └────────┘ └─────┘ │  │
│  │ ░░░░░░ Mini timelapse (5 anos recentes) ░░░░░░░░░░░░ │  │
│  └──────────────────────────────────────────────────────┘  │
│  📍 Cuiabá - MT  •  📐 2.847 ha  •  🔴 3 novos          │
│  [🔍 Verificar] [📋 Alertas] [🛰️ Satélite] [✕]         │
└────────────────────────────────────────────────────────────┘
```

---

### 10. Novas Rotas de Satélite (Backend)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cars/:id/satellite/capabilities` | Listar satélites e anos disponíveis |
| GET | `/api/cars/:id/satellite/timelapse?sat=sentinel&from=2016&to=2025` | Gerar GIF animado |
| GET | `/api/cars/:id/satellite/compare?sat1=landsat8&year1=2017&sat2=sentinel&year2=2024` | Imagem split-view |
| GET | `/api/cars/:id/satellite/ndvi?year=2024` | Mapa NDVI + dados |
| GET | `/api/cars/:id/satellite/frame?sat=sentinel&year=2024&format=png` | Frame único |
| GET | `/api/cars/:id/satellite/analysis?from=2023&to=2024` | Análise automática de mudança |

#### Aba 5: 📄 Documentos

```
┌──────────────────────────────────────────────────────────────┐
│  Documentos da propriedade                                    │
│                                                              │
│  📋 CAR (Cadastro Ambiental Rural)                            │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 📄 MT27827/2017 — Nº estadual                            ││
│  │ 📄 MT-5103402-XXXX — CAR Federal                         ││
│  │ 📅 Última atualização: 15/03/2024                        ││
│  │ [📥 Baixar extrato CAR (PDF)]  [🔗 Ver no SICAR]        ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  📋 Licenças Ambientais                                      │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ⏳ Nenhuma licença ativa detectada                       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  📋 Autos e Embargos                                         │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ⏳ Nenhum auto/embargo detectado                         ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  [📄 Gerar relatório completo (PDF)]                         │
│  Inclui: dados cadastrais, alertas SCCON, mapa, documentos   │
└──────────────────────────────────────────────────────────────┘
```

#### Aba 6: ⚙️ Configurações do CAR

```
┌──────────────────────────────────────────────────────────────┐
│  Configurações deste CAR                                      │
│                                                              │
│  Apelido:                                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Fazenda São João                                     │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Notificações:                                                │
│  ☑ Alertas críticos (CUT, MINERAL_EXTRACTION) — Imediato     │
│  ☑ Degradação (SELECTIVE_EXTRACTION) — Resumo diário         │
│  ☐ Queimadas (BURN_SCAR)                                     │
│  ☐ Abertura de acesso (ACCESS, AIRSTRIP)                     │
│                                                              │
│  Frequência de verificação:                                   │
│  ○ Diária (recomendado)                                       │
│  ○ Semanal                                                    │
│  ○ Manual (apenas quando eu solicitar)                       │
│                                                              │
│  ⚠️ Zona de perigo                                            │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [🗑️ Remover este CAR do monitoramento]              │    │
│  │ Esta ação não pode ser desfeita.                      │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

### 6. Perfil (`/dashboard/profile`)

- Avatar (iniciais)
- Nome, email
- WhatsApp (editável, com verificação)
- Estatísticas: CARs ativos, total alertas, área total monitorada
- Preferências de notificação globais
- Botão "Excluir conta" (com dupla confirmação + senha)

---

### 7. Onboarding / Tour guiado (primeiro acesso) 🆕

```
┌──────────────────────────────────────────────────────┐
│  Bem-vindo ao AlertaCAR! 🎉                           │
│                                                      │
│  Vamos monitorar sua primeira propriedade em 3 passos │
│                                                      │
│  Passo 1/3: Adicione seu CAR                         │
│  ┌──────────────────────────────────────────────┐    │
│  │ Digite o número do CAR (ex: MT271442/2017)   │    │
│  │ ┌──────────────────────────────────────────┐ │    │
│  │ │                                          │ │    │
│  │ └──────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  [Pular tour]              [Próximo →]               │
└──────────────────────────────────────────────────────┘
```

3 passos:
1. Adicionar primeiro CAR
2. Conferir o dashboard
3. Ativar notificações WhatsApp (quando disponível)

---

## Sistema de Downloads 📥 🆕

### Formatos disponíveis

| Recurso | Formatos | Rota |
|---------|----------|------|
| Polígono do CAR | Shapefile (.zip) | `GET /api/cars/:id/export?format=shp` |
| Alertas (todos) | CSV, GeoJSON, JSON | `GET /api/cars/:id/alerts/export?format=csv\|geojson\|json` |
| Alerta individual | GeoJSON | Botão no card do alerta |
| Relatório completo | PDF, HTML | `GET /api/cars/:id/report?format=pdf\|html` |
| Imagem satélite | PNG (GeoTIFF no futuro) | `GET /api/cars/:id/satellite?date=2026-07-21` |

### UI de download
- Dropdown "📥 Baixar" em cada seção relevante
- Opções: Shapefile (.zip) | CSV | PDF
- Download inicia automaticamente (sem popup extra)
- Toast "✅ Arquivo baixado: CAR_MT27827.zip"

---

## Mapa (Leaflet)

```tsx
// No detalhe do CAR
<MapContainer center={[-15.6, -56.1]} zoom={13}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  
  {/* Polígono do CAR */}
  <GeoJSON 
    data={carPolygon} 
    style={{ color: '#10b981', fillOpacity: 0.15, weight: 2 }}
  />
  
  {/* Alertas SCCON como círculos */}
  {alerts.map(alert => (
    <CircleMarker
      key={alert.id}
      center={centroid(alert.geometry)}
      color={alertClassColor(alert.classType)}
      radius={8}
    >
      <Popup>{alert.classType} - {alert.areaHa}ha</Popup>
    </CircleMarker>
  ))}
  
  {/* Controle de camadas */}
  <LayersControl>
    <BaseLayer checked name="Satélite"><TileLayer url="..." /></BaseLayer>
    <BaseLayer name="OpenStreetMap"><TileLayer url="..." /></BaseLayer>
    <Overlay name="Polígono CAR"><GeoJSON .../></Overlay>
    <Overlay name="Alertas SCCON"><AlertasLayer .../></Overlay>
  </LayersControl>
</MapContainer>
```

---

## Sistema de Relatórios 📄 🆕

### Relatório PDF da propriedade

Gerado no backend e baixado pelo frontend. Conteúdo:

```
Página 1: Capa
  - Nome da propriedade / CAR
  - Data do relatório
  - Logo AlertaCAR

Página 2: Resumo
  - Dados cadastrais (área, município, status)
  - Mapa do polígono (imagem estática)
  - Resumo de alertas (gráfico de barras)

Página 3+: Timeline de alertas
  - Lista cronológica com classe, data, área
  - Pequeno mapa de cada alerta

Última página: Recomendações
  - "Procure um engenheiro florestal"
  - "Regularize seu CAR no SICAR"
  - Contato do admin (whatsapp)
```

Template HTML → Puppeteer/Playwright → PDF. Ou alternativa: jsPDF no frontend.

### Relatório rápido (CSV)

Download instantâneo da listagem de alertas:
```csv
data,classe,area_ha,latitude,longitude,whatsapp_enviado
2026-07-21,CUT,12.5,-15.601,-56.098,sim
2026-06-15,DEGRADATION_SELECTIVE_CUT,3.2,-15.603,-56.095,sim
```

---

## Notificações no Browser 🔔 🆕

Além do WhatsApp, notificações push no navegador:

```
┌─────────────────────────────────────────┐
│  🌿 AlertaCAR                            │
│  ┌─────────────────────────────────────┐│
│  │ 🔴 Novo alerta: MT27827/2017       ││
│  │ Desmatamento - Corte Raso           ││
│  │ 12.5 ha detectados em 21/07        ││
│  └─────────────────────────────────────┘│
│  [Ver detalhes]                         │
└─────────────────────────────────────────┘
```

- Service Worker para notificações mesmo com aba fechada
- Permission request no primeiro login
- Opção "Notificar também no navegador" nas configs

---

## Estados de UI (todos os componentes)

| Estado | Comportamento |
|--------|---------------|
| **Loading** | Skeleton cards com shimmer animation |
| **Empty** | Ilustração SVG + "Você ainda não monitora nenhum CAR" + CTA |
| **Error** | Banner com ícone, mensagem, botão "Tentar novamente" |
| **Success** | Dados renderizados com fade-in |
| **Downloading** | Spinner no botão, toast ao concluir |
| **Checking** | Botão "⏳ Verificando..." com animação de pulso |
| **Offline** | Banner no topo "Sem conexão. Dados do cache." |

---

## Responsividade

- **Mobile**: cards em lista vertical, sidebar vira bottom nav
- **Tablet/Desktop**: grid de 2-3 colunas para CARs
- **Mapa**: altura fixa 400px, ocupa largura total
- **Aba de detalhes**: tabs horizontais no mobile, sidebar no desktop

---

## Performance

- **Code splitting**: cada aba do detalhe = lazy import
- **Mapa**: só carrega Leaflet na aba Mapa
- **Cache**: SWR/stale-while-revalidate para lista de CARs
- **Otimização de imagens**: thumbnails WebP para mapas estáticos

---

---

# 🆕 Telas novas do cliente (consultor / eng. florestal)

> Estas seções cobrem as funcionalidades adicionadas no plano ampliado (Fases 5–11).
> Persona: consultor que gerencia **carteiras** de imóveis. Tudo grátis, GIS-first, com IA de apoio.

## A. Carteira / Portfólio (`/dashboard` repensado) 📂

O dashboard deixa de ser "lista de CARs" e vira **gestão de carteira**. Dois modos: **Cards** e **Tabela**.

```
┌──────────────────────────────────────────────────────────────────┐
│  👤 Consultor            [🔍 Buscar Ctrl+K]   [+ Importar] [+ CAR]│
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────────┐  │
│  │🌿 Imóveis│ │📐 Área   │ │🔴 Risco  │ │🔔 Alertas│ │🕐 Último  │  │
│  │   127    │ │ 84.6k ha│ │ 8 altos │ │   312    │ │ check: 6h  │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └────────────┘  │
│                                                                  │
│  Filtros: [Cliente ▼] [Município ▼] [Tag ▼] [Risco ▼] [Status ▼]│
│  Ver: ( ▦ Cards ) ( ▤ Tabela ) ( 🗺️ Mapa )      Ordenar: Risco ▼ │
│                                                                  │
│  ▤ TABELA                                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ☐ Imóvel        Cliente     Munic.   Área    Risco  Alertas │  │
│  │ ☐ MT27827/2017  Faz. S.João Cuiabá  2.847ha  🔴 82   3 novos│  │
│  │ ☐ MT8019/2017   J. Silva    V.Grande  156ha  🟢 12   0      │  │
│  │ ☐ MT4410/2019   Agro Ltda   Sinop   9.204ha  🟠 54   1      │  │
│  │ ...                                        [Ações em massa ▾]│  │
│  └────────────────────────────────────────────────────────────┘  │
│  Ações em massa: ✔ Verificar · 📥 Exportar · 📄 Relatório · 🏷️ Tag│
└──────────────────────────────────────────────────────────────────┘
```

- **Score de risco** (IA) como badge/coluna ordenável — o consultor ataca os piores primeiro.
- **Pastas por cliente** na lateral; arrastar imóveis entre pastas.
- **Mapa da carteira**: todos os polígonos num mapa, coloridos por risco; clique → detalhe.
- **Ações em massa**: verificar, exportar (SHP/CSV), gerar relatório, aplicar tag.

## B. Importação em massa (`/dashboard/import`) 🆕

```
┌──────────────────────────────────────────────────┐
│  Importar imóveis                                 │
│  ( ● Lista de CARs ) ( ○ CSV ) ( ○ Shapefile/KML )│
│                                                   │
│  Cole os números (um por linha):                  │
│  ┌───────────────────────────────────────────┐   │
│  │ MT27827/2017                              │   │
│  │ 8019                                       │   │
│  │ MT4410/2019                               │   │
│  └───────────────────────────────────────────┘   │
│  Cliente/pasta: [ Agro Ltda ▼ ]  Tags: [ 2026 ]  │
│                                                   │
│  [ Importar 3 imóveis ]                           │
│  ▓▓▓▓▓▓▓░░░ 2/3 — MT4410/2019 (buscando WFS...)   │
│  ✅ 2 com polígono · ⚠️ 1 sem polígono (só SCCON) │
└──────────────────────────────────────────────────┘
```

- Formatos: **lista colada · CSV · Shapefile(.zip)/KML/GeoJSON** (cria CARs por geometria).
- Relatório de importação: quais acharam polígono, quais só monitoram por SCCON.

## C. Aba IA na página do CAR (DeepSeek V4 Flash) 🤖

```
┌──────────────────────────────────────────────────────────────┐
│  🤖 Assistente — MT27827/2017        Score de risco: 🔴 82   │
│                                                              │
│  [ Explicar alertas ] [ Resumo do mês ] [ Gerar laudo ]      │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Você: esse desmate de 12 ha tem autorização?             ││
│  │                                                          ││
│  │ 🤖: Não localizei AUTEX/autorização de desmate vigente   ││
│  │ sobre o polígono do alerta de 21/07 (12,5 ha, dentro de  ││
│  │ APP em ~3 ha). Recomendo triagem como "provável irregular"││
│  │ e verificação em campo. ⚠️ Análise preliminar — consulte  ││
│  │ o RT.                                    [👍] [👎] [copiar]││
│  └──────────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Pergunte sobre este imóvel...                     [ ➤ ]  ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

- Chat com **streaming**; escopo do imóvel (contexto = camadas + alertas + NDVI + autorizações).
- Botões rápidos: **explicar alerta**, **resumo do mês**, **gerar laudo** (abre o editor).
- No dashboard: widget **"Pergunte sobre sua carteira"** (escopo portfólio).
- Ver contrato/arquitetura em **[IA-ASSISTENTE.md](./IA-ASSISTENTE.md)**.

## D. Workflow de alertas (aba Alertas turbinada) 🔬

Cada alerta ganha **ciclo de vida** e ferramentas de triagem do consultor:

```
┌──────────────────────────────────────────────────────────────┐
│ 🔴 21/07/2026 — Corte Raso — 12,5 ha — dentro de APP (3 ha)  │
│ Status: [ Novo ▼ ]  Severidade: 🔴 Alta  •  🤖 provável irreg.│
│ Fonte: SCCON #458932 · sem AUTEX vigente                     │
│                                                              │
│ 📝 Notas: _______________________________  [+ anexar foto]   │
│ 👤 Responsável: [ Eu ▼ ]                                     │
│ [🗺️ Ver no mapa] [🤖 Triagem IA] [📥 GeoJSON] [📋 coords]   │
└──────────────────────────────────────────────────────────────┘
```

- **Status**: novo → em análise → validado → falso positivo → resolvido.
- **Severidade automática** (classe × área × recência × sobreposição APP/ARL).
- **Cruzamento com autorizações**: mostra se há AUTEX vigente sobre o alerta.
- **Notas + anexos + fotos de campo**, atribuição de responsável.
- **Triagem IA** sugere status; o consultor confirma.
- Filtros avançados + **saved views** ("meus críticos", "sem AUTEX", "não resolvidos").

## E. Exports GIS e interoperabilidade 📥

- Dropdown **📥 Baixar** em imóvel, alertas e camadas: **SHP(.zip) · GeoJSON · KML/KMZ · GPKG · CSV**.
- Exportar **todas as camadas do CAR** (ATP/ARL/APP/AUAS/…) num pacote.
- **API Key** no perfil → usar em QGIS/ArcGIS/scripts; link **"abrir no QGIS"** (WMS/WFS próprio).
- **Webhooks**: dispara quando surge alerta (config no perfil).

## F. Notificações multicanal (config) 🔔

```
┌──────────────────────────────────────────────────┐
│  Notificações                                     │
│  Canais:  ☑ WhatsApp  ☑ Email  ☐ Telegram  ☑ Push │
│  Modo:    ( ○ Imediato ) ( ● Resumo diário )      │
│  Horário silencioso: 22:00 → 06:00                │
│                                                   │
│  Por classe:  ☑ Corte raso (imediato)             │
│               ☑ Embargo/Auto (imediato)           │
│               ☐ Queimada (resumo)                 │
│  Severidade mínima: [ Média ▼ ]                   │
│                                                   │
│  Destinatários extras (cópia ao cliente final):   │
│  [+ WhatsApp] [+ Email]                            │
└──────────────────────────────────────────────────┘
```

- **Digest diário/semanal** da carteira (e-mail HTML) além de alertas imediatos.
- **Destinatários extras**: consultor adiciona o contato do cliente final para receber cópia.

## G. Modo Campo (mobile / PWA) 📱

- **PWA instalável** + cache offline da carteira.
- **"Estou aqui"**: GPS marca a posição no mapa do imóvel (conferir alerta em campo).
- **Foto geolocalizada**: tira foto no local e anexa ao CAR/alerta (vira anexo do parecer).
- Bottom nav no mobile; busca global (Ctrl/Cmd+K).

## H. Editor de Laudo (`/dashboard/cars/:id/laudo`) 📄

```
┌──────────────────────────────────────────────────────────────┐
│  Laudo técnico — MT27827/2017         [🤖 Gerar minuta] [PDF] │
│  ┌──────────────┬───────────────────────────────────────────┐ │
│  │ Blocos       │  1. Identificação do imóvel                │ │
│  │ ▸ Introdução │  CAR MT27827/2017, Cuiabá-MT, 2.847,32 ha  │ │
│  │ ▸ Identif.   │  ...                                       │ │
│  │ ▸ Análise    │  [ inserir mapa ] [ inserir NDVI ]         │ │
│  │ ▸ Conformid. │                                            │ │
│  │ ▸ Conclusão  │  (texto editável, gerado pela IA)          │ │
│  │ ▸ Recomend.  │                                            │ │
│  └──────────────┴───────────────────────────────────────────┘ │
│  Rodapé/marca do consultor: [ logo ]   RT: _______  ART: ____ │
└──────────────────────────────────────────────────────────────┘
```

- IA gera a minuta (contexto completo) → consultor edita blocos → insere mapa/NDVI → exporta PDF.
- **Marca própria** (logo/rodapé) mesmo sem white-label pago.

## I. Camadas SEMA no navegador (viewer) 🗺️

Qualquer das **135 camadas WFS/WMS** da SEMA (ver [CAMADAS-SEMA.md](./CAMADAS-SEMA.md)) desenhada ao vivo
sobre o mapa do imóvel — sem sair do AlertaCAR, sem abrir o Geoportal da SEMA.

```
┌──────────────────────────────────────────────────────────────┐
│  🗺️ Mapa — MT27827/2017            [🔎 buscar camada...]     │
│  ┌──────────────┬───────────────────────────────────────────┐ │
│  │ CAMADAS      │                                            │ │
│  │ Base:        │            MAPA LEAFLET                    │ │
│  │ ◉ Sentinel24 │      (polígono do CAR + overlays)          │ │
│  │ ○ OSM        │                                            │ │
│  │ ○ Relevo DEM │        🟩 CAR ▓ embargo ░ TI               │ │
│  │              │                                            │ │
│  │ Overlays:    │                                            │ │
│  │ ☑ CAR (ATP)  │                                            │ │
│  │ ☑ Embargos   │  opac. ████████░░ 80%                      │ │
│  │ ☐ Autos infr.│                                            │ │
│  │ ☑ TI / UC    │                                            │ │
│  │ ☐ Licenças   │                                            │ │
│  │ ☐ Autorizaç. │                                            │ │
│  │ ☐ Hidrografia│                                            │ │
│  │ ☐ Desmate hist│  [📸 Snapshot p/ laudo]  [+ mais camadas ▾]│ │
│  └──────────────┴───────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

- Lista de camadas vem de **`/api/map/capabilities`** (classificada em satélite / vetor / CAR).
- Cada overlay é um **`WMSTileLayer`** apontando para o WMS da SEMA (`GetMap` + `authkey`), com **opacidade**.
- **Base layer** = mosaico de satélite (Sentinel-2/Landsat/CBERS-4A) ou OSM/relevo.
- **📸 Snapshot**: `POST /api/cars/:id/map/snapshot` gera PNG (base + overlays + bbox) para inserir no laudo.
- Interseção "quantos ha do CAR estão embargados / em TI" via `POST /api/map/intersection-hectares`.

## J. Ferramentas GIS de conformidade (aba Ferramentas) 🧰

Reúso do GeoForest — valida e processa shapefiles do CAR direto no app (padrão upload → SSE → ZIP):

```
┌──────────────────────────────────────────────────────────────┐
│  🧰 Ferramentas          Arraste um ZIP (.shp+.dbf+.prj) aqui │
│                                                              │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐        │
│  │ ✔ Validar     │ │ ◈ Vértices    │ │ ▣ Áreas não   │        │
│  │  geometria    │ │  próximas     │ │  contidas     │        │
│  │ borda cruza,  │ │ pares coincid.│ │ alvo − contin.│        │
│  │ pts repetidos │ │               │ │               │        │
│  └───────────────┘ └───────────────┘ └───────────────┘        │
│  ┌───────────────┐ ┌───────────────┐                          │
│  │ ⚙ ProcessarGeo│ │ ✂ Recortar    │   Resultado → anexa ao   │
│  │ APP/APPD/ARL  │ │  camadas CAR  │   CAR da carteira        │
│  └───────────────┘ └───────────────┘                          │
│                                                              │
│  ▓▓▓▓▓▓▓░░░ Processando... 2 bordas se cruzam, 1 ponto rep.  │
│  [📥 Baixar erros (ZIP)]  [📄 Gerar laudo de conformidade]    │
└──────────────────────────────────────────────────────────────┘
```

- Ferramentas: **validação de geometria · vértices próximas · áreas não contidas · ProcessarGeo · recorte de camadas**.
- Resultado vincula ao imóvel da carteira (anexa relatório de erros / laudo ao CAR).

---

## Checklist de features (futuras / backlog)

- [ ] Múltiplos usuários por CAR com papéis (dono/editor/leitor) + convites
- [ ] Integração com calendário (prazos de licença/embargo)
- [ ] Detecção de mudança por ML próprio (além do diff NDVI)
- [ ] Créditos de carbono (integração futura com CarbonLink)
- [ ] i18n completo (EN/ES)
- [ ] 2FA para admin (TOTP)

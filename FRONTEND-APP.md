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
│  [📥 Baixar polígono (GeoJSON)] [📥 (SHP)] [📥 (KML)]       │
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

#### Aba 4: 🛰️ Comparação de Satélite

```
┌──────────────────────────────────────────────────────────────┐
│  Antes e Depois — imagens Landsat/CBERS                       │
│                                                              │
│  Data do alerta: [21/07/2026 ▼]                              │
│                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐           │
│  │                     │  │                     │           │
│  │   ANTES             │  │   DEPOIS             │           │
│  │   15/06/2026        │  │   21/07/2026         │           │
│  │                     │  │                     │           │
│  │  🟩🟩🟩🟩🟩🟩🟩 │  │  🟩🟩🟫🟫🟫🟩🟩 │           │
│  │  🟩🟩🟩🟩🟩🟩🟩 │  │  🟩🟫🟫🟫🟫🟫🟩 │           │
│  │  🟩🟩🟩🟩🟩🟩🟩 │  │  🟩🟩🟫🟫🟫🟩🟩 │           │
│  │                     │  │                     │           │
│  └─────────────────────┘  └─────────────────────┘           │
│                                                              │
│  🔴 Área desmatada detectada: 12.5 ha                        │
│                                                              │
│  [▶️ Animação fade antes/depois]                             │
│  [📥 Baixar imagem antes] [📥 Baixar imagem depois]          │
└──────────────────────────────────────────────────────────────┘
```

**Features do comparador:**
- Slider vertical/horizontal para comparar antes vs depois
- WMS da SEMA como fonte das imagens (via GeoServer)
- Timelapse animado (opcional, se múltiplas datas disponíveis)
- Download das imagens em PNG

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
| Polígono do CAR | GeoJSON, SHP (zip), KML | `GET /api/cars/:id/export?format=geojson\|shp\|kml` |
| Alertas (todos) | CSV, GeoJSON, JSON | `GET /api/cars/:id/alerts/export?format=csv\|geojson\|json` |
| Alerta individual | GeoJSON | Botão no card do alerta |
| Relatório completo | PDF, HTML | `GET /api/cars/:id/report?format=pdf\|html` |
| Imagem satélite | PNG (GeoTIFF no futuro) | `GET /api/cars/:id/satellite?date=2026-07-21` |

### UI de download
- Dropdown "📥 Baixar" em cada seção relevante
- Opções: GeoJSON | Shapefile | KML | CSV | PDF
- Download inicia automaticamente (sem popup extra)
- Toast "✅ Arquivo baixado: CAR_MT27827.geojson"

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

## Checklist de features (futuras)

- [ ] Compartilhar relatório via link temporário
- [ ] Múltiplos usuários por CAR (ex: proprietário + engenheiro)
- [ ] Alertas por email (fallback se WhatsApp offline)
- [ ] Integração com calendário (Google Calendar)
- [ ] App PWA (instalável no celular)
- [ ] Dark/light mode toggle
- [ ] Gráfico de tendência (NDVI ao longo do tempo)
- [ ] Previsão de risco (machine learning: score de probabilidade de desmate)
- [ ] Marketplace de créditos de carbono (integração futura com CarbonLink)

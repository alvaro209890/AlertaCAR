# Frontend — Painel Admin

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Auth local (JWT, mesmo backend)
- Wouter (roteamento)
- Recharts (gráficos)
- file-saver + jszip (exportação)
- date-fns (formatação de datas)

## Design

Tema escuro, mais sóbrio que o app (slate/zinc). Sidebar fixa com navegação.

```
┌──────────┬──────────────────────────────────────────────┐
│          │                                              │
│  Sidebar │  Conteúdo                                     │
│  200px   │  flex-1                                       │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

### Sidebar
```
┌─────────────────┐
│   🌿 AlertaCAR   │
│   Admin          │
├─────────────────┤
│ 📊 Dashboard    │ ← ativo: bg-slate-800, borda emerald
│ 🌿 CARs         │
│ 👥 Usuários     │
│ 🔔 Alertas      │
│ 💬 WhatsApp     │
│ 📨 Notificações │
│ 📄 Relatórios   │ 🆕
│ 📊 Exportações  │ 🆕
│ ⚙️ Configurações│
├─────────────────┤
│ 🕐 Cron: 06:00  │
│ ✅ Online       │
├─────────────────┤
│ 👤 Álvaro       │
│ Sair            │
└─────────────────┘
```

---

## Páginas

### 1. Dashboard (`/dashboard`)

```
┌──────────────────────────────────────────────────────────┐
│  Dashboard                                                │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 👥       │ │ 🌿       │ │ 🔔       │ │ 💬       │   │
│  │ Usuários │ │ CARs     │ │ Alertas  │ │ WhatsApp │   │
│  │   127    │ │   342    │ │  1.203   │ │ ● Online │   │
│  │ +12 mês  │ │ 98% ativ │ │  últ 24h │ │ desde 10h│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📈 Alertas por dia (últimos 30 dias)              │   │
│  │                                                    │   │
│  │  ██              ← Gráfico Recharts (barras)       │   │
│  │  ██ ██                                              │   │
│  │  ██ ██ ██    ██                                     │   │
│  │  ██ ██ ██ ██ ██ ██    ██                            │   │
│  │  ██ ██ ██ ██ ██ ██ ██ ██                            │   │
│  │  15 16 17 18 19 20 21                               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌────────────────────┐ ┌────────────────────────────┐  │
│  │ Último Cron        │ │ Top CARs mais alertados     │  │
│  │ ✅ 21/07 06:00     │ │ MT27827/2017 — 47 alertas   │  │
│  │ 342 processados    │ │ MT8019/2017  — 12 alertas   │  │
│  │ 8 alertas novos    │ │ MT4521/2018  — 5 alertas    │  │
│  │ 0 erros            │ │ [...]                       │  │
│  └────────────────────┘ └────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📊 Distribuição de classes de alerta (pizza)      │   │
│  │ 🔴 CUT: 45%  🟠 DEGRAD: 30%  🟡 BURN: 15% ...   │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Gráficos com Recharts:**
- Barras: alertas/dia (últimos 30 dias), com tooltip interativo
- Pizza: distribuição por classe de alerta
- Linha: crescimento de usuários e CARs ao longo do tempo
- Todos com exportação PNG/SVG

### 2. CARs (`/dashboard/cars`) 🆕

```
┌──────────────────────────────────────────────────────────┐
│  CARs monitorados                           [📥 Exportar] │
│  ┌────────────────────┐ ┌────────────────────────────┐   │
│  │ 🔍 Buscar CAR...   │ │ Todos os status ▼           │  │
│  └────────────────────┘ └────────────────────────────┘   │
│                                                          │
│  ┌─────────┬──────────┬──────────┬────────┬───────────┐  │
│  │ CAR     │ Usuário  │ Município│ Área   │ Alertas   │  │
│  ├─────────┼──────────┼──────────┼────────┼───────────┤  │
│  │ MT27827 │ João S.  │ Cuiabá   │ 2.847ha│ 47 (3🔴)  │  │
│  │ MT8019  │ Maria O. │ VG       │ 156ha  │ 2 (✅)    │  │
│  └─────────┴──────────┴──────────┴────────┴───────────┘  │
│                                                          │
│  Ações por linha: [👁️ Ver] [🔄 Verificar] [🗑️ Remover]  │
│  Seleção múltipla: [☑] → [🔄 Verificar selecionados]    │
└──────────────────────────────────────────────────────────┘
```

### 3. Usuários (`/dashboard/users`)

Tabela com toolbar:

```
┌──────────────────────────────────────────────────────────┐
│  Usuários                                    [📥 Exportar]│
│  ┌────────────────────┐ ┌────────────────────────────┐   │
│  │ 🔍 Buscar...       │ │ Todos ▼  [Role ▼]          │  │
│  └────────────────────┘ └────────────────────────────┘   │
│                                                          │
│  ┌────────┬──────────┬──────────────┬──────┬──────────┐  │
│  │ Nome   │ Email    │ WhatsApp     │ CARs │ Ações    │  │
│  ├────────┼──────────┼──────────────┼──────┼──────────┤  │
│  │ João   │ joao@... │ +55 65 9...  │  12  │ 👁️ ✏️ 🚫 │  │
│  │ Maria  │ maria@.. │ +55 66 9...  │   3  │ 👁️ ✏️ 🚫 │  │
│  └────────┴──────────┴──────────────┴──────┴──────────┘  │
│                                                          │
│  Ações: 👁️ Ver CARs  ✏️ Editar  🚫 Desativar  🔄 Resetar│
└──────────────────────────────────────────────────────────┘
```

### 4. Alertas (`/dashboard/alerts`) 🆕

```
┌──────────────────────────────────────────────────────────┐
│  Todos os alertas                          [📥 Exportar]  │
│                                                          │
│  Filtros:                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │Classe ▼ │ │Período ▼│ │Status ▼  │ │🔍 CAR...    │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
│                                                          │
│  ┌────────┬──────────┬──────────┬────────┬────────────┐  │
│  │ Data   │ CAR      │ Classe   │ Área   │ WhatsApp   │  │
│  ├────────┼──────────┼──────────┼────────┼────────────┤  │
│  │ 21/07  │ MT27827  │ 🔴 CUT   │ 12.5ha │ ✅ Enviado │  │
│  │ 20/07  │ MT8019   │ 🟠 DEGR  │ 3.2ha  │ ⏳ Pendente│  │
│  │ 19/07  │ MT27827  │ 🟡 BURN  │ 8.1ha  │ ❌ Falhou  │  │
│  └────────┴──────────┴──────────┴────────┴────────────┘  │
│                                                          │
│  Ações em massa: [📱 Reenviar WhatsApp] [🗑️ Arquivar]    │
└──────────────────────────────────────────────────────────┘
```

### 5. WhatsApp Connect (`/dashboard/whatsapp`)

```
┌──────────────────────────────────────────────────────────┐
│  Conexão WhatsApp                                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Estado: ● Conectado                                     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  📱 +55 65 99999-8888                             │   │
│  │  Conectado desde: 21/07/2026 10:34                │   │
│  │  Uptime: 12h 47min                                │   │
│  │  Mensagens enviadas hoje: 8                       │   │
│  │  Mensagens na fila: 2                              │   │
│  │  Taxa de entrega: 98.7%                            │   │
│  │                                                   │   │
│  │  [ Desconectar ]  [ 🔄 Reconectar ]               │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  --- OU (estado desconectado) ---                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  📱 WhatsApp não conectado                        │   │
│  │                                                   │   │
│  │  1. Abra o WhatsApp no seu celular                │   │
│  │  2. Vá em Dispositivos Vinculados                 │   │
│  │  3. Escaneie o QR Code abaixo                     │   │
│  │                                                   │   │
│  │       ┌─────────────────────┐                    │   │
│  │       │                     │                    │   │
│  │       │     QR CODE          │                    │   │
│  │       │                     │                    │   │
│  │       └─────────────────────┘                    │   │
│  │                                                   │   │
│  │  Aguardando escaneamento... (atualiza a cada 3s)  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Histórico de conexões:                                   │
│  ┌──────────────┬──────────┬──────────┐                  │
│  │ Data         │ Evento   │ Duração  │                  │
│  ├──────────────┼──────────┼──────────┤                  │
│  │ 21/07 10:34  │ Conectar │ 12h 47m  │                  │
│  │ 20/07 06:00  │ Desconect│ 4h 34m   │                  │
│  └──────────────┴──────────┴──────────┘                  │
└──────────────────────────────────────────────────────────┘
```

### 6. Log de Notificações (`/dashboard/notifications`)

```
┌──────────────────────────────────────────────────────────┐
│  Notificações                              [📥 Exportar]  │
│  Filtro: [Hoje ▼]  [Status: Todos ▼]                     │
├──────────────────────────────────────────────────────────┤
│  ┌────────┬─────────┬────────────┬──────────┬────────┐   │
│  │ Data   │ Usuário │ CAR        │ Tipo     │ Status │   │
│  ├────────┼─────────┼────────────┼──────────┼────────┤   │
│  │ 08:32  │ João S. │ MT27827... │ 🔴 CUT   │ ✅     │   │
│  │ 08:31  │ João S. │ MT27827... │ 🟠 DEGR  │ ✅     │   │
│  │ 06:15  │ Maria   │ MT8019/... │ 🔴 CUT   │ ⏳     │   │
│  └────────┴─────────┴────────────┴──────────┴────────┘   │
│                                                          │
│  [📱 Reenviar selecionados]  [📄 Exportar CSV]            │
└──────────────────────────────────────────────────────────┘
```

### 7. Relatórios (`/dashboard/reports`) 🆕

```
┌──────────────────────────────────────────────────────────┐
│  Relatórios                                                │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📊 Relatório Semanal (automático)                  │   │
│  │ ┌──────────────────────────────────────────────┐  │   │
│  │ │ Gerar toda segunda-feira, 07:00               │  │   │
│  │ │ Conteúdo: novos alertas, resumo por CAR       │  │   │
│  │ │ Destino: email admin + WhatsApp               │  │   │
│  │ │ [⚙️ Configurar] [📄 Gerar agora]              │  │   │
│  │ └──────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📄 Relatório por CAR (manual)                     │   │
│  │ Selecione o CAR: [MT27827/2017 ▼]                │   │
│  │ Período: [Últimos 30 dias ▼]                     │   │
│  │ Formato: [PDF ▼]                                 │   │
│  │ [📄 Gerar relatório]                             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Relatórios gerados recentemente:                         │
│  ┌────────────────────┬────────┬──────────┐              │
│  │ Data               │ CAR    │ Link     │              │
│  ├────────────────────┼────────┼──────────┤              │
│  │ 21/07/2026 08:45   │ MT27827│ 📥 Baixar│              │
│  │ 20/07/2026 06:00   │ Todos  │ 📥 Baixar│              │
│  └────────────────────┴────────┴──────────┘              │
└──────────────────────────────────────────────────────────┘
```

### 8. Exportações (`/dashboard/exports`) 🆕

```
┌──────────────────────────────────────────────────────────┐
│  Exportação de dados                                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📥 Exportar CARs (GeoJSON)                         │   │
│  │ [Todos os CARs ▼]  Formato: [GeoJSON ▼]           │   │
│  │ [📥 Exportar]        Inclui: geometria + atributos │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📥 Exportar Alertas (CSV/GeoJSON)                  │   │
│  │ Período: [Últimos 30 dias ▼]                      │   │
│  │ Formato: [CSV ▼]                                  │   │
│  │ [📥 Exportar]                                      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📥 Exportar Usuários (CSV)                         │   │
│  │ [📥 Exportar]  Inclui: nome, email, CARs, status   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🗄️ Backup do banco de dados                       │   │
│  │ [📥 Baixar alertacar.db]                          │   │
│  │ Último backup automático: 21/07 03:00             │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 9. Configurações (`/dashboard/settings`)

```
┌──────────────────────────────────────────────────────────┐
│  ⚙️ Configurações                                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🕐 Monitoramento                                   │   │
│  │ Horário diário: ┌──────────┐                      │   │
│  │                 │ 06:00    │ (horário de Brasília)│   │
│  │                 └──────────┘                      │   │
│  │ [🔄 Forçar execução agora]                         │   │
│  │ [📋 Ver logs do cron]                              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 📱 Template WhatsApp                               │   │
│  │ ┌──────────────────────────────────────────────┐  │   │
│  │ │ 🔔 *AlertaCAR*                                │  │   │
│  │ │ 📍 CAR: {car_number}                          │  │   │
│  │ │ 🏷️ {class_type}                               │  │   │
│  │ │ 📅 {date} • 📐 {area} ha                       │  │   │
│  │ │                                                │  │   │
│  │ │ Acesse: alertacar.cursar.space                 │  │   │
│  │ └──────────────────────────────────────────────┘  │   │
│  │ Variáveis: {car_number} {class_type} {date}       │   │
│  │ {area} {municipality} {source} {link}             │   │
│  │ [💾 Salvar] [🔄 Resetar padrão]                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🚦 Rate Limiting                                   │   │
│  │ Máx. mensagens por CAR por hora: ┌────┐           │   │
│  │                                  │ 1  │           │   │
│  │                                  └────┘           │   │
│  │ Máx. mensagens por usuário/dia:  ┌────┐           │   │
│  │                                  │ 10 │           │   │
│  │                                  └────┘           │   │
│  │ [💾 Salvar]                                        │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🛡️ Manutenção                                     │   │
│  │ [🧹 Limpar alertas antigos (>1 ano)]              │   │
│  │ [🗄️ Backup do banco agora]                        │   │
│  │ [📊 Ver métricas do servidor]                      │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## Métricas do Servidor 📊 🆕

Na página de configurações, card "Métricas do servidor":

```
┌──────────────────────────────────────────────────┐
│  🖥️ Servidor: server-desktop                       │
│                                                   │
│  CPU:  ████████░░ 78%                             │
│  RAM:  ██████░░░░ 62% (7.8/12.5 GB)               │
│  DISCO SSD: ████░░░░░░ 38% (42/112 GB)           │
│  DISCO HD:  ██████░░░░ 65% (1.17/1.8 TB)         │
│                                                   │
│  Uptime: 47 dias                                  │
│  Node: v20.11.1                                   │
│                                                   │
│  Serviços rodando:                                │
│  ✅ GeoForest (3001)  ✅ AlertaCAR (3002)          │
│  ✅ GeoServer (8081)  ✅ Cloudflared              │
│  ⚠️ Nexus (offline)                               │
└──────────────────────────────────────────────────┘
```

---

## Sistema de Exportação 📥 🆕

### Formatos e endpoints

| Dado | Formatos | Endpoint |
|------|----------|----------|
| Lista de CARs | CSV, JSON, GeoJSON | `GET /api/admin/cars/export` |
| Lista de usuários | CSV, JSON | `GET /api/admin/users/export` |
| Alertas | CSV, GeoJSON | `GET /api/admin/alerts/export` |
| Log notificações | CSV | `GET /api/admin/notifications/export` |
| Relatório PDF | PDF | `POST /api/admin/reports/generate` |
| Banco completo | SQLite (.db) | `GET /api/admin/database/backup` |

### UI de exportação
- Botão "📥 Exportar" no canto superior direito de cada tabela
- Dropdown com opções de formato
- Toast "✅ Exportado: 342 CARs em alertacar_cars_2026-07-21.csv"
- Para arquivos grandes (>10MB), mostrar progresso

---

## Componentes do Admin

- `StatsCard`: ícone + valor grande + label + delta (↑↓)
- `WhatsAppQRCard`: QR Code com polling, auto-refresh
- `UsersTable`: tabela com sort, busca, ações inline
- `NotificationsLog`: tabela com filtros de período
- `StatusBadge`: online/offline/enviado/pendente/falhou
- `BarChart`: gráfico de barras (Recharts)
- `PieChart`: gráfico de pizza (Recharts)
- `ExportDropdown`: dropdown de formatos de exportação
- `CronStatus`: status do último cron com indicador visual
- `ServerMetrics`: cards de CPU/RAM/Disco

---

## Checklist de features (futuras)

- [ ] Fila de WhatsApp com retry manual
- [ ] Agendamento de relatórios automáticos (semanal/mensal)
- [ ] Sistema de logs de auditoria (quem fez o quê)
- [ ] 2FA para admin (TOTP)
- [ ] Webhook para integrar com outros sistemas
- [ ] API Key para acesso programático de usuários
- [ ] Dashboard customizável (arrastar cards)
- [ ] Suporte multi-idioma (PT-BR, EN, ES)
- [ ] Modo claro/escuro manual
- [ ] Teste de conexão com WhatsApp (ping)

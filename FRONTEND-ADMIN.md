# Frontend — Painel Admin

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Auth local (JWT, mesmo backend)
- Wouter (roteamento)

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
│ 💬 WhatsApp     │
│ 👥 Usuários     │
│ 📨 Notificações │
│ ⚙️ Configurações│
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
│  │ Alertas por dia (últimos 7 dias)                  │   │
│  │                                                    │   │
│  │  ██                                                 │   │
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
│  └────────────────────┘ └────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 2. WhatsApp Connect (`/dashboard/whatsapp`)

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
│  │                                                   │   │
│  │  [ Desconectar ]                                  │   │
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
└──────────────────────────────────────────────────────────┘
```

### 3. Usuários (`/dashboard/users`)

Tabela com toolbar:

```
┌──────────────────────────────────────────────────────────┐
│  Usuários                                       [+ Novo]  │
│  ┌────────────────────┐ ┌────────────────────────────┐   │
│  │ 🔍 Buscar...       │ │ Todos ▼ │                    │  │
│  └────────────────────┘ └────────────────────────────┘   │
│                                                          │
│  ┌────────┬──────────┬──────────────┬──────┬──────────┐  │
│  │ Nome   │ Email    │ WhatsApp     │ CARs │ Ações    │  │
│  ├────────┼──────────┼──────────────┼──────┼──────────┤  │
│  │ João   │ joao@... │ +55 65 9...  │  12  │ 👁️ 🚫   │  │
│  │ Maria  │ maria@.. │ +55 66 9...  │   3  │ 👁️ 🚫   │  │
│  └────────┴──────────┴──────────────┴──────┴──────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 4. Log de Notificações (`/dashboard/notifications`)

```
┌──────────────────────────────────────────────────────────┐
│  Notificações                                             │
│  Filtro: [Hoje ▼]                                        │
├──────────────────────────────────────────────────────────┤
│  ┌────────┬─────────┬────────────┬──────────┬────────┐   │
│  │ Data   │ Usuário │ CAR        │ Tipo     │ Status │   │
│  ├────────┼─────────┼────────────┼──────────┼────────┤   │
│  │ 08:32  │ João S. │ MT27827... │ 🔴 CUT   │ ✅     │   │
│  │ 08:31  │ João S. │ MT27827... │ 🟠 DEGR  │ ✅     │   │
│  │ 06:15  │ Maria   │ MT8019/... │ 🔴 CUT   │ ⏳     │   │
│  └────────┴─────────┴────────────┴──────────┴────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 5. Configurações (`/dashboard/settings`)

```
┌──────────────────────────────────────────────────────────┐
│  ⚙️ Configurações                                         │
│                                                          │
│  Horário do monitoramento diário                         │
│  ┌──────────┐                                            │
│  │ 06:00    │ (horário de Brasília)                      │
│  └──────────┘                                            │
│                                                          │
│  Limite de CARs por usuário                              │
│  ┌──────────┐                                            │
│  │ 50       │                                            │
│  └──────────┘                                            │
│                                                          │
│  Template WhatsApp (usa {variaveis})                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │ 🔔 *AlertaCAR*                                    │   │
│  │ CAR: {car_number}                                 │   │
│  │ 🏷️ {class_type}                                   │   │
│  │ 📅 {date} • 📐 {area} ha                           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Manutenção                                              │
│  [ Forçar execução do cron agora ]                       │
└──────────────────────────────────────────────────────────┘
```

---

## Componentes do Admin

- `StatsCard`: ícone + valor grande + label + delta (↑↓)
- `WhatsAppQRCard`: QR Code com polling, auto-refresh
- `UsersTable`: tabela com sort, busca, ações inline
- `NotificationsLog`: tabela com filtros de período
- `StatusBadge`: online/offline/enviado/pendente/falhou
- `BarChart`: gráfico de barras simples (alertas/dia)

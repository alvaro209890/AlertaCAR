# Frontend — Painel Admin

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Firebase Authentication (cliente) — mesmo auth do app

## Acesso

**Apenas usuários na whitelist de admins.** O backend verifica o `uid` contra uma lista fixa de admins. Se o usuário logado não for admin, o backend retorna 403.

## Páginas

### 1. Login (`/login`)

- Mesmo Firebase Auth do app
- Se usuário logado não for admin → mensagem "Acesso restrito"
- Redireciona para `/dashboard` após login admin

### 2. Dashboard Admin (`/dashboard`)

Cards com métricas principais:
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   USUÁRIOS   │ │  CARs ATIVOS │ │   ALERTAS    │
│     127      │ │     342      │ │   1,203      │
│  +12 no mês  │ │  98% ativos  │ │ última 24h: 8│
└──────────────┘ └──────────────┘ └──────────────┘

┌──────────────┐ ┌──────────────┐
│  WHATSAPP    │ │ ÚLTIMO CRON  │
│  ● ONLINE    │ │ 21/07 06:00  │
│  desde 10h   │ │ 342 CARs ok  │
└──────────────┘ └──────────────┘
```

Gráfico simples (últimos 7 dias): alertas/dia.

### 3. WhatsApp Connect (`/dashboard/whatsapp`)

**Estado: Desconectado**
- Botão grande "Conectar WhatsApp"
- Instruções: "Abra o WhatsApp no seu celular, vá em Dispositivos Vinculados e escaneie o QR Code"
- Ao clicar: aparece QR Code (via SSE ou polling do backend)
- Spinner enquanto aguarda conexão

**Estado: Conectado**
- Indicador verde "● Conectado"
- Número conectado (extraído da sessão)
- Última conexão
- Botão "Desconectar" (com confirmação)
- Log das últimas mensagens enviadas

**QR Code**: Exibido como `<img src={qrBase64} />` com auto-refresh. O backend gera o QR via baileys e retorna como base64.

### 4. Usuários (`/dashboard/users`)

- Tabela com busca e paginação
- Colunas: Nome, Email, WhatsApp, CARs ativos, Cadastro, Status
- Ações: ativar/desativar, ver detalhes
- Filtro: ativos, inativos, todos
- Ordenação por data de cadastro, nº de CARs

### 5. Log de Notificações (`/dashboard/notifications`)

- Tabela com todas as notificações enviadas
- Colunas: Data/Hora, Usuário, CAR, Tipo de alerta, Status
- Status: ✅ enviado, ⏳ pendente, ❌ falhou
- Filtro por período (hoje, 7 dias, 30 dias)
- Busca por usuário ou CAR

### 6. Configurações (`/dashboard/settings`)

- Horário do cron de monitoramento (padrão: 06:00)
- Template da mensagem WhatsApp (editável)
- Limite de CARs por usuário
- Manutenção: "Forçar execução do cron agora"

## Componentes específicos do admin

- `StatsCard` — Card de métrica com ícone, valor e delta
- `WhatsAppQRCard` — Card do QR Code com polling
- `UsersTable` — Tabela de usuários com ações
- `NotificationsLog` — Tabela de log de notificações
- `StatusBadge` — Badge de status (online/offline/enviado/falhou)

## Design

Seguir mesmo padrão visual do app, mas com paleta mais sóbria (slate/zinc) para diferenciar do app do usuário. Sidebar com navegação.

## Sidebar Admin

```
┌─────────────────┐
│   AlertaCAR      │
│   Admin          │
├─────────────────┤
│ 📊 Dashboard    │
│ 💬 WhatsApp     │
│ 👥 Usuários     │
│ 📨 Notificações │
│ ⚙️ Configs      │
├─────────────────┤
│ 👤 Álvaro       │
│ Sair            │
└─────────────────┘
```

# AlertaCAR

Plataforma de monitoramento de CARs (Cadastro Ambiental Rural) com notificações via WhatsApp.

O usuário se cadastra, informa o número do CAR que deseja monitorar, e o sistema diariamente consulta a SCCON (Sistema de Comercialização e Controle de Produtos de Origem Florestal) e o WFS da SEMA-MT em busca de novos alertas — desmatamento, degradação, embargos, mudanças de status cadastral.

Qualquer novidade é enviada diretamente no WhatsApp do usuário.

## Diferencial

A SCCON gera os alertas, mas ninguém fica logando lá todo dia. O AlertaCAR monitora automaticamente e entrega na mão do produtor rural, engenheiro florestal ou advogado ambiental.

## Módulos

| Módulo | Descrição | Público |
|--------|-----------|---------|
| **App Usuário** | Cadastro, login, dashboard com CARs monitorados, histórico de alertas | Clientes |
| **Painel Admin** | Gerenciar usuários, conectar WhatsApp (baileys), ver estatísticas de alertas enviados | Dono/Admin |
| **Backend** | API REST, cron de monitoramento diário, integração WFS/SEMA + SCCON, fila de notificações WhatsApp | Interno |

## Stack

- **Frontend App**: React 19 + Vite + TypeScript + Tailwind + shadcn/ui
- **Frontend Admin**: React 19 + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Auth**: Firebase Authentication
- **Banco**: SQLite (local, simples, sem necessidade de PostGIS)
- **WhatsApp**: Baileys (mesmo padrão SaldoPro)
- **Hospedagem**: Cloudflare Tunnel → `alertacar.cursar.space` (app) + `alertacar-api.cursar.space` (backend)

## Domínios

| Domínio | Serviço | Porta |
|---------|---------|-------|
| `alertacar.cursar.space` | Frontend App (usuário) | Cloudflare → localhost:XXXX |
| `alertacar-admin.cursar.space` | Frontend Admin | Cloudflare → localhost:XXXX |
| `alertacar-api.cursar.space` | Backend API | Cloudflare → localhost:XXXX |

## Estrutura prevista do repositório

```
AlertaCAR/
├── app/                  # Frontend app do usuário
│   ├── src/
│   │   ├── pages/        # Login, Dashboard, Meus CARs, Alertas
│   │   ├── components/   # Card de CAR, timeline de alertas, etc.
│   │   ├── contexts/     # AuthContext, etc.
│   │   ├── lib/          # firebase.ts, api.ts
│   │   └── ...
│   └── ...
├── admin/                # Frontend painel administrativo
│   ├── src/
│   │   ├── pages/        # Dashboard admin, WhatsApp Connect, Usuários
│   │   └── ...
│   └── ...
├── backend/
│   ├── src/
│   │   ├── index.ts      # Servidor Express
│   │   ├── routes/       # carros.ts, auth.ts, admin.ts
│   │   ├── services/     # sccon.ts, wfs-sema.ts, whatsapp.ts
│   │   ├── cron/         # monitoramento diário
│   │   └── db/           # SQLite setup + migrations
│   └── ...
├── docs/                 # Documentação e planos
├── .env.example
└── README.md
```

## Status

🚧 **Planejamento** — documento de arquitetura e plano MVP em elaboração.

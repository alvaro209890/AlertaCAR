# AlertaCAR

**Plataforma SaaS de monitoramento de CARs com notificações via WhatsApp.**

> Status: 🚧 **Planejamento** — testes de integração concluídos, planos detalhados em elaboração.

O usuário cadastra seu número de CAR, e o sistema monitora diariamente:
- **SCCON**: alertas de desmatamento e degradação (CUT, SELECTIVE_EXTRACTION, etc.)
- **SEMA-MT**: novos embargos, mudanças de status cadastral
- **Notificação**: qualquer novidade cai direto no WhatsApp

## 🎯 Diferencial

A SCCON gera os alertas mas exige login manual. O produtor rural não tem tempo pra isso. O AlertaCAR automatiza a consulta e entrega na mão — é o "porteiro" que monitora o CAR enquanto o dono dorme.

## 🏗️ Módulos

| Módulo | Descrição | Público |
|--------|-----------|---------|
| **App Usuário** | Cadastro, login, dashboard com CARs, mapa interativo, timeline de alertas | Clientes |
| **Painel Admin** | Métricas, WhatsApp Connect (QR Code), gerenciar usuários, logs | Dono |
| **Backend API** | REST, cron diário, integração WFS/SEMA + SCCON, fila WhatsApp (Baileys) | Interno |

## 🔧 Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Admin**: React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript + esbuild
- **Auth**: Firebase Authentication
- **Banco**: SQLite (better-sqlite3)
- **WhatsApp**: Baileys (WebSocket, sessão persistente)
- **Mapas**: Leaflet + react-leaflet
- **Geo**: Turf.js (área, interseção)

## 🌐 Domínios

| Domínio | Serviço | Porta |
|---------|---------|-------|
| `alertacar.cursar.space` | App Usuário | 3002 |
| `alertacar-admin.cursar.space` | Painel Admin | 3002 |
| `alertacar-api.cursar.space` | API REST | 3002 |

## 📦 Estrutura do Repositório

```
AlertaCAR/
├── app/                  # Frontend app do usuário
│   ├── src/
│   │   ├── pages/        # Login, Dashboard, CARs, Perfil
│   │   ├── components/   # CarCard, AlertTimeline, MapaLeaflet
│   │   ├── contexts/     # AuthContext
│   │   └── lib/          # firebase.ts, api.ts
│   └── ...
├── admin/                # Frontend painel administrativo
│   ├── src/
│   │   ├── pages/        # Dashboard, WhatsApp, Usuários, Logs
│   │   └── ...
│   └── ...
├── backend/
│   ├── src/
│   │   ├── index.ts      # Servidor Express
│   │   ├── routes/       # auth.ts, cars.ts, alerts.ts, admin.ts
│   │   ├── services/     # sccon.ts, wfs-sema.ts, whatsapp.ts
│   │   ├── cron/         # monitoramento diário
│   │   └── db/           # SQLite setup + migrations
│   ├── data/
│   │   └── alertacar.db  # SQLite (gitignored)
│   └── ...
├── docs/                 # Documentação e planos
├── .env.example
└── README.md
```

## 🔗 Links

- **Repo**: https://github.com/alvaro209890/AlertaCAR
- **GeoForest** (referência): https://github.com/alvaro209890/GeoForest-IA
- **SaldoPro** (ref. WhatsApp): https://github.com/alvaro209890/SaldoPro

## ✅ Testes de Integração Realizados

- [x] Token público SCCON — funcional (Bearer JWT)
- [x] WFS SCCON — retorna alertas (5+ em área de 0.5°×0.5° no MT)
- [x] API detalhes SCCON — retorna `classType`, `alertDetectedDate`, geometria Polygon
- [x] WFS SEMA-MT — 135 camadas disponíveis, authkey funcional
- [x] Camadas CAR mapeadas: ATP, AUAS, AVN, APP, ARL, Nascente
- [x] Camada de Embargos confirmada: `TDAD_FISCALIZACAO_TERMO_DE_EMBARGO`
- [x] Camadas de Desmatamento histórico: 2012-2018

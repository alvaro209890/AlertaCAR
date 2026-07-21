# AlertaCAR

**Plataforma de monitoramento ambiental rural, GIS-first, com IA de apoio à decisão.**

> Status: 🚧 **Fases 1–3 concluídas** (código real) — Auth, CRUD CARs + WFS SEMA, SCCON monitoramento.
> Fases 4–12 **replanejadas e ampliadas** com foco no consultor/engenheiro florestal e IA robusta.
> Veja o roteiro completo em **[PLANO-MVP.md](./PLANO-MVP.md)**.

> **Persona-alvo:** consultor / engenheiro florestal que monitora **carteiras** de imóveis de clientes.
> **Modelo:** tudo grátis / self-hosted, sem planos pagos.

O usuário cadastra seu imóvel rural (CAR, matrícula, ou coordenadas), e o sistema monitora **diariamente** múltiplas fontes oficiais:

- 🔴 **SCCON**: desmatamento, degradação, queimadas
- 🟠 **SEMA-MT**: embargos, autos de infração, licenciamento
- 🟡 **Cadastral**: mudanças no CAR, novos requerimentos
- 🟢 **Sobreposições**: terras indígenas, UC, assentamentos INCRA

Qualquer novidade → WhatsApp do usuário em segundos.

## 🎯 Diferencial

Ninguém unifica **SCCON + SEMA + INPE + cadastral + fundiário** num dashboard só, com **gestão de carteira**
e **IA de apoio** (resumos, score de risco, minuta de laudo). O AlertaCAR é o "vigia" que nunca dorme — o
consultor não precisa logar em 5 sistemas diferentes por imóvel, todo dia, para dezenas de clientes.

## 🏗️ Módulos

| Módulo | Público | Descrição |
|--------|---------|-----------|
| **App Usuário** | Clientes | Cadastro, dashboard com CARs, mapa interativo, timeline de alertas, downloads |
| **Painel Admin** | Dono | Métricas, WhatsApp Connect (QR Code Baileys), gerenciar usuários, relatórios |
| **Backend API** | Interno | REST, cron diário multicamada, integração WFS/SEMA + SCCON, fila WhatsApp |

## ✅ Progresso

| Fase | Status | Descrição |
|------|--------|-----------|
| 1 | ✅ | Auth local + monorepo base |
| 2 | ✅ | CRUD CARs + WFS SEMA (polígono) |
| 3 | ✅ | SCCON monitoramento + cron diário |
| 4 | ⏳ | Fontes expandidas — SEMA multicamada + camadas do CAR + INPE + vizinho |
| 5 | ⏳ | Detalhes do CAR + Mapa + Workflow de alertas |
| 6 | ⏳ | Satélite / NDVI / Timelapse |
| 7 | ⏳ | IA robusta (DeepSeek V4 Flash) |
| 8 | ⏳ | Gestão de Carteira (consultor) |
| 9 | ⏳ | Relatórios + Exportações + Interoperabilidade GIS |
| 10 | ⏳ | Notificações multicanal + WhatsApp |
| 11 | ⏳ | Plataforma / UX / Modo Campo (mobile) |
| 12 | ⏳ | Admin avançado + Segurança + Deploy + Backup |
| 13 | ⏳ | Ferramentas GIS de conformidade (reúso GeoForest) |

## 🔧 Stack (100% self-hosted, zero SaaS externo)

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Admin**: React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript + esbuild
- **Auth**: **Local** — bcrypt + JWT + SQLite (sem Firebase, sem Supabase)
- **Banco**: SQLite (better-sqlite3) em `Banco_de_dados/AlertaCAR/`
- **WhatsApp**: Baileys (WebSocket) · **Email/Telegram/Push** (multicanal)
- **Mapas**: Leaflet + react-leaflet · **Satélite/NDVI**: WMS SEMA (Landsat/Sentinel-2)
- **Gráficos**: Recharts
- **Geo**: Turf.js + proj4js · **Exports**: SHP/GeoJSON/KML/GPKG
- **IA**: DeepSeek V4 Flash (`api.deepseek.com/v1`) — resumos, score de risco, laudos
- **PDF**: Puppeteer/Playwright ou jsPDF

## 🌐 Domínios

| Domínio | Serviço | Porta |
|---------|---------|-------|
| `alertacar.cursar.space` | App Usuário | 3002 |
| `alertacar-admin.cursar.space` | Painel Admin | 3002 |
| `alertacar-api.cursar.space` | API REST | 3002 |

## 📦 Estrutura

```
AlertaCAR/                              # Código fonte (GitHub)
├── app/             # Frontend usuário
├── admin/           # Frontend admin
├── backend/         # API + cron + baileys
└── docs/*.md        # Planos e documentação

Banco_de_dados/AlertaCAR/               # Dados (fora do repo)
└── alertacar.db     # SQLite
```

## 🔗 Links

- **Repo**: https://github.com/alvaro209890/AlertaCAR
- **Docs**: [PLANO-MVP.md](./PLANO-MVP.md) | [ARQUITETURA.md](./ARQUITETURA.md) | [BACKEND.md](./BACKEND.md)
- **Camadas SEMA (WFS/WMS ao vivo)**: [CAMADAS-SEMA.md](./CAMADAS-SEMA.md) 🆕
- **Reúso do GeoForest**: [REUSO-GEOFOREST.md](./REUSO-GEOFOREST.md) 🆕
- **IA**: [IA-ASSISTENTE.md](./IA-ASSISTENTE.md) 🆕
- **Frontend**: [FRONTEND-APP.md](./FRONTEND-APP.md) | [FRONTEND-ADMIN.md](./FRONTEND-ADMIN.md)
- **Integrações**: [INTEGRACOES.md](./INTEGRACOES.md) | [DEPLOY.md](./DEPLOY.md)

## ✅ Testes de Integração (21/07/2026)

| Integração | Status | Detalhes |
|-----------|--------|----------|
| SCCON Token público | ✅ | GET com User-Agent, cache 23h |
| SCCON Busca por CAR | ✅ | POST `/alerts/search` com `cdCars` |
| SCCON Dedup | ✅ | `source_id` único por CAR |
| WFS SEMA CAR_ATP | ✅ | `Geoportal:CAR_ATP`, NUMEROESTADUAL |
| WFS SEMA (135 camadas) | ✅ | Auth key funcional, todas categorizadas |
| Auth local | ✅ | Register + login + JWT + requireAuth |
| CRUD CARs | ✅ | POST/GET/DELETE + WFS automático |
| Cron monitoramento | ✅ | node-cron 06:00 GMT-3 |

## 🚀 Como rodar

```bash
cd "/media/server/HD Backup/Servidores_NAO_MEXA/AlertaCAR"

# Terminal 1: Backend
cd backend && pnpm run dev    # porta 3002

# Terminal 2: App
cd app && pnpm run dev         # porta 5173

# Terminal 3: Admin
cd admin && pnpm run dev       # porta 5174

# Promover admin:
sqlite3 "Banco_de_dados/AlertaCAR/alertacar.db" \
  "UPDATE users SET role='admin' WHERE email='seu@email.com'"
```

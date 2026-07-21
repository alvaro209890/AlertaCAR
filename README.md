# AlertaCAR

**Plataforma de monitoramento ambiental rural com notificações via WhatsApp.**

> Status: 🚧 **Planejamento avançado** — integrações testadas, 135 camadas WFS mapeadas, SCCON funcional.

O usuário cadastra seu imóvel rural (CAR, matrícula, ou coordenadas), e o sistema monitora **diariamente** múltiplas fontes oficiais:

- 🔴 **SCCON**: desmatamento, degradação, queimadas
- 🟠 **SEMA-MT**: embargos, autos de infração, licenciamento
- 🟡 **Cadastral**: mudanças no CAR, novos requerimentos
- 🟢 **Sobreposições**: terras indígenas, UC, assentamentos INCRA

Qualquer novidade → WhatsApp do usuário em segundos.

## 🎯 Diferencial

Ninguém unifica **SCCON + SEMA + cadastral + fundiário** num dashboard só. O AlertaCAR é o "vigia" que nunca dorme — o produtor rural, engenheiro florestal ou advogado ambiental não precisa logar em 5 sistemas diferentes todo dia.

## 🏗️ Módulos

| Módulo | Público | Descrição |
|--------|---------|-----------|
| **App Usuário** | Clientes | Cadastro, dashboard com CARs, mapa interativo, timeline de alertas |
| **Painel Admin** | Dono | Métricas, WhatsApp Connect (QR Code Baileys), gerenciar usuários |
| **Backend API** | Interno | REST, cron diário, integração WFS/SEMA + SCCON, fila WhatsApp |

## 🔧 Stack (100% self-hosted, zero SaaS externo)

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Admin**: React 19 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript + esbuild
- **Auth**: **Local** — bcrypt + JWT + SQLite (sem Firebase, sem Supabase)
- **Banco**: SQLite (better-sqlite3) em `Banco_de_dados/AlertaCAR/`
- **WhatsApp**: Baileys (WebSocket)
- **Mapas**: Leaflet + react-leaflet
- **Geo**: Turf.js + proj4js

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
└── docs/            # Planos e documentação

Banco_de_dados/AlertaCAR/               # Dados (fora do repo, na pasta de servidores)
└── alertacar.db     # SQLite
```

## 🔗 Links

- **Repo**: https://github.com/alvaro209890/AlertaCAR

## ✅ Testes de Integração (21/07/2026)

| Integração | Status | Detalhes |
|-----------|--------|----------|
| SCCON Token público | ✅ | JWT funcional, ~24h validade |
| SCCON WFS (bbox) | ✅ | 5+ alertas em 0.5°×0.5° |
| SCCON Detalhes | ✅ | classType, data, geometria Polygon |
| SCCON Busca paginada | ✅ | API `/api-v2/alerts/search` |
| SCCON Busca por CAR | ✅ | Endpoint suporta `cdCars`, aguarda teste com CAR válido |
| WFS SEMA (135 camadas) | ✅ | Auth key funcional, todas categorizadas |
| Embargos | ✅ | 5 camadas de embargo (SEMA + SIGA) |
| Licenciamento | ✅ | LP, LI, LO disponíveis |
| Infrações | ✅ | Autos de infração, notificações |

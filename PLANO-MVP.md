# Plano MVP — AlertaCAR

> ✅ Fases 1-3 concluídas. Fases 4-6 planejadas com features enriquecidas.

## Resumo

| Fase | Descrição | Checklist | Dias |
|------|-----------|-----------|------|
| 1 | Fundação — monorepo, auth local, backend base | ✅ 15/15 | 1-2 |
| 2 | CRUD CARs — WFS SEMA, busca polígono, dashboard | ✅ 12/12 | 1 |
| 3 | SCCON — alertas desmatamento, cron diário | ✅ 10/10 | 1 |
| 4 | SEMA — embargos, infrações, licenciamento, fundiário | 14 itens | 2 |
| 5 | WhatsApp + Frontend rico + Mapas + Downloads | 22 itens | 2-3 |
| 6 | Admin avançado + Relatórios + Deploy | 16 itens | 2 |

**Total: 8-10 dias para MVP completo e polido.**

---

## Fase 1 — Fundação ✅

### 1.1 Setup ✅
- [x] `mkdir -p Banco_de_dados/AlertaCAR/` (fora do repo!)
- [x] Monorepo: `app/`, `admin/`, `backend/`
- [x] Vite + React 19 + TS + Tailwind + shadcn/ui (app + admin)
- [x] Express + TS + esbuild (backend)
- [x] `.env.example` completo

### 1.2 Auth Local ✅
- [x] `POST /api/auth/register` — bcrypt 12 rounds, retorna JWT
- [x] `POST /api/auth/login` — verificar senha, retornar JWT
- [x] `GET /api/auth/me` — dados do usuário logado
- [x] Middleware `requireAuth` e `requireAdmin`
- [x] `JWT_SECRET` gerado e salvo no `.env`

### 1.3 Frontend Auth ✅
- [x] Página de login / cadastro (WhatsApp obrigatório)
- [x] `AuthContext` com token JWT no localStorage
- [x] Rota protegida, redirect se não autenticado
- [x] Dashboard vazio pós-login

---

## Fase 2 — CRUD de CARs ✅

### 2.1 WFS SEMA ✅
- [x] `wfs-sema.ts`: `fetchCarPolygon(carNumber)`
- [x] Conversão nº simplificado → `MTXXXXX/YYYY` (scan de anos)
- [x] Cache 30 dias SQLite, retry 3x com backoff
- [x] Extrai AREA_HA e NOMEPROPRIEDADE do WFS

### 2.2 Rotas ✅
- [x] `POST /api/cars` — busca WFS automática
- [x] `GET /api/cars` — lista com contagem de alertas
- [x] `GET /api/cars/:id` — detalhes + GeoJSON
- [x] `DELETE /api/cars/:id` — soft delete
- [x] `PATCH /api/cars/:id/refresh` — força atualização

### 2.3 Dashboard ✅
- [x] Cards com nº, município, área, badges
- [x] Empty state com CTA
- [x] Formulário "Adicionar CAR" com feedback

---

## Fase 3 — SCCON ✅

### 3.1 Serviço SCCON ✅
- [x] `getPublicToken()` — GET, cache 23h
- [x] `searchAlertsByCar(carNumber)` — POST `/alerts/search` com `cdCars`
- [x] Filtrar NOVOS por `source_id`, salvar em `alerts`
- [x] 8 classes de alerta: CUT, BURN_SCAR, SELECTIVE_EXTRACTION, etc.

### 3.2 Cron SCCON ✅
- [x] `node-cron`: `0 6 * * *` (America/Sao_Paulo)
- [x] `checkAllActiveCars()` — varre + salva + log
- [x] Endpoints: check manual, check-all, logs

### 3.3 Timeline no Frontend ✅
- [x] Botão "🔍 Verificar" e "📋 Alertas" em cada card
- [x] AlertTimeline com cores por classe
- [x] Status WhatsApp (pendente/enviado)

---

## Fase 4 — SEMA Multicamada + Frontend Rico

### 4.1 Embargos
- [ ] `wfs-sema.ts`: `fetchEmbargos(polygon)` — `AREAS_EMBARGADAS_SEMA` + `AREA_EMBARGADA_SIGA_POLIGONO`
- [ ] Detectar NOVOS embargos via spatial join
- [ ] Salvar como `source='sema_embargo'`

### 4.2 Infrações
- [ ] `fetchInfracoes(polygon)` — `TDAD_FISCALIZACAO_AUTO_DE_INFRACAO`
- [ ] `fetchNotificacoes(polygon)` — `TDAD_FISCALIZACAO_NOTIFICACAO`

### 4.3 Licenciamento
- [ ] `fetchLicenciamento(polygon)` — `SIMLAMGEO_LP/LI/LO_ATIVA`
- [ ] Alertar novas licenças ou vencimento próximo
- [ ] Detectar vencimento de licenças (30, 60, 90 dias)

### 4.4 Fundiário (sobreposições)
- [ ] `fetchSobreposicoes(polygon)` — UC, TI, Assentamentos INCRA/INTERMAT
- [ ] Alertar se polígono do CAR sobrepõe área restrita
- [ ] `fetchDesembargos(polygon)` — `AREAS_DESEMBARGADAS_SEMA`

### 4.5 Página de Detalhes do CAR (Frontend) ⭐
- [ ] Layout com abas: Visão Geral | Alertas | Mapa | Satélite | Documentos | Config
- [ ] Aba Visão Geral: resumo + gráfico de atividade 12 meses + status integrações
- [ ] Aba Alertas: timeline completa com filtros por classe/período
- [ ] Aba Mapa: Leaflet com polígono + alertas como markers + controle de camadas
- [ ] Aba Satélite: comparador antes/depois com slider (WMS SEMA)
- [ ] Aba Documentos: extrato CAR, licenças, autos (com links para SICAR)
- [ ] Aba Config: apelido, preferências de notificação por classe, frequência

### 4.6 Sistema de Downloads ⭐
- [ ] `GET /api/cars/:id/export?format=geojson|shp|kml` — polígono
- [ ] `GET /api/cars/:id/alerts/export?format=csv|geojson|json` — alertas
- [ ] `GET /api/cars/:id/report?format=pdf` — relatório PDF
- [ ] `GET /api/cars/:id/satellite?date=YYYY-MM-DD` — imagem
- [ ] UI: dropdown "📥 Baixar" em cada seção, toast ao concluir

### 4.7 Melhorias no Dashboard
- [ ] Mini-timeline inline nos cards (últimos 3 alertas)
- [ ] Stats cards: CARs, Área Total, Alertas, Último Check
- [ ] Dica inline: "Clique no card para ver detalhes"
- [ ] Modo de cadastro múltiplo: CAR, Matrícula, Coordenadas

---

## Fase 5 — WhatsApp + Mapas + UI Polida

### 5.1 Baileys (WhatsApp)
- [ ] Sessão persistente SQLite
- [ ] QR Code (base64) no painel admin
- [ ] Reconexão automática com handler `connection.update`
- [ ] `sendAlert(to, carNumber, alerts)` com template customizável
- [ ] Rate limiting: 1 msg/CAR/h, 10 msgs/user/dia
- [ ] Agrupar múltiplos alertas do mesmo CAR
- [ ] Fila com retry 3x + backoff

### 5.2 Mapa Interativo (Leaflet)
- [ ] Polígono do CAR (emerald, fill 15%, weight 2)
- [ ] CircleMarkers dos alertas SCCON (coloridos por classe)
- [ ] Popup com dados resumidos ao clicar
- [ ] Controle de camadas: satélite, relevo, político
- [ ] Cluster de markers (acima de 50)
- [ ] Ferramenta de medição (distância e área)
- [ ] Mini-mapa de overview
- [ ] Botões: "Zoom to CAR", "Zoom to alerts"

### 5.3 Comparador de Satélite
- [ ] Slider antes/depois usando WMS da SEMA
- [ ] Seleção de data do alerta
- [ ] Animação fade entre imagens
- [ ] Download das imagens em PNG

### 5.4 UI/UX Polimento
- [ ] Dark mode refinado (glassmorphism consistente)
- [ ] Animações: fadeIn, slideIn, pulse para alertas críticos
- [ ] Responsivo mobile-first
- [ ] Skeleton loaders em todas as listas
- [ ] Toast notifications (Sonner) para ações
- [ ] Onboarding: tour guiado de 3 passos no primeiro acesso

### 5.5 Notificações Browser
- [ ] Service Worker para push notifications
- [ ] Permission request no primeiro login
- [ ] Opção "Notificar também no navegador" nas configs

---

## Fase 6 — Admin Avançado + Relatórios + Deploy

### 6.1 Painel Admin — Páginas Novas
- [ ] **CARs**: tabela com busca, filtro, ações em massa, exportação
- [ ] **Alertas**: tabela com filtros avançados, reenvio WhatsApp, arquivamento
- [ ] **Relatórios**: gerador de PDF por CAR/período, agendamento semanal
- [ ] **Exportações**: CSV/GeoJSON/Shapefile em massa
- [ ] **Métricas do Servidor**: CPU, RAM, disco, serviços rodando

### 6.2 Gráficos (Recharts)
- [ ] Barras: alertas/dia (últimos 30 dias)
- [ ] Pizza: distribuição por classe de alerta
- [ ] Linha: crescimento de usuários e CARs
- [ ] Exportação PNG/SVG de cada gráfico

### 6.3 Relatórios PDF
- [ ] Template HTML → PDF com Puppeteer ou jsPDF
- [ ] Capa + resumo + timeline de alertas + mapa + recomendações
- [ ] Relatório individual (por CAR) ou consolidado (todos)
- [ ] Agendamento automático (semanal, mensal)
- [ ] Link de download temporário (expira em 24h)

### 6.4 Configurações Administrativas
- [ ] Horário do cron (padrão 06:00)
- [ ] Template WhatsApp customizável com variáveis
- [ ] Rate limiting ajustável
- [ ] Limite de CARs por usuário
- [ ] Manutenção: limpar alertas antigos, backup do banco

### 6.5 Deploy
- [ ] Systemd: `alertacar-backend.service` (Restart=always, porta 3002)
- [ ] Cloudflare Tunnel: 3 domínios → `localhost:3002`
  - `alertacar.cursar.space` (app)
  - `alertacar-admin.cursar.space` (admin)
  - `alertacar-api.cursar.space` (API)
- [ ] Script de deploy: build app + admin + backend → restart
- [ ] Smoke test: cadastro, login, add CAR, check SCCON

### 6.6 Segurança
- [ ] Rate limiting nas rotas públicas (express-rate-limit)
- [ ] Validação de input com Zod
- [ ] Helmet (headers de segurança)
- [ ] Log de auditoria (quem fez o quê, quando)
- [ ] Backup automático do banco (diário)

---

## Funcionalidades Futuras (pós-MVP)

### UX
- [ ] Compartilhar relatório via link temporário
- [ ] Múltiplos usuários por CAR (ex: proprietário + consultor)
- [ ] Alertas por email (fallback se WhatsApp offline)
- [ ] Integração com Google Calendar (lembretes de vencimento)
- [ ] App PWA (instalável no celular)
- [ ] Dark/light mode toggle manual
- [ ] Multi-idioma (PT-BR, EN, ES)

### Técnico
- [ ] API Key para acesso programático
- [ ] Webhook para integrar com outros sistemas
- [ ] 2FA para admin (TOTP)
- [ ] Gráfico de tendência NDVI ao longo do tempo
- [ ] Previsão de risco (ML: score de probabilidade de desmate)
- [ ] Migração SQLite → PostgreSQL (se escala exigir)

### Negócio
- [ ] Painel de assinatura/planos (free/premium)
- [ ] Integração com CarbonLink (créditos de carbono)
- [ ] White label para consultorias ambientais
- [ ] Marketplace de serviços (engenheiro florestal, advogado)

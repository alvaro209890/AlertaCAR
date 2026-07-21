# Frontend — App do Usuário

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS + shadcn/ui (mesmo padrão GeoForest)
- Firebase Auth (cliente)
- Wouter (roteamento leve)
- Leaflet + react-leaflet (mapa)
- Sonner (toast notifications)

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

### 3. Dashboard (`/dashboard`)

```
┌──────────────────────────────────────────────────────────┐
│  👤 Álvaro                            [ + Adicionar CAR ]│
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Seus CARs monitorados (3)                               │
│                                                          │
│  ┌─────────────────────┐ ┌─────────────────────┐        │
│  │ 🔵 MT27827/2017     │ │ 🔵 MT8019/2017      │        │
│  │ Cuiabá - MT         │ │ Várzea Grande - MT  │        │
│  │ 2.847 ha            │ │ 156.3 ha            │        │
│  │                     │ │                     │        │
│  │ Último check: 2h    │ │ Último check: 2h    │        │
│  │                     │ │                     │        │
│  │      🔴 3           │ │      ✅ 0           │        │
│  │   novos alertas     │ │  tudo tranquilo     │        │
│  │   [Ver detalhes →]  │ │  [Ver detalhes →]   │        │
│  └─────────────────────┘ └─────────────────────┘        │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Estado do card baseado em alertas**:
- 🔴 Alertas críticos (CUT, DEGRADATION): borda red, badge "3 novos"
- 🟢 Tudo ok: borda emerald sutil, badge "Monitorado ✅"

### 4. Adicionar CAR (modal ou `/dashboard/add`)

```
┌──────────────────────────────────────┐
│  Adicionar novo CAR                   │
│                                       │
│  Número do CAR                        │
│  ┌────────────────────────────────┐   │
│  │ MT-271442/2026          [Buscar]│  │
│  └────────────────────────────────┘   │
│                                       │
│  ⏳ Buscando dados na SEMA-MT...      │
│                                       │
│  ┌─ Resultado encontrado ──────────┐  │
│  │ ✅ CAR MT27827/2017              │  │
│  │ 📍 Cuiabá - MT                   │  │
│  │ 📐 2.847,32 hectares             │  │
│  │ 📋 Status: Ativo                 │  │
│  │                                   │  │
│  │ [✓ Confirmar monitoramento]      │  │
│  └──────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 5. Detalhes do CAR (`/dashboard/cars/:id`)

```
┌──────────────────────────────────────────────────────────┐
│  ← Voltar                                                │
│                                                          │
│  MT27827/2017                    Status: ✅ Ativo         │
│  Cuiabá - MT   •   2.847 ha                             │
│                                                          │
│  [🔄 Forçar verificação]  [🗑️ Remover monitoramento]     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌───────────────────────────────┐ │
│  │                  │  │  Alertas detectados            │ │
│  │    MAPA          │  │                                │ │
│  │   Leaflet        │  │  🔴 Desmatamento (CUT)        │ │
│  │                  │  │  27/12/2019 • 12.5 ha          │ │
│  │  ┌────────┐      │  │  WhatsApp ✅ Enviado           │ │
│  │  │polígono│      │  │                                │ │
│  │  │  CAR   │      │  │  🟠 Degradação                │ │
│  │  └────────┘      │  │  15/03/2020 • 2.3 ha           │ │
│  │   🔴 ● 🟠        │  │  WhatsApp ✅ Enviado           │ │
│  │  alertas SCCON   │  │                                │ │
│  └──────────────────┘  │  🟡 Queimada (BURN_SCAR)       │ │
│                         │  10/08/2020 • 8.1 ha           │ │
│                         │  WhatsApp ✅ Enviado           │ │
│                         └────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 6. Perfil (`/dashboard/profile`)

- Avatar (iniciais)
- Nome, email
- WhatsApp (editável)
- Estatísticas: CARs ativos, total alertas
- Botão "Excluir conta" (com dupla confirmação)

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
</MapContainer>
```

---

## Estados de UI (todos os componentes)

| Estado | Comportamento |
|--------|---------------|
| **Loading** | Skeleton cards com shimmer animation |
| **Empty** | Ilustração SVG + "Você ainda não monitora nenhum CAR" + CTA |
| **Error** | Banner com ícone, mensagem, botão "Tentar novamente" |
| **Success** | Dados renderizados com fade-in |

---

## Responsividade

- **Mobile**: cards em lista vertical, sidebar vira bottom nav
- **Tablet/Desktop**: grid de 2-3 colunas para CARs
- **Mapa**: altura fixa 400px, ocupa largura total

# UIUX.md — MK Projetos (Mika)
> **Leia este arquivo inteiro antes de qualquer alteração de interface. É a fonte da verdade de design do Mika, complementar ao AGENTS.md.**
> Toda decisão de cor, espaçamento, componente e comportamento visual está definida aqui.
> **Nunca improvise estilo inline. Nunca use cores fora do sistema de tokens. Nunca quebre as regras de layout definidas neste arquivo.**

---

## 1. Direção Visual

- Mika é uma ferramenta operacional para escritório de engenharia: **densa, escaneável, previsível e dark-only**.
- A referência visual é Linear-style: fundos em camadas, bordas sutis, texto claro, foco em alinhamento e leitura.
- Não criar landing page, hero, cards decorativos, gradientes chamativos, ilustrações ornamentais ou layouts de marketing dentro do app.
- A UI deve favorecer uso repetido em LAN por equipe técnica: menos ornamento, mais consistência, densidade e controles claros.
- Textos visíveis na UI devem preservar caracteres especiais em português (acentos, cedilha e til). Dados importados sem acento devem ser normalizados para exibição quando forem labels globais conhecidas.
- Labels globais conhecidos devem usar acentuação correta: `REVISÃO`, `ANÁLISE`, `DEFINIÇÃO`, `Elétrico`, `Concluídas`, `Responsável`, `Sem responsável`, `Sem seção`, `Dias Conclusão`.
- Todo arquivo de UI e documentação deve ser salvo e revisado como UTF-8 real. Nunca commitar mojibake como `Ã©`, `Ã§`, `Ã£`, `Â`, `â€”`, `â‰¤` ou sequências similares.
- Antes de finalizar alteração visual, pesquisar nos arquivos tocados por padrões de mojibake (`Ã`, `Â`, `â`) e por labels globais sem acento (`REVISAO`, `ANALISE`, `DEFINICAO`, `responsavel`, `Conclusao`).

---

## 2. Tokens de Design (CSS Variables)

Definidos em `apps/client/src/styles/globals.css`. **Nunca usar cores hardcoded no código.**

### 2.1 Fundos

```css
--bg-0: #0d0d0f;      /* Fundo raiz da aplicação (body) */
--bg-1: #111114;      /* Sidebar, painéis laterais */
--bg-2: #18181c;      /* Cards, modais, painéis flutuantes */
--bg-3: #1e1e23;      /* Inputs, dropdowns, tooltips */
--bg-4: #26262d;      /* Hover de item em lista, separadores visuais */
```

### 2.2 Bordas

```css
--color-border:        rgba(255,255,255,0.08);
--color-border-subtle: rgba(255,255,255,0.04);
--color-border-focus:  rgba(255,255,255,0.20);
```

### 2.3 Texto

```css
--color-text-primary:   #e8e8ec;   /* Títulos, labels de campo, valores preenchidos */
--color-text-secondary: #9999a8;   /* Labels de campo, subtítulos */
--color-text-muted:     #5a5a6e;   /* Placeholders, metadados, células vazias */
--color-text-disabled:  #3a3a4a;
```

### 2.4 Marca MK

```css
--color-brand-orange:       #f26522;
--color-brand-orange-hover: #d95a18;
--color-brand-orange-muted: rgba(242,101,34,0.15);
```

### 2.5 Status — SISTEMA DE CORES TRAVADO

> **Regra crítica:** chips de status usam fundo translúcido (alpha 15%) + texto na mesma tonalidade porém claro.
> ❌ NUNCA usar cores 100% sólidas saturadas como fundo de chip.
> ❌ NUNCA usar `bg-blue-500`, `bg-yellow-400`, `text-white` sobre fundo colorido saturado.

```css
--status-todo-bg:           rgba(148,163,184,0.15);
--status-todo-text:          #94a3b8;

--status-scheduled-bg:      rgba(100,116,139,0.15);
--status-scheduled-text:     #7c8fa3;

--status-inprogress-bg:     rgba(59,130,246,0.15);
--status-inprogress-text:    #60a5fa;

--status-review-bg:         rgba(245,158,11,0.15);
--status-review-text:        #fbbf24;

--status-analysis-bg:       rgba(168,85,247,0.15);
--status-analysis-text:      #c084fc;

--status-waiting-bg:        rgba(249,115,22,0.15);
--status-waiting-text:       #fb923c;

--status-late-bg:           rgba(239,68,68,0.15);
--status-late-text:          #f87171;

--status-done-bg:           rgba(34,197,94,0.15);
--status-done-text:          #4ade80;
```

**Mapeamento enum → token:**

| Valor | bg token | text token |
|---|---|---|
| `A_FAZER` | `--status-todo-bg` | `--status-todo-text` |
| `NO_CRONOGRAMA` | `--status-scheduled-bg` | `--status-scheduled-text` |
| `EM_ANDAMENTO` | `--status-inprogress-bg` | `--status-inprogress-text` |
| `AGUARDANDO_REVISAO` | `--status-review-bg` | `--status-review-text` |
| `EM_ANALISE` | `--status-analysis-bg` | `--status-analysis-text` |
| `AGUARDANDO_DEFINICAO` | `--status-waiting-bg` | `--status-waiting-text` |
| `ATRASADO` | `--status-late-bg` | `--status-late-text` |
| `FINALIZADO` | `--status-done-bg` | `--status-done-text` |

### 2.6 Prioridade

```css
--priority-urgent-bg:   rgba(239,68,68,0.15);   --priority-urgent-text:  #f87171;
--priority-high-bg:     rgba(249,115,22,0.15);  --priority-high-text:    #fb923c;
--priority-medium-bg:   rgba(234,179,8,0.15);   --priority-medium-text:  #facc15;
--priority-low-bg:      rgba(148,163,184,0.15); --priority-low-text:     #94a3b8;
--priority-none-bg:     rgba(71,85,105,0.15);   --priority-none-text:    #64748b;
```

### 2.7 Disciplina

```css
--disc-ele-bg:    rgba(59,130,246,0.15);   --disc-ele-text:   #60a5fa;
--disc-spda-bg:   rgba(168,85,247,0.15);   --disc-spda-text:  #c084fc;
--disc-tel-bg:    rgba(20,184,166,0.15);   --disc-tel-text:   #2dd4bf;
--disc-hid-bg:    rgba(14,165,233,0.15);   --disc-hid-text:   #38bdf8;
--disc-ppci-bg:   rgba(239,68,68,0.15);    --disc-ppci-text:  #f87171;
--disc-hvac-bg:   rgba(34,197,94,0.15);    --disc-hvac-text:  #4ade80;
--disc-coord-bg:  rgba(249,115,22,0.15);   --disc-coord-text: #fb923c;
--disc-ep-bg:     rgba(234,179,8,0.15);    --disc-ep-text:    #facc15;
--disc-none-bg:   rgba(71,85,105,0.15);    --disc-none-text:  #64748b;
```

### 2.8 Plataforma

```css
--plat-cad-bg:    rgba(59,130,246,0.12);   --plat-cad-text:   #7db3f5;
--plat-revit-bg:  rgba(20,184,166,0.12);   --plat-revit-text: #5dcfbe;
--plat-coord-bg:  rgba(249,115,22,0.12);   --plat-coord-text: #f5a878;
--plat-none-bg:   rgba(71,85,105,0.12);    --plat-none-text:  #64748b;
```

### 2.9 Resolução de cor importada do Asana

Toda cor vinda do Asana (campo `color` de seção, projeto ou tag) **não pode** ser usada diretamente no CSS.
Deve passar por uma função `resolveAsanaColor(color: string)` no client que retorna `{ bg: string, text: string }` com alpha e texto sempre legível. Cores sem mapeamento recebem o token `--disc-none-*`.

---

## 3. Componente: Chip / Badge

O chip é o componente de exibição de enums. **Regra única para todos os chips do sistema.**

### Anatomia

```
padding-x: 8px | padding-y: 3px | border-radius: 4px | font-size: 11px | font-weight: 500 | letter-spacing: 0.02em
```

### Implementação Tailwind

```tsx
<span
  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tracking-wide whitespace-nowrap"
  style={{
    backgroundColor: `var(--status-${key}-bg)`,
    color: `var(--status-${key}-text)`,
  }}
>
  {label}
</span>
```

### Regras invioláveis

- ❌ NUNCA cor sólida como fundo de chip (sem alpha)
- ❌ NUNCA bolinha lateral como único indicador — o chip inteiro é o indicador
- ❌ NUNCA hex hardcoded — sempre CSS variable
- ❌ NUNCA dois padrões visuais para o mesmo enum na mesma tela
- ✅ Sempre `whitespace-nowrap` para evitar quebra de linha
- ✅ Chips em células de tabela com largura mínima suficiente para o texto mais longo do enum

---

## 4. Campos Fixos de Tarefa (Global Custom Fields)

> **Decisão arquitetural travada:** Os campos custom do Asana são importados como campos **fixos** da model `Task`. Não existe UI para criar, remover ou configurar campos por projeto. Campos são definidos em código e schema.

### 4.1 Campos fixos a adicionar na model Task

| Campo Prisma | Label exibida | Tipo | Enum / Formato |
|---|---|---|---|
| `platform` | Plataforma | `String?` | `CAD`, `REVIT`, `COORD` |
| `discipline` | Disciplina | `String?` | `ELE`, `SPDA`, `TEL`, `HID`, `PPCI`, `HVAC`, `COORD`, `EP` |
| `estimatedTime` | Dias Estimados | `Float?` | decimal, ex: `2.5` |
| `maxDeadline` | Prazo Máximo | `DateTime?` | datepicker compartilhado |
| `conclusionDays` | Dias Conclusão | `Float?` | decimal |
| `stage` | Etapa | `String?` | texto livre |

> O campo legado `estimatedTime` importado do Asana (`Estimated time`) deve ser migrado para este campo. Se houver duplicata, o valor importado prevalece e o campo legado fica oculto nas telas principais.

### 4.2 Migração obrigatória

```bash
pnpm --filter server prisma migrate dev --name add-task-fixed-fields
```

### 4.3 Ordem fixa de exibição dos campos no TaskDetail

1. Status (localStatus)
2. Plataforma
3. Disciplina
4. Status de Conclusão (campo `completed` / `completedAt`)
5. Prazo Máximo
6. Dias Estimados
7. Dias Conclusão
8. Etapa

Campos com valor vazio devem ser exibidos na mesma posição e com a mesma altura, mostrando `—` em `--color-text-muted`.

---

## 5. Layout: Modal / Painel de Detalhe de Tarefa (TaskDetail)

### 5.1 Estrutura

```
┌──────────────────────────────────────────────┐
│ [ícone]  [Título editável inline]    [X]      │  ← cabeçalho: px-6 py-4, bg-2, border-b
├──────────────────────────────────────────────┤
│                                              │
│  CAMPOS — grid 2 colunas fixas               │
│  ┌─────────────────┬──────────────────────┐  │
│  │ label 140px     │ valor flex-1         │  │
│  │ (13px, muted)   │ (chip / input / data)│  │
│  └─────────────────┴──────────────────────┘  │
│  (cada linha: min-h-[32px], border-b subtle) │
│                                              │
│  COMENTÁRIOS                                 │
│  [área de comentários + input]               │
└──────────────────────────────────────────────┘
```

### 5.2 Grid de campos — implementação

```tsx
<div className="grid grid-cols-[140px_1fr] gap-x-4">
  {fields.map(field => (
    <React.Fragment key={field.key}>
      <div className="flex items-center min-h-8 border-b border-[--color-border-subtle]">
        <span className="text-[13px] text-[--color-text-secondary]">
          {field.label}
        </span>
      </div>
      <div className="flex items-center min-h-8 border-b border-[--color-border-subtle]">
        {field.render()}
      </div>
    </React.Fragment>
  ))}
</div>
```

### 5.3 Regras de alinhamento

- Coluna de label: **sempre 140px fixos** — nunca auto, nunca minmax sem mínimo
- Label: `text-[13px] text-[--color-text-secondary] font-normal`
- Valor: alinhado ao topo do label, nunca deslocado verticalmente
- Cada linha: `min-h-[32px]`, `items-center`
- Separador: `border-b border-[--color-border-subtle]`
- **Nunca usar `<table>` para layout de campos** — usar CSS Grid

### 5.4 Cabeçalho do modal

- Fundo: `--bg-2`, borda inferior: `--color-border`
- Título: input editável inline, `text-[16px] font-semibold text-[--color-text-primary]`
- Botão X: ícone lucide 16px, `text-[--color-text-muted]`, hover `text-[--color-text-primary]`
- Padding: `px-6 py-4`

---

## 6. Layout: Visualização em Lista (aba Lista)

### 6.1 Colunas e larguras

| # | Coluna | Largura | Alinhamento | Conteúdo |
|---|---|---|---|---|
| 1 | Tarefa | `minmax(200px,1fr)` | esquerda | texto `truncate` |
| 2 | Seção | `120px` | esquerda | texto `truncate` |
| 3 | Responsável | `140px` | esquerda | avatar 20px + nome `truncate` |
| 4 | Status | `150px` | esquerda | chip status |
| 5 | Plataforma | `90px` | centro | chip plataforma |
| 6 | Disciplina | `100px` | centro | chip disciplina |
| 7 | Status Conclusão | `120px` | centro | chip Concluída / Aberta |
| 8 | Prazo Máximo | `120px` | esquerda | `dd/MM/yyyy` |
| 9 | Dias Estimados | `90px` | direita | decimal `font-mono text-[12px]` |
| 10 | Dias Conclusão | `90px` | direita | decimal `font-mono text-[12px]` |
| 11 | Etapa | `80px` | esquerda | texto `truncate` |

### 6.2 Estrutura CSS

```tsx
<div className="overflow-x-auto w-full">
  <table className="w-full border-collapse table-fixed min-w-[1100px]">
    <thead className="sticky top-0 z-10 bg-[--bg-1]">
      <tr className="border-b border-[--color-border]">
        {/* th: text-[11px] font-medium text-[--color-text-muted] uppercase tracking-widest px-3 py-2 */}
      </tr>
    </thead>
    <tbody>
      {/* tr: border-b border-[--color-border-subtle] hover:bg-[--bg-3] transition-colors */}
      {/* td: px-3 py-2 text-[13px] text-[--color-text-primary] */}
    </tbody>
  </table>
</div>
```

### 6.3 Regras da tabela

- `table-fixed` obrigatório — controla larguras
- `min-w-[1100px]` + `overflow-x-auto` no container (scroll horizontal controlado no container, nunca dentro de células)
- Células longas: classe `truncate` (overflow hidden + ellipsis)
- Header: fundo `--bg-1`, `sticky top-0 z-10`
- Linhas alternadas: **não usar** — apenas hover `--bg-3`
- Altura de linha estável: `py-2`, nenhum controle pode mudar a altura da linha no hover
- Coluna de responsável: `<img className="w-5 h-5 rounded-full mr-1.5 inline-block">` + nome `truncate`
- Colunas numéricas (Dias): `text-right font-mono text-[12px]`
- As colunas dos campos globais devem vir do catálogo global definido neste arquivo, **não** dos campos presentes nas tarefas filtradas

### 6.4 Célula vazia

Quando um campo não tem valor: exibir `—` (en dash `&mdash;`) em `text-[--color-text-muted]`. Nunca deixar célula em branco.

### 6.5 Ordenação de colunas

- Header clicável exibe ícone lucide `ChevronsUpDown` (inativo) / `ChevronUp` / `ChevronDown` (ativo), 12px
- Ícone aparece no hover do `th` e permanece visível na coluna ativa
- Coluna ativa: header com `text-[--color-text-primary]`

---

## 7. Chips, Inputs e Dropdowns

### 7.1 Regra geral de inputs

Todo input, select, textarea e datepicker deve ter dark styling explícito. **Nunca depender do estilo nativo claro do browser.**

```tsx
// Classe base — usar em todos os inputs do app
const inputBase = [
  "bg-[--bg-3]",
  "border border-[--color-border]",
  "text-[--color-text-primary]",
  "rounded-md text-[13px]",
  "px-3 py-1.5",
  "focus:outline-none focus:border-[--color-border-focus]",
  "placeholder:text-[--color-text-muted]",
  "w-full",
].join(" ")
```

### 7.2 Input numérico (dias, horas)

- ❌ NUNCA `<input type="number">` — sempre `<input type="text" inputMode="decimal">`
- Sem steppers/spinners nativos
- Aceitar `.` e `,` como separador decimal — normalizar para `.` no submit
- Placeholder: `"Ex: 2.5"`

### 7.3 Datepicker

- ❌ NUNCA `<input type="date">` cru
- ✅ Sempre o componente `DatePicker` compartilhado (Radix + date-fns)
- Formato de exibição: `dd/MM/yyyy`
- Formato interno: ISO 8601

### 7.4 Dropdown pesquisável (Combobox)

- Enums editáveis (Status, Plataforma, Disciplina, Responsável) usam Combobox com campo de busca interno
- Nenhum dropdown pode ter scroll horizontal
- Cada item exibe o chip colorido à esquerda + label à direita
- Largura mínima do popover: `200px`; máxima: `320px`
- Texto longo: `truncate` no final, nunca quebra de linha dentro do item
- Item selecionado: fundo `--bg-4` permanente

### 7.5 Dropdown de status — layout interno

```
┌─────────────────────────────────┐
│ 🔍 Buscar Status...             │  ← input bg-[--bg-4]
├─────────────────────────────────┤
│  [chip A fazer         ]        │
│  [chip No Cronograma   ]        │
│  [chip Em andamento    ]        │
│  [chip Ag. Revisão     ]        │
│  [chip Em Análise      ]        │
│  [chip Ag. Definição   ]        │
│  [chip Atrasado        ]        │
│  [chip Finalizado      ]        │
└─────────────────────────────────┘
```

- Cada linha: `flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[--bg-4] rounded-md mx-1`
- O chip dentro do dropdown tem a mesma aparência do chip na tarefa
- ❌ NUNCA checkbox lateral em dropdown de status

### 7.6 Filtro textual de listas

- Filtros textuais refinam somente a lista ou tabela em que aparecem; não substituem nem abrem a busca global.
- Devem ficar em uma toolbar ligada visualmente aos resultados, com rótulo persistente e escopo explícito.
- O campo usa debounce de 250 ms e consulta o servidor quando a lista é paginada.
- Durante a atualização, manter os resultados anteriores visíveis e exibir um indicador discreto.
- Quando houver texto, oferecer ação explícita para limpar o filtro.
- A vista de Projetos ativos usa o rótulo `Filtrar projetos`, o escopo `Somente nesta lista` e o placeholder `Nome ou construtora`.

---

## 8. Painel de Tarefa — Separação de Conceitos

A tarefa tem dois conceitos de estado distintos que **nunca devem ser visualmente confundidos**:

| Campo | Nome exibido | Conceito | Valores |
|---|---|---|---|
| `completed` / `completedAt` | Status de Conclusão | Entrega final (herdado Asana) | `Concluída` / `Aberta` |
| `localStatus` | Status | Fluxo operacional do Mika | enum localStatus |

- `Status de Conclusão` usa chip verde (`--status-done-*`) ou cinza (`--status-todo-*`)
- `Status` usa o sistema completo de chips por enum
- Os dois campos devem ter labels claramente diferentes — nunca nomear ambos de "Status"

---

## 9. Sidebar

- Largura: `240px` (expandida), `56px` (colapsada)
- Fundo: `--bg-1`, borda direita: `--color-border-subtle`
- Itens: `h-8 px-3 text-[13px] rounded-md`
- Item ativo: `bg-[--bg-3] text-[--color-text-primary]`
- Item inativo: `text-[--color-text-secondary] hover:bg-[--bg-3] hover:text-[--color-text-primary]`
- Ícones: lucide-react, 16px

---

## 10. Kanban

### Colunas

- Fundo: `--bg-1`
- Largura: `w-80`; altura: `h-[calc(100vh-230px)] min-h-[520px]`
- Padding: `p-3`; espaçamento horizontal entre colunas: `gap-4`
- Header: título `text-sm font-bold text-[--color-text-primary]` + label canônica do status `text-xs text-[--color-text-muted]`
- Contador: `bg-[--bg-4] text-[--color-text-secondary] text-[11px] px-1.5 py-0.5 rounded`
- Conteúdo: scroll vertical interno, `gap-3`; estado vazio compartilhado `Nenhuma tarefa aqui`
- Minhas Tarefas, Projeto e Sprint Boards usam a mesma geometria de coluna. Filtros, criação e paginação permanecem específicos de cada página.

### Cards

- Superfície inteira: fundo translúcido e borda definidos por `statusTimelineStyle`, `rounded-md`
- Padding: `px-3 py-3`
- Título: texto do status, `text-sm font-semibold`, máx 2 linhas
- Anatomia canônica nos Kanbans por status: título + avatar, projeto, responsável, data efetiva (`maxDeadline` ou entrega), prioridade, disciplina e Status de Conclusão.
- Projeto, responsável e data mantêm texto neutro para preservar hierarquia e contraste.
- O chip de Status operacional não aparece dentro dos Kanbans organizados por status; o cabeçalho da coluna e a superfície do card já comunicam esse valor. O chip de Status de Conclusão permanece.
- O mesmo contrato de superfície deve ser usado em Minhas Tarefas, Projeto, Sprint Boards e Quadro do Time, inclusive variantes compactas. No Quadro do Time, preservar métricas, alertas, faixa de prioridade e chip textual de Status.
- Badge de seção: chip `--disc-*`, `text-[10px]`
- Estado dragging: `opacity-70 shadow-2xl scale-[1.02]`
- Todo card/linha clicável que representa uma tarefa deve suportar o menu de contexto da tarefa no clique direito, usando `TaskContextMenu` ou o equivalente compartilhado. O menu deve preservar ações esperadas como abrir detalhes, copiar link, abrir projeto, alterar status, duplicar, recalcular datas e excluir quando a permissão permitir.

### Vista Calendário (Minhas Tarefas)

- Barras de tarefa seguem o mesmo contrato visual da Carga de Trabalho: fundo translúcido por status (`statusTimelineStyle`), borda na mesma tonalidade, `rounded-md`, `shadow-sm`.
- Tarefa concluída (`completed`): `opacity: 0.45` sobre a barra; cores de status permanecem.
- Rótulo em duas linhas via `workloadTaskDisplayLabel(task, "global")`: título `text-[11px] font-semibold` + nome do projeto `text-[9px] text-text-secondary/80`.
- Sem truncamento opaco (`+N tarefas`); tarefas sobrepostas empilham em faixas (`assignLanes`) e a semana expande em altura.
- Posicionamento por coluna com inset lateral (`calc(col * 100%/7 + 2px)`); barras não invadem a coluna vizinha.
- Scroll vertical contínuo entre meses; cabeçalho de mês sticky; toolbar (`‹` / `Hoje` / `›`) controla scroll e o rótulo do mês acompanha o viewport.

---

## 11. Tipografia

- Fonte: `Inter` com `font-feature-settings: 'cv02','cv03','cv04','cv11'`

| Uso | Tamanho | Peso |
|---|---|---|
| Título de página | 20px | 600 |
| Título de modal | 16px | 600 |
| Label de campo | 13px | 400 |
| Corpo / células | 13px | 400 |
| Texto secundário | 12px | 400 |
| Headers de tabela | 11px | 500 |
| Chips / badges | 11px | 500 |
| Números decimais | 12px | 400 (mono) |

---

## 12. Animações

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
```

- Modais: `fade-in` + `slide-up` 200ms `--ease-out-expo`
- Dropdowns: `fade-in` + `zoom-in-95` 150ms `ease-out`
- Hover linha/card: `transition-colors duration-100`
- Drag & drop: `transition-transform duration-150`
- ❌ Nunca animar `width`/`height` diretamente — usar `transform` e `opacity`

---

## 13. Estados de UI

### 13.1 Caixa de notificações

- O sino abre um `Popover` compacto com no máximo 8 itens recentes; o histórico completo fica em `/notifications`.
- Cada item usa avatar do ator quando disponível, com ícone do tipo sobreposto. Eventos automáticos usam apenas o ícone do tipo.
- O título é o nome do ator; a linha secundária descreve a ação (`comentou`, `mencionou`, `atribuiu`, `alterou`, `solicitou revisão`).
- A mensagem é texto limpo em no máximo duas linhas. Nunca renderizar imagens, listas ou blocos Markdown dentro da caixa de notificações.
- Itens não lidos usam fundo `--color-brand-orange-muted` sutil e marcador complementar; nunca depender apenas de uma bolinha lateral.
- A data é relativa na interface e disponibiliza `dd/MM/yyyy às HH:mm` no atributo `title`.
- A página agrupa os itens em `Hoje`, `Ontem` e `Anteriores`, com abas `Todas` / `Não lidas`, filtro por tipo e paginação.
- Clicar no corpo abre o destino relacionado. A ação de marcar como lida/não lida deve ser independente e não pode disparar navegação.
- Leitura individual e em massa usa atualização otimista com rollback e toast em erro.
- Popover e página não podem ter scroll horizontal; nomes e mensagens longas usam truncamento limpo.

### Loading

- Listas curtas (≤10 itens): `LoadingSpinner` centralizado
- Listas longas: skeleton de linhas `animate-pulse bg-[--bg-4]`

### Empty State

- Componente `EmptyState`: ícone lucide 40px `text-[--color-text-muted]` + título + subtítulo
- Nunca deixar área em branco sem indicação

### Erro

- Toast Sonner para erros de ação (PATCH, POST, DELETE)
- Banner inline para erros de carregamento de página
- Formato: `{ error: string, details?: unknown }`

---

## 14. Performance: Listas Grandes

- Telas operacionais nunca devem carregar a base inteira de projetos/tarefas no primeiro render.
- Vistas com muitos registros devem usar paginação, lazy-loading, infinite scroll ou virtualização.
- Boards Kanban/Sprint devem paginar por coluna/status, carregando mais itens apenas quando o usuário rolar aquela coluna.
- Contadores totais devem vir de endpoints agregados, nunca do tamanho do array carregado no client.
- Limite padrão por página: 25 itens; limite máximo: 50 itens, salvo justificativa explícita.
- Renderizar somente itens necessários para a interação atual; evitar centenas de cards/linhas simultâneos no DOM.

---

## 15. Acessibilidade Mínima

- Todo elemento interativo: `focus-visible:ring-2 ring-[--color-brand-orange] ring-offset-1 ring-offset-[--bg-2]`
- Ícones decorativos: `aria-hidden="true"`
- Ícones funcionais sem label de texto: `aria-label` obrigatório

---

## 16. QA Visual (Playwright)

- Usar Playwright ao alterar TaskDetail, TaskCreateSheet, tabela Lista, dropdowns, datepickers, chips coloridos ou responsividade
- Após mudanças relevantes de UI, validar em desktop e viewport menor:
  - Sem texto cortado de forma incoerente
  - Sem sobreposição de elementos
  - Sem campo com estilo claro nativo vazando
  - Sem chip ilegível (contraste insuficiente)
  - Sem tabela desalinhada ou quebrando layout

---

## 17. Checklist — O que NUNCA fazer

- ❌ `bg-blue-500`, `bg-yellow-400`, `bg-pink-500` como fundo de chip — usar tokens
- ❌ `text-white` sobre fundo colorido saturado
- ❌ Bolinha lateral como único indicador visual de status
- ❌ `<input type="number">` — sempre `type="text" inputMode="decimal"`
- ❌ `<input type="date">` cru — sempre datepicker compartilhado
- ❌ Dois padrões visuais diferentes para o mesmo enum na mesma tela
- ❌ Células de tabela vazias (usar `—`)
- ❌ Tabela sem `table-fixed` e sem larguras definidas
- ❌ Scroll horizontal dentro de popover/dropdown
- ❌ Campos custom configuráveis por projeto — campos são fixos em código
- ❌ Cor hexadecimal hardcoded fora dos tokens CSS
- ❌ Bloquear edição inline aguardando `invalidateQueries` + refetch do servidor

---

## 18. Atualização otimista de mutations

### Quando aplicar

- Toda edição inline em tabela/lista (projetos, tarefas, status, dropdowns) **deve** atualizar o cache antes da resposta HTTP.
- Formulários modais de save único seguem o mesmo contrato quando o usuário espera feedback imediato.

### Contrato TanStack Query

1. **`onMutate`**: cancelar queries concorrentes das mesmas keys; snapshot do estado anterior no `context`; `setQueryData` com valor otimista.
2. **`onError`**: restaurar snapshot; toast Sonner (mensagem em português).
3. **`onSuccess`**: reconciliar com payload do servidor (`setQueryData`), não depender só de `invalidateQueries`.
4. **`onSettled`**: invalidar apenas quando a mutation altera escopo amplo (ex.: mover tarefa entre projetos) ou quando não há DTO confiável para merge.
5. **Proibido** para PATCH de campo único: UI que só muda após `invalidateQueries` + refetch.

### Referências de implementação

- Tarefas: `apps/client/src/hooks/useTasks.ts` (`useUpdateTask`)
- Projetos: `apps/client/src/hooks/useProjects.ts` (`usePatchProject`, `useUpdateProject`) + `apps/client/src/lib/projectCache.ts`

### UX esperada

- Chip, texto e ordenação mudam no mesmo frame da interação.
- Em erro, valor volta ao anterior sem refresh manual.
- Sem spinner por campo em PATCH inline.
- Não alterar campos de ordenação (ex.: `updatedAt`) no patch otimista — isso evita o item “pular” na lista e voltar quando o servidor reconcilia.

---

## 19. Área de Anotações e Reuniões

- A página de projeto usa uma única navegação principal: `Tarefas | Anotações | Atas de reunião`.
- Apenas `Tarefas` possui navegação secundária `Lista | Quadro`; documentos não usam subabas internas.
- A ação contextual fica à direita da navegação principal: `Criar tarefa`, `Nova anotação` ou `Nova ata`.
- Em desktop, usar lista de 320px à esquerda e painel de leitura/edição flexível à direita.
- Em viewport estreito, exibir lista ou painel por vez, com ação explícita de voltar.
- Lista deve ter busca com debounce, paginação de 25 itens, título truncado e metadados secundários.
- O painel de leitura tem um único cabeçalho com título, autoria, datas e ações; nunca repetir o título no corpo.
- A leitura usa uma superfície contínua com seções separadas por bordas: `Conteúdo | Anexos` para anotações e `Participantes | Registro da reunião | Anexos` para atas.
- Participantes internos usam chips com avatar e nome; participantes externos usam chips identificados por `Externo`.
- O conteúdo usa largura máxima de 5xl e não deve criar cards internos ao redor de cada seção.
- Edição usa título, editor markdown compartilhado e documentos anexos; atas adicionam datepicker, horário dark, usuários pesquisáveis e participantes externos.
- Exclusão de documento exige Dialog com título acessível e confirmação explícita.
- Conflito HTTP 409 preserva o conteúdo local e oferece ação para carregar a versão atual.
- Não usar cards decorativos, feed misto ou scroll horizontal nessa área.

---

*Última atualização: 2026 · MK Engenharia · Balneário Camboriú/SC*

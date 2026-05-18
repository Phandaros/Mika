# AGENTS.md — MK Projetos
> **Leia este arquivo inteiro antes de qualquer ação. Ele é a fonte da verdade do projeto.**
> Toda decisão de arquitetura, stack, nomenclatura e convenção já está definida aqui.
> **Nunca proponha alternativas às decisões travadas. Implemente exatamente o que está descrito.**

---

## 1. Visão Geral do Produto

**MK Projetos** é um gerenciador de tarefas para escritório de engenharia (MK Engenharia, Balneário Camboriú/SC), substituindo o Asana. Roda em rede local (LAN): um PC Windows hospeda o servidor, os demais acessam via navegador pelo IP da rede. Também terá um app desktop Windows via Electron, funcionando como shell nativo do client React/Vite, sem duplicar regra de negócio nem criar outro frontend.

**Hierarquia de dados (produto):**
```
Projeto → Secao (Asana Section) → Tarefa
```
No modelo importado do Asana, **Section** e a unidade entre projeto e tarefa. O client ainda expoe o tipo compartilhado `Discipline` como alias de `Section` por compatibilidade. Nao ha sub-tarefas como entidade de produto; relacoes `parentId` no banco sao legado Asana.

---

## 2. Stack — TRAVADA, NÃO ALTERAR

### Gerenciador de pacotes
- **SEMPRE `pnpm`**. Nunca `npm`, nunca `yarn`, nunca `bun`.
- Comandos: `pnpm install`, `pnpm add`, `pnpm run`, `pnpm -r` (recursivo).
- Arquivo de lock: `pnpm-lock.yaml`. Nunca commitar `package-lock.json` ou `yarn.lock`.

### Monorepo
- **Turborepo** (`turbo`) para orquestração de scripts.
- Workspaces definidos em `pnpm-workspace.yaml`.
- Três apps (`apps/server`, `apps/client`, `apps/desktop`) e um pacote compartilhado (`packages/shared`).

### Backend — `apps/server`
| Tecnologia | Versão mínima | Observação |
|---|---|---|
| Node.js | 20 LTS | Motor de execução |
| TypeScript | 5.x | `strict: true` obrigatório |
| Express | 4.x | Framework HTTP |
| Prisma | 5.x | ORM + migrations |
| SQLite (better-sqlite3) | via Prisma | Arquivo único `data/mk-projetos.db` |
| JWT (jsonwebtoken) | 9.x | Autenticação stateless |
| bcrypt | 5.x | Hash de senhas |
| Socket.io | 4.x | Notificações in-app em tempo real |
| Multer | 1.x LTS | Upload de arquivos (Fase 2; endpoint pode retornar 501) |
| Zod | 3.x | Validação de schemas de entrada |
| cors | 2.x | Liberar acesso da LAN |
| dotenv | 16.x | Variáveis de ambiente |
| tsx | latest | Dev runner (nunca ts-node) |

### Frontend — `apps/client`
| Tecnologia | Versão mínima | Observação |
|---|---|---|
| React | 18.x | UI |
| Vite | 5.x | Bundler |
| TypeScript | 5.x | `strict: true` |
| React Router | 6.x | Roteamento client-side |
| TanStack Query | 5.x | Server state, cache, loading/error |
| Zustand | 4.x | Client state (auth, UI) |
| Tailwind CSS | 3.x | Estilização utility-first |
| shadcn/ui | latest | Componentes base (Radix UI) |
| @hello-pangea/dnd | latest | Drag & Drop no Kanban |
| axios | 1.x | HTTP client (com interceptors) |
| date-fns | 3.x | Manipulação de datas |
| sonner | 2.x | Toasts de feedback |
| cmdk | 1.x | Paleta de comandos (⌘/Ctrl+K) |
| tinykeys | 3.x | Atalhos de teclado globais |
| tailwind-merge + clsx | latest | Utilitario `cn()` no client |
| tailwindcss-animate | 1.x | Animacoes utilitarias (shadcn) |
| @radix-ui/react-dialog | 1.x | Dialog (paleta, atalhos) |
| lucide-react | latest | Ícones |
| socket.io-client | 4.x | Notificações em tempo real |

### Desktop — `apps/desktop`
| Tecnologia | Versão mínima | Observação |
|---|---|---|
| Electron | 42.x | Shell desktop Windows para o client React/Vite |
| TypeScript | 5.x | `strict: true` |
| electron-builder | latest | Empacotamento do app desktop |
| Vite | 5.x | Reutiliza o build do `apps/client`; não criar segundo renderer |

**Regra arquitetural:** o Electron não substitui o client web. Ele deve carregar o `apps/client` em desenvolvimento via `VITE_DEV_SERVER_URL` e, em build/produção, carregar o `dist` gerado pelo client. Toda regra de negócio continua no `apps/server`; o desktop é apenas a camada nativa.

**Segurança obrigatória no Electron:**
- `nodeIntegration: false`
- `contextIsolation: true`
- `sandbox: true`
- Usar `preload.ts` com `contextBridge` apenas quando necessário
- Nunca expor APIs Node diretamente ao renderer
- Nunca usar `remote`
- Nunca desabilitar `webSecurity`
- Links externos devem abrir com `shell.openExternal` após validação de URL

### Pacote compartilhado — `packages/shared` e `packages/eslint-config`
- **`packages/shared`:** apenas tipos TypeScript (interfaces, enums, aliases). Zero dependencias externas.
- **`packages/eslint-config`:** configuracao ESLint compartilhada (`@mk/eslint-config`); apps estendem `server.cjs` ou `client.cjs`.

---


## 3. Estrutura de Pastas — EXATA

```
mk-projetos/                        ← root do monorepo
├── AGENTS.md                       ← este arquivo
├── package.json                    ← root package (scripts turbo)
├── pnpm-workspace.yaml
├── turbo.json
├── .env.example
├── .gitignore
│
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── types/
│   │           ├── user.ts
│   │           ├── project.ts
│   │           ├── discipline.ts
│   │           ├── task.ts
│   │           ├── comment.ts
│   │           ├── notification.ts
│   │           └── enums.ts
│   └── eslint-config/
│       ├── package.json
│       ├── server.cjs
│       └── client.cjs
│
└── apps/
    ├── server/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env                    ← NÃO commitar
    │   ├── prisma/
    │   │   ├── schema.prisma
    │   │   └── seed.ts
    │   ├── scripts/
    │   │   └── import_asana_json.py
    │   ├── data/                   ← banco SQLite (NÃO commitar)
    │   ├── uploads/                ← arquivos enviados (NÃO commitar)
    │   └── src/
    │       ├── index.ts            ← entry point, cria app Express + Socket.io
    │       ├── config/
    │       │   └── env.ts          ← lê e valida variáveis com Zod
    │       ├── lib/
    │       │   ├── prisma.ts       ← singleton PrismaClient
    │       │   ├── socket.ts       ← instância Socket.io exportável
    │       │   └── notify.ts       ← persistir + emitir notificacoes
    │       ├── middleware/
    │       │   ├── auth.ts         ← verifica JWT
    │       │   ├── role.ts         ← verifica role mínimo
    │       │   ├── validate.ts     ← valida body com schema Zod
    │       │   └── errorHandler.ts ← handler global de erros
    │       ├── routes/
    │       │   ├── index.ts        ← agrega todas as rotas em /api/v1
    │       │   ├── auth.routes.ts
    │       │   ├── users.routes.ts
    │       │   ├── projects.routes.ts
    │       │   ├── sections.routes.ts
    │       │   ├── tasks.routes.ts
    │       │   ├── comments.routes.ts
    │       │   ├── notifications.routes.ts
    │       │   ├── activity.routes.ts
    │       │   └── uploads.routes.ts
    │       └── controllers/
    │           ├── auth.controller.ts
    │           ├── users.controller.ts
    │           ├── projects.controller.ts
    │           ├── sections.controller.ts
    │           ├── tasks.controller.ts
    │           ├── comments.controller.ts
    │           ├── notifications.controller.ts
    │           ├── activity.controller.ts
    │           └── uploads.controller.ts
    │
    └── client/
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── tailwind.config.ts
        ├── components.json
        ├── index.html
        └── src/
            ├── main.tsx
            ├── App.tsx
            ├── assets/
            │   └── logo.svg        ← logo MK (preto + laranja)
            ├── styles/
            │   └── globals.css     ← Tailwind directives + CSS vars
            ├── lib/
            │   ├── api.ts          ← instância axios configurada
            │   ├── queryClient.ts
            │   ├── socket.ts
            │   ├── utils.ts
            │   └── runtimeConfig.ts
            ├── store/
            │   ├── authStore.ts    ← Zustand: user, token, login/logout
            │   └── uiStore.ts      ← Zustand: sidebar, paleta de comandos, dialogo de atalhos
            ├── hooks/
            │   ├── useAuth.ts
            │   ├── useProjects.ts
            │   ├── useSections.ts
            │   ├── useTasks.ts
            │   ├── useRecentActivity.ts
            │   ├── useAppHotkeys.ts
            │   └── useNotifications.ts
            ├── components/
            │   ├── ui/
            │   ├── layout/
            │   │   ├── AppShell.tsx
            │   │   ├── Sidebar.tsx
            │   │   ├── Header.tsx
            │   │   ├── CommandPalette.tsx
            │   │   ├── ShortcutsDialog.tsx
            │   │   └── NotificationBell.tsx
            │   ├── project/
            │   │   └── ProjectForm.tsx
            │   ├── section/
            │   │   └── SectionTab.tsx
            │   ├── task/
            │   │   ├── TaskCard.tsx
            │   │   ├── TaskForm.tsx
            │   │   ├── TaskDetail.tsx
            │   │   └── TaskStatusBadge.tsx
            │   └── shared/
            │       ├── Avatar.tsx
            │       ├── PriorityBadge.tsx
            │       ├── EmptyState.tsx
            │       └── LoadingSpinner.tsx
            └── pages/
                ├── LoginPage.tsx
                ├── DashboardPage.tsx       ← visão geral: projetos ativos, minhas tarefas
                ├── ProjectsPage.tsx        ← lista de todos os projetos
                ├── ProjectDetailPage.tsx   ← abas: Kanban | Lista | Carga de Trabalho
                ├── MyTasksPage.tsx         ← página do usuário logado
                ├── UserProfilePage.tsx     ← perfil público de outro usuário
                ├── UsersPage.tsx           ← admin: gerenciar usuários
                └── NotFoundPage.tsx
    │
    └── desktop/
        ├── package.json
        ├── tsconfig.json
        ├── electron-builder.json
        └── src/
            ├── main.ts             ← processo principal Electron
            └── preload.ts          ← ponte segura via contextBridge
```

---

## 4. Modelo de Dados (Prisma Schema)

A fonte de verdade e o arquivo `apps/server/prisma/schema.prisma`. O banco espelha o **export JSON do Asana** (workspace, teams, projects, sections, tasks, memberships, tags, custom fields, etc.), com cliente Prisma gerado em `apps/server/src/generated/prisma`.

Resumo das entidades principais:

- **AsanaWorkspace**, **Team**, **Project**, **Section**: hierarquia de projeto; `Section` e a unidade entre projeto e tarefa no backend canonico.
- **Task** + **TaskMembership**: tarefas Asana e colocacao em secao; campos locais (`localStatus`, etc.) para o Kanban.
- **User**: usuarios do app e importados (`asanaGid`); `passwordHash` pode ser nulo para usuarios importados.
- **Comment**: comentarios com campos opcionais de import (`asanaGid`, `authorAsanaGid`, `asanaCreatedAt`).
- **Notification**: notificacoes in-app persistidas; emissao em tempo real via Socket.io (`lib/notify.ts`).

Enums e tipos de API expostos ao client permanecem em `packages/shared` (`TaskStatus`, `Priority`, `DisciplineType`, alias `Section` = `Discipline`, etc.).

Nao duplicar o schema completo neste arquivo: apos alterar o Prisma, rodar `pnpm --filter server prisma migrate dev` e revisar o `schema.prisma` no repositorio.

---

## 5. API REST — Rotas

Prefixo global: `/api/v1`

```
AUTH
  POST   /auth/login
  POST   /auth/logout
  GET    /auth/me
  POST   /auth/refresh

USERS (Admin only para criação/deleção)
  GET    /users
  GET    /users/:id
  POST   /users
  PATCH  /users/:id
  DELETE /users/:id

PROJECTS
  GET    /projects
  GET    /projects/:id
  POST   /projects           (Admin, Coordinator)
  PATCH  /projects/:id       (Admin, Coordinator)
  DELETE /projects/:id       (Admin only)

SECTIONS (canonico; alias temporario `/disciplines` espelha as mesmas rotas)
  GET    /projects/:projectId/sections
  GET    /projects/:projectId/disciplines
  POST   /projects/:projectId/sections   (Coordinator)
  POST   /projects/:projectId/disciplines (alias)
  PATCH  /sections/:id
  PATCH  /disciplines/:id                 (alias)
  DELETE /sections/:id                   (Coordinator)
  DELETE /disciplines/:id                (alias)

TASKS
  GET    /sections/:sectionId/tasks
  GET    /disciplines/:disciplineId/tasks (alias)
  GET    /tasks/:id
  POST   /sections/:sectionId/tasks
  POST   /disciplines/:disciplineId/tasks (alias)
  PATCH  /tasks/:id
  DELETE /tasks/:id
  PATCH  /tasks/:id/status

COMMENTS
  GET    /tasks/:taskId/comments
  POST   /tasks/:taskId/comments
  DELETE /comments/:id

ACTIVITY
  GET    /activity/recent                 (feed mesclado para dashboard)

ATTACHMENTS
  POST   /tasks/:taskId/attachments       (Fase 2; pode responder 501)
  GET    /attachments/:id/download
  DELETE /attachments/:id

NOTIFICATIONS
  GET    /notifications
  PATCH  /notifications/:id/read
  PATCH  /notifications/read-all
```

---

## 6. Identidade Visual — TRAVADA (Linear-style)

Tokens em `apps/client/src/styles/globals.css` (dark unico). Alem da marca MK (`--color-brand-orange`, etc.), usar camadas de fundo e borda:

- **Fundos:** `--bg-0` … `--bg-3` (mais profundo ao mais elevado).
- **Bordas:** `--color-border`, `--color-border-subtle`.
- **Texto:** `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`.
- **Status / prioridade:** `--color-status-*`, `--color-priority-*` (alinhados ao Kanban e ao calendario em `MyTasksPage`).
- **Movimento:** `--ease-out-expo` + plugin `tailwindcss-animate` no `tailwind.config.ts`.

Tipografia: Inter com `font-feature-settings` leves. Logo: `apps/client/src/assets/logo.svg`.

Paleta de comandos (**cmdk** + Radix Dialog), toasts (**sonner**), atalhos globais (**tinykeys**): ver `CommandPalette.tsx`, `ShortcutsDialog.tsx`, `useAppHotkeys.ts`.

---

## 7. Autenticação

- JWT com dois tokens: `accessToken` (15 min) e `refreshToken` (7 dias).
- `accessToken` armazenado em memória (Zustand), nunca em localStorage.
- `refreshToken` armazenado em **httpOnly cookie**.
- Rota `/auth/refresh` usa o cookie para emitir novo accessToken.
- Middleware `auth.ts` valida Bearer token no header `Authorization`.
- Middleware `role.ts` recebe role mínimo e rejeita com 403 se insuficiente.

---

## 8. Upload de Arquivos

- Multer (quando ativo) salva em `apps/server/uploads/` com nome UUID.
- Limite: 50 MB por arquivo.
- Tipos permitidos: `pdf, dwg, dxf, rvt, ifc, jpg, jpeg, png, xlsx, docx, zip`.
- Ate a Fase 2, o controller pode responder **501** com mensagem em portugues; o client nao deve exibir fluxo de anexo quebrado.

---

## 9. Socket.io — Notificações em Tempo Real

- Servidor cria namespace `/notifications`.
- Ao fazer login, client emite `join` com seu `userId`.
- Servidor emite para o room do userId quando:
  - Uma tarefa é atribuída a ele → `notification:new`
  - Um comentário é adicionado em tarefa que ele está atribuído → `notification:new`
  - Status de tarefa atribuída é alterado → `notification:new`
- Client ouve `notification:new` e exibe badge no sino + toast (Sonner).

---

## 10. Regras de Desenvolvimento

### Nunca faça
- ❌ Usar `npm` ou `yarn` em qualquer comando
- ❌ Criar arquivos fora da estrutura de pastas definida na seção 3
- ❌ Adicionar dependências não listadas na seção 2 sem justificativa explícita
- ❌ Usar `any` no TypeScript (ative `noImplicitAny: true`)
- ❌ Hardcodar strings de conexão, senhas ou segredos (usar `.env`)
- ❌ Criar sub-tarefas ou qualquer nível adicional na hierarquia
- ❌ Alterar o schema Prisma sem gerar migration (`pnpm prisma migrate dev`)
- ❌ Commitar a pasta `data/`, `uploads/` ou arquivos `.env`
- ❌ Usar `CommonJS` (`require`/`module.exports`) — apenas ESM/TypeScript
- ❌ Criar um renderer separado no Electron; o desktop deve reutilizar o `apps/client`
- ❌ Ativar `nodeIntegration`, desativar `contextIsolation`, desativar `sandbox` ou desativar `webSecurity` no Electron

### Sempre faça
- ✅ Validar toda entrada do usuário com Zod no servidor
- ✅ Retornar erros no formato `{ error: string, details?: unknown }`
- ✅ Usar `async/await` com try/catch (sem `.then().catch()` sem motivo)
- ✅ Exportar tipos do `packages/shared` para reusar em client e server
- ✅ Usar `date-fns` para toda manipulação de datas (nunca `moment`)
- ✅ Campos de duração/dias estimados nunca devem usar `input type="number"`; usar input textual decimal compartilhado sem steppers nativos.
- ✅ Campos de data devem usar o datepicker compartilhado; nunca usar `input type="date"` cru no frontend.
- ✅ Dropdowns de dados editáveis com lista de opções devem usar o dropdown pesquisável compartilhado.
- ✅ Nomes de arquivos em `camelCase` para utilitários, `PascalCase` para componentes React
- ✅ Nomes de branches: `feat/nome-da-feature`, `fix/descricao`, `chore/descricao`
- ✅ Manter o Electron como shell nativo seguro, apontando para o Vite dev server em desenvolvimento e para o build estático do client em produção

### Convenção de commits (Conventional Commits)
```
feat: adiciona view kanban na página de projeto
fix: corrige refresh token expirado não renovando sessão
chore: atualiza dependências do client
docs: atualiza AGENTS.md com rotas de upload
```

---

## 11. Scripts do Monorepo

```json
// package.json (root)
{
  "scripts": {
    "dev":     "turbo run dev",
    "build":   "turbo run build",
    "lint":    "turbo run lint",
    "test":    "turbo run test",
    "db:push": "pnpm --filter server prisma db push",
    "db:migrate": "pnpm --filter server prisma migrate dev",
    "db:studio": "pnpm --filter server prisma studio",
    "db:seed": "pnpm --filter server tsx prisma/seed.ts",
    "desktop:dev": "pnpm --filter desktop dev",
    "desktop:build": "pnpm --filter desktop build"
  }
}
```

```json
// apps/server/package.json scripts
{
  "dev":   "tsx watch src/index.ts",
  "build": "tsc -p tsconfig.json",
  "start": "node dist/index.js",
  "lint":  "eslint src --ext .ts",
  "test":  "vitest run"
}
```

```json
// apps/client/package.json scripts
{
  "dev":   "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "lint":  "eslint src --ext .ts,.tsx",
  "test":  "node -e \"process.exit(0)\""
}
```

```json
// apps/desktop/package.json scripts
{
  "dev":   "electron .",
  "build": "tsc -p tsconfig.json && electron-builder",
  "lint":  "eslint src --ext .ts",
  "test":  "node -e \"process.exit(0)\""
}
```

---

## 12. Variáveis de Ambiente

```env
# apps/server/.env (nunca commitar)
DATABASE_URL="file:./data/mk-projetos.db"
JWT_ACCESS_SECRET="troque-por-segredo-forte-1"
JWT_REFRESH_SECRET="troque-por-segredo-forte-2"
PORT=3001
CLIENT_URL="http://localhost:5173"
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB=50
```

```env
# apps/client/.env (nunca commitar)
VITE_API_URL="http://localhost:3001/api/v1"
VITE_SOCKET_URL="http://localhost:3001"
# Fallback de hostname quando o browser nao expoe host (ex.: desktop / LAN)
VITE_DEFAULT_SERVER_HOST="192.168.1.100"
```

```env
# apps/desktop/.env (nunca commitar)
VITE_DEV_SERVER_URL="http://localhost:5173"
ELECTRON_APP_NAME="MK Projetos"
```

> **Em produção LAN:** substituir `localhost` pelo IP fixo do servidor Windows, ex: `http://192.168.1.100:3001`

---

## 13. Seed Inicial

O `prisma/seed.ts` cria **workspace** local, usuario administrador com senha conhecida para primeiro login, e (quando o banco nao tem projetos) dados minimos de demonstracao compativeis com o schema Asana. Ajustar emails/senhas apenas em ambiente de desenvolvimento; nunca commitar `.env`.

---

## 14. Views da Página de Projeto (`ProjectDetailPage`)

A página de detalhe de projeto tem 3 abas:

### Kanban
- Colunas: `BACKLOG | A FAZER | EM ANDAMENTO | EM REVISÃO | CONCLUÍDO`
- Filtro por secao (dropdown no topo)
- Drag & drop de cards entre colunas via `@hello-pangea/dnd`
- Card exibe: título, assignee avatar, prioridade, data de entrega, badge da secao

### Lista
- Tabela com colunas: Tarefa | Secao | Responsavel | Prioridade | Status | Entrega
- Ordenacao por coluna clicavel
- Filtros: secao, status, responsavel, prioridade
- Inline edit de status e assignee

### Carga de Trabalho
- Agrupa tarefas por usuário
- Mostra contagem: total | em andamento | atrasadas
- Barra de progresso visual por usuário
- Clique no usuário abre suas tarefas filtradas

---

## 15. App Desktop Electron (`apps/desktop`)

O app desktop deve ser criado como um wrapper nativo do client web:

- Em desenvolvimento, abrir `VITE_DEV_SERVER_URL` (`http://localhost:5173` por padrão).
- Em produção, carregar o build estático de `apps/client/dist`.
- Não duplicar páginas, componentes, stores, hooks ou estilos dentro de `apps/desktop`.
- O backend continua sendo `apps/server`, acessado via `VITE_API_URL` e `VITE_SOCKET_URL`.
- O objetivo do desktop é facilitar uso em Windows na LAN, com ícone, janela nativa e empacotamento instalável.
- O app deve iniciar com `BrowserWindow` em dark mode, tamanho mínimo razoável e título `MK Projetos`.
- O build desktop deve depender do build do client.
- Não implementar auto-update nesta fase, salvo se solicitado explicitamente.

Configuração mínima obrigatória do `BrowserWindow`:

```ts
webPreferences: {
  preload: path.join(__dirname, "preload.js"),
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true
}
```

---

## 16. Import Asana (JSON → SQLite)

Script: `apps/server/scripts/import_asana_json.py`.

- Uso basico: `python import_asana_json.py --json-dir <pasta> --server-dir apps/server`
- Opcoes uteis: `--clear` (limpa tabelas importadas), `--import-users`, `--clear-comments` + import de `comments_*.json` / `stories_*.json` para a tabela `Comment` (idempotente por `asanaGid`).

---

*Última atualização: 2026 · MK Engenharia · Balneário Camboriú/SC*

# AGENTS.md — MK Projetos
> **Leia este arquivo inteiro antes de qualquer ação. Ele é a fonte da verdade do projeto.**
> Toda decisão de arquitetura, stack, nomenclatura e convenção já está definida aqui.
> **Nunca proponha alternativas às decisões travadas. Implemente exatamente o que está descrito.**

---

## 1. Visão Geral do Produto

**MK Projetos** é um gerenciador de tarefas para escritório de engenharia (MK Engenharia, Balneário Camboriú/SC), substituindo o Asana. Roda em rede local (LAN): um PC Windows hospeda o servidor, os demais acessam via navegador pelo IP da rede. Também terá um app desktop Windows via Electron, funcionando como shell nativo do client React/Vite, sem duplicar regra de negócio nem criar outro frontend.

**Hierarquia de dados:**
```
Projeto → Disciplina → Tarefa
```
Não há sub-tarefas. Não há níveis adicionais.

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
| Multer | 3.x | Upload de arquivos |
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
| react-hot-toast | 2.x | Toasts de feedback |
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

### Pacote compartilhado — `packages/shared`
- Apenas tipos TypeScript (`interfaces`, `enums`, `type aliases`).
- Zero dependências externas.
- Exporta: tipos de entidades, DTOs de request/response, enums de status/role/prioridade.

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
│   └── shared/
│       ├── package.json
│       └── src/
│           ├── index.ts
│           └── types/
│               ├── user.ts
│               ├── project.ts
│               ├── discipline.ts
│               ├── task.ts
│               ├── comment.ts
│               ├── notification.ts
│               └── enums.ts
│
└── apps/
    ├── server/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env                    ← NÃO commitar
    │   ├── prisma/
    │   │   ├── schema.prisma
    │   │   └── seed.ts
    │   ├── data/                   ← banco SQLite (NÃO commitar)
    │   ├── uploads/                ← arquivos enviados (NÃO commitar)
    │   └── src/
    │       ├── index.ts            ← entry point, cria app Express + Socket.io
    │       ├── config/
    │       │   └── env.ts          ← lê e valida variáveis com Zod
    │       ├── lib/
    │       │   ├── prisma.ts       ← singleton PrismaClient
    │       │   └── socket.ts       ← instância Socket.io exportável
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
    │       │   ├── disciplines.routes.ts
    │       │   ├── tasks.routes.ts
    │       │   ├── comments.routes.ts
    │       │   ├── notifications.routes.ts
    │       │   └── uploads.routes.ts
    │       └── controllers/
    │           ├── auth.controller.ts
    │           ├── users.controller.ts
    │           ├── projects.controller.ts
    │           ├── disciplines.controller.ts
    │           ├── tasks.controller.ts
    │           ├── comments.controller.ts
    │           ├── notifications.controller.ts
    │           └── uploads.controller.ts
    │
    └── client/
        ├── package.json
        ├── tsconfig.json
        ├── vite.config.ts
        ├── tailwind.config.ts
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
            │   ├── queryClient.ts  ← TanStack Query client
            │   └── socket.ts       ← socket.io-client singleton
            ├── store/
            │   ├── authStore.ts    ← Zustand: user, token, login/logout
            │   └── uiStore.ts      ← Zustand: sidebar, modais globais
            ├── hooks/
            │   ├── useAuth.ts
            │   ├── useProjects.ts
            │   ├── useDisciplines.ts
            │   ├── useTasks.ts
            │   └── useNotifications.ts
            ├── components/
            │   ├── ui/             ← shadcn/ui (auto-gerados, não editar)
            │   ├── layout/
            │   │   ├── AppShell.tsx      ← wrapper com sidebar + header
            │   │   ├── Sidebar.tsx
            │   │   ├── Header.tsx
            │   │   └── NotificationBell.tsx
            │   ├── project/
            │   │   ├── ProjectCard.tsx
            │   │   └── ProjectForm.tsx
            │   ├── discipline/
            │   │   ├── DisciplineTab.tsx
            │   │   └── DisciplineForm.tsx
            │   ├── task/
            │   │   ├── TaskCard.tsx       ← usado no Kanban e na Lista
            │   │   ├── TaskForm.tsx
            │   │   ├── TaskDetail.tsx     ← drawer lateral com detalhes
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

```prisma
// apps/server/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  COORDINATOR
  DESIGNER
  INTERN
}

enum ProjectStatus {
  ACTIVE
  ON_HOLD
  COMPLETED
  CANCELLED
}

enum DisciplineType {
  HYDRAULIC       // Hidráulico
  SANITARY        // Sanitário
  FIRE_PROTECTION // PPCI
  SPRINKLER
  PRESSURIZED_STAIR // Escada Pressurizada
  ELECTRICAL
  SPDA
  TELECOM
  HVAC            // Climatização
  GAS
  AUTOMATION
  EXHAUST         // Exaustão
  VACUUM          // Aspiração Central
  OTHER
}

enum DisciplineStatus {
  NOT_STARTED
  IN_PROGRESS
  IN_REVIEW
  COMPLETED
}

enum TaskStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  IN_REVIEW
  DONE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role     @default(DESIGNER)
  avatarUrl    String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  assignedTasks    Task[]         @relation("TaskAssignee")
  createdTasks     Task[]         @relation("TaskCreator")
  comments         Comment[]
  notifications    Notification[]
  responsibleDisciplines Discipline[] @relation("DisciplineResponsible")
}

model Project {
  id          String        @id @default(cuid())
  name        String
  description String?
  client      String?
  status      ProjectStatus @default(ACTIVE)
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  disciplines Discipline[]
}

model Discipline {
  id            String           @id @default(cuid())
  projectId     String
  name          String
  type          DisciplineType
  status        DisciplineStatus @default(NOT_STARTED)
  responsibleId String?
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  project     Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  responsible User?   @relation("DisciplineResponsible", fields: [responsibleId], references: [id])
  tasks       Task[]
}

model Task {
  id           String     @id @default(cuid())
  disciplineId String
  title        String
  description  String?
  status       TaskStatus @default(BACKLOG)
  priority     Priority   @default(MEDIUM)
  assigneeId   String?
  creatorId    String
  startDate    DateTime?
  dueDate      DateTime?
  completedAt  DateTime?
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  discipline   Discipline @relation(fields: [disciplineId], references: [id], onDelete: Cascade)
  assignee     User?      @relation("TaskAssignee", fields: [assigneeId], references: [id])
  creator      User       @relation("TaskCreator", fields: [creatorId], references: [id])
  comments     Comment[]
  attachments  Attachment[]
}

model Comment {
  id        String   @id @default(cuid())
  taskId    String
  authorId  String
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  task   Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author User @relation(fields: [authorId], references: [id])
}

model Attachment {
  id           String   @id @default(cuid())
  taskId       String
  filename     String
  originalName String
  mimeType     String
  size         Int
  uploadedById String
  createdAt    DateTime @default(now())

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   // TASK_ASSIGNED | TASK_UPDATED | COMMENT_ADDED | DUE_SOON
  title     String
  message   String
  read      Boolean  @default(false)
  taskId    String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

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

DISCIPLINES
  GET    /projects/:projectId/disciplines
  POST   /projects/:projectId/disciplines  (Admin, Coordinator)
  PATCH  /disciplines/:id
  DELETE /disciplines/:id    (Admin, Coordinator)

TASKS
  GET    /disciplines/:disciplineId/tasks
  GET    /tasks/:id
  POST   /disciplines/:disciplineId/tasks
  PATCH  /tasks/:id
  DELETE /tasks/:id
  PATCH  /tasks/:id/status   (move no kanban)

COMMENTS
  GET    /tasks/:taskId/comments
  POST   /tasks/:taskId/comments
  DELETE /comments/:id

ATTACHMENTS
  POST   /tasks/:taskId/attachments   (multipart/form-data)
  GET    /attachments/:id/download
  DELETE /attachments/:id

NOTIFICATIONS
  GET    /notifications               (do usuário logado)
  PATCH  /notifications/:id/read
  PATCH  /notifications/read-all
```

---

## 6. Identidade Visual — TRAVADA

```css
/* Cores base — CSS custom properties em globals.css */
--color-brand-orange:   #FF6600;
--color-brand-black:    #111111;
--color-brand-white:    #FFFFFF;

--color-surface:        #1A1A1A;   /* fundo sidebar */
--color-surface-card:   #242424;   /* cards de tarefas */
--color-surface-hover:  #2E2E2E;
--color-border:         #3A3A3A;
--color-text-primary:   #F5F5F5;
--color-text-secondary: #A0A0A0;
--color-text-muted:     #666666;

/* Status de tarefas */
--color-status-backlog:     #555555;
--color-status-todo:        #3B82F6;  /* azul */
--color-status-in-progress: #FF6600;  /* laranja MK */
--color-status-in-review:   #A855F7;  /* roxo */
--color-status-done:        #22C55E;  /* verde */

/* Prioridades */
--color-priority-low:    #22C55E;
--color-priority-medium: #EAB308;
--color-priority-high:   #F97316;
--color-priority-urgent: #EF4444;
```

**Tema:** Dark mode como padrão e único tema (combina com a identidade escura da MK).

**Tipografia:** Inter (Google Fonts) — sans-serif limpa, legível em telas.

**Logo:** usar `apps/client/src/assets/logo.svg` (arquivo original fornecido).

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

- Multer salva em `apps/server/uploads/` com nome UUID.
- Limite: 50 MB por arquivo.
- Tipos permitidos: `pdf, dwg, dxf, rvt, ifc, jpg, jpeg, png, xlsx, docx, zip`.
- Endpoint de download serve o arquivo com `Content-Disposition: attachment`.
- A pasta `uploads/` deve estar no `.gitignore`.

---

## 9. Socket.io — Notificações em Tempo Real

- Servidor cria namespace `/notifications`.
- Ao fazer login, client emite `join` com seu `userId`.
- Servidor emite para o room do userId quando:
  - Uma tarefa é atribuída a ele → `notification:new`
  - Um comentário é adicionado em tarefa que ele está atribuído → `notification:new`
  - Status de tarefa atribuída é alterado → `notification:new`
- Client ouve `notification:new` e exibe badge no sino + toast.

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
  "lint":  "eslint src --ext .ts"
}
```

```json
// apps/client/package.json scripts
{
  "dev":   "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "lint":  "eslint src --ext .ts,.tsx"
}
```

```json
// apps/desktop/package.json scripts
{
  "dev":   "electron .",
  "build": "tsc -p tsconfig.json && electron-builder",
  "lint":  "eslint src --ext .ts"
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
```

```env
# apps/desktop/.env (nunca commitar)
VITE_DEV_SERVER_URL="http://localhost:5173"
ELECTRON_APP_NAME="MK Projetos"
```

> **Em produção LAN:** substituir `localhost` pelo IP fixo do servidor Windows, ex: `http://192.168.1.100:3001`

---

## 13. Seed Inicial

O seed (`prisma/seed.ts`) deve criar:
1. Um usuário Admin: `admin@mkengenharia.eng.br` / senha `admin123` (forçar troca no primeiro login)
2. Disciplinas padrão disponíveis como constantes em `packages/shared`
3. Um projeto de exemplo com 3 disciplinas e 5 tarefas em diferentes status

---

## 14. Views da Página de Projeto (`ProjectDetailPage`)

A página de detalhe de projeto tem 3 abas:

### Kanban
- Colunas: `BACKLOG | A FAZER | EM ANDAMENTO | EM REVISÃO | CONCLUÍDO`
- Filtro por disciplina (dropdown no topo)
- Drag & drop de cards entre colunas via `@hello-pangea/dnd`
- Card exibe: título, assignee avatar, prioridade, data de entrega, disciplina badge

### Lista
- Tabela com colunas: Tarefa | Disciplina | Responsável | Prioridade | Status | Entrega
- Ordenação por coluna clicável
- Filtros: disciplina, status, responsável, prioridade
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

*Última atualização: 2025 · MK Engenharia · Balneário Camboriú/SC*

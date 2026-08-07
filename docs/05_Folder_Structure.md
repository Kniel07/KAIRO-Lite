# KAIRO-Lite
## Folder Structure

Version: 1.4 (amended)
Status: Approved

---

# 1. Philosophy

The folder structure reflects the architecture.

Every folder has a single responsibility.

The project favors:

- Feature isolation
- Reusable components
- Predictable organization
- Low coupling
- High cohesion

---

# 2. Root Structure

```
kairo-lite/

├── app/
├── components/
├── features/
├── lib/
├── ai/
├── prisma/
├── types/
├── hooks/
├── providers/
├── styles/
├── constants/
├── config/
├── public/
├── docs/
├── tests/
├── scripts/
├── middleware.ts
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── eslint.config.js
├── prettier.config.js
├── .env.example
└── README.md
```

---

# 3. App Directory

The App Router only contains routing.

```
app/

├── (dashboard)/
├── api/
├── auth/
├── projects/
├── knowledge/
├── notes/
├── documents/
├── ai/
├── search/
├── settings/
├── globals.css
├── layout.tsx
├── page.tsx
└── not-found.tsx
```

Rules

- No business logic.
- No database queries.
- No AI provider calls.

---

# 4. Features Directory

Business logic is organized by feature.

```
features/

├── dashboard/
├── projects/
├── knowledge/
├── notes/
├── documents/
├── ai/
├── search/
├── settings/
├── governance/
└── shared/
```

Each feature contains

```
feature/

components/

actions/

services/

repositories/

schemas/

types/

hooks/

utils/
```

<!-- Amended: `repositories/` added to the per-feature structure, giving the Repository pattern (mandated by Document 7 §8, named in Document 6 §22) a concrete location. See Document 13 §3 (Amendment 2). -->

---

# 5. Components

Reusable UI only.

```
components/

ui/

layout/

forms/

navigation/

tables/

charts/

editors/

feedback/

shared/
```

Rules

Components never access Prisma.

Components never call OpenAI.

---

# 6. AI Module

```
ai/

providers/

orchestrator/

prompts/

templates/

context/

memory/

validators/

parsers/

schemas/

types/

utils/
```

Responsibilities

- AI routing
- Prompt assembly
- Context retrieval
- Provider abstraction
- Response validation

`ai/context/` reads project, knowledge, and conversation data via the Repository layer (§4, §7) directly — never via Feature Services. See §20.

---

# 7. Lib

Infrastructure utilities.

```
lib/

db/

auth/

logger/

cache/

email/

storage/

search/

markdown/

utils/

validation/
```

`lib/db/` additionally contains shared/cross-cutting repositories (`lib/db/repositories/`) used by more than one feature (e.g. `TagRepository`, `AuditLogRepository`). Feature-specific repositories live inside their owning feature per §4. <!-- Amended: see Document 13 §3 (Amendment 2). -->

---

# 8. Prisma

```
prisma/

schema.prisma

migrations/

seed.ts
```

Only Prisma-related files belong here.

---

# 9. Types

Global TypeScript definitions.

```
types/

api.ts

ai.ts

database.ts

projects.ts

knowledge.ts

documents.ts

shared.ts
```

---

# 10. Hooks

Reusable React hooks.

```
hooks/

useProject.ts

useKnowledge.ts

useSearch.ts

useTheme.ts

useDebounce.ts
```

Hooks contain client-side behavior only.

---

# 11. Providers

Application providers.

```
providers/

ThemeProvider.tsx

QueryProvider.tsx

SessionProvider.tsx

AIProvider.tsx
```

---

# 12. Constants

```
constants/

routes.ts

roles.ts

statuses.ts

themes.ts

prompts.ts
```

---

# 13. Config

Application configuration.

```
config/

app.ts

database.ts

ai.ts

auth.ts

search.ts
```

Environment loading belongs here.

---

# 14. Public

Static assets.

```
public/

images/

icons/

logos/

fonts/
```

---

# 15. Documentation

Repository documentation.

```
docs/

01_PRD.md

02_Architecture.md

03_Database.md

04_AI_Architecture.md

05_Folder_Structure.md

06_Naming_Conventions.md

07_Coding_Standards.md

08_API_Contracts.md

09_Implementation_Plan.md

10_Prisma_Data_Model.md

11_Security_Authentication.md

12_AI_Prompt_Library.md

13_Architecture_Amendments.md

14_Architecture_Compliance_Matrix.md

15_Technical_Debt_Register.md

16_Release_Roadmap.md
```

<!-- Amended: Documents 10-13 added per the Phase 0 constitutional expansion. See Document 13. Document 14 added per the Phase 2 hardening review (Document 13 §16-19) — it is explicitly NOT part of the constitution proper (see its own header): it's a point-in-time audit report over Documents 1-13, not a rule-defining document, and is expected to go stale and be regenerated rather than hand-maintained. Documents 15 and 16 added the same way, same non-constitutional standing — a debt register and a release-milestone map, not rules. All three listed here for discoverability only. -->

Documents 1-13 are the project constitution. Documents 14-16 are derived artifacts (an audit report, a debt register, and a release roadmap), regenerated/updated as needed rather than treated as source-of-truth rules.

---

# 16. Tests

```
tests/

unit/

integration/

e2e/

fixtures/

mocks/
```

No production code belongs here.

---

# 17. Scripts

Developer utilities.

```
scripts/

seed.ts

cleanup.ts

migrate.ts

generate.ts
```

---

# 18. Naming Rules

Folders

lowercase

Examples

```
projects

knowledge

documents
```

Components

PascalCase

```
ProjectCard.tsx

KnowledgeEditor.tsx
```

Hooks

camelCase

```
useProject.ts

useSearch.ts
```

Utilities

camelCase

```
formatDate.ts

parseMarkdown.ts
```

Types

PascalCase

```
Project.ts

Knowledge.ts
```

---

# 19. Import Rules

Prefer aliases.

```
@/components

@/features

@/lib

@/ai

@/hooks

@/types
```

Avoid deep relative imports.

---

# 20. Dependency Rules

Allowed

```
App
↓

Features
↓

AI / Lib
↓

Prisma
```

`ai/` and `features/` are dependency siblings — both depend downward on `lib/`/Prisma, neither depends on the other, with one explicit exception: a Feature Service may call into `ai/` (e.g. an action invoking the Orchestrator), but `ai/` never calls into `features/`. AI context retrieval reads via the Repository layer (§4, §7), not via Feature Services. <!-- Amended: see Document 13 §4 (Amendment 3). -->

Forbidden

- Components → Prisma
- Components → AI Providers
- Features → UI Components from unrelated features
- Prisma → Features
- AI → Features (Feature Services may call into AI; the reverse is forbidden)

No circular dependencies.

---

# 21. Future Expansion

Reserved folders

```
plugins/

workers/

automation/

vector/

embeddings/

integrations/

analytics/
```

These remain empty until officially introduced.

---

# 22. Folder Structure Rules

- Every folder has a single responsibility.
- Shared logic belongs in `lib`.
- Feature-specific logic stays inside its feature.
- AI logic stays inside `/ai`.
- Database access is isolated to services and repositories.
- The architecture must remain modular and scalable.
- New top-level folders require architectural approval and corresponding documentation updates.

---

END OF DOCUMENT 5

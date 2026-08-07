# KAIRO-Lite
## Naming Conventions

Version: 1.1 (amended)
Status: Approved

---

# 1. Philosophy

Naming is architecture.

Every name should communicate intent immediately.

Names must be:

- Consistent
- Predictable
- Searchable
- Self-documenting
- Stable over time

Avoid abbreviations unless universally understood.

---

# 2. General Rules

Use English only.

Prefer descriptive names.

Avoid generic names such as:

- data
- utils
- helper
- temp
- new
- test
- misc

Every identifier should reveal its responsibility.

---

# 3. Folder Naming

Rule

lowercase

Singular only when representing a single implementation.

Plural for feature domains.

Examples

```
projects
knowledge
documents
notes
settings
search
```

Never

```
ProjectFiles
Project_Module
PROJECTS
```

---

# 4. File Naming

## React Components

PascalCase

```
ProjectCard.tsx
KnowledgeEditor.tsx
SearchBar.tsx
DashboardHeader.tsx
```

---

## Hooks

camelCase with "use"

```
useProject.ts
useKnowledge.ts
useSearch.ts
useTheme.ts
```

---

## Utilities

camelCase

```
formatDate.ts
slugify.ts
parseMarkdown.ts
buildPrompt.ts
```

---

## Constants

camelCase

```
routes.ts
statuses.ts
themes.ts
prompts.ts
```

---

## Configuration

camelCase

```
app.ts
database.ts
auth.ts
ai.ts
```

---

## Types

PascalCase filenames

```
Project.ts
Knowledge.ts
Conversation.ts
```

---

# 5. React Components

PascalCase

```
ProjectCard

DashboardSidebar

KnowledgeViewer

PromptEditor
```

Never

```
projectcard

dashboard_component

COMPONENT
```

---

# 6. Variables

camelCase

```
currentProject

selectedNote

knowledgeList

conversationHistory
```

Boolean variables begin with:

```
isLoading

isArchived

hasPermission

canEdit

shouldSave
```

---

# 7. Functions

camelCase

Function names begin with verbs.

Examples

```
createProject()

updateKnowledge()

deleteDocument()

searchProjects()

buildPrompt()

validateSchema()

generateSummary()
```

Avoid

```
project()

knowledge()

data()

process()
```

---

# 8. Classes

PascalCase

```
AIOrchestrator

ProjectService

KnowledgeRepository

PromptBuilder
```

---

# 9. Interfaces

PascalCase with "I" prefix **not used**.

Correct

```
Project

Knowledge

PromptTemplate

AIProvider
```

Avoid

```
IProject

IKnowledge
```

---

# 10. Enums

PascalCase

Members use UPPER_SNAKE_CASE.

```
ProjectStatus

ACTIVE

ARCHIVED

COMPLETED
```

`ProjectStatus`'s three values above are the final, canonical enum — not merely illustrative. The complete canonical value set for every enum in the system (`ProjectPriority`, `ProjectVisibility`, `KnowledgeStatus`, `TaskStatus`, `TaskPriority`, `NoteType`, `NoteSource`, `DocumentType`, `MessageRole`, `UserRole`, `Theme`, `AuditOperation`, `ActorType`, `AIMode`) is defined in Document 10 §5 and recorded in Document 13 §7 (Amendment 6). <!-- Amended -->

---

# 11. Database Tables

snake_case

Plural nouns.

```
projects

knowledge

notes

documents

users

tasks

audit_logs
```

---

# 12. Database Columns

camelCase inside Prisma models.

Mapped automatically to database naming if required.

Examples

```
createdAt

updatedAt

projectId

ownerId

archivedAt
```

---

# 13. Primary Keys

Always

```
id
```

Foreign keys

```
projectId

userId

conversationId

knowledgeId
```

Never

```
projID

project_id_fk

fkProject
```

---

# 14. API Routes

REST-oriented.

Plural resources.

```
/api/projects

/api/projects/[id]

/api/knowledge

/api/search

/api/ai/chat

/api/settings
```

Actions belong inside the service layer, not the route name.

Avoid

```
/api/createProject

/api/deleteKnowledge

/api/updateDocument
```

---

# 15. Environment Variables

UPPER_SNAKE_CASE

```
DATABASE_URL

OPENAI_API_KEY

RESEND_API_KEY

AUTH_SECRET

APP_URL
```

<!-- Amended: `NEXTAUTH_SECRET` replaced with `AUTH_SECRET` to match the Auth.js v5 convention chosen in Document 11 §3 (Doc 13 §3, Amendment 3's env-var note). Full env var list is in Document 11 §9. -->

---

# 16. CSS Classes

Tailwind utilities preferred.

Custom classes use kebab-case.

```
project-card

knowledge-editor

dashboard-grid
```

---

# 17. Git Branches

Feature

```
feature/project-management

feature/knowledge-search
```

Fix

```
fix/authentication

fix/prisma-migration
```

Refactor

```
refactor/ai-orchestrator
```

Documentation

```
docs/database-design
```

---

# 18. Commit Messages

Conventional Commits

```
feat: add project dashboard

fix: resolve prisma migration issue

refactor: simplify ai orchestrator

docs: update architecture documentation

test: add project service tests

chore: update dependencies
```

---

# 19. Prompt Templates

Names are PascalCase.

```
ThinkPrompt

ValidatePrompt

DocumentPrompt

ImplementationPrompt
```

`ReviewPrompt` is not a fifth mode — it is satisfied by VALIDATE mode's review-report output (Document 12 §4). See Document 13 §12. <!-- Amended -->

---

# 20. AI Providers

Provider classes

```
OpenAIProvider

AnthropicProvider

GoogleProvider

LocalProvider
```

---

# 21. Services

Every service ends with

```
Service
```

Examples

```
ProjectService

KnowledgeService

SearchService

GovernanceService
```

---

# 22. Repositories

Every repository ends with

```
Repository
```

Examples

```
ProjectRepository

KnowledgeRepository

DocumentRepository
```

Repository classes live in `features/<feature>/repositories/` or, for cross-cutting repositories, `lib/db/repositories/`. See Document 5 §4, §7 and Document 13 §3 (Amendment 2). <!-- Amended -->

---

# 23. Schemas

Validation schemas end with

```
Schema
```

Examples

```
ProjectSchema

KnowledgeSchema

PromptSchema
```

---

# 24. Naming Rules

Never abbreviate important concepts.

Prefer

```
conversationHistory
```

Instead of

```
convHist
```

Prefer

```
knowledgeRepository
```

Instead of

```
repo
```

Names should optimize readability over brevity.

---

# 25. Reserved Words

The following names are reserved architectural concepts and must remain consistent throughout the project:

- AIOrchestrator
- Knowledge
- Project
- Conversation
- PromptBuilder
- Governance
- ContextRetriever
- SearchService
- ProjectService
- KnowledgeRepository
- AuditLog

These identifiers must not be renamed without updating the project documentation.

---

END OF DOCUMENT 6

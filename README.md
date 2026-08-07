# KAIRO-Lite

An AI-native Personal Operating System. See `docs/` for the full project constitution (Documents 1-13) — the source of truth for architecture, database design, AI architecture, folder structure, naming conventions, coding standards, API contracts, and the implementation plan.

Current status: **Phase 0 (Project Foundation) and Phase 1 (Core Infrastructure)** complete, per `docs/09_Implementation_Plan.md`.

## Getting started

```bash
cp .env.example .env   # fill in real values
npm install
npm run db:generate    # generate the Prisma client
npm run dev
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier (write) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Run Prisma migrations (Phase 2+) |
| `npm run db:seed` | Run the seed script (Phase 2+) |

## Documentation

The constitution lives in `docs/`:

- `01_PRD.md` – Product Requirements
- `02_Architecture.md` – System Architecture
- `03_Database.md` – Database Design
- `04_AI_Architecture.md` – AI Architecture
- `05_Folder_Structure.md` – Folder Structure
- `06_Naming_Conventions.md` – Naming Conventions
- `07_Coding_Standards.md` – Coding Standards
- `08_API_Contracts.md` – API Contracts
- `09_Implementation_Plan.md` – Implementation Plan
- `10_Prisma_Data_Model.md` – Prisma Data Model Specification
- `11_Security_Authentication.md` – Security & Authentication
- `12_AI_Prompt_Library.md` – AI Prompt Library
- `13_Architecture_Amendments.md` – Architecture Amendments ledger

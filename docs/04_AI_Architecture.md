# KAIRO-Lite
## AI Architecture

Version: 1.1 (amended)
Status: Approved

---

# 1. AI Philosophy

KAIRO-Lite is an AI-native Personal Operating System.

The AI is not the product.

The AI is the intelligence layer that augments human thinking.

Every AI interaction must improve knowledge quality while preserving user ownership of decisions.

Core principles:

- AI augments, never replaces.
- AI explains reasoning.
- AI preserves context.
- AI is stateless.
- Knowledge is stateful.
- Human approval always overrides AI suggestions.

---

# 2. AI Responsibilities

The AI layer is responsible for:

- Context retrieval
- Prompt assembly
- Knowledge reasoning
- Idea expansion
- Validation
- Documentation
- Project assistance
- Decision support
- Knowledge linking

The AI layer is NOT responsible for:

- Owning business rules
- Writing directly to the database
- Bypassing validation
- Modifying historical records without audit

---

# 3. AI Orchestrator

The AI Orchestrator is the single entry point for every AI request.

No UI component or API route may communicate directly with an LLM.

Responsibilities:

- Load project context
- Load knowledge context
- Load conversation history
- Select prompt template
- Assemble system prompt
- Select AI provider
- Execute request
- Validate response
- Return structured output

<!-- Amended: Context retrieval (loading project/knowledge/conversation data above) reads via the Repository layer directly (read-only), not via Feature Services. This keeps `ai/` and `features/` as dependency siblings per Document 5 §20, avoiding a circular dependency, since Section 2 above already establishes the Orchestrator may read but never write directly. Context retrieval independently applies ownership scoping rather than reusing a Service's full authorization logic. See Document 13 §4 (Amendment 3). -->

Flow

```
User

↓

API Route

↓

AI Orchestrator

↓

Context Retrieval

↓

Prompt Builder

↓

LLM

↓

Validation

↓

Structured Response
```

---

# 4. AI Modes

The AI operates in explicit modes.

Each mode changes behavior without changing the underlying architecture.

## THINK

Purpose

Strategic thinking.

Responsibilities

- Brainstorm
- Explore options
- Identify assumptions
- Analyze trade-offs
- Generate alternatives

Output

Ideas only.

Never implementation.

---

## VALIDATE

Purpose

Independent reviewer.

Responsibilities

- Find inconsistencies
- Detect missing requirements
- Challenge assumptions
- Risk assessment
- Quality review

Output

Review report.

---

## DOCUMENT

Purpose

Technical writer.

Responsibilities

- Produce specifications
- Improve documentation
- Generate architecture docs
- Write implementation guides

Output

Structured documents.

---

## IMPLEMENT

Purpose

Software engineering.

Responsibilities

- Generate code
- Follow architecture
- Respect standards
- Produce production-quality implementations

Output

Code only after explicit approval.

---

# 5. Prompt Pipeline

Every request is assembled dynamically.

Inputs

User Prompt

Project

Knowledge

Conversation

Relevant Documents

Coding Standards

Architecture

Output Format

↓

Prompt Builder

↓

LLM

---

# 6. Context Retrieval

Context is assembled before every AI request.

Priority

1. Active Project

2. Active Document

3. Related Knowledge

4. Previous Conversation

5. Global Knowledge

6. User Preferences

Only relevant context should be injected.

Avoid prompt bloat.

---

# 7. AI Providers

Architecture supports multiple providers.

Provider Interface

```
interface AIProvider {

chat()

stream()

embeddings()

health()

}
```

Supported providers (future)

- OpenAI

- Anthropic

- Google

- Local Models

The Orchestrator owns provider selection.

---

# 8. Prompt Templates

Prompt templates are versioned.

Each template contains

- Name

- Purpose

- Variables

- System Prompt

- Output Schema

Examples

Think

Validate

Document

Summarize

Explain

Review

Code

The concrete THINK, VALIDATE, DOCUMENT, and IMPLEMENT templates are fully specified in Document 12 (AI Prompt Library).

---

# 9. Response Validation

Every AI response passes validation.

Checks include

- JSON validity

- Required fields

- Schema compliance

- Hallucination detection (future)

- Empty response detection

Invalid responses never reach the UI.

---

# 10. Memory Model

The AI itself has no permanent memory.

Persistent memory belongs to the Knowledge Layer.

Memory consists of

Projects

Knowledge

Notes

Documents

Conversations

Tags

Relationships

The Orchestrator reconstructs context for every request.

---

# 11. Knowledge Retrieval Strategy

Knowledge is ranked by

- Active project

- Semantic similarity (future)

- Tags

- Recency

- Explicit references

The retrieval engine should return only the most relevant information.

---

# 12. AI Safety

The AI must

- Never fabricate project history

- Never invent database records

- Never silently change requirements

- Explain uncertainty

- Ask when ambiguity exists

- Preserve auditability

---

# 13. Structured Outputs

All AI responses should be strongly typed.

Preferred formats

- JSON

- Markdown

- Tables

- Code Blocks

Free-form text should be minimized for implementation tasks.

---

# 14. Future AI Capabilities

Reserved for future releases

- Knowledge Graph reasoning

- Multi-agent collaboration

- Autonomous research

- Patch generation

- Workflow automation

- Background AI jobs

- Semantic search

- Embeddings

- Long-term memory optimization

---

# 15. AI Design Rules

No direct database writes.

No provider-specific code outside providers.

Prompt templates are version-controlled.

Every AI interaction is reproducible.

Every AI request is auditable.

Business logic never belongs inside prompts.

AI remains stateless.

Knowledge remains stateful.

The AI Orchestrator is the only gateway to external AI providers.

---

END OF DOCUMENT 4

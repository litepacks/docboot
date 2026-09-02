---
title: AI Agents & LLM Integration
description: How Docboot empowers AI coding agents with structured markdown primitives, automated diagnostics, and .agents/AGENTS.md guidelines.
---

# AI Agents & LLM Pair Programming

Docboot is architected from the ground up for modern engineering workflows where humans and **AI coding assistants** (Antigravity, Cursor, Copilot, Claude) collaborate on documentation.

---

## 1. Workspace Agent Guidelines (`.agents/AGENTS.md`)

Docboot repositories support a standardized `.agents/AGENTS.md` configuration at the repository root. This file provides AI assistants with instantaneous, high-precision context regarding:

- **Repository Layout & Subsystems**: Clear mapping of CLI entrypoints, compiler engines, search indexers, and test suites.
- **Testing Commands & Standards**: Explicit CLI invocations for unit tests (`node --test tests/<suite>.test.js`) and full regression suites (`npm test`).
- **Formatting & Escaping Rules**: Guidelines for directive syntax, sub-item parsing, and XSS-safe HTML escaping.
- **Link Integrity & Quality Gates**: Rules enforced by `docboot doctor` to prevent broken links or outdated references.

:::terminal Agent Context Verification
$ cat .agents/AGENTS.md
# AGENTS.md — AI Agent Guidelines & Repository Architecture
:::

---

## 2. LLM-Friendly Markdown Primitives

Traditional documentation often requires manual, fragile HTML tables or custom JSX components that confuse LLM generators. Docboot solves this with **declarative, token-efficient directives**:

:::cards cols="2"
::card API & Endpoints href="/guide/rich-content" icon="terminal"
Structured `:::endpoint`, `:::params`, `:::request`, and `:::response` blocks that LLMs can author reliably.
::
::card Interactive Previews href="/guide/rich-content" icon="code"
Live sandbox `:::preview` and `:::sandbox` blocks without complex bundling setups.
::
::card High-Impact Metrics href="/guide/rich-content" icon="zap"
Benchmark KPIs `:::metrics` with automated trend calculation.
::
::card Process Roadmaps href="/guide/rich-content" icon="layers"
Structured `:::timeline` and `:::faq` directives with schema microdata.
::
:::

---

## 3. Automated Agent Verification with Doctor

AI agents can validate the health of documentation changes before submitting Pull Requests using `docboot doctor`:

:::terminal Running Doctor in CI / AI workflows
$ docboot doctor --stale

  ▲ Docboot v0.3.0 — Ultra-fast Markdown documentation

  DOCUMENTATION HEALTH CHECK

  ✔ 25 documentation pages discovered & parsed
  ✔ 330 internal links verified
  ✔ All routes deterministic and valid

  ✔ All health checks passed successfully with zero broken links!
:::

### Verified Checks
- **Broken Internal Links**: Detects missing routes, invalid anchors, and typos.
- **Stale Content**: Flags documentation files uncommitted or untouched for configured periods.
- **Redirect Loops**: Prevents cyclical redirects.
- **WCAG 2.2 AA Audits**: Automatically flags missing image `alt` attributes, heading level skips, and inaccessible frames.

---

## 4. Best Practices for AI Pair-Programming

1. **Keep `.agents/AGENTS.md` Updated**: Whenever new directives, flags, or configuration keys are added, update the guideline document so AI agents stay synchronized.
2. **Run Doctor in Git Hooks**: Add `docboot doctor` to `pre-commit` or CI pipelines to catch agent hallucinations early.
3. **Use Declarative Directives**: Leverage rich content primitives instead of raw HTML tables or complex JSX components.

---

## Next Steps

- [Rich Documentation Content](/guide/rich-content) — Complete cheatsheet of 47+ directives
- [Docboot Doctor](/tooling/doctor) — Validating links, redirects, and accessibility
- [Configuration Reference](/reference/configuration) — Full configuration options

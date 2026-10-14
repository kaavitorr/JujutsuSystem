# Character Creation 2.0 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Open a fullscreen, three-stage Manga/Persona/Jujutsu creator when a new 2.0 character is created.

**Architecture:** Keep choices in a local draft until completion. Load actual species, combat styles, specialization graph and customization feats from the compendium. Validate before one native actor/item batch, then open the completed sheet. Reuse the Hunter's fullscreen ApplicationV2 pattern and Jujutsu's existing specialization/rank rules.

**Tech Stack:** Foundry VTT 14 ApplicationV2, Handlebars, CSS, ES modules, Node test runner.

**Spec:** User request in this chat: (1) power origin/species and attributes, (2) combat style and specializations, (3) portrait/token, customization categories and proficiency allocation. Style metadata supplies initial specialization count and separate proficiency budgets.

## Global Constraints

- Only ruleset 2.0, locally created character actors owned by the creator; skip imports, duplicates, actors with existing items, and completed creation.
- Attributes: 20 total, each 1–6 at creation, from chapter 1.
- Preserve native documents, images, effects, actions, compendium source identities and future tree synchronization.
- No fake customization content; provide functioning categories and selectors/drop support for future items.
- Use inline outline SVG icons, existing purple/gold/ink palette and condensed type.
- Do not modify compendium packs or overwrite existing user data.

## Review Focus

- Cancel/close never applies the draft; permit resuming an unfinished new actor.
- Changing styles cannot keep allocations above new budgets.
- Specialization dependencies must remain valid when earlier selections are removed.
- Repeated Finish clicks cannot grant duplicate documents; failed batches stay retryable.
- Creation must use style budgets without giving a negative proficiency pool afterward.

## Tasks

1. **Draft and rules** — Add focused creation model/catalog helpers and tests for exact attributes, category pools, dependency order, cancellation and imported-actor guards. Read style flags, reuse the specialization engine, and make initial style proficiency totals consistent with the normal sheet.
2. **Native completion** — Build a validated native batch for species/style, granted level-zero origin features, chosen specialization/customization feats, actor ranks, portrait/token and completion flags. Test no writes on invalid choices, native source identities and duplicate submission protection.
3. **Fullscreen flow** — Add ApplicationV2 creator with three stages, searchable real content, detailed previews, live allocation counters, image pickers, customization selectors and drop support. Back/Next preserve the draft; cancellation returns to the sheet.
4. **Integration and verification** — Wire new actor hooks and a resume action, load styles, preserve 1.0. Check actual templates and application actions, render populated/empty/compact previews, run relevant tests and syntax/diff checks.

No commits or separate worktree: apply to the current installed system requested by the user.

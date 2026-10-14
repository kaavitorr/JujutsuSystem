# Personalização Implementation Plan

**Goal:** Replace the 2.0 biography tab with Personalização, keeping physical details first and adding four real item sections.

**Requirements:** Altura, Cabelo, Peso, Gênero, Pele and Idade use existing actor fields. Show Defeitos (maximum five, explicitly confirmed by the user), Peculiaridades, Penalidades Variantes and Modificadores Lendários. Remove the old ideals/personality/bonds/flaws/appearance editors from this 2.0 view; preserve stored data and the original 1.0 template. Native item documents, activities and effects remain intact.

**Architecture:** A pure customization helper defines category flags and validates bulk additions and owned-item assignments. A dedicated 2.0 template uses native inventory actions; actor sheet compendium selection and drops retain the native creation pipeline. A V2-only biography context supplies six physical fields and visible categorized items. Customization items appear only in Personalização, avoiding duplicated sections in Características.

## Tasks

- [x] Test category mapping, maximum-five bulk validation, movement without duplication, permission and cancellation behavior, native activity preservation and 1.0 isolation.
- [x] Implement helper, V2 part routing/context, native creation/drop integration, and compendium addition action.
- [x] Build manga physical-details panel and four stacked item sections; retain native open/edit/delete/activity controls and drag behavior.
- [x] Verify actual templates with empty, populated, full, and read-only fixtures; check existing sheet behavior and module syntax.
- [x] Review the integration, address important findings, and deliver applied changes with reload instructions.

Ruling: Defeitos is a count limit of five (user clarified), not a rank from one to five. Extra defects already in saved data must remain visible; new additions are blocked at/above five. Items are the working interpretation of the second optional clarification, matching the system's existing Defeitos implementation.

Validation: 45 focused sheet tests passed, including 12 customization tests. All seven actual templates compile; Personalização fixtures pass for empty, populated, full, existing overflow and read-only states. Native expand/collapse and single activity activation are exercised with production handlers and rendered markup. Existing species and four-rank checks pass; modified modules pass syntax checks and git diff whitespace checks.

Review findings resolved and rechecked: native duplication now hits the document-creation limit guard; expansion uses native description markup with SVG-compatible toggle; advancement bulk updates validate projected final count and hold the queue until actual batch completion. Invalid dry runs throw because Foundry ignores their returned arrays. Valid delete/add replacement is supported. Independent reviewer found no important unresolved defects after these fixes. Live visual preview remains unavailable; no commits, world resets or unrelated cleanup performed.

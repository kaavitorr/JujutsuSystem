# Recursos Extras Implementation Plan

> Execute inline with superpowers:executing-plans; preserve the installed checkout and existing edits.

**Goal:** Add real editable PER and extensible resource cards below the summary identity row, move Fulgor there, and replace its former strip with Treinamento Intenso.

**Architecture:** Typed actor resources feed a pure presentation helper. Cards select an owned activity and use its native execution and consumption; actor resource paths are exposed to native Attribute consumption. Training retains existing actor counters and handlers, with correct 2.0 labels.

**Tech Stack:** Foundry DataModel, ApplicationV2, Handlebars, scoped CSS, Node tests.

**Spec:** User requests in this conversation: editable PER counter; configurable activity activation; Recursos Extras in Resumo; Fulgor there; training in its old strip.

## Constraints and review focus

- Preserve native actions, permission checks, prior sheet changes and 1.0 behavior.
- Initial PER maximum 30, editable and available to Active Effects.
- Cancelled activity usage must not spend PER; native consumption is the sole deduction.
- Deleted or foreign activities must never run; preserve unrelated consumption targets.
- Use escaped labels, safe resource IDs and inline stroke SVG icons.
- Read-only actors cannot configure, edit or activate resources.
- Existing actors without the new data must render with defaults.

### Task 1: Resource model and native activity integration

Files: legacy2-schema.mjs, new legacy2-extra-resources.mjs, consumption-targets-field.mjs, character-sheet.mjs, test/legacy2-extra-resources.test.mjs.

- [x] Test defaults, dynamic maxima, invalid input, owned activity resolution, cancellation, single native use, and preservation of other costs.
- [x] Implement typed reverseEnergy and extraResources; helper builds cards and native consumption targets; configuration dialog saves a selected activity and optional cost.
- [x] Register native sheet actions and resource dropdown options; run the new tests.

### Task 2: Summary presentation and training

Files: character-summary-hunter-2.hbs, legacy2-sheet.mjs, manipulation-handlers.mjs, jujutsu-hunter-approved-2.css.

- [x] Add manga resource section, editable counters, isolated configuration/activation buttons, and custom resource creation/removal.
- [x] Move Fulgor zone controls into a card and add training strip showing actual training counters; correct 2.0 training gain and remove old PM option in 2.0.
- [x] Verify all seven actual templates and owner/read-only states; test persisted training updates.

### Task 3: Verify and deliver

- [x] Run relevant sheet regression tests, module syntax checks, and template fixture validation.
- [x] Review diff for data paths, ownership, escaping, duplicate consumption and unchanged native controls.
- [x] Report applied changes and reload instruction; do not claim live browser verification if unavailable.

Validation: 29 Node tests passed. Actual-template fixtures passed for all seven tabs, extras with owner/read-only states, escaped labels, input/action isolation, existing refinement isolation, level/feature styling, action pips and proficiency dots. All modified modules passed syntax checks. Reviewer findings fixed and rechecked: changing the activity preserves its native cost/formula; resource names resolve before native label cache. Unchanged effective maxima are not baked into actor source. Live visual preview unavailable (browser transport closed). No commits, worktree changes, world resets or unrelated cleanup.

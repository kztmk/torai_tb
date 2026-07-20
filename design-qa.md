# Xマーケティング Design QA

- source visual truth path: `/Users/kazu/.codex/generated_images/019f58f3-fc2d-7ff3-a88d-d0fb05b2d950/exec-81c71b56-0348-439e-9459-74d49caeede8.png`
- implementation screenshot path: unavailable
- viewport: intended 1440 x 1024
- state: development demo query `?demo=x-marketing`, 対応インボックス and 反応者CRM

## Full-view comparison evidence

Source mock was opened and used as the implementation target. A browser-rendered implementation screenshot could not be captured because the sandbox rejected the local Vite listener with `listen EPERM` on `0.0.0.0:4173`. Build and static code inspection are not substituted for browser evidence.

## Focused region comparison evidence

Blocked for the same reason. The intended focused regions are the global cost header, inbox row/detail split, left-navigation switching, and CRM pipeline/detail split.

## Findings

- [P1] Browser-rendered visual evidence unavailable
  - Location: both Xマーケティング routes.
  - Evidence: source visual is available; implementation screenshot is not.
  - Impact: spacing, wrapping, responsive behavior, and exact visual fidelity cannot be certified.
  - Fix: start the Vite development server in an environment that permits a local listener, capture both routes at 1440 x 1024, then compare against the source mock.

## Implementation checklist

- [x] Existing Torai purple navigation and Mantine tokens reused.
- [x] 対応インボックス and 反応者CRM routes implemented.
- [x] Global and selected-account cost displays implemented.
- [x] Development-only realistic data state implemented.
- [x] Production build and targeted ESLint passed.
- [ ] Capture both browser-rendered routes and complete visual comparison.

## Comparison history

No visual iteration was possible because the first implementation capture was blocked by the environment listener restriction.

final result: blocked

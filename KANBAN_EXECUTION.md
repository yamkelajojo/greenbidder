# KANBAN Execution Tracker

## Ticket Queue

1. Deterministic Bug Harness for Auth/Onboarding
- Type: AFK
- State: Done
- Blocked by: None
- Acceptance Criteria:
- [x] A deterministic signal exists for forbidden `buyer_profiles.price_range_*` writes.
- [x] A deterministic signal exists for login social button visibility.
- Evidence:
- `src/screens/onboarding/BuyerPriceRangeScreen.jsx` no longer writes `price_range_min` or `price_range_max`.
- `tests/app-onboarding.spec.js` asserts `"Or continue with"`, `"Google"`, and `"Apple"` are visible.

2. Buyer Budget Preference Local Deep Module
- Type: AFK
- State: Done
- Blocked by: #1
- Acceptance Criteria:
- [x] A small interface persists budget tier locally.
- [x] Preference survives app restarts.
- Evidence:
- New module: `src/services/buyerPreferenceStore.js` with `saveBudgetTier`, `getBudgetTier`, `clearBudgetTier`.
- `OnboardingContext` loads persisted budget tier into `priceRange`.

3. Onboarding Continue Flow Never Blocks
- Type: AFK
- State: Done
- Blocked by: #2
- Acceptance Criteria:
- [x] Continue does not depend on non-existent DB columns.
- [x] Onboarding step completion happens after valid local save.
- [x] Buyer mock shortcut marks all required buyer steps complete to avoid deadlock.
- [x] Continue button is protected against duplicate taps while saving.
- Evidence:
- `BuyerPriceRangeScreen` persists locally and marks `priceRange` step complete.
- No Supabase write against missing schema columns.
- `completeBuyerOnboardingMock` now completes `welcome/location/buyerPreferences/priceRange` from budget continue path.
- `OnboardingStack` now resumes from the first incomplete step, preventing route deadlocks.

4. Login Social Buttons Visibility + Disabled UX
- Type: AFK
- State: Done
- Blocked by: #1
- Acceptance Criteria:
- [x] Social area is visibly rendered.
- [x] Buttons are intentionally disabled and communicate coming-soon state.
- Evidence:
- Added explicit social styles and icon sizing in `LoginScreen`.
- Added disabled labels (`Google (Coming Soon)`, `Apple (Coming Soon)`).

5. PRD + Issue Mirror + Dependency Map Sync
- Type: HITL
- State: Blocked
- Blocked by: #3, #4
- Acceptance Criteria:
- [ ] Mirror to GitHub issues in dependency order once `gh` auth is available.
- Evidence:
- Source-of-truth is this file; ready to mirror.

## Run Report

- Done: #1, #2, #3, #4
- Blocked: #5 (requires human/`gh` auth context)
- Residual Risks:
- Automated runtime test execution is currently blocked by local npm CLI path issue (`npm-cli.js` missing).
- Next Actionable Ticket:
- #5 once GitHub CLI auth and project issue destination are confirmed.

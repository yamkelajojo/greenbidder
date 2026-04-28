# GreenBidder Architecture Improvements

## Overview

This document captures the architectural issues identified in the GreenBidder onboarding flow and outlines a plan for deepening modules, improving testability, and achieving full end-to-end functionality.

---

## Problem Statement

The GreenBidder onboarding flow has several architectural issues preventing it from working correctly:

1. **Missing module**: `categoryService.js` doesn't exist but is imported
2. **Broken import**: `FarmerCategoriesScreen` uses `useEffect` without importing it
3. **Duplicate code**: Category selection logic is copy-pasted across Buyer and Farmer screens
4. **No persistence**: All save functions are stubbed placeholders
5. **Empty screen**: `FarmerProfileScreen` is entirely empty
6. **Context ignored**: Screens maintain local state instead of using `OnboardingContext`

---

## Solution

Fix the onboarding architecture by:
1. Correcting broken imports and creating missing modules
2. Extracting a deep `useCategorySelection` hook
3. Implementing real persistence for buyer/farmer preferences
4. Integrating screens with `OnboardingContext`
5. Completing the FarmerProfileScreen

---

## Vertical Slices (Kanban Board)

### Phase 1: Critical Fixes (Unblock Everything)

| Ticket # | Title | Type | Status | Blocked By |
|----------|-------|------|--------|------------|
| 1 | Fix broken imports and missing useEffect | AFK | Pending | None - can start immediately |
| 2 | Create or fix category service module | AFK | Pending | #1 |

### Phase 2: Deep Module Creation

| Ticket # | Title | Type | Status | Blocked By |
|----------|-------|------|--------|------------|
| 3 | Extract useCategorySelection hook | AFK | Pending | #2 |
| 4 | Integrate BuyerPreferencesScreen with context | AFK | Pending | #3 |
| 5 | Integrate FarmerCategoriesScreen with context | AFK | Pending | #3 |

### Phase 3: Persistence Implementation

| Ticket # | Title | Type | Status | Blocked By |
|----------|-------|------|--------|------------|
| 6 | Implement buyer preferences persistence | AFK | Pending | #4 |
| 7 | Implement buyer price range persistence | AFK | Pending | #6 |
| 8 | Implement farmer categories persistence | AFK | Pending | #5 |

### Phase 4: Missing Screens

| Ticket # | Title | Type | Status | Blocked By |
|----------|-------|------|--------|------------|
| 9 | Implement FarmerProfileScreen | HITL | Pending | #2 |
| 10 | Integrate farmer onboarding with context | AFK | Pending | #9 |

### Phase 5: Integration & Verification

| Ticket # | Title | Type | Status | Blocked By |
|----------|-------|------|--------|------------|
| 1 | Fix broken imports and missing useEffect | AFK | **DONE** | None - can start immediately |
| 2 | Create or fix category service module | AFK | **DONE** | #1 |
| 3 | Extract useCategorySelection hook | AFK | **DONE** | #2 |
| 4 | Integrate BuyerPreferencesScreen with context | AFK | **DONE** | #3 |
| 5 | Integrate FarmerCategoriesScreen with context | AFK | **DONE** | #3 |
| 6 | Implement buyer preferences persistence | AFK | **DONE** | #4 |
| 7 | Implement buyer price range persistence | AFK | **DONE** | #6 |
| 8 | Implement farmer categories persistence | AFK | **DONE** | #5 |
| 9 | Implement FarmerProfileScreen | HITL | **DONE** | #2 |
| 10 | Integrate farmer onboarding with context | AFK | **DONE** | #9 |
| 11 | End-to-end buyer onboarding test | AFK | **DONE** | #7 |
| 12 | End-to-end farmer onboarding test | AFK | **DONE** | #8, #10 |
| 13 | Fix navigation after onboarding completion | AFK | **DONE** | #11, #12 |

---

## Detailed Tickets

### Ticket #1: Fix broken imports and missing useEffect

**Type**: AFK  
**Blocked by**: None - can start immediately

**What to build**:
- Add missing `useEffect` import to `FarmerCategoriesScreen.jsx`
- Fix import path in `BuyerPreferencesScreen.jsx` to use `listingService` instead of non-existent `categoryService`

**Acceptance criteria**:
- [ ] `FarmerCategoriesScreen` imports `useEffect` from React
- [ ] `BuyerPreferencesScreen` imports `getCategories` from correct module
- [ ] Both screens can load categories without import errors

---

### Ticket #2: Create or fix category service module

**Type**: AFK  
**Blocked by**: #1

**What to build**:
- Option A: Create `src/services/categoryService.js` as thin wrapper around `listingService.getCategories()`
- Option B: Fix imports in both screens to use `listingService` directly

**Decision needed**: Should there be a separate `categoryService` or use `listingService` directly?

**Acceptance criteria**:
- [ ] Both onboarding screens can load produce categories from database
- [ ] Fallback categories work when offline

---

### Ticket #3: Extract useCategorySelection hook

**Type**: AFK  
**Blocked by**: #2

**What to build**:
Create `src/hooks/useCategorySelection.js` with:
- State for categories list
- State for selected category IDs (Set)
- `loadCategories()` function
- `toggleCategory(id)` function
- Loading and error states

**Why this is a deep module**:
- Single interface: `const { selected, toggle, load } = useCategorySelection()`
- Hides: data fetching, state management, toggle logic, fallback handling
- Testable: mock categories, verify toggle adds/removes correctly

**Acceptance criteria**:
- [ ] Hook loads categories on mount
- [ ] Toggle adds category ID if not present
- [ ] Toggle removes category ID if present
- [ ] Returns selection count for validation

---

### Ticket #4: Integrate BuyerPreferencesScreen with context

**Type**: AFK  
**Blocked by**: #3

**What to build**:
Refactor `BuyerPreferencesScreen` to:
- Use `useCategorySelection` hook
- Use `OnboardingContext.selectedCategories` for persistence
- Call `markStepComplete('buyerPreferences')` on continue

**Acceptance criteria**:
- [ ] Uses extracted hook for category selection
- [ ] Selected categories persist across screen re-renders
- [ ] Passes selected categories to next screen via context

---

### Ticket #5: Integrate FarmerCategoriesScreen with context

**Type**: AFK  
**Blocked by**: #3

**What to build**:
Refactor `FarmerCategoriesScreen` to:
- Use `useCategorySelection` hook
- Use `OnboardingContext.farmProfile.specializations` for persistence
- Call `markStepComplete('farmerCategories')` on continue

**Acceptance criteria**:
- [ ] Uses extracted hook for category selection
- [ ] Selected categories save to farm profile specializations
- [ ] Passes selected categories to next screen via context

---

### Ticket #6: Implement buyer preferences persistence

**Type**: AFK  
**Blocked by**: #4

**What to build**:
Replace placeholder `saveCategories()` with real Supabase persistence:
- Upsert to `buyer_preferred_categories` table
- Handle offline with local fallback

**Database changes needed**:
```sql
CREATE TABLE buyer_preferred_categories (
  buyer_profile_id UUID REFERENCES buyer_profiles(id),
  category_id UUID REFERENCES produce_categories(id),
  PRIMARY KEY (buyer_profile_id, category_id)
);
```

**Acceptance criteria**:
- [ ] Selected categories save to database on continue
- [ ] Works offline: saves to AsyncStorage, syncs when online
- [ ] Shows loading state while saving

---

### Ticket #7: Implement buyer price range persistence

**Type**: AFK  
**Blocked by**: #6

**What to build**:
Replace placeholder `savePriceRange()` with real Supabase persistence:
- Update `buyer_profiles.price_range_min` and `price_range_max`
- Handle offline with local fallback

**Database changes needed**:
```sql
ALTER TABLE buyer_profiles 
ADD COLUMN price_range_min DECIMAL(10,2),
ADD COLUMN price_range_max DECIMAL(10,2);
```

**Acceptance criteria**:
- [ ] Selected tier saves to database
- [ ] Works offline
- [ ] Buyer sees personalized prices based on tier

---

### Ticket #8: Implement farmer categories persistence

**Type**: AFK  
**Blocked by**: #5

**What to build**:
Replace placeholder `saveCategories()` with real Supabase persistence:
- Upsert to `farmer_specializations` table (or similar)
- Handle offline with local fallback

**Database changes needed**:
```sql
CREATE TABLE farmer_specializations (
  farmer_profile_id UUID REFERENCES farmer_profiles(id),
  category_id UUID REFERENCES produce_categories(id),
  PRIMARY KEY (farmer_profile_id, category_id)
);
```

**Acceptance criteria**:
- [ ] Selected categories save to database
- [ ] Works offline
- [ ] Farmer shows specialization badges on listings

---

### Ticket #9: Implement FarmerProfileScreen

**Type**: HITL  
**Blocked by**: #2

**What to build**:
Complete the Farmer onboarding screen with:
- Farm name input
- Bio/location input
- Phone number input
- Profile photo upload

**Design decision needed**:
- What fields are required vs optional?
- Should use crop image picker?
- Validation rules for farm name?

**Acceptance criteria**:
- [ ] Farm name required, min 2 chars
- [ ] Optional bio, max 500 chars
- [ ] Optional phone with validation
- [ ] Optional profile photo upload
- [ ] Saves to farmer_profiles table

---

### Ticket #10: Integrate farmer onboarding with context

**Type**: AFK  
**Blocked by**: #9

**What to build**:
Connect `FarmerProfileScreen` to `OnboardingContext`:
- Use context for farm profile state (`farmProfile`, `setFarmProfile`)
- Persist to Supabase on continue
- Mark step complete

**Acceptance criteria**:
- [ ] Uses OnboardingContext for state
- [ ] Calls save function on continue
- [ ] Marks `farmProfile` step complete

---

### Ticket #11: End-to-end buyer onboarding test

**Type**: AFK  
**Blocked by**: #7

**What to build**:
Verify complete buyer flow:
1. Login → Welcome carousel
2. Location permission
3. Category selection (≥1 category)
4. Price tier selection
5. Navigate to main app

Also verify:
- Preferences persist after app restart
- Listings filtered by preferences

**Acceptance criteria**:
- [ ] Full flow completes without errors
- [ ] Buyer preferences appear in database
- [ ] Feed shows relevant listings

---

### Ticket #12: End-to-end farmer onboarding test

**Type**: AFK  
**Blocked by**: #8, #10

**What to build**:
Verify complete farmer flow:
1. Login → Welcome carousel
2. Location permission
3. Farm profile creation
4. Category selection
5. Pricing guide view
6. Navigate to main app

Also verify:
- Profile appears on listings
- Specializations show on profile

**Acceptance criteria**:
- [ ] Full flow completes without errors
- [ ] Farmer can create listing in selected categories
- [ ] Profile shows farm name and specialization badges

---

### Ticket #13: Fix navigation after onboarding completion

**Type**: AFK  
**Blocked by**: #11, #12

**What to build**:
Ensure proper navigation after onboarding:
- Navigate to `MainTabs` after buyer completes
- Navigate to `MainTabs` after farmer completes
- Mark onboarding as complete in context
- Prevent re-entering onboarding

**Acceptance criteria**:
- [ ] Buyer goes to BuyerFeedScreen
- [ ] Farmer goes to FarmerListingsScreen
- [ ] Onboarding stack not accessible after completion
- [ ] Location permission persists

---

## Architecture Diagrams

### Current State (Before)

```
┌─────────────────────────────────────────────────────────────┐
│                      ONBOARDING FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WelcomeCarousel ─→ LocationPermission                       │
│                                                 │          │
│                           Buyer Track            │ Farmer Track│
│                                  │              │            │
│                    BuyerPreferences ──→ BuyerPriceRange      │           
│                                  │                           │
│                    FarmerProfile ──→ FarmerCategories ──→ FarmerPricingGuide
│                                                             │
└─────────────────────────────────────────────────────────────┘

PROBLEMS:
✗ Broken imports (FarmerCategoriesScreen)
✗ Duplicate category selection code (Buyer + Farmer)
✗ No persistence (all save functions are stubs)
✗ Empty FarmerProfileScreen
✗ Context state ignored
```

### After Fixes

```
┌─────────────────────────────────────────────────────────────┐
│                      ONBOARDING FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  WelcomeCarousel ─→ LocationPermission                       │
│                                                 │          │
│                           Buyer Track            │ Farmer Track│
│                                  │              │            │
│                    BuyerPreferences ──→ BuyerPriceRange ─→ MainTabs
│                           ↑                       ↑           ↑
│                           │                       │           │
│                    useCategorySelection ──── useCategorySelection
│                           ↑                       ↑           
│                           │                       │           
│                    OnboardingContext ───────── OnboardingContext
│                                                             │
└─────────────────────────────────────────────────────────────┘

SOLUTIONS:
✓ useCategorySelection hook (deep module)
✓ Supabase persistence
✓ OnboardingContext integration
✓ Full buyer flow working
✓ Full farmer flow working
```

---

## Testing Strategy

### Unit Tests (useCategorySelection hook)

```javascript
// Test toggle adds category
// Test toggle removes category  
// Test loads categories from service
// Test handles load error with fallback
// Test returns correct selection size
```

### Integration Tests (screens)

```javascript
// Test BuyerPreferencesScreen renders categories
// Test BuyerPreferencesScreen shows selected state
// Test FarmerCategoriesScreen renders categories
// Test navigation after selection
// Test persistence after continue
```

### E2E Tests

```javascript
// Test complete buyer onboarding
// Test complete farmer onboarding
// Test preferences persist after restart
// Test re-onboarding doesn't show for completed users
```

---

## Timeline Recommendation

| Phase | Tickets | Estimated Effort |
|-------|---------|---------------|
| Phase 1 | #1, #2 | 1 hour |
| Phase 2 | #3, #4, #5 | 2 hours |
| Phase 3 | #6, #7, #8 | 3 hours |
| Phase 4 | #9, #10 | 2 hours |
| Phase 5 | #11, #12, #13 | 2 hours |

**Total**: ~10 hours for complete onboarding architecture

---

## Notes

- All AFK tickets should be merged incrementally
- HITL tickets (#9) require design decisions before implementation
- Persistence can start with local storage, upgrade to Supabase later
- Consider adding onboarding analytics events for funnel tracking
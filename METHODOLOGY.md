# GreenBidder — System Development Methodology

## For AI Slide Generation

This document contains ALL information an AI needs to create presentation slides about the GreenBidder app's development methodology, architecture, and system processes.

---

## 1. Project Context

**App Name:** GreenBidder
**Tagline:** AI-Powered Agricultural Marketplace
**Purpose:** Connect South African farmers with buyers through intelligent produce quality assessment and personalised recommendations
**Developers:** Mr. Jojo & Mr. Mokgonyane (2 developers)
**Team Size:** 2
**Version:** 1.0.0
**Framework:** React Native 0.81.5 + Expo 54

**Problem Solved:**
- Farmers lack market visibility for accurate produce pricing
- Buyers cannot assess produce quality before purchasing
- No personalised discovery in agricultural marketplaces
- Disconnect between rural farmers and urban buyers in South Africa

**Solution:**
- Two-sided marketplace (farmer listings + buyer feed)
- AI vision analysis (Llama 4 Scout 17B via Groq) for produce grading
- Hybrid collaborative filtering recommendation engine
- South Africa context-aware (seasonal, ZAR pricing, regional markets)

---

## 2. Development Methodology

### 2.1 Approach: Kanban-Based Iterative Development

- **Project Management:** Kanban board with phased execution
- **Execution Document:** `KANBAN_EXECUTION.md`
- **Architecture Document:** `docs/ARCHITECTURE_IMPROVEMENTS.md`
- **Vertical Slices:** Tickets organised in dependency-ordered phases
- **Ticket Types:** AFK (Autonomous From Keyboard — auto-implementable), HITL (Human In The Loop — requires design decisions)

### 2.2 Development Phases (from Kanban)

| Phase | Focus | Tickets | Effort |
|-------|-------|---------|--------|
| Phase 1 | Critical Fixes (broken imports, missing modules) | #1, #2 | 1 hour |
| Phase 2 | Deep Module Creation (useCategorySelection hook) | #3, #4, #5 | 2 hours |
| Phase 3 | Persistence Implementation (Supabase + AsyncStorage) | #6, #7, #8 | 3 hours |
| Phase 4 | Missing Screens (FarmerProfileScreen) | #9, #10 | 2 hours |
| Phase 5 | Integration & Verification (E2E tests, navigation) | #11, #12, #13 | 2 hours |

**Total Effort:** ~10 hours for complete onboarding architecture

### 2.3 Development Principles

1. **Service Layer Architecture** — All database operations through service files, never direct Supabase calls from components
2. **Single Responsibility** — Each service, hook, and component has one clear purpose
3. **Query Optimisation** — Parallel queries with Promise.all, no N+1 patterns, specific field selection
4. **Input Validation** — Zod schemas for all form inputs
5. **Offline-Resilient** — AsyncStorage fallback for all critical user data
6. **Graceful Degradation** — Features fail silently without breaking UX (especially tracking and AI)

### 2.4 Team Work Division

Based on codebase structure and module ownership:

**Mr. Jojo — Likely Areas:**
- AI Integration (aiService.js, AIModal, AIBadge, AIPriceScale, VisualDefects, AnalyzingGlow)
- Recommendation Engine (recommendationEngine.js — 636 lines)
- Navigation architecture (RootNavigator, AuthStack, MainTabs, OnboardingStack)
- Auth system (useAuth.js, authService.js)
- Theme/Design system (theme.js — 533 lines, tamagui.config.js)

**Mr. Mokgonyane — Likely Areas:**
- Database architecture (gbdb.sql — 629 lines, 12 tables, 1 view, 5 triggers, 15+ indexes, RLS policies)
- Listing management (listingService.js, CreateListingScreen, EditListingScreen, FarmerListingsScreen)
- Onboarding flow (OnboardingContext, OnboardingStack, 9 onboarding screens)
- Review system (reviewService.js, FarmerTrustCard, ReviewSheet)
- Tracking & analytics (trackingService.js, buyerPreferenceStore.js)
- Testing (4 Playwright test files)

**Shared Work:**
- Shared components (13 components in components/shared/)
- Screen integration and UI polish
- Navigation wiring and state management
- Documentation and architecture planning

### 2.5 Code Quality Practices

- **Centralised Config:** Single Supabase client, single theme file
- **Validation:** Zod schemas for login, register, create listing, edit listing
- **Error Handling:** Graceful degradation in all services (try/catch with fallbacks)
- **No Hardcoded Values:** All colors, spacing, typography from design tokens
- **Component Reusability:** TactilePressable, Surface, FadeSlideIn, SkeletonCard, etc.
- **Documentation:** JSDoc comments on all public functions, architecture docs

---

## 3. System Architecture

### 3.1 Layered Architecture

```
┌─────────────────────────────────────────────────────┐
│                   APP (Root)                         │
│  GestureHandlerRootView + TamaguiProvider           │
│  SafeAreaProvider + BottomSheetModalProvider         │
│  AuthProvider → OnboardingProvider                   │
│  → FeedbackProvider → AIModalProvider                │
├─────────────────────────────────────────────────────┤
│              NAVIGATION LAYER                        │
│  RootNavigator (decides stack based on auth + onboard)│
│  ├── AuthStack (Login, Register)                     │
│  ├── OnboardingStack (9 screens)                     │
│  └── MainTabs (role-aware: Feed, Prices, Saved/Listings, Profile)│
├─────────────────────────────────────────────────────┤
│              SCREEN LAYER                            │
│  ├── auth/ (LoginScreen, RegisterScreen)             │
│  ├── buyer/ (BuyerFeedScreen, SavedListingsScreen, SearchScreen)│
│  ├── farmer/ (FarmerListingsScreen, CreateListingScreen, EditListingScreen)│
│  ├── onboarding/ (9 screens: carousel, location, preferences, profile, categories, pricing guide, complete)│
│  └── shared/ (ListingDetailScreen, MarketPricesScreen, ProfileScreen)│
├─────────────────────────────────────────────────────┤
│            COMPONENT LAYER                           │
│  ├── ai/ (AIBadge, AIModal, AIDetailCard, AIPriceScale, AnalyzingGlow, VisualDefects)│
│  ├── feedback/ (FeedbackProvider + related)          │
│  ├── onboarding/ (ProgressBar + related)             │
│  └── shared/ (13 components: AnimatedError, AnimatedLogo, FadeEdgeScroll, FadeSlideIn, FarmerTrustCard, Hairline, LocationChip, PriceGuidance, ReviewSheet, ScrollAwareCard, SkeletonCard, Surface, TactilePressable)│
├─────────────────────────────────────────────────────┤
│          BUSINESS LOGIC LAYER                        │
│  Hooks: useAuth, useOnboarding, useCategorySelection, useOnboardingSlideMotion│
│  Context: OnboardingContext                          │
├─────────────────────────────────────────────────────┤
│            SERVICE LAYER (12 services)               │
│  aiService, authService, buyerPreferenceStore,       │
│  categoryService, imageService, listingService,      │
│  marketPriceService, onBoardingService, profileService,│
│  recommendationEngine, reviewService, trackingService│
├─────────────────────────────────────────────────────┤
│              DATA LAYER                              │
│  Supabase (PostgreSQL + PostGIS + RLS + Triggers)   │
│  AsyncStorage (offline caching)                      │
│  SecureStore (auth tokens)                           │
│  MMKV (fast key-value storage)                       │
└─────────────────────────────────────────────────────┘
```

### 3.2 Navigation Flow

```
App Launch
    ↓
RootNavigator checks:
    ├── No user → AuthStack (Login ↔ Register)
    ├── User exists, not onboarded → OnboardingStack
    │       ├── Welcome Carousel (3 slides)
    │       ├── Location Permission
    │       ├── IF Buyer → Preferences → Price Range → MainTabs
    │       └── IF Farmer → Profile → Categories → Pricing Guide → MainTabs
    └── User exists, onboarded → MainTabs
            ├── Feed (BuyerFeedScreen, SearchScreen, ListingDetailScreen)
            ├── Prices (MarketPricesScreen)
            ├── IF Buyer → Saved (SavedListingsScreen, ListingDetailScreen)
            ├── IF Farmer → Listings (FarmerListingsScreen, CreateListingScreen, EditListingScreen, ListingDetailScreen)
            └── Profile (ProfileScreen)
```

### 3.3 State Management

- **AuthProvider** (useAuth.js) — Identity: session, userRole, appUserId, profileId, profileData
- **OnboardingProvider** (OnboardingContext.jsx) — Onboarding state: steps, location, categories, price range, farm profile
- **AIModalProvider** (AIModalContext.jsx) — AI modal state across the app
- **FeedbackProvider** — User feedback/rating prompts
- **AsyncStorage** — Offline persistence for onboarding state, budget tier
- **Component-level state** — React useState/useReducer for local UI state

---

## 4. Tech Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Framework** | React Native 0.81.5 | Cross-platform mobile development |
| **SDK** | Expo 54.0.33 | Development, building, deployment |
| **UI Framework** | Tamagui 2.0.0-rc.38 | Design system, theming, components |
| **Navigation** | React Navigation 7 (Native Stack + Bottom Tabs) | Screen routing |
| **Backend** | Supabase 2.103.0 | PostgreSQL database, Auth, Storage, RLS |
| **Geospatial** | PostGIS | Location-based queries, proximity search |
| **AI/ML** | Groq API (Llama 4 Scout 17B Vision) | Produce image analysis |
| **Animations** | React Native Reanimated 4.1.1 | Spring physics, gesture-driven animations |
| **Animations** | Lottie React Native 7.3.6 | Lottie animation playback |
| **Graphics** | @shopify/react-native-skia 2.2.12 | Advanced graphics rendering |
| **Gesture** | react-native-gesture-handler 2.28.0 | Touch handling |
| **Icons** | lucide-react-native 1.8.0 + @tamagui/lucide-icons-2 | Icon system |
| **Bottom Sheet** | @gorhom/bottom-sheet 5.2.10 | Modal bottom sheets |
| **Validation** | Zod 4.3.6 | Schema-based input validation |
| **Storage** | react-native-mmkv 4.3.1 | Fast key-value storage |
| **Storage** | @react-native-async-storage 2.2.0 | AsyncStorage for offline data |
| **Storage** | expo-secure-store 15.0.8 | Secure credential storage |
| **Location** | expo-location 19.0.8 | GPS and location permissions |
| **Image Picker** | expo-image-picker 17.0.10 | Camera and gallery access |
| **UI Extras** | expo-blur, expo-linear-gradient, expo-image, expo-haptics, expo-status-bar, expo-system-ui | Native platform features |
| **Haptics** | react-native-haptic-feedback 3.0.0 | Tactile feedback |
| **Fun Effects** | react-native-confetti-cannon 1.5.2 | Confetti animations |
| **Math** | simplex-noise 4.0.3 | Noise generation for animations |
| **Pager** | react-native-pager-view 8.0.1, react-native-tab-view 4.3.0 | Swipeable carousels |
| **Testing** | Playwright 1.40.0 | E2E smoke tests |
| **Language** | TypeScript 5.9.3 | Type definitions |

---

## 5. Database Architecture

### 5.1 Schema Overview

**12 Tables + 1 View + 15+ Indexes + 5 Triggers + Row Level Security (RLS)**

### 5.2 Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| **users** | Base identity, links to Supabase Auth | auth_id, email, role (buyer/farmer), is_active |
| **farmer_profiles** | Farmer details, trust metrics | farm_name, phone, bio, avg_rating, is_verified, response_rate, location (PostGIS), location_name |
| **buyer_profiles** | Buyer preferences, location | full_name, phone, preferred_radius_km, location (PostGIS), location_name |
| **produce_categories** | Reference: produce types | name, description, icon_url (12 categories seeded) |
| **listings** | Core marketplace entity | farmer_id, category_id, title, description, price, quantity, unit, status, is_organic, view_count, save_count, location (PostGIS) |
| **listing_images** | Photos per listing | listing_id, image_url, is_primary |
| **ai_analysis** | AI quality assessment (one per listing) | listing_id, condition_score (0-10), ripeness_estimate, growth_insight, price_suggestion_min/max, raw_feedback (JSONB) |
| **saved_listings** | Buyer favourites | buyer_id, listing_id, saved_at |
| **farmer_reviews** | Trust review system | buyer_id, farmer_id, listing_id, rating (1-5), comment (JSON structured) |
| **browsing_history** | View tracking | buyer_id, listing_id, duration_seconds, source, viewed_at |
| **search_history** | Search tracking | buyer_id, category_id, query, results_count, price filters, location filters |
| **contact_events** | Contact tracking | buyer_id, listing_id, contact_method (in_app/phone/whatsapp), contacted_at |
| **market_prices** | Market price data | category_id, price_per_unit, recorded_date, source (FAO/WorldBank) |

### 5.3 View

**recommendation_interactions** — Unified view combining browsing_history, saved_listings, contact_events, and search-originated views with weighted scores. Used for LightFM ML training data extraction.

### 5.4 Triggers

| Trigger | Purpose |
|---------|---------|
| `trg_listings_updated_at` | Auto-updates updated_at on listings |
| `on_auth_user_created` | Auto-creates users record when Supabase Auth user signs up |
| `trg_increment_views` | Increments listing view_count on browsing_history insert |
| `trg_save_count` | Increments/decrements listing save_count on saved_listings changes |
| `trg_update_avg_rating` | Recalculates farmer avg_rating on review changes |

### 5.5 Row Level Security (RLS)

- **13 tables** all have RLS enabled
- **Helper functions:** get_current_user_id(), get_current_user_role(), get_current_buyer_profile_id(), get_current_farmer_profile_id()
- **Policies:** Role-based access — buyers see own data, farmers see own listings, anyone can view active listings and public data
- **No hard deletes:** Listings use soft-delete (status = 'archived')

### 5.6 Geospatial

- **PostGIS extension** enabled
- **GIST indexes** on farmer_profiles, buyer_profiles, and listings location columns
- **get_nearby_listings()** SQL function for proximity-based search

---

## 6. AI Integration

### 6.1 Architecture

- **Model:** Llama 4 Scout 17B (meta-llama/llama-4-scout-17b-16e-instruct)
- **Provider:** Groq API (https://api.groq.com/openai/v1/chat/completions)
- **Input:** Image (base64) + full listing context (title, description, price, quantity, unit, organic flag, location, season)
- **Output:** Strict JSON with 15+ fields
- **Temperature:** 0.2 (deterministic, consistent)
- **Max tokens:** 1100

### 6.2 What AI Analyses

| Field | Description |
|-------|-------------|
| condition_score | 0-10 overall quality score |
| variety_identified | Specific variety if visible |
| ripeness_estimate | Practical ripeness description |
| days_to_peak | Days until peak ripeness (negative = overripe) |
| shelf_life_days | Remaining shelf life at room temperature |
| harvest_readiness | ready/soon/not yet/overdue |
| confidence_level | high/medium/low |
| uniformity_score | 0-1 batch consistency |
| visual_defects | Array of 0-5 observations |
| growth_insight | 2-3 sentence analysis tying everything together |
| storage_advice | Practical short-term storage |
| seasonal_note | Supply status for current month/region |
| price_suggestion_min | Floor price in ZAR |
| price_suggestion_max | Ceiling price in ZAR |
| market_insight | Comparison to typical SA market value |
| price_assessment | verdict (fair/underpriced/overpriced), margin_percent, reasoning |

### 6.3 Context-Awareness

- **South African seasons:** Autumn (harvest), Winter (cool crops), Spring (planting), Summer (peak growing)
- **Regional pricing:** Location-aware market context
- **Farmer claim verification:** AI checks if listing claims match what's visible in the photo
- **Uncertainty handling:** If image is unclear, AI expresses doubt in field values rather than hallucinating

### 6.4 Pipeline

1. `analyseProduceImage(imageUri, context)` — Vision call + JSON parsing + normalisation
2. `saveAnalysis(listingId, analysis)` — Upsert to ai_analysis table
3. `analyseAndSave(imageUri, listingId, context)` — Full pipeline (called after listing creation)

### 6.5 Error Handling

- Rate limit (429) → "AI is busy. Analysis will retry later."
- Network error → Graceful fallback message
- Empty response → Null analysis with error message
- Sanitisation: Strips markdown fencing, normalises price range, coerces uniformity_score to 0-1

---

## 7. Recommendation Engine

### 7.1 Algorithm: Weighted Hybrid Collaborative Filtering

**4-Phase Pipeline:**

### Phase 1: Buyer Profile Construction
- **Category Affinity Vector** — Map of categoryId → score (0-1) based on interaction history
- **Price Sensitivity** — Weighted average price + standard deviation (tolerance)
- **Quality Consciousness** — Average AI score of viewed listings
- **Interaction Recency** — 14-day exponential decay half-life

**Signal Sources (fetched in parallel via Promise.all):**
- Browsing history (views with duration)
- Saved listings (favourites)
- Contact events (farmer contact)
- Search history (category searches)

**Onboarding Boost:** Selected categories get 0.8 affinity, price range seeds price profile

### Phase 2: Candidate Scoring

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Category Match | 25% | Does it match buyer preferences? |
| AI Quality | 20% | How good is the produce (condition_score)? |
| Freshness | 15% | Newer listings surface faster (7-day half-life) |
| Novelty | 15% | Unseen listings get full boost, seen get 0.2 |
| Popularity | 10% | Social proof (views + saves × 2) |
| Price Fit | 10% | Gaussian: how close to buyer's comfort zone? |
| Proximity | 5% | Location-based (available but not weighted in current version) |

### Phase 3: Diversity Injection
- Cap per-category at 40% of results
- Prevent echo chambers (tomato lovers don't only see tomatoes)
- Fill remaining slots with next-best from other categories

### Phase 4: Cold Start Handling
- New buyers with < 3 interactions get popularity + quality + freshness ranking
- Gradually transitions to personalised ranking as signals accumulate

### 7.2 Signal Weights

| Signal | Weight | Description |
|--------|--------|-------------|
| Short view (<30s) | 1.0 | Casual browse |
| Long view (>30s) | 2.0 | Genuine interest |
| Repeat view | 1.5× multiplier | Came back |
| Save listing | 3.0 | Planning to buy |
| Search query | 2.5 | Explicit intent |
| Category filter | 1.5 | Deliberate choice |
| Contact farmer | 5.0 | Strongest signal |

### 7.3 Upgrade Path

- Architecture is **LightFM-ready**
- `recommendation_interactions` view outputs exact format LightFM expects
- Deploy FastAPI service → Train LightFM model → Replace `getRecommendations()` → No other code changes needed

---

## 8. Onboarding Flow

### 8.1 Architecture

- **OnboardingContext** — Single source of truth for onboarding state
- **useOnboarding hook** — Access context from any component
- **AsyncStorage persistence** — Completed steps, location permission, tutorials, budget tier
- **REPLAY_ONBOARDING_EVERY_LAUNCH** flag — Currently set to true for development

### 8.2 Screens (9 total)

| Screen | Purpose | Role |
|--------|---------|------|
| WelcomeCarousel | 3-slide intro (AI quality, personalised feed, fair prices) | Shared |
| LocationPermission | Request GPS access | Shared |
| BuyerPreferences | Select produce categories of interest | Buyer |
| BuyerPriceRange | Choose budget tier | Buyer |
| FarmerProfile | Farm name, bio, phone, photo | Farmer |
| FarmerCategories | Select specializations | Farmer |
| FarmerPricingGuide | View market pricing guidance | Farmer |
| OnboardingComplete | Completion confirmation | Shared |

### 8.3 Navigation Guard

RootNavigator checks:
- No user → AuthStack
- User exists, not onboarded → OnboardingStack
- User exists, onboarded → MainTabs

### 8.4 Shared Hook

**useCategorySelection** — Extracted hook eliminates duplicate category selection code between BuyerPreferencesScreen and FarmerCategoriesScreen

---

## 9. Security Architecture

### 9.1 Authentication

- **Supabase Auth** — Email/password authentication
- **Session management** — Auto-refresh tokens, persistent sessions via SecureStore
- **Auth trigger** — Auto-creates users record on signup with role from metadata
- **Identity caching** — useAuth loads full identity once at login, caches for all screens

### 9.2 Authorisation

- **Row Level Security (RLS)** — Every table has policies
- **Role-based access** — buyer/farmer roles enforced at database level
- **Helper functions** — SECURITY DEFINER functions resolve user identity from JWT
- **No direct table access** — Components use service layer, which uses Supabase client with RLS

### 9.3 Data Protection

- **Environment variables** — Supabase URL and anon key in .env (never committed)
- **SecureStore** — Auth tokens stored securely
- **Soft deletes** — Listings archived, never deleted (data integrity)
- **One review per buyer-farmer** — UNIQUE constraint prevents duplicate reviews

---

## 10. Design System

### 10.1 Theme (theme.js — 533 lines)

**Swiss Design + Apple Material Sensibility**

**Colors:**
- Green palette (9 levels) — Brand identity, agricultural
- Warm neutrals/paper (9 levels) — Surfaces, not cold greys
- Amber (6 levels) — AI and premium moments
- Red, Blue, White, Black — Signal states

**Semantic Mapping:** Components use `colors.textPrimary`, `colors.surface`, etc. — never raw hex values

### 10.2 Typography

| Style | Size | Weight | Use |
|-------|------|--------|-----|
| display | 40px | 800 | Hero, welcome |
| h1 | 32px | 700 | Screen titles |
| h2 | 26px | 700 | Section headers |
| h3 | 20px | 700 | Card titles |
| body | 16px | 400 | Default text |
| caption | 14px | 400 | Supporting copy |
| small | 12px | 400 | Labels, badges |

**Font families:** SF Pro (iOS), Roboto (Android)

### 10.3 Spacing

4/8 grid system: xxs(2), xs(4), sm(8), md(16), lg(24), xl(32), xxl(48), xxxl(64), display(96)

### 10.4 Corner Radius

none(0), xs(6), sm(10), md(14), lg(20), xl(28), xxl(36), full(9999)

### 10.5 Shadows

5 levels: resting, raised, floating, overlay, hero

### 10.6 Motion/Springs

6 spring presets: gentle, standard, snappy, bouncy, slow, press
3 stagger intervals: tight(40ms), standard(70ms), loose(120ms)
5 timing durations: instant(100ms), fast(180ms), standard(260ms), slow(420ms), hero(680ms)

---

## 11. Testing Strategy

### 11.1 E2E Tests (Playwright)

| Test File | Purpose |
|-----------|---------|
| app-onboarding.spec.js | Full onboarding flow tests |
| onboarding-guards.spec.js | Navigation guard tests |
| onboarding-motion-guards.spec.js | Animation/motion guard tests |
| ui-polish-guards.spec.js | UI polish verification tests |

### 11.2 Test Command

```bash
npm run e2e:smoke  # npx playwright test --project=web --grep=@smoke
```

### 11.3 Validation

- **Zod schemas** for all forms (login, register, create listing, edit listing)
- **validate()** helper function returns structured errors
- Password rules: min 8 chars, uppercase, number
- Farm name: min 2 chars
- Listing title: min 3 chars
- Price/quantity: must be positive numbers

---

## 12. Performance Optimisations

### 12.1 Database

- **Parallel queries** — Promise.all for fetching browsing, saves, contacts, search simultaneously
- **No N+1** — Single query with joins for listings (includes farmer, category, AI analysis, images)
- **Specific field selection** — Only query needed fields, not entire rows
- **Denormalised counters** — view_count, save_count updated via triggers (no COUNT queries)
- **15+ indexes** — Optimised for all common query patterns
- **GIST indexes** — Fast geospatial proximity queries

### 12.2 Frontend

- **Identity caching** — useAuth loads once, all screens read from cache
- **Memoised context values** — useMemo in OnboardingProvider prevents unnecessary re-renders
- **Fire-and-forget tracking** — trackView/trackContact never block UX
- **Graceful degradation** — Recommendation engine returns unranked results on error
- **Lazy loading patterns** — Bottom sheet modals, staggered list rendering

### 12.3 AI

- **Background processing** — analyseAndSave runs async after listing creation
- **Rate limit handling** — Graceful "AI is busy" message on 429
- **Token optimisation** — max_tokens set to 1100 (enough, not wasteful)
- **Temperature 0.2** — Low temperature for consistent, predictable output

---

## 13. Codebase Statistics

| Metric | Count |
|--------|-------|
| Total files | 105+ |
| Source code words | ~261,000 |
| Knowledge graph nodes | 239 |
| Knowledge graph edges | 198 |
| Communities detected | 15 |
| Tables | 12 |
| Views | 1 |
| Triggers | 5 |
| Indexes | 15+ |
| RLS policies | 20+ |
| Services | 12 |
| Screens | 17 |
| Shared components | 13 |
| AI components | 6 |
| Onboarding screens | 9 |
| Custom hooks | 4 |
| Contexts | 4 |
| Navigation stacks | 4 |
| E2E test files | 4 |
| Design token categories | 8 (colors, typography, spacing, radius, shadows, springs, durations, layout) |

---

## 14. Service Layer Details

| Service | Lines | Purpose | Key Functions |
|---------|-------|---------|---------------|
| aiService.js | 423 | Produce image analysis via Groq Vision | analyseProduceImage, saveAnalysis, analyseAndSave |
| recommendationEngine.js | 636 | Hybrid collaborative filtering | getRecommendations, buildBuyerProfile, scoreListing, coldStartRanking, applyDiversity |
| listingService.js | 146 | Listing CRUD and queries | getActiveListings, getListingById, createListing, updateListing, archiveListing, getNearbyListings, getCategories |
| reviewService.js | 302 | Farmer trust and reviews | submitReview, getFarmerTrustProfile, hasReviewed, computeRating |
| trackingService.js | 192 | Behavioral signal capture | trackView, trackContact, trackSearch, trackCategoryFilter, trackPriceResearch |
| marketPriceService.js | 197 | Market price intelligence | fetchWorldBankInflation, fetchMarketPrices |
| authService.js | 53 | Authentication operations | registerUser, loginUser, logoutUser |
| buyerPreferenceStore.js | 33 | Buyer budget persistence | saveBudgetTier, getBudgetTier, clearBudgetTier |
| onBoardingService.js | TBD | Onboarding persistence | (onboarding-related DB operations) |
| profileService.js | TBD | User profile management | (profile CRUD operations) |
| categoryService.js | TBD | Category data access | (wrapper around listingService.getCategories) |
| imageService.js | TBD | Image upload/handling | (image processing operations) |

---

## 15. Key Architectural Decisions

### 15.1 Service Layer Pattern
- Components never call `supabase.from()` directly
- All database operations go through service files
- Single Supabase client in `src/config/supabase.js`
- Services handle error handling, data transformation, and fallbacks

### 15.2 Context Over Prop Drilling
- Auth state via AuthProvider (useAuth hook)
- Onboarding state via OnboardingProvider (useOnboarding hook)
- AI modal state via AIModalProvider
- Feedback state via FeedbackProvider

### 15.3 Soft Deletes
- Listings set status = 'archived' instead of DELETE
- Preserves data integrity for recommendation engine
- No DELETE policy on listings table in RLS

### 15.4 Denormalised Counters
- view_count and save_count on listings table
- Updated via database triggers (not app code)
- Eliminates expensive COUNT queries in recommendation engine

### 15.5 Structured Reviews
- Reviews store JSON in comment field with version marker
- Three dimensions: quality, accuracy, would-buy-again
- Weighted rating computation (40/35/25)
- Auto-updates farmer avg_rating via trigger

### 15.6 LightFM Upgrade Path
- `recommendation_interactions` view outputs training data format
- Signal weights match LightFM expected format
- Only `getRecommendations()` function needs replacement
- No UI code changes required for ML upgrade

---

## 16. File Structure Summary

```
GreenBidder/
├── App.js                          # Root app with all providers
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── database/migrations/gbdb.sql    # Full database schema (629 lines)
├── docs/ARCHITECTURE_IMPROVEMENTS.md
├── KANBAN_EXECUTION.md
├── tests/                          # 4 Playwright test files
├── src/
│   ├── config/                     # supabase.js, tamagui.config.js, theme.js
│   ├── constants/                  # env.js
│   ├── context/                    # OnboardingContext.jsx
│   ├── hooks/                      # useAuth, useOnboarding, useCategorySelection, useOnboardingSlideMotion
│   ├── navigation/                 # RootNavigator, AuthStack, MainTabs, OnboardingStack
│   ├── screens/
│   │   ├── auth/                   # Login, Register
│   │   ├── buyer/                  # Feed, Saved, Search
│   │   ├── farmer/                 # Listings, Create, Edit
│   │   ├── onboarding/             # 9 screens
│   │   └── shared/                 # ListingDetail, MarketPrices, Profile
│   ├── components/
│   │   ├── ai/                     # 6 AI components
│   │   ├── feedback/               # Feedback system
│   │   ├── onboarding/             # Onboarding UI components
│   │   └── shared/                 # 13 reusable components
│   ├── services/                   # 12 services
│   ├── utils/                      # dateUtils, formatters, haptics, scoreColor, scrollPhysics, usePressAnimation
│   └── validators/                 # schemas.js (Zod)
└── assets/                         # Icons, onboarding images, splash
```

---

## 17. Slide-Ready Bullet Points

### Slide: Development Methodology
- Kanban-based iterative development with 5 phases
- 13 dependency-ordered tickets across critical fixes, module creation, persistence, and integration
- Two-developer team: Mr. Jojo (AI, recommendations, navigation, auth) & Mr. Mokgonyane (database, listings, onboarding, reviews, testing)
- Service layer architecture — zero direct database calls from UI
- Single Responsibility Principle across all modules
- Graceful degradation — features fail without breaking UX

### Slide: System Architecture
- 4-layer architecture: Navigation → Screens → Components → Services → Data
- 4 context providers managing app-wide state
- Role-aware navigation (buyer vs farmer)
- 17 screens across 5 feature areas
- 12 service files handling all business logic
- Supabase backend with PostGIS, RLS, and 5 database triggers

### Slide: AI-Powered Quality Assessment
- Llama 4 Scout 17B Vision model via Groq API
- Analyses 15+ attributes from a single produce photo
- Context-aware: uses listing details, SA seasons, regional pricing
- Structured JSON output with strict normalisation
- Graceful fallback when AI is unavailable
- Background processing — doesn't block user flow

### Slide: Personalised Recommendations
- Hybrid collaborative filtering algorithm
- 4-phase pipeline: Profile → Score → Diversify → Cold Start
- 7 weighted signals from buyer behavior
- 14-day temporal decay on interactions
- 40% category cap prevents echo chambers
- LightFM ML upgrade path built-in

### Slide: Database & Security
- 12 tables, 1 view, 15+ indexes, 5 triggers
- Row Level Security on all 13 tables
- PostGIS for geospatial proximity queries
- Denormalised counters via triggers (no expensive COUNTs)
- Soft deletes for data integrity
- Supabase Auth with role-based access control

### Slide: Tech Stack
- React Native 0.81.5 + Expo 54
- Tamagui design system (Swiss + Apple design philosophy)
- Supabase (PostgreSQL + PostGIS + RLS)
- Groq AI (Llama 4 Scout 17B Vision)
- Reanimated 4 for spring physics animations
- Zod for input validation
- Playwright for E2E testing

### Slide: Design System
- Swiss design principles + Apple material sensibility
- Semantic color tokens (not raw hex values)
- 8-level typography scale
- 4/8px grid spacing system
- 6 spring physics presets for animations
- 5 shadow elevation levels
- All components reference single theme file

### Slide: Key Features
- AI produce quality scoring (0-10)
- Price fairness assessment (fair/underpriced/overpriced)
- Personalised buyer feed with learning recommendations
- Farmer trust profile with structured reviews
- Market price intelligence (World Bank + FAO data)
- Location-based proximity search (PostGIS)
- Role-aware UI (buyer sees Saved, farmer sees Create)
- Offline-resilient onboarding with AsyncStorage

### Slide: Development Practices
- Centralised Supabase client — imported by services only
- JSDoc documentation on all public functions
- Zod schemas for all form validation
- Fire-and-forget tracking (never blocks UX)
- Parallel database queries (Promise.all)
- No N+1 query patterns
- Specific field selection in all queries
- Graceful degradation in every service

### Slide: Codebase Scale
- 105+ source files, ~261,000 words of code
- 239 knowledge graph nodes, 198 edges
- 12 services, 17 screens, 19 components
- 12 database tables with 20+ RLS policies
- 4 custom hooks, 4 context providers
- 4 E2E test suites with Playwright

---

*Generated for AI slide generation | GreenBidder v1.0.0 | Developers: Mr. Jojo & Mr. Mokgonyane*

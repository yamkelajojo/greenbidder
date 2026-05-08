# GreenBidder - Presentation Preparation

## App Overview

**GreenBidder** is a South African agricultural produce marketplace mobile app built with **React Native (Expo)**. It connects farmers directly with buyers through a smart listing and bidding system, powered by AI-driven produce quality analysis and a personalised recommendation engine.

---

## Slide Deck Structure

### Slide 1: Title
- **GreenBidder** — AI-Powered Agricultural Marketplace
- Tagline: "Connecting Farmers & Buyers with Intelligent Quality Assessment"
- Tech Stack: React Native, Expo, Supabase, Groq AI, Tamagui

---

### Slide 2: The Problem
- Farmers struggle to price produce accurately without market visibility
- Buyers can't assess produce quality before purchasing
- No personalised discovery mechanism for agricultural marketplaces
- Disconnect between rural farmers and urban buyers in South Africa

---

### Slide 3: The Solution
- **Two-sided marketplace**: Farmer listings + buyer feed
- **AI Vision Analysis**: Llama Vision model analyses produce photos for quality, ripeness, shelf life, and fair pricing
- **Personalised Recommendations**: Hybrid collaborative filtering engine learns buyer preferences
- **South Africa Context-Aware**: Seasonal awareness, ZAR pricing, regional market conditions

---

### Slide 4: App Architecture
```
┌─────────────────────────────────────────┐
│              App (Root)                  │
│  TamaguiProvider + AuthProvider          │
│  OnboardingProvider + FeedbackProvider   │
│  AIModalProvider                         │
├─────────────────────────────────────────┤
│           Navigation Layer               │
│  RootNavigator → AuthStack / MainTabs    │
│              / OnboardingStack           │
├─────────────────────────────────────────┤
│           Screen Layer                   │
│  Auth | Buyer | Farmer | Onboarding     │
│              | Shared                    │
├─────────────────────────────────────────┤
│        Services & Business Logic         │
│  AI Service | Recommendation Engine      │
│  Listing | Auth | Review | Tracking     │
├─────────────────────────────────────────┤
│           Data Layer                     │
│  Supabase (PostgreSQL) + AsyncStorage    │
└─────────────────────────────────────────┘
```

---

### Slide 5: Key Feature — AI Produce Analysis
- **Model**: Llama 4 Scout 17B via Groq API (Vision)
- **What it analyses from a single photo**:
  - Condition score (0–10)
  - Variety identification
  - Ripeness estimate & harvest readiness
  - Shelf life prediction
  - Visual defects detection
  - Batch uniformity scoring
  - Price range suggestion (ZAR)
  - Price fairness assessment (fair / underpriced / overpriced)
- **Context-aware**: Uses listing title, description, price, quantity, location, and SA season
- **Offline-resilient**: Graceful degradation when AI is unavailable

---

### Slide 6: Key Feature — Recommendation Engine
- **Algorithm**: Weighted Hybrid Collaborative Filtering
- **4-Phase Pipeline**:
  1. **Profile Construction** — Category affinity, price sensitivity, quality consciousness, interaction recency
  2. **Candidate Scoring** — Category match (25%), AI quality (20%), freshness (15%), novelty (15%), popularity (10%), price fit (10%), proximity (5%)
  3. **Diversity Injection** — Caps per-category at 40% to prevent echo chambers
  4. **Cold Start Handling** — Popularity + quality ranking for new buyers
- **Signal Types**: Views, saves, contacts, searches, filters — each weighted differently
- **Temporal Decay**: 14-day half-life — recent interactions matter more
- **Upgrade Path**: LightFM-ready architecture

---

### Slide 7: User Onboarding Flow
```
Welcome Carousel → Location Permission
       ├── Buyer Track: Preferences → Price Range → Main App
       └── Farmer Track: Profile → Categories → Pricing Guide → Main App
```
- **Context-driven**: OnboardingContext shares state across screens
- **Reusable hooks**: `useCategorySelection` eliminates duplicate code
- **Persistence**: AsyncStorage fallback + Supabase sync
- **Smart navigation**: Prevents re-onboarding for completed users

---

### Slide 8: Tech Stack
| Layer | Technology |
|-------|-----------|
| **Framework** | React Native 0.81.5 + Expo 54 |
| **UI** | Tamagui (design system), Lucide Icons |
| **Navigation** | React Navigation 7 (Native Stack + Bottom Tabs) |
| **Backend** | Supabase (PostgreSQL, Auth, Storage) |
| **AI** | Groq API (Llama 4 Scout 17B Vision) |
| **State** | React Context (Auth, Onboarding, AI Modal, Feedback) |
| **Animations** | React Native Reanimated 4, Lottie, Skia |
| **Storage** | MMKV, AsyncStorage, SecureStore |
| **Testing** | Playwright (E2E smoke tests) |

---

### Slide 9: Project Structure
```
src/
├── components/
│   ├── ai/          — AIBadge, AIModal, AIPriceScale, VisualDefects, AnalyzingGlow
│   ├── feedback/    — Feedback system with provider
│   ├── onboarding/  — Onboarding UI components
│   └── shared/      — 13 reusable components (animations, cards, inputs)
├── screens/
│   ├── auth/        — LoginScreen, RegisterScreen
│   ├── buyer/       — BuyerFeedScreen, SavedListingsScreen, SearchScreen
│   ├── farmer/      — FarmerListingsScreen, CreateListingScreen, EditListingScreen
│   ├── onboarding/  — 9 screens (carousel, location, preferences, profile, etc.)
│   └── shared/      — ProfileScreen, MarketPricesScreen, ListingDetailScreen
├── services/        — 12 services (AI, auth, listing, recommendation, review, etc.)
├── hooks/           — useAuth, useOnboarding, useCategorySelection, motion hooks
├── context/         — OnboardingContext
├── navigation/      — RootNavigator, AuthStack, MainTabs, OnboardingStack
├── config/          — Tamagui config, Supabase client
├── constants/       — App-wide constants
├── utils/           — Utility functions
└── validators/      — Zod schemas & validation logic
```

---

### Slide 10: AI Components (Visual Features)
| Component | Purpose |
|-----------|---------|
| **AIBadge** | Compact quality indicator with sparkle personality |
| **AIModal** | Full-screen AI analysis viewer with corner animations |
| **AIDetailCard** | Detailed analysis card with gradient scoring |
| **AIPriceScale** | Price fairness visualisation (underpriced → fair → overpriced) |
| **AnalyzingGlow** | Animated glow effect during AI processing |
| **VisualDefects** | Structured defect observations display |

---

### Slide 11: Database Schema (Key Tables)
- **users** — Authenticated users (Supabase Auth)
- **buyer_profiles** — Buyer preferences, price range, location
- **farmer_profiles** — Farm name, bio, location, trust rating
- **listings** — Produce listings with status, price, quantity, category
- **produce_categories** — Available produce types
- **ai_analysis** — AI condition scores, ripeness, pricing, raw feedback
- **browsing_history** — Buyer view events with duration
- **saved_listings** — Buyer favourites
- **contact_events** — Buyer-farmer contact tracking
- **search_history** — Category search events
- **reviews** — Farmer trust review system
- **buyer_preferred_categories** — Many-to-many buyer category preferences
- **farmer_specializations** — Many-to-many farmer category specializations

---

### Slide 12: Key Services
| Service | Responsibility |
|---------|---------------|
| **aiService.js** | Produce image analysis via Groq Vision (423 lines) |
| **recommendationEngine.js** | Hybrid collaborative filtering (636 lines) |
| **listingService.js** | CRUD for listings, categories, nearby search |
| **authService.js** | Supabase auth wrapper |
| **reviewService.js** | Farmer trust profile & review system |
| **marketPriceService.js** | Market price guidance |
| **trackingService.js** | Interaction signal tracking for recommendations |
| **buyerPreferenceStore.js** | Buyer preference persistence |
| **onBoardingService.js** | Onboarding flow persistence |
| **profileService.js** | User profile management |
| **categoryService.js** | Category data access |
| **imageService.js** | Image upload & handling |

---

### Slide 13: What Makes GreenBidder Unique
1. **AI-Powered Quality Assessment** — First marketplace to use vision AI for produce grading
2. **South Africa Specific** — Seasonal awareness, ZAR pricing, regional market context
3. **Personalised Buyer Feed** — Learns from behavior, not just filters
4. **Farmer Trust System** — Review-based trust scoring for buyer confidence
5. **Price Fairness Engine** — AI compares asking price to market estimate
6. **Offline-Resilient** — Graceful degradation for rural connectivity
7. **Architected for Scale** — LightFM upgrade path, modular service layer

---

### Slide 14: Demo Flow Suggestions
1. **Auth** — Show login/registration screen
2. **Onboarding** — Walk through buyer or farmer onboarding
3. **Farmer: Create Listing** — Upload produce photo, show AI analysis in action
4. **AI Analysis** — Highlight the modal with condition score, ripeness, price assessment
5. **Buyer: Feed** — Show personalised recommendations
6. **Listing Detail** — Show AIPriceScale, visual defects, farmer trust card
7. **Market Prices** — Show market price guidance screen
8. **Profile** — Show user profile with saved listings / farmer stats

---

### Slide 15: Technical Highlights
- **239 nodes, 198 edges** in codebase knowledge graph
- **15 modular communities** identified via graph analysis
- **Core abstractions**: `useAuth()`, `AIModal()`, `getRecommendations()`, `useOnboarding()`
- **Zero N+1 queries** — parallel data fetching with Promise.all
- **Strict JSON output** from AI with sanitisation and normalisation
- **Temporal decay** on recommendations (14-day half-life)
- **Diversity constraints** prevent filter bubbles (40% cap per category)

---

### Slide 16: Development Stats
- **105 source files** · ~261,000 words of code
- **12 services** · **13 shared components** · **6 AI components**
- **9 onboarding screens** · **8 feature screens**
- **4 custom hooks** · **1 global context**
- **4 navigation stacks**
- **Playwright E2E** smoke tests configured
- **Tamagui** design system for consistent theming

---

### Slide 17: Future Roadmap
- LightFM ML model deployment (FastAPI backend)
- Real-time bidding system
- Push notifications for price drops and new listings
- In-app messaging between farmers and buyers
- Expanded AI analysis (disease detection, yield prediction)
- Multi-language support (isiZulu, Afrikaans)
- Web dashboard for analytics

---

### Slide 18: Thank You
- GreenBidder — Smarter farming, better buying
- Contact / GitHub / Demo links

---

## Key Talking Points Per Feature

### AI Analysis
- "The AI sees what buyers can't — it scores condition, predicts shelf life, identifies defects, and even checks if the farmer's price is fair."
- "It knows South African seasons, regional pricing, and adjusts its analysis based on the current month and location."
- "If the image is unclear, it says so — no hallucination, honest uncertainty."

### Recommendations
- "Unlike static marketplaces, GreenBidder learns. Every view, save, search, and contact shapes what you see next."
- "New buyers get the most popular, highest-quality listings until the system learns their taste."
- "We prevent echo chambers — you won't see only tomatoes even if you searched for tomatoes once."

### Onboarding
- "Two tracks: buyers select what they want to buy, farmers set up their farm profile and specializations."
- "Everything persists — preferences survive app restarts, offline changes sync when connected."

### Architecture
- "Built for incremental improvement. The recommendation engine is designed to swap in a real ML model without touching any screen code."
- "Every service has a single responsibility. AI analysis doesn't know about listings — it just analyses images."

---

## Live Demo Script (Suggested)

1. **Start on Login** — "Here's the auth flow, backed by Supabase..."
2. **Switch to Farmer** — "Let me create a listing as a farmer..."
3. **Upload Photo** — "Watch the AI analyse this produce photo in real-time..."
4. **Show Analysis** — "Condition score 7.8, ripe and market ready, shelf life 5 days, price is fair..."
5. **Switch to Buyer** — "Now as a buyer, my feed is personalised..."
6. **Open Listing** — "Here's the AI badge, tap for full analysis, price scale shows it's fairly priced..."
7. **Show Market Prices** — "Market price guidance across all categories..."
8. **Show Profile** — "Farmer trust score, saved listings, interaction history..."

---

## Potential Q&A

**Q: How accurate is the AI?**
A: It uses Llama 4 Scout 17B Vision, one of the most capable open vision models. It expresses uncertainty explicitly and never invents specifics from unclear images.

**Q: What happens offline?**
A: Onboarding preferences save to local storage. AI analysis gracefully degrades with a message. The app remains functional for browsing cached data.

**Q: How does personalisation work without a ML model?**
A: A weighted hybrid algorithm using interaction signals. The architecture is LightFM-ready — when we deploy the ML model, only the service function changes, not any UI code.

**Q: Is this production-ready?**
A: The core features are functional: auth, onboarding, listing CRUD, AI analysis, recommendations, and reviews. It's built on production-grade infrastructure (Supabase, Expo, Groq).

---

*Generated: 2026-05-08 | GreenBidder v1.0.0*

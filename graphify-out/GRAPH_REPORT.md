# Graph Report - .  (2026-04-28)

## Corpus Check
- 105 files · ~261,091 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 239 nodes · 198 edges · 15 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 22|Community 22]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 6 edges
2. `MainActivity` - 5 edges
3. `AIModal()` - 5 edges
4. `getRecommendations()` - 5 edges
5. `AIBadge()` - 4 edges
6. `useOnboarding()` - 4 edges
7. `analyseProduceImage()` - 4 edges
8. `scoreToColor()` - 4 edges
9. `MainApplication` - 3 edges
10. `useAIModal()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `AIModal()` --calls--> `useAIModal()`  [INFERRED]
  src\components\ai\AIModal.jsx → src\components\ai\AIModalContext.jsx
- `OnboardingProvider()` --calls--> `useAuth()`  [INFERRED]
  context\OnboardingContext.jsx → hooks\useAuth.js
- `MainTabs()` --calls--> `useAuth()`  [INFERRED]
  navigation\MainTabs.jsx → hooks\useAuth.js
- `AIBadge()` --calls--> `useAIModal()`  [INFERRED]
  src\components\ai\AIBadge.jsx → src\components\ai\AIModalContext.jsx
- `RootNavigator()` --calls--> `useOnboarding()`  [INFERRED]
  navigation\AuthStack.jsx → context\OnboardingContext.jsx

## Communities

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (7): OnboardingProvider(), useOnboarding(), useAuth(), RootNavigator(), MainTabs(), OnboardingStack(), RootNavigator()

### Community 1 - "Community 1"
Cohesion: 0.2
Nodes (4): AIBadge(), makeBadgeId(), makeSparklePersonality(), useAIModal()

### Community 2 - "Community 2"
Cohesion: 0.21
Nodes (4): AIModal(), generateCornerTimings(), generateLeaveDirections(), prepareContent()

### Community 3 - "Community 3"
Cohesion: 0.33
Nodes (8): applyDiversity(), buildBuyerProfile(), coldStartRanking(), fetchCandidates(), gaussian(), getRecommendations(), norm(), scoreListing()

### Community 4 - "Community 4"
Cohesion: 0.29
Nodes (2): AIDetailCard(), useFadeSlide()

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (2): archiveListing(), updateListing()

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (1): MainApplication

### Community 7 - "Community 7"
Cohesion: 0.52
Nodes (6): analyseAndSave(), analyseProduceImage(), getSouthAfricanSeason(), isHumanReadableLocation(), resolveLocationForPrompt(), saveAnalysis()

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (1): MainActivity

### Community 11 - "Community 11"
Cohesion: 0.53
Nodes (4): lerp(), scoreToColor(), scoreToHex(), scoreToRgba()

### Community 13 - "Community 13"
Cohesion: 0.5
Nodes (2): computeRating(), submitReview()

### Community 14 - "Community 14"
Cohesion: 0.67
Nodes (2): AIPriceScale(), verdictLabel()

### Community 16 - "Community 16"
Cohesion: 0.67
Nodes (2): ListingDetailScreen(), useEntranceStyle()

### Community 17 - "Community 17"
Cohesion: 0.83
Nodes (3): ProfileScreen(), useFadeSlide(), useStaggerSpring()

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (2): formatLocation(), LocationChip()

## Knowledge Gaps
- **Thin community `Community 4`** (8 nodes): `AIDetailCard()`, `buildGradientColors()`, `cardBackgroundForScore()`, `cardShadowForScore()`, `scoreTextColor()`, `scoreTintBg()`, `useFadeSlide()`, `AIDetailCard.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 5`** (8 nodes): `archiveListing()`, `createListing()`, `getActiveListings()`, `getCategories()`, `getListingById()`, `getNearbyListings()`, `listingService.js`, `updateListing()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 6`** (7 nodes): `MainApplication.kt`, `getJSMainModuleName()`, `getPackages()`, `getUseDeveloperSupport()`, `MainApplication`, `.onConfigurationChanged()`, `.onCreate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (6 nodes): `MainActivity.kt`, `MainActivity`, `.createReactActivityDelegate()`, `.getMainComponentName()`, `.invokeDefaultOnBackPressed()`, `.onCreate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 13`** (5 nodes): `computeRating()`, `getFarmerTrustProfile()`, `hasReviewed()`, `reviewService.js`, `submitReview()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 14`** (4 nodes): `AIPriceScale()`, `verdictColors()`, `verdictLabel()`, `AIPriceScale.jsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (4 nodes): `ListingDetailScreen.jsx`, `ListingDetailScreen()`, `SaveHeart()`, `useEntranceStyle()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 22`** (3 nodes): `LocationChip.jsx`, `formatLocation()`, `LocationChip()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAIModal()` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `AIModal()` connect `Community 2` to `Community 1`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `useAuth()` (e.g. with `OnboardingProvider()` and `RootNavigator()`) actually correct?**
  _`useAuth()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
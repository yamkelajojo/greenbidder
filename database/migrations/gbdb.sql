-- ============================================================
-- GreenBidder — Migration 001: COMPLETE DATABASE
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- 
-- 12 tables + 1 view + PostGIS + RLS + triggers
-- Recommendation-engine-ready from day one
-- ============================================================


-- ┌─────────────────────────────────────────────┐
-- │  STEP 1: Extensions                         │
-- └─────────────────────────────────────────────┘
CREATE EXTENSION IF NOT EXISTS postgis;


-- ┌─────────────────────────────────────────────┐
-- │  STEP 2: Custom ENUM types                  │
-- └─────────────────────────────────────────────┘
CREATE TYPE user_role AS ENUM ('buyer', 'farmer');
CREATE TYPE listing_status AS ENUM ('pending', 'active', 'inactive', 'sold', 'archived');
CREATE TYPE interaction_source AS ENUM ('feed', 'search', 'recommendation', 'direct');
CREATE TYPE contact_method AS ENUM ('in_app', 'phone', 'whatsapp');


-- ┌─────────────────────────────────────────────┐
-- │  STEP 3: Core identity tables               │
-- └─────────────────────────────────────────────┘

-- 3a. Users (base identity — links to Supabase Auth)
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id       UUID UNIQUE NOT NULL,              -- maps to auth.users.id
    email         TEXT UNIQUE NOT NULL,
    role          user_role NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3b. Farmer profiles
CREATE TABLE farmer_profiles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    farm_name     TEXT NOT NULL,
    phone         TEXT,
    bio           TEXT,
    avg_rating    DECIMAL(3,2) DEFAULT 0.00,
    is_verified   BOOLEAN NOT NULL DEFAULT false,
    response_rate DECIMAL(5,2) DEFAULT 0.00,         -- % of contacts responded to (recommendation feature)

    -- GEO: farm location
    location      GEOGRAPHY(POINT, 4326),
    location_name TEXT,                              -- human-readable: "Limpopo, South Africa"

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3c. Buyer profiles
CREATE TABLE buyer_profiles (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name     TEXT NOT NULL,
    phone         TEXT,
    preferred_radius_km INT NOT NULL DEFAULT 50,     -- default search radius (recommendation user feature)

    -- GEO: buyer location for proximity searches
    location      GEOGRAPHY(POINT, 4326),
    location_name TEXT,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ┌─────────────────────────────────────────────┐
-- │  STEP 4: Marketplace tables                 │
-- └─────────────────────────────────────────────┘

-- 4a. Produce categories (reference table)
CREATE TABLE produce_categories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT UNIQUE NOT NULL,
    description   TEXT,
    icon_url      TEXT
);

-- 4b. Listings (core marketplace entity)
CREATE TABLE listings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id     UUID NOT NULL REFERENCES farmer_profiles(id) ON DELETE RESTRICT,
    category_id   UUID NOT NULL REFERENCES produce_categories(id) ON DELETE RESTRICT,
    title         TEXT NOT NULL,
    description   TEXT,
    price         DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    quantity      DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
    unit          TEXT NOT NULL DEFAULT 'kg',
    status        listing_status NOT NULL DEFAULT 'pending',
    is_organic    BOOLEAN NOT NULL DEFAULT false,

    -- Denormalized counters (updated via triggers — recommendation item features)
    view_count    INT NOT NULL DEFAULT 0,
    save_count    INT NOT NULL DEFAULT 0,

    -- GEO: listing pickup/delivery location (may differ from farm)
    location      GEOGRAPHY(POINT, 4326),
    location_name TEXT,

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4c. Listing images
CREATE TABLE listing_images (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id    UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    image_url     TEXT NOT NULL,
    is_primary    BOOLEAN NOT NULL DEFAULT false,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4d. AI analysis (one per listing — written by Edge Functions via service role)
CREATE TABLE ai_analysis (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id            UUID UNIQUE NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    condition_score       DECIMAL(3,1) CHECK (condition_score >= 0 AND condition_score <= 10),
    ripeness_estimate     TEXT,
    growth_insight        TEXT,
    price_suggestion_min  DECIMAL(10,2),
    price_suggestion_max  DECIMAL(10,2),
    raw_feedback          JSONB,
    analyzed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT valid_price_range CHECK (price_suggestion_max >= price_suggestion_min)
);


-- ┌─────────────────────────────────────────────┐
-- │  STEP 5: Social & credibility tables        │
-- └─────────────────────────────────────────────┘

-- 5a. Saved listings (buyer favourites — recommendation signal weight: 3.0)
CREATE TABLE saved_listings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id      UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    listing_id    UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    saved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_save UNIQUE (buyer_id, listing_id)
);

-- 5b. Farmer reviews
CREATE TABLE farmer_reviews (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id      UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    farmer_id     UUID NOT NULL REFERENCES farmer_profiles(id) ON DELETE CASCADE,
    listing_id    UUID REFERENCES listings(id) ON DELETE SET NULL,
    rating        INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment       TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT one_review_per_buyer_farmer UNIQUE (buyer_id, farmer_id)
);


-- ┌─────────────────────────────────────────────┐
-- │  STEP 6: Tracking & recommendation tables   │
-- └─────────────────────────────────────────────┘

-- 6a. Browsing history (recommendation signal weight: 1.0–2.0 based on duration)
CREATE TABLE browsing_history (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id         UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    listing_id       UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    viewed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_seconds INT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    source           interaction_source NOT NULL DEFAULT 'feed'
);

-- 6b. Search history (recommendation intent signal weight: 2.0)
CREATE TABLE search_history (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id         UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    category_id      UUID REFERENCES produce_categories(id) ON DELETE SET NULL,
    query            TEXT NOT NULL,
    results_count    INT NOT NULL DEFAULT 0,
    min_price_filter DECIMAL(10,2),                  -- nullable: buyer's price floor intent
    max_price_filter DECIMAL(10,2),                  -- nullable: buyer's price ceiling intent
    location_lat     DOUBLE PRECISION,               -- nullable: geo filter lat
    location_lng     DOUBLE PRECISION,               -- nullable: geo filter lng
    radius_km        INT,                            -- nullable: geo filter radius
    searched_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6c. Contact events (STRONGEST recommendation signal weight: 5.0)
CREATE TABLE contact_events (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id         UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    listing_id       UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    contact_method   contact_method NOT NULL DEFAULT 'in_app',
    contacted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ┌─────────────────────────────────────────────┐
-- │  STEP 7: Market data table                  │
-- └─────────────────────────────────────────────┘

CREATE TABLE market_prices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES produce_categories(id) ON DELETE CASCADE,
    price_per_unit  DECIMAL(10,2) NOT NULL CHECK (price_per_unit >= 0),
    unit            TEXT NOT NULL DEFAULT 'kg',
    recorded_date   DATE NOT NULL,
    source          TEXT NOT NULL DEFAULT 'FAO',     -- 'FAO' or 'WorldBank'

    CONSTRAINT unique_price_entry UNIQUE (category_id, recorded_date, source)
);


-- ┌─────────────────────────────────────────────┐
-- │  STEP 8: Indexes                            │
-- └─────────────────────────────────────────────┘

-- Geo indexes (GIST) — fast proximity queries
CREATE INDEX idx_farmer_profiles_location ON farmer_profiles USING GIST (location);
CREATE INDEX idx_buyer_profiles_location  ON buyer_profiles  USING GIST (location);
CREATE INDEX idx_listings_location        ON listings        USING GIST (location);

-- Core lookup indexes
CREATE INDEX idx_users_auth_id           ON users(auth_id);
CREATE INDEX idx_listings_farmer_id      ON listings(farmer_id);
CREATE INDEX idx_listings_category_id    ON listings(category_id);
CREATE INDEX idx_listings_status         ON listings(status);
CREATE INDEX idx_listings_created_at     ON listings(created_at DESC);
CREATE INDEX idx_listing_images_lid      ON listing_images(listing_id);
CREATE INDEX idx_ai_analysis_lid         ON ai_analysis(listing_id);

-- Social indexes
CREATE INDEX idx_saved_listings_buyer    ON saved_listings(buyer_id);
CREATE INDEX idx_saved_listings_listing  ON saved_listings(listing_id);
CREATE INDEX idx_farmer_reviews_farmer   ON farmer_reviews(farmer_id);
CREATE INDEX idx_farmer_reviews_buyer    ON farmer_reviews(buyer_id);

-- Recommendation engine indexes (optimised for training data pulls)
CREATE INDEX idx_browsing_buyer_time     ON browsing_history(buyer_id, viewed_at DESC);
CREATE INDEX idx_browsing_listing        ON browsing_history(listing_id);
CREATE INDEX idx_search_buyer_time       ON search_history(buyer_id, searched_at DESC);
CREATE INDEX idx_contact_buyer_time      ON contact_events(buyer_id, contacted_at DESC);
CREATE INDEX idx_contact_listing         ON contact_events(listing_id);

-- Market price lookup
CREATE INDEX idx_market_prices_cat_date  ON market_prices(category_id, recorded_date DESC);


-- ┌─────────────────────────────────────────────┐
-- │  STEP 9: Triggers & functions               │
-- └─────────────────────────────────────────────┘

-- 9a. Auto-update updated_at on listings
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- 9b. Auto-create user record when someone signs up via Supabase Auth
--     This is CRITICAL — without it, RLS policies can't resolve user_id from JWT
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (auth_id, email, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            (NEW.raw_user_meta_data->>'role')::user_role,
            'buyer'  -- default role if not specified during signup
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_auth_user();

-- 9c. Increment view_count when browsing_history row is inserted
CREATE OR REPLACE FUNCTION increment_view_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE listings SET view_count = view_count + 1 WHERE id = NEW.listing_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_views
    AFTER INSERT ON browsing_history
    FOR EACH ROW
    EXECUTE FUNCTION increment_view_count();

-- 9d. Increment/decrement save_count when saved_listings changes
CREATE OR REPLACE FUNCTION update_save_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE listings SET save_count = save_count + 1 WHERE id = NEW.listing_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE listings SET save_count = save_count - 1 WHERE id = OLD.listing_id;
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_save_count
    AFTER INSERT OR DELETE ON saved_listings
    FOR EACH ROW
    EXECUTE FUNCTION update_save_count();

-- 9e. Recalculate farmer avg_rating when a review is added/updated/deleted
CREATE OR REPLACE FUNCTION update_farmer_avg_rating()
RETURNS TRIGGER AS $$
DECLARE
    target_farmer_id UUID;
BEGIN
    target_farmer_id := COALESCE(NEW.farmer_id, OLD.farmer_id);
    UPDATE farmer_profiles
    SET avg_rating = COALESCE(
        (SELECT ROUND(AVG(rating)::numeric, 2) FROM farmer_reviews WHERE farmer_id = target_farmer_id),
        0.00
    )
    WHERE id = target_farmer_id;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_avg_rating
    AFTER INSERT OR UPDATE OR DELETE ON farmer_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_farmer_avg_rating();


-- ┌──────────────────────────────────────────────────────────────┐
-- │  STEP 10: Unified interactions view (for LightFM training)  │
-- └──────────────────────────────────────────────────────────────┘

CREATE OR REPLACE VIEW recommendation_interactions AS
    -- Views: weight by duration (brief = 1.0, long = 2.0)
    SELECT
        buyer_id,
        listing_id,
        CASE WHEN duration_seconds > 30 THEN 2.0 ELSE 1.0 END AS weight,
        viewed_at AS interacted_at,
        'view'::TEXT AS interaction_type
    FROM browsing_history

    UNION ALL

    -- Saves: weight 3.0
    SELECT
        buyer_id,
        listing_id,
        3.0 AS weight,
        saved_at AS interacted_at,
        'save'::TEXT AS interaction_type
    FROM saved_listings

    UNION ALL

    -- Contacts: weight 5.0 (strongest signal)
    SELECT
        buyer_id,
        listing_id,
        5.0 AS weight,
        contacted_at AS interacted_at,
        'contact'::TEXT AS interaction_type
    FROM contact_events

    UNION ALL

    -- Search-originated views: weight 2.0 (intentional discovery)
    SELECT
        buyer_id,
        listing_id,
        2.0 AS weight,
        viewed_at AS interacted_at,
        'search_click'::TEXT AS interaction_type
    FROM browsing_history
    WHERE source = 'search';


-- ┌─────────────────────────────────────────────┐
-- │  STEP 11: Row Level Security (RLS)          │
-- └─────────────────────────────────────────────┘

-- Enable RLS on all tables
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE buyer_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE produce_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_images     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis        ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_listings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE browsing_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices      ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS UUID AS $$
    SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS user_role AS $$
    SELECT role FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_buyer_profile_id()
RETURNS UUID AS $$
    SELECT bp.id FROM buyer_profiles bp
    JOIN users u ON bp.user_id = u.id
    WHERE u.auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_current_farmer_profile_id()
RETURNS UUID AS $$
    SELECT fp.id FROM farmer_profiles fp
    JOIN users u ON fp.user_id = u.id
    WHERE u.auth_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── Users ──
CREATE POLICY "Users can read own record"
    ON users FOR SELECT USING (auth_id = auth.uid());
CREATE POLICY "Users can update own record"
    ON users FOR UPDATE USING (auth_id = auth.uid());

-- ── Farmer Profiles ──
CREATE POLICY "Anyone can view farmer profiles"
    ON farmer_profiles FOR SELECT USING (true);
CREATE POLICY "Farmers can insert own profile"
    ON farmer_profiles FOR INSERT
    WITH CHECK (user_id = get_current_user_id() AND get_current_user_role() = 'farmer');
CREATE POLICY "Farmers can update own profile"
    ON farmer_profiles FOR UPDATE USING (user_id = get_current_user_id());

-- ── Buyer Profiles ──
CREATE POLICY "Buyers can view own profile"
    ON buyer_profiles FOR SELECT USING (user_id = get_current_user_id());
CREATE POLICY "Buyers can insert own profile"
    ON buyer_profiles FOR INSERT
    WITH CHECK (user_id = get_current_user_id() AND get_current_user_role() = 'buyer');
CREATE POLICY "Buyers can update own profile"
    ON buyer_profiles FOR UPDATE USING (user_id = get_current_user_id());

-- ── Produce Categories (public read-only) ──
CREATE POLICY "Anyone can read categories"
    ON produce_categories FOR SELECT USING (true);

-- ── Listings ──
--    NOTE: No DELETE policy. Deletion is soft-delete via status = 'archived'.
CREATE POLICY "Anyone can view active listings"
    ON listings FOR SELECT
    USING (
        status = 'active'
        OR farmer_id = get_current_farmer_profile_id()
    );
CREATE POLICY "Farmers can create own listings"
    ON listings FOR INSERT
    WITH CHECK (
        farmer_id = get_current_farmer_profile_id()
        AND get_current_user_role() = 'farmer'
    );
CREATE POLICY "Farmers can update own listings"
    ON listings FOR UPDATE
    USING (farmer_id = get_current_farmer_profile_id());
-- No DELETE policy — farmers set status = 'archived' instead

-- ── Listing Images ──
CREATE POLICY "Anyone can view listing images"
    ON listing_images FOR SELECT USING (true);
CREATE POLICY "Farmers can add own listing images"
    ON listing_images FOR INSERT
    WITH CHECK (
        listing_id IN (
            SELECT id FROM listings WHERE farmer_id = get_current_farmer_profile_id()
        )
    );
CREATE POLICY "Farmers can delete own listing images"
    ON listing_images FOR DELETE
    USING (
        listing_id IN (
            SELECT id FROM listings WHERE farmer_id = get_current_farmer_profile_id()
        )
    );

-- ── AI Analysis (read for all, write via service role only) ──
CREATE POLICY "Anyone can view AI analysis"
    ON ai_analysis FOR SELECT USING (true);

-- ── Saved Listings ──
CREATE POLICY "Buyers can view own saves"
    ON saved_listings FOR SELECT USING (buyer_id = get_current_buyer_profile_id());
CREATE POLICY "Buyers can save listings"
    ON saved_listings FOR INSERT
    WITH CHECK (buyer_id = get_current_buyer_profile_id() AND get_current_user_role() = 'buyer');
CREATE POLICY "Buyers can unsave listings"
    ON saved_listings FOR DELETE
    USING (buyer_id = get_current_buyer_profile_id());

-- ── Farmer Reviews ──
CREATE POLICY "Anyone can view reviews"
    ON farmer_reviews FOR SELECT USING (true);
CREATE POLICY "Buyers can submit reviews"
    ON farmer_reviews FOR INSERT
    WITH CHECK (buyer_id = get_current_buyer_profile_id() AND get_current_user_role() = 'buyer');
CREATE POLICY "Buyers can update own reviews"
    ON farmer_reviews FOR UPDATE USING (buyer_id = get_current_buyer_profile_id());

-- ── Browsing History (buyer's own only) ──
CREATE POLICY "Buyers can view own browsing history"
    ON browsing_history FOR SELECT USING (buyer_id = get_current_buyer_profile_id());
CREATE POLICY "Buyers can log views"
    ON browsing_history FOR INSERT
    WITH CHECK (buyer_id = get_current_buyer_profile_id());

-- ── Search History (buyer's own only) ──
CREATE POLICY "Buyers can view own search history"
    ON search_history FOR SELECT USING (buyer_id = get_current_buyer_profile_id());
CREATE POLICY "Buyers can log searches"
    ON search_history FOR INSERT
    WITH CHECK (buyer_id = get_current_buyer_profile_id());

-- ── Contact Events ──
CREATE POLICY "Buyers can view own contacts"
    ON contact_events FOR SELECT USING (buyer_id = get_current_buyer_profile_id());
CREATE POLICY "Buyers can log contacts"
    ON contact_events FOR INSERT
    WITH CHECK (buyer_id = get_current_buyer_profile_id() AND get_current_user_role() = 'buyer');
-- Farmers can see contacts on their listings (for response_rate tracking)
CREATE POLICY "Farmers can view contacts on own listings"
    ON contact_events FOR SELECT
    USING (
        listing_id IN (
            SELECT id FROM listings WHERE farmer_id = get_current_farmer_profile_id()
        )
    );

-- ── Market Prices (public read, write via service role/scheduled job) ──
CREATE POLICY "Anyone can read market prices"
    ON market_prices FOR SELECT USING (true);


-- ┌─────────────────────────────────────────────┐
-- │  STEP 12: Geo helper functions              │
-- └─────────────────────────────────────────────┘

-- Find active listings near a lat/lng point
CREATE OR REPLACE FUNCTION get_nearby_listings(
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    radius_meters INT DEFAULT 50000
)
RETURNS TABLE (
    listing_id    UUID,
    title         TEXT,
    price         DECIMAL,
    unit          TEXT,
    location_name TEXT,
    farm_name     TEXT,
    category_name TEXT,
    condition_score DECIMAL,
    distance_m    DOUBLE PRECISION
) AS $$
    SELECT
        l.id AS listing_id,
        l.title,
        l.price,
        l.unit,
        l.location_name,
        fp.farm_name,
        pc.name AS category_name,
        aa.condition_score,
        ST_Distance(
            l.location,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
        ) AS distance_m
    FROM listings l
    JOIN farmer_profiles fp ON l.farmer_id = fp.id
    JOIN produce_categories pc ON l.category_id = pc.id
    LEFT JOIN ai_analysis aa ON aa.listing_id = l.id
    WHERE l.status = 'active'
      AND l.location IS NOT NULL
      AND ST_DWithin(
            l.location,
            ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
            radius_meters
          )
    ORDER BY distance_m ASC;
$$ LANGUAGE sql STABLE;


-- ┌─────────────────────────────────────────────┐
-- │  STEP 13: Seed data — produce categories    │
-- └─────────────────────────────────────────────┘
INSERT INTO produce_categories (name, description) VALUES
    ('Tomatoes',    'Fresh tomatoes — cherry, roma, beefsteak, etc.'),
    ('Potatoes',    'All potato varieties'),
    ('Onions',      'White, red, spring onions'),
    ('Cabbage',     'Green and red cabbage'),
    ('Spinach',     'Fresh spinach and morogo'),
    ('Maize',       'Sweet corn and maize meal corn'),
    ('Carrots',     'Fresh carrots'),
    ('Peppers',     'Bell peppers, chilli peppers'),
    ('Butternut',   'Butternut squash'),
    ('Apples',      'All apple varieties'),
    ('Bananas',     'Fresh bananas'),
    ('Oranges',     'Oranges and citrus');

-- ============================================================
-- GreenBidder — Migration 002: CABBAGE DISEASE DETECTION
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- (safe to re-run: every statement is idempotent)
--
-- Adds:
--   * public.disease_scans        — per-user scan history
--   * storage bucket "disease-scans" — one folder per user (auth uid)
--   * RLS on both (users only touch their own rows / files)
--
-- App-side counterpart: src/services/diseaseService.js
-- ============================================================


-- ┌─────────────────────────────────────────────┐
-- │  STEP 1: disease_scans table                │
-- └─────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS public.disease_scans (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    image_path    TEXT NOT NULL,             -- storage object path: <user_id>/<ts>.jpg
    disease_key   TEXT NOT NULL,             -- e.g. "black_rot" or "unknown"
    disease_label TEXT NOT NULL,             -- e.g. "Black Rot"
    confidence    NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    is_cabbage    BOOLEAN NOT NULL DEFAULT true,
    advisory      TEXT,                      -- short advisory (summary line)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disease_scans_user_created
    ON public.disease_scans (user_id, created_at DESC);

COMMENT ON TABLE public.disease_scans IS
    'CabbageGuard on-device diagnosis history (one row per scan).';


-- ┌─────────────────────────────────────────────┐
-- │  STEP 2: RLS — users touch only their own   │
-- └─────────────────────────────────────────────┘

ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disease_scans_users_read_own" ON public.disease_scans;
CREATE POLICY "disease_scans_users_read_own"
    ON public.disease_scans FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "disease_scans_users_insert_own" ON public.disease_scans;
CREATE POLICY "disease_scans_users_insert_own"
    ON public.disease_scans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "disease_scans_users_delete_own" ON public.disease_scans;
CREATE POLICY "disease_scans_users_delete_own"
    ON public.disease_scans FOR DELETE
    USING (auth.uid() = user_id);

-- No UPDATE policy on purpose: scans are immutable history entries;
-- the app deletes and re-creates instead of editing.


-- ┌─────────────────────────────────────────────┐
-- │  STEP 3: Storage bucket "disease-scans"     │
-- └─────────────────────────────────────────────┘

-- Public bucket so the app can render thumbnails without authed fetches
-- (same convention as the existing "listing-images" bucket).
INSERT INTO storage.buckets (id, name, public)
VALUES ('disease-scans', 'disease-scans', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Objects live under <auth.uid()>/... — users can only read, upload,
-- and delete files inside their own folder.
DROP POLICY IF EXISTS "disease-scans_read_own" ON storage.objects;
CREATE POLICY "disease-scans_read_own"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'disease-scans'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "disease-scans_insert_own" ON storage.objects;
CREATE POLICY "disease-scans_insert_own"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'disease-scans'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "disease-scans_delete_own" ON storage.objects;
CREATE POLICY "disease-scans_delete_own"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'disease-scans'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ===============================================
-- NOTION AI CLONE - BASIC SCHEMA (PART 1)
-- ===============================================
-- Core tables and functionality only

-- ===============================================
-- EXTENSIONS
-- ===============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================================
-- CORE TABLES
-- ===============================================

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    cover_url TEXT,
    user_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Pages table with all required columns including user_id and is_deleted
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content JSONB DEFAULT '[]'::jsonb,
    parent_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    icon TEXT,
    icon_url TEXT,
    cover_image TEXT,
    cover_url TEXT,
    summary TEXT,
    summary_updated_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    color TEXT,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Page tags junction table
CREATE TABLE IF NOT EXISTS page_tags (
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (page_id, tag_id)
);

-- ===============================================
-- INDEXES
-- ===============================================

CREATE INDEX IF NOT EXISTS idx_pages_workspace_id ON pages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_pages_user_id ON pages(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_pages_cover_image ON pages(cover_image);
CREATE INDEX IF NOT EXISTS idx_pages_is_deleted ON pages(is_deleted);
CREATE INDEX IF NOT EXISTS idx_tags_workspace_id ON tags(workspace_id);

-- ===============================================
-- FUNCTIONS
-- ===============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Summary timestamp update function
CREATE OR REPLACE FUNCTION update_summary_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.summary IS DISTINCT FROM NEW.summary THEN
        NEW.summary_updated_at = TIMEZONE('utc'::text, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- TRIGGERS
-- ===============================================

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
CREATE TRIGGER update_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pages_updated_at ON pages;
CREATE TRIGGER update_pages_updated_at
    BEFORE UPDATE ON pages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pages_summary_timestamp ON pages;
CREATE TRIGGER update_pages_summary_timestamp
    BEFORE UPDATE ON pages
    FOR EACH ROW
    EXECUTE FUNCTION update_summary_timestamp();

-- ===============================================
-- ROW LEVEL SECURITY
-- ===============================================

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_tags ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- RLS POLICIES - WORKSPACES
-- ===============================================

DROP POLICY IF EXISTS "Users can view their own workspaces" ON workspaces;
CREATE POLICY "Users can view their own workspaces"
    ON workspaces FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own workspaces" ON workspaces;
CREATE POLICY "Users can create their own workspaces"
    ON workspaces FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own workspaces" ON workspaces;
CREATE POLICY "Users can update their own workspaces"
    ON workspaces FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own workspaces" ON workspaces;
CREATE POLICY "Users can delete their own workspaces"
    ON workspaces FOR DELETE
    USING (auth.uid() = user_id);

-- ===============================================
-- RLS POLICIES - PAGES
-- ===============================================

DROP POLICY IF EXISTS "Users can view pages in their workspaces" ON pages;
CREATE POLICY "Users can view pages in their workspaces"
    ON pages FOR SELECT
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = pages.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create pages in their workspaces" ON pages;
CREATE POLICY "Users can create pages in their workspaces"
    ON pages FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = pages.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update pages in their workspaces" ON pages;
CREATE POLICY "Users can update pages in their workspaces"
    ON pages FOR UPDATE
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = pages.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete pages in their workspaces" ON pages;
CREATE POLICY "Users can delete pages in their workspaces"
    ON pages FOR DELETE
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = pages.workspace_id
                AND workspaces.user_id = auth.uid()
        )
    );

-- ===============================================
-- RLS POLICIES - TAGS
-- ===============================================

DROP POLICY IF EXISTS "Users can view tags in their workspaces" ON tags;
CREATE POLICY "Users can view tags in their workspaces"
    ON tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = tags.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage tags in their workspaces" ON tags;
CREATE POLICY "Users can manage tags in their workspaces"
    ON tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = tags.workspace_id
                AND workspaces.user_id = auth.uid()
        )
    );

-- ===============================================
-- RLS POLICIES - PAGE TAGS
-- ===============================================

DROP POLICY IF EXISTS "Users can manage page tags in their workspaces" ON page_tags;
CREATE POLICY "Users can manage page tags in their workspaces"
    ON page_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM pages
            JOIN workspaces ON workspaces.id = pages.workspace_id
            WHERE pages.id = page_tags.page_id
            AND workspaces.user_id = auth.uid()
        )
    );

-- ===============================================
-- STORAGE SETUP
-- ===============================================

DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public) VALUES
        ('page-icons', 'page-icons', true),
        ('page-covers', 'page-covers', true),
        ('user-uploads', 'user-uploads', false)
    ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Storage buckets setup skipped: %', SQLERRM;
END $$;

-- Basic storage policies
DO $$
BEGIN
    -- Page icons bucket policies
    DROP POLICY IF EXISTS "Anyone can view page icons" ON storage.objects;
    CREATE POLICY "Anyone can view page icons"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'page-icons');

    DROP POLICY IF EXISTS "Authenticated users can upload page icons" ON storage.objects;
    CREATE POLICY "Authenticated users can upload page icons"
        ON storage.objects FOR INSERT
        WITH CHECK (
            bucket_id = 'page-icons'
            AND auth.role() = 'authenticated'
        );

    -- Page covers bucket policies
    DROP POLICY IF EXISTS "Anyone can view page covers" ON storage.objects;
    CREATE POLICY "Anyone can view page covers"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'page-covers');

    DROP POLICY IF EXISTS "Authenticated users can upload page covers" ON storage.objects;
    CREATE POLICY "Authenticated users can upload page covers"
        ON storage.objects FOR INSERT
        WITH CHECK (
            bucket_id = 'page-covers'
            AND auth.role() = 'authenticated'
        );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Storage policies setup skipped: %', SQLERRM;
END $$; 
-- ===============================================
-- PAGE LINKS TRACKING FOR BIDIRECTIONAL SUGGESTIONS
-- ===============================================

-- Create a table to track links between pages
CREATE TABLE IF NOT EXISTS page_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    target_page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    link_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure unique links per source-target pair
    UNIQUE(source_page_id, target_page_id)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_page_links_source ON page_links(source_page_id);
CREATE INDEX IF NOT EXISTS idx_page_links_target ON page_links(target_page_id);
CREATE INDEX IF NOT EXISTS idx_page_links_workspace ON page_links(workspace_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_page_links_updated_at ON page_links;
CREATE TRIGGER update_page_links_updated_at
    BEFORE UPDATE ON page_links
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- ENHANCED SEMANTIC SEARCH WITH BIDIRECTIONAL CONTEXT
-- ===============================================

-- Function to get bidirectional link suggestions
CREATE OR REPLACE FUNCTION get_bidirectional_link_suggestions(
    current_page_id UUID,
    workspace_filter UUID,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    page_id UUID,
    title TEXT,
    summary TEXT,
    link_count INTEGER,
    is_already_linked BOOLEAN,
    bidirectional_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    WITH linked_pages AS (
        -- Get pages that are already linked from current page
        SELECT target_page_id AS linked_id
        FROM page_links
        WHERE source_page_id = current_page_id
        
        UNION
        
        -- Get pages that link to current page
        SELECT source_page_id AS linked_id
        FROM page_links
        WHERE target_page_id = current_page_id
    ),
    page_scores AS (
        SELECT 
            p.id,
            p.title,
            p.summary,
            -- Count total links for this page
            (
                SELECT COUNT(*)
                FROM page_links pl
                WHERE pl.source_page_id = p.id OR pl.target_page_id = p.id
            ) AS total_links,
            -- Check if already linked
            EXISTS(SELECT 1 FROM linked_pages WHERE linked_id = p.id) AS already_linked,
            -- Calculate bidirectional score based on mutual connections
            (
                SELECT COUNT(DISTINCT mutual.page_id)
                FROM (
                    -- Pages that this page links to
                    SELECT pl1.target_page_id AS page_id
                    FROM page_links pl1
                    WHERE pl1.source_page_id = p.id
                    
                    INTERSECT
                    
                    -- Pages that the current page links to
                    SELECT pl2.target_page_id AS page_id
                    FROM page_links pl2
                    WHERE pl2.source_page_id = current_page_id
                    
                    UNION
                    
                    -- Pages that link to this page
                    SELECT pl3.source_page_id AS page_id
                    FROM page_links pl3
                    WHERE pl3.target_page_id = p.id
                    
                    INTERSECT
                    
                    -- Pages that link to the current page
                    SELECT pl4.source_page_id AS page_id
                    FROM page_links pl4
                    WHERE pl4.target_page_id = current_page_id
                ) AS mutual
            )::FLOAT / GREATEST(total_links, 1) AS mutual_connection_score
        FROM pages p
        WHERE 
            p.workspace_id = workspace_filter
            AND p.id != current_page_id
            AND p.is_deleted = false
    )
    SELECT 
        ps.id AS page_id,
        ps.title,
        ps.summary,
        ps.total_links AS link_count,
        ps.already_linked AS is_already_linked,
        ps.mutual_connection_score AS bidirectional_score
    FROM page_scores ps
    WHERE NOT ps.already_linked -- Exclude already linked pages
    ORDER BY ps.mutual_connection_score DESC, ps.total_links DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- FUNCTION TO EXTRACT AND UPDATE PAGE LINKS
-- ===============================================

CREATE OR REPLACE FUNCTION extract_page_links(
    page_id UUID,
    page_content JSONB
) RETURNS VOID AS $$
DECLARE
    link_record RECORD;
    target_id UUID;
BEGIN
    -- Delete existing links from this page
    DELETE FROM page_links WHERE source_page_id = page_id;
    
    -- Extract links from content (simplified - adjust based on your content structure)
    FOR link_record IN 
        SELECT DISTINCT
            (regexp_matches(content_text, '/page/([a-f0-9-]{36})', 'g'))[1] AS linked_page_id,
            substring(content_text FROM position((regexp_matches(content_text, '/page/([a-f0-9-]{36})', 'g'))[1] IN content_text) - 50 FOR 100) AS context
        FROM (
            SELECT jsonb_pretty(page_content) AS content_text
        ) AS content_data
    LOOP
        BEGIN
            target_id := link_record.linked_page_id::UUID;
            
            -- Verify target page exists in same workspace
            IF EXISTS (
                SELECT 1 FROM pages p1
                JOIN pages p2 ON p1.workspace_id = p2.workspace_id
                WHERE p1.id = page_id 
                AND p2.id = target_id
                AND p2.is_deleted = false
            ) THEN
                INSERT INTO page_links (source_page_id, target_page_id, workspace_id, link_text)
                SELECT 
                    page_id,
                    target_id,
                    p.workspace_id,
                    link_record.context
                FROM pages p
                WHERE p.id = page_id
                ON CONFLICT (source_page_id, target_page_id) DO NOTHING;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Skip invalid UUIDs or other errors
                CONTINUE;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ===============================================
-- RLS POLICIES
-- ===============================================

ALTER TABLE page_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view page links in their workspaces" ON page_links;
CREATE POLICY "Users can view page links in their workspaces"
    ON page_links FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = page_links.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can manage page links in their workspaces" ON page_links;
CREATE POLICY "Users can manage page links in their workspaces"
    ON page_links FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = page_links.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    ); 
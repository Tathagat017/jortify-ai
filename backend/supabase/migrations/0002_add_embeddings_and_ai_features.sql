-- ===============================================
-- NOTION AI CLONE - EMBEDDINGS & AI FEATURES
-- ===============================================
-- Add embeddings table and AI-related functionality

-- ===============================================
-- EXTENSIONS FOR AI FEATURES
-- ===============================================

-- Enable vector extension for embeddings (if available)
-- CREATE EXTENSION IF NOT EXISTS vector;

-- ===============================================
-- EMBEDDINGS TABLE
-- ===============================================

-- Page embeddings table for semantic search
CREATE TABLE IF NOT EXISTS page_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    embedding TEXT NOT NULL, -- JSON string of embedding vector
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure one embedding per page
    UNIQUE(page_id)
);

-- ===============================================
-- AI SESSIONS TABLE
-- ===============================================

-- AI chat sessions for pages
CREATE TABLE IF NOT EXISTS ai_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT,
    messages JSONB DEFAULT '[]'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ===============================================
-- INDEXES FOR PERFORMANCE
-- ===============================================

-- Embeddings indexes
CREATE INDEX IF NOT EXISTS idx_page_embeddings_page_id ON page_embeddings(page_id);
CREATE INDEX IF NOT EXISTS idx_page_embeddings_content_hash ON page_embeddings(content_hash);

-- AI sessions indexes
CREATE INDEX IF NOT EXISTS idx_ai_sessions_page_id ON ai_sessions(page_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user_id ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_created_at ON ai_sessions(created_at);

-- ===============================================
-- TRIGGERS FOR UPDATED_AT
-- ===============================================

DROP TRIGGER IF EXISTS update_page_embeddings_updated_at ON page_embeddings;
CREATE TRIGGER update_page_embeddings_updated_at
    BEFORE UPDATE ON page_embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_sessions_updated_at ON ai_sessions;
CREATE TRIGGER update_ai_sessions_updated_at
    BEFORE UPDATE ON ai_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- ROW LEVEL SECURITY
-- ===============================================

ALTER TABLE page_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- RLS POLICIES - PAGE EMBEDDINGS
-- ===============================================

DROP POLICY IF EXISTS "Users can view embeddings for their pages" ON page_embeddings;
CREATE POLICY "Users can view embeddings for their pages"
    ON page_embeddings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM pages
            JOIN workspaces ON workspaces.id = pages.workspace_id
            WHERE pages.id = page_embeddings.page_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "System can manage embeddings" ON page_embeddings;
CREATE POLICY "System can manage embeddings"
    ON page_embeddings FOR ALL
    USING (true); -- Allow system operations for embedding generation

-- ===============================================
-- RLS POLICIES - AI SESSIONS
-- ===============================================

DROP POLICY IF EXISTS "Users can view their AI sessions" ON ai_sessions;
CREATE POLICY "Users can view their AI sessions"
    ON ai_sessions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create AI sessions for their pages" ON ai_sessions;
CREATE POLICY "Users can create AI sessions for their pages"
    ON ai_sessions FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM pages
            JOIN workspaces ON workspaces.id = pages.workspace_id
            WHERE pages.id = ai_sessions.page_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their AI sessions" ON ai_sessions;
CREATE POLICY "Users can update their AI sessions"
    ON ai_sessions FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their AI sessions" ON ai_sessions;
CREATE POLICY "Users can delete their AI sessions"
    ON ai_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- ===============================================
-- SEMANTIC SEARCH FUNCTION
-- ===============================================

-- Function to calculate cosine similarity between embeddings
CREATE OR REPLACE FUNCTION cosine_similarity(a TEXT, b TEXT)
RETURNS FLOAT AS $$
DECLARE
    vec_a FLOAT[];
    vec_b FLOAT[];
    dot_product FLOAT := 0;
    norm_a FLOAT := 0;
    norm_b FLOAT := 0;
    i INTEGER;
BEGIN
    -- Parse JSON arrays
    SELECT array_agg(value::FLOAT) INTO vec_a FROM json_array_elements_text(a::JSON);
    SELECT array_agg(value::FLOAT) INTO vec_b FROM json_array_elements_text(b::JSON);
    
    -- Check if arrays have same length
    IF array_length(vec_a, 1) != array_length(vec_b, 1) THEN
        RETURN 0;
    END IF;
    
    -- Calculate dot product and norms
    FOR i IN 1..array_length(vec_a, 1) LOOP
        dot_product := dot_product + (vec_a[i] * vec_b[i]);
        norm_a := norm_a + (vec_a[i] * vec_a[i]);
        norm_b := norm_b + (vec_b[i] * vec_b[i]);
    END LOOP;
    
    -- Avoid division by zero
    IF norm_a = 0 OR norm_b = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN dot_product / (sqrt(norm_a) * sqrt(norm_b));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function for semantic search
CREATE OR REPLACE FUNCTION semantic_search(
    query_embedding TEXT,
    workspace_filter UUID DEFAULT NULL,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    page_id UUID,
    title TEXT,
    similarity FLOAT,
    content JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        cosine_similarity(pe.embedding, query_embedding) as similarity,
        p.content,
        p.created_at
    FROM pages p
    JOIN page_embeddings pe ON p.id = pe.page_id
    WHERE 
        (workspace_filter IS NULL OR p.workspace_id = workspace_filter)
        AND p.is_deleted = false
        AND cosine_similarity(pe.embedding, query_embedding) >= similarity_threshold
    ORDER BY similarity DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Function to find similar pages
CREATE OR REPLACE FUNCTION find_similar_pages(
    target_page_id UUID,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    page_id UUID,
    title TEXT,
    similarity FLOAT,
    content JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    target_embedding TEXT;
BEGIN
    -- Get the embedding for the target page
    SELECT embedding INTO target_embedding 
    FROM page_embeddings 
    WHERE page_id = target_page_id;
    
    IF target_embedding IS NULL THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        cosine_similarity(pe.embedding, target_embedding) as similarity,
        p.content,
        p.created_at
    FROM pages p
    JOIN page_embeddings pe ON p.id = pe.page_id
    WHERE 
        p.id != target_page_id
        AND p.is_deleted = false
        AND cosine_similarity(pe.embedding, target_embedding) >= similarity_threshold
    ORDER BY similarity DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql; 
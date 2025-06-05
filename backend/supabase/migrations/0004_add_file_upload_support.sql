-- ===============================================
-- FILE UPLOAD SUPPORT FOR RAG
-- ===============================================
-- Add tables for document file uploads and embeddings

-- ===============================================
-- PAGE FILES TABLE
-- ===============================================

-- Store metadata for files uploaded to pages
CREATE TABLE IF NOT EXISTS page_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx')),
    file_size INTEGER NOT NULL,
    file_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ===============================================
-- FILE EMBEDDINGS TABLE
-- ===============================================

-- Store embeddings for file chunks
CREATE TABLE IF NOT EXISTS file_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES page_files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding TEXT NOT NULL, -- JSON string of embedding vector
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure unique chunk index per file
    UNIQUE(file_id, chunk_index)
);

-- ===============================================
-- HELP CONTENT TABLE
-- ===============================================

-- Store help documentation content
CREATE TABLE IF NOT EXISTS help_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT, -- JSON string of embedding vector
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Ensure unique section names
    UNIQUE(section)
);

-- ===============================================
-- INDEXES
-- ===============================================

CREATE INDEX IF NOT EXISTS idx_page_files_page_id ON page_files(page_id);
CREATE INDEX IF NOT EXISTS idx_page_files_workspace_id ON page_files(workspace_id);
CREATE INDEX IF NOT EXISTS idx_page_files_user_id ON page_files(user_id);
CREATE INDEX IF NOT EXISTS idx_file_embeddings_file_id ON file_embeddings(file_id);
CREATE INDEX IF NOT EXISTS idx_help_content_section ON help_content(section);

-- ===============================================
-- TRIGGERS
-- ===============================================

DROP TRIGGER IF EXISTS update_page_files_updated_at ON page_files;
CREATE TRIGGER update_page_files_updated_at
    BEFORE UPDATE ON page_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_help_content_updated_at ON help_content;
CREATE TRIGGER update_help_content_updated_at
    BEFORE UPDATE ON help_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- ROW LEVEL SECURITY
-- ===============================================

ALTER TABLE page_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_content ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- RLS POLICIES - PAGE FILES
-- ===============================================

DROP POLICY IF EXISTS "Users can view files in their workspaces" ON page_files;
CREATE POLICY "Users can view files in their workspaces"
    ON page_files FOR SELECT
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = page_files.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can upload files to their pages" ON page_files;
CREATE POLICY "Users can upload files to their pages"
    ON page_files FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = page_files.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their files" ON page_files;
CREATE POLICY "Users can delete their files"
    ON page_files FOR DELETE
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = page_files.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

-- ===============================================
-- RLS POLICIES - FILE EMBEDDINGS
-- ===============================================

DROP POLICY IF EXISTS "Users can view embeddings for their files" ON file_embeddings;
CREATE POLICY "Users can view embeddings for their files"
    ON file_embeddings FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM page_files
            JOIN workspaces ON workspaces.id = page_files.workspace_id
            WHERE page_files.id = file_embeddings.file_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "System can manage file embeddings" ON file_embeddings;
CREATE POLICY "System can manage file embeddings"
    ON file_embeddings FOR ALL
    USING (true); -- Allow system operations for embedding generation

-- ===============================================
-- RLS POLICIES - HELP CONTENT
-- ===============================================

DROP POLICY IF EXISTS "Anyone can view help content" ON help_content;
CREATE POLICY "Anyone can view help content"
    ON help_content FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "System can manage help content" ON help_content;
CREATE POLICY "System can manage help content"
    ON help_content FOR ALL
    USING (auth.role() = 'service_role');

-- ===============================================
-- STORAGE BUCKET SETUP
-- ===============================================

DO $$
BEGIN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('page-documents', 'page-documents', false)
    ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Storage bucket setup skipped: %', SQLERRM;
END $$;

-- Storage policies for page documents
DO $$
BEGIN
    -- View policy
    DROP POLICY IF EXISTS "Users can view their page documents" ON storage.objects;
    CREATE POLICY "Users can view their page documents"
        ON storage.objects FOR SELECT
        USING (
            bucket_id = 'page-documents' AND
            auth.role() = 'authenticated'
        );

    -- Upload policy
    DROP POLICY IF EXISTS "Users can upload page documents" ON storage.objects;
    CREATE POLICY "Users can upload page documents"
        ON storage.objects FOR INSERT
        WITH CHECK (
            bucket_id = 'page-documents' AND
            auth.role() = 'authenticated'
        );

    -- Delete policy
    DROP POLICY IF EXISTS "Users can delete their page documents" ON storage.objects;
    CREATE POLICY "Users can delete their page documents"
        ON storage.objects FOR DELETE
        USING (
            bucket_id = 'page-documents' AND
            auth.role() = 'authenticated'
        );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Storage policies setup skipped: %', SQLERRM;
END $$;

-- ===============================================
-- ENHANCED SEMANTIC SEARCH FUNCTION
-- ===============================================

-- Update semantic search to include file embeddings
CREATE OR REPLACE FUNCTION semantic_search_with_files(
    query_embedding TEXT,
    workspace_filter UUID DEFAULT NULL,
    similarity_threshold FLOAT DEFAULT 0.7,
    max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
    source_type TEXT,
    source_id UUID,
    page_id UUID,
    title TEXT,
    similarity FLOAT,
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    -- Search in page embeddings
    SELECT 
        'page'::TEXT as source_type,
        p.id as source_id,
        p.id as page_id,
        p.title,
        cosine_similarity(pe.embedding, query_embedding) as similarity,
        COALESCE(p.summary, LEFT(p.content::TEXT, 500)) as content,
        pe.metadata,
        p.created_at
    FROM pages p
    JOIN page_embeddings pe ON p.id = pe.page_id
    WHERE 
        (workspace_filter IS NULL OR p.workspace_id = workspace_filter)
        AND p.is_deleted = false
        AND cosine_similarity(pe.embedding, query_embedding) >= similarity_threshold
    
    UNION ALL
    
    -- Search in file embeddings
    SELECT 
        'file'::TEXT as source_type,
        fe.id as source_id,
        pf.page_id as page_id,
        pf.file_name as title,
        cosine_similarity(fe.embedding, query_embedding) as similarity,
        fe.chunk_text as content,
        fe.metadata,
        fe.created_at
    FROM file_embeddings fe
    JOIN page_files pf ON pf.id = fe.file_id
    WHERE 
        (workspace_filter IS NULL OR pf.workspace_id = workspace_filter)
        AND cosine_similarity(fe.embedding, query_embedding) >= similarity_threshold
    
    UNION ALL
    
    -- Search in help content
    SELECT 
        'help'::TEXT as source_type,
        hc.id as source_id,
        NULL::UUID as page_id,
        hc.section as title,
        cosine_similarity(hc.embedding, query_embedding) as similarity,
        hc.content as content,
        hc.metadata,
        hc.created_at
    FROM help_content hc
    WHERE 
        hc.embedding IS NOT NULL
        AND cosine_similarity(hc.embedding, query_embedding) >= similarity_threshold
    
    ORDER BY similarity DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql; 
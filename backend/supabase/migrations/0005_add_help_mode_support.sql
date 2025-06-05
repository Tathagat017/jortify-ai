-- ===============================================
-- HELP MODE SUPPORT FOR CHAT CONVERSATIONS
-- ===============================================
-- Add help mode flag to chat conversations

-- Add help_mode column to chat_conversations
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS help_mode BOOLEAN DEFAULT false;

-- Add index for help mode queries
CREATE INDEX IF NOT EXISTS idx_chat_conversations_help_mode 
ON chat_conversations(help_mode);

-- ===============================================
-- ENHANCED SEMANTIC SEARCH FUNCTIONS
-- ===============================================

-- Create workspace-only semantic search function
CREATE OR REPLACE FUNCTION semantic_search_workspace_only(
    query_embedding TEXT,
    workspace_filter UUID,
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
        p.workspace_id = workspace_filter
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
        pf.workspace_id = workspace_filter
        AND cosine_similarity(fe.embedding, query_embedding) >= similarity_threshold
    
    ORDER BY similarity DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- Create help-only semantic search function
CREATE OR REPLACE FUNCTION semantic_search_help_only(
    query_embedding TEXT,
    similarity_threshold FLOAT DEFAULT 0.5,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    source_type TEXT,
    source_id UUID,
    section TEXT,
    similarity FLOAT,
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'help'::TEXT as source_type,
        hc.id as source_id,
        hc.section,
        cosine_similarity(hc.embedding, query_embedding) as similarity,
        hc.content,
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

-- ===============================================
-- CHAT CONVERSATION METADATA
-- ===============================================

-- Add metadata column for storing additional chat settings
ALTER TABLE chat_conversations 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add web search enabled flag
UPDATE chat_conversations 
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{web_search_enabled}',
    'false'::jsonb
)
WHERE metadata IS NULL OR metadata->>'web_search_enabled' IS NULL; 
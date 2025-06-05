-- ===============================================
-- NOTION AI CLONE - CHAT FUNCTIONALITY
-- ===============================================
-- Add chat conversations and messages tables for RAG chatbot

-- ===============================================
-- CHAT CONVERSATIONS TABLE
-- ===============================================

-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ===============================================
-- CHAT MESSAGES TABLE
-- ===============================================

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ===============================================
-- INDEXES FOR PERFORMANCE
-- ===============================================

-- Chat conversations indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_workspace_id ON chat_conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON chat_conversations(updated_at DESC);

-- Chat messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);

-- ===============================================
-- TRIGGERS FOR UPDATED_AT
-- ===============================================

DROP TRIGGER IF EXISTS update_chat_conversations_updated_at ON chat_conversations;
CREATE TRIGGER update_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON chat_messages;
CREATE TRIGGER update_chat_messages_updated_at
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ===============================================
-- TRIGGER TO UPDATE CONVERSATION TIMESTAMP
-- ===============================================

-- Function to update conversation timestamp when messages are added
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations 
    SET updated_at = NOW() 
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation timestamp on new messages
DROP TRIGGER IF EXISTS update_conversation_on_message ON chat_messages;
CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- ===============================================
-- ROW LEVEL SECURITY
-- ===============================================

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- RLS POLICIES - CHAT CONVERSATIONS
-- ===============================================

DROP POLICY IF EXISTS "Users can view their workspace conversations" ON chat_conversations;
CREATE POLICY "Users can view their workspace conversations"
    ON chat_conversations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = chat_conversations.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create conversations in their workspaces" ON chat_conversations;
CREATE POLICY "Users can create conversations in their workspaces"
    ON chat_conversations FOR INSERT
    WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = chat_conversations.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update their conversations" ON chat_conversations;
CREATE POLICY "Users can update their conversations"
    ON chat_conversations FOR UPDATE
    USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = chat_conversations.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete their conversations" ON chat_conversations;
CREATE POLICY "Users can delete their conversations"
    ON chat_conversations FOR DELETE
    USING (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM workspaces
            WHERE workspaces.id = chat_conversations.workspace_id
            AND workspaces.user_id = auth.uid()
        )
    );

-- ===============================================
-- RLS POLICIES - CHAT MESSAGES
-- ===============================================

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON chat_messages;
CREATE POLICY "Users can view messages in their conversations"
    ON chat_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations cc
            JOIN workspaces w ON w.id = cc.workspace_id
            WHERE cc.id = chat_messages.conversation_id
            AND w.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create messages in their conversations" ON chat_messages;
CREATE POLICY "Users can create messages in their conversations"
    ON chat_messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_conversations cc
            JOIN workspaces w ON w.id = cc.workspace_id
            WHERE cc.id = chat_messages.conversation_id
            AND w.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update messages in their conversations" ON chat_messages;
CREATE POLICY "Users can update messages in their conversations"
    ON chat_messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations cc
            JOIN workspaces w ON w.id = cc.workspace_id
            WHERE cc.id = chat_messages.conversation_id
            AND w.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete messages in their conversations" ON chat_messages;
CREATE POLICY "Users can delete messages in their conversations"
    ON chat_messages FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations cc
            JOIN workspaces w ON w.id = cc.workspace_id
            WHERE cc.id = chat_messages.conversation_id
            AND w.user_id = auth.uid()
        )
    );

-- ===============================================
-- HELPER FUNCTIONS
-- ===============================================

-- Function to get conversation with message count
CREATE OR REPLACE FUNCTION get_workspace_conversations(workspace_uuid UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    updated_at TIMESTAMP WITH TIME ZONE,
    message_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cc.id,
        cc.title,
        cc.updated_at,
        COUNT(cm.id) as message_count
    FROM chat_conversations cc
    LEFT JOIN chat_messages cm ON cm.conversation_id = cc.id
    WHERE cc.workspace_id = workspace_uuid
    GROUP BY cc.id, cc.title, cc.updated_at
    ORDER BY cc.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get conversation history
CREATE OR REPLACE FUNCTION get_conversation_history(conversation_uuid UUID)
RETURNS TABLE (
    id UUID,
    role TEXT,
    content TEXT,
    citations JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cm.id,
        cm.role,
        cm.content,
        cm.citations,
        cm.created_at
    FROM chat_messages cm
    WHERE cm.conversation_id = conversation_uuid
    ORDER BY cm.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
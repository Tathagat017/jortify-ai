-- ===============================================
-- PART 3: ENABLE RLS AND ADD POLICIES
-- ===============================================

-- Enable RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_conversations
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

-- RLS Policies for chat_messages
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
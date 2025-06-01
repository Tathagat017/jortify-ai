import { faComments, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { useStore } from "../../../hooks/use-store";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";
import SuggestedPrompts from "./SuggestedPrompts";

const ChatbotModal = observer(() => {
  const { chatStore, workspaceStore } = useStore();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load conversations when modal opens
  useEffect(() => {
    if (chatStore.isOpen && workspaceStore.selectedWorkspace?.id) {
      chatStore.loadWorkspaceConversations(workspaceStore.selectedWorkspace.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatStore.isOpen, workspaceStore.selectedWorkspace?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [chatStore.messages.length]);

  const handleNewConversation = async () => {
    if (workspaceStore.selectedWorkspace?.id) {
      await chatStore.createNewConversation(
        workspaceStore.selectedWorkspace.id
      );
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    await chatStore.deleteConversation(conversationId);
  };

  const handleSelectConversation = async (conversationId: string) => {
    await chatStore.selectConversation(conversationId);
  };

  const handleSendMessage = async (message: string) => {
    if (workspaceStore.selectedWorkspace?.id) {
      await chatStore.sendMessage(workspaceStore.selectedWorkspace.id, message);
    }
  };

  const handleSuggestedPrompt = async (prompt: string) => {
    if (workspaceStore.selectedWorkspace?.id) {
      await chatStore.sendSuggestedPrompt(
        workspaceStore.selectedWorkspace.id,
        prompt
      );
    }
  };

  return (
    <Modal
      opened={chatStore.isOpen}
      onClose={chatStore.closeChat}
      title={
        <Group spacing="sm">
          <FontAwesomeIcon icon={faComments} style={{ color: "#000" }} />
          <Text weight={600} color="#000">
            AI Assistant
          </Text>
          {workspaceStore.selectedWorkspace && (
            <Badge variant="outline" size="sm" color="dark">
              {workspaceStore.selectedWorkspace.name}
            </Badge>
          )}
        </Group>
      }
      size="xl"
      centered
      styles={{
        inner: {
          overflow: "hidden",
        },
        content: {
          height: "85vh",
          maxHeight: "85vh",
          backgroundColor: "#fff",
          border: "2px solid #000",
          overflow: "hidden",
        },
        body: {
          height: "calc(80vh - 60px)", // Subtract header height
          padding: 0,
          overflow: "hidden",
        },
        header: {
          backgroundColor: "#fff",
          borderBottom: "1px solid #000",
        },
      }}
    >
      <Box style={{ display: "flex", height: "100%" }}>
        {/* Conversation Sidebar */}
        <Box
          style={{
            width: "250px",
            borderRight: "2px solid #000",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            backgroundColor: "#f8f9fa",
          }}
        >
          {/* New Conversation Button */}
          <Box p="sm" style={{ flexShrink: 0 }}>
            <Button
              variant="outline"
              color="dark"
              size="xs"
              leftIcon={<FontAwesomeIcon icon={faPlus} />}
              onClick={handleNewConversation}
              disabled={chatStore.isLoading}
              fullWidth
              styles={{
                root: {
                  borderColor: "#000",
                  color: "#000",
                  "&:hover": {
                    backgroundColor: "#000",
                    color: "#fff",
                  },
                },
              }}
            >
              New Chat
            </Button>
          </Box>

          <Divider style={{ flexShrink: 0, borderColor: "#000" }} />

          {/* Conversations List */}
          <ScrollArea style={{ flex: 1, minHeight: 0 }} p="xs">
            {chatStore.isLoading ? (
              <Box style={{ textAlign: "center", padding: "20px" }}>
                <Loader size="sm" color="dark" />
              </Box>
            ) : chatStore.safeConversations.length === 0 ? (
              <Text
                size="xs"
                color="dimmed"
                style={{ textAlign: "center", padding: "20px", color: "#666" }}
              >
                No conversations yet
              </Text>
            ) : (
              <Stack spacing="xs">
                {chatStore.safeConversations.map((conversation) => (
                  <Paper
                    key={conversation.id}
                    p="xs"
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        chatStore.currentConversation?.id === conversation.id
                          ? "#000"
                          : "#fff",
                      border: "1px solid #000",
                      color:
                        chatStore.currentConversation?.id === conversation.id
                          ? "#fff"
                          : "#000",
                    }}
                    onClick={() => handleSelectConversation(conversation.id)}
                  >
                    <Group position="apart" spacing="xs">
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Text size="xs" weight={500} truncate>
                          {conversation.title}
                        </Text>
                        <Text
                          size="xs"
                          truncate
                          style={{
                            color:
                              chatStore.currentConversation?.id ===
                              conversation.id
                                ? "#ccc"
                                : "#666",
                          }}
                        >
                          {chatStore.getConversationPreview(conversation)}
                        </Text>
                      </Box>
                      <ActionIcon
                        size="xs"
                        color="dark"
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteConversation(conversation.id);
                        }}
                        style={{
                          color:
                            chatStore.currentConversation?.id ===
                            conversation.id
                              ? "#fff"
                              : "#666",
                        }}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
          </ScrollArea>
        </Box>

        {/* Chat Area */}
        <Box
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            backgroundColor: "#fff",
          }}
        >
          {/* Error Display */}
          {chatStore.error && (
            <Box style={{ flexShrink: 0 }}>
              <Alert
                color="dark"
                onClose={chatStore.clearError}
                withCloseButton
                styles={{
                  root: {
                    backgroundColor: "#f8f9fa",
                    border: "1px solid #000",
                    color: "#000",
                  },
                }}
              >
                {chatStore.error}
              </Alert>
            </Box>
          )}

          {/* Messages Area */}
          <ScrollArea
            style={{ flex: 1, minHeight: 0 }}
            p="md"
            viewportRef={scrollAreaRef}
          >
            {chatStore.isNewConversation ? (
              <SuggestedPrompts
                prompts={chatStore.suggestedPrompts}
                onPromptClick={handleSuggestedPrompt}
                isLoading={chatStore.isLoading}
              />
            ) : (
              <MessageList
                messages={chatStore.messages}
                isTyping={chatStore.isTyping}
              />
            )}
          </ScrollArea>

          {/* Message Input */}
          <Box
            p="md"
            style={{
              borderTop: "2px solid #000",
              flexShrink: 0,
              backgroundColor: "#f8f9fa",
            }}
          >
            <MessageInput
              value={chatStore.currentMessage}
              onChange={chatStore.setCurrentMessage}
              onSend={handleSendMessage}
              disabled={chatStore.isLoading || chatStore.isTyping}
              isLoading={chatStore.isTyping}
              placeholder={
                chatStore.isNewConversation
                  ? "Ask me anything about your workspace..."
                  : "Continue the conversation..."
              }
            />
          </Box>
        </Box>
      </Box>
    </Modal>
  );
});

export default ChatbotModal;

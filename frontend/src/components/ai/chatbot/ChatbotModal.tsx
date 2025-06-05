import {
  faRobot,
  faPlus,
  faQuestionCircle,
  faGlobe,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
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
  Switch,
  Tooltip,
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { useStore } from "../../../hooks/use-store";
import MessageInput from "./MessageInput";
import MessageList from "./MessageList";
import SuggestedPrompts from "./SuggestedPrompts";
import { DeleteConfirmation } from "../../shared/DeleteConfirmation";

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
          <FontAwesomeIcon icon={faRobot} style={{ color: "#4A90E2" }} />
          <Text weight={600} color="#000">
            AI Assistant
          </Text>
          {chatStore.helpMode && (
            <Badge variant="filled" size="sm" color="blue">
              Help Mode
            </Badge>
          )}
          {!chatStore.helpMode && workspaceStore.selectedWorkspace && (
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
          borderBottom: "1px solid #e0e0e0",
        },
      }}
    >
      <Box style={{ display: "flex", height: "100%" }}>
        {/* Conversation Sidebar */}
        <Box
          style={{
            width: "250px",
            borderRight: "1px solid #e0e0e0",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            backgroundColor: "#f8f9fa",
            overflow: "hidden",
          }}
        >
          {/* New Conversation Button */}
          <Box p="sm" style={{ flexShrink: 0 }}>
            <Button
              variant="outline"
              color="dark"
              size="xs"
              leftIcon={
                <FontAwesomeIcon icon={faPlus} style={{ color: "#28A745" }} />
              }
              onClick={handleNewConversation}
              disabled={chatStore.isLoading}
              fullWidth
              styles={{
                root: {
                  borderColor: "#e0e0e0",
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

          <Divider style={{ flexShrink: 0, borderColor: "#e0e0e0" }} />

          {/* Mode Toggles */}
          <Box p="sm" style={{ flexShrink: 0 }}>
            <Stack spacing="xs">
              <Tooltip label="Toggle between workspace content and application help">
                <Group position="apart">
                  <Group spacing="xs">
                    <FontAwesomeIcon
                      icon={faQuestionCircle}
                      style={{ color: "#4A90E2" }}
                    />
                    <Text size="xs" weight={500}>
                      Help Mode
                    </Text>
                  </Group>
                  <Switch
                    size="xs"
                    checked={chatStore.helpMode}
                    onChange={() => chatStore.toggleHelpMode()}
                    styles={{
                      track: {
                        backgroundColor: chatStore.helpMode
                          ? "#4A90E2"
                          : "#e0e0e0",
                      },
                    }}
                  />
                </Group>
              </Tooltip>

              {!chatStore.helpMode && (
                <Tooltip label="Enable web search for additional information">
                  <Group position="apart">
                    <Group spacing="xs">
                      <FontAwesomeIcon
                        icon={faGlobe}
                        style={{ color: "#28A745" }}
                      />
                      <Text size="xs" weight={500}>
                        Web Search
                      </Text>
                    </Group>
                    <Switch
                      size="xs"
                      checked={chatStore.webSearchEnabled}
                      onChange={() => chatStore.toggleWebSearch()}
                      disabled
                      styles={{
                        track: {
                          backgroundColor: chatStore.webSearchEnabled
                            ? "#28A745"
                            : "#e0e0e0",
                        },
                      }}
                    />
                  </Group>
                </Tooltip>
              )}
            </Stack>
          </Box>

          <Divider style={{ flexShrink: 0, borderColor: "#e0e0e0" }} />

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
                      border: "1px solid #e0e0e0",
                      color:
                        chatStore.currentConversation?.id === conversation.id
                          ? "#fff"
                          : "#000",
                      overflow: "hidden",
                    }}
                    onClick={() => handleSelectConversation(conversation.id)}
                  >
                    <Group
                      position="apart"
                      spacing="xs"
                      style={{ overflow: "hidden" }}
                    >
                      <Box
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          maxWidth: 150,
                        }}
                      >
                        <Group spacing={4}>
                          <Text
                            size="xs"
                            weight={500}
                            truncate
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {conversation.title}
                          </Text>
                          {conversation.helpMode && (
                            <Badge size="xs" variant="dot" color="blue">
                              Help
                            </Badge>
                          )}
                        </Group>
                        <Text
                          size="xs"
                          truncate
                          style={{
                            color:
                              chatStore.currentConversation?.id ===
                              conversation.id
                                ? "#ccc"
                                : "#666",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {chatStore.getConversationPreview(conversation)}
                        </Text>
                      </Box>
                      <DeleteConfirmation
                        onConfirm={() =>
                          chatStore.deleteConversation(conversation.id)
                        }
                        itemName="conversation"
                        iconColor={
                          chatStore.currentConversation?.id === conversation.id
                            ? "#fff"
                            : "#DC3545"
                        }
                      />
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
                    border: "1px solid #e0e0e0",
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
            {/* Loading overlay for chat initialization */}
            {(chatStore.isLoading || chatStore.isTyping) &&
            (chatStore.isNewConversation || chatStore.messages.length === 0) ? (
              <Box
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  minHeight: "200px",
                  color: "#666",
                }}
              >
                <Loader size="md" color="dark" />
                <Text size="sm" color="dimmed" mt="md">
                  {chatStore.isLoading
                    ? "Initializing chat..."
                    : "Processing your message..."}
                </Text>
              </Box>
            ) : chatStore.isNewConversation ? (
              <SuggestedPrompts
                prompts={chatStore.currentPrompts}
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
              borderTop: "1px solid #e0e0e0",
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
                chatStore.helpMode
                  ? "Ask me how to use this application..."
                  : chatStore.isNewConversation
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

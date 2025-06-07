import { makeAutoObservable, runInAction } from "mobx";
import { QueryClient } from "@tanstack/react-query";
import { aiService, ChatMessage, Conversation } from "../services/ai.service";

export class ChatStore {
  queryClient: QueryClient;

  // State
  isOpen = false;
  isLoading = false;
  isTyping = false;
  currentConversation: Conversation | null = null;
  conversations: Conversation[] = [];
  messages: ChatMessage[] = [];
  currentMessage = "";
  error: string | null = null;

  // Help mode and web search settings
  helpMode = false;
  webSearchEnabled = false;

  // Suggested prompts for new conversations
  suggestedPrompts = [
    "What are the main themes in my workspace?",
    "Help me find pages related to a specific topic",
  ];

  // Help mode prompts
  helpPrompts = [
    "How do I create a new page?",
    "How do I link pages together?",
    "How do I use AI features?",
    "How do I organize my workspace?",
  ];

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }

  // =================== UI ACTIONS ===================

  openChat = () => {
    runInAction(() => {
      this.isOpen = true;
      this.error = null;
    });
  };

  closeChat = () => {
    runInAction(() => {
      this.isOpen = false;
      this.error = null;
      // Don't clear conversation state when closing - keep it for when reopened
    });
  };

  setCurrentMessage = (message: string) => {
    this.currentMessage = message;
  };

  clearError = () => {
    this.error = null;
  };

  toggleHelpMode = () => {
    runInAction(() => {
      this.helpMode = !this.helpMode;
      // Clear current conversation when switching modes
      this.currentConversation = null;
      this.messages = [];
    });
  };

  toggleWebSearch = () => {
    runInAction(() => {
      this.webSearchEnabled = !this.webSearchEnabled;
      console.log(
        `🌐 Web search toggled: ${this.webSearchEnabled ? "ON" : "OFF"}`
      );
    });
  };

  // =================== CONVERSATION MANAGEMENT ===================

  loadWorkspaceConversations = async (workspaceId: string) => {
    if (!workspaceId) return;

    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = null;
      });

      const conversations = await aiService.getWorkspaceConversations(
        workspaceId
      );

      runInAction(() => {
        this.conversations = Array.isArray(conversations) ? conversations : [];

        // If we have a current conversation, make sure it's still valid
        if (this.currentConversation) {
          const stillExists = this.conversations.find(
            (c) => c.id === this.currentConversation?.id
          );
          if (!stillExists) {
            // Current conversation no longer exists, clear it
            this.currentConversation = null;
            this.messages = [];
          }
        }

        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to load conversations";

        // Handle authentication errors specifically
        if (
          errorMessage.includes("authentication token") ||
          errorMessage.includes("401")
        ) {
          this.error =
            "Authentication expired. Please sign in again to use AI features.";
        } else {
          this.error = errorMessage;
        }

        // Ensure conversations is always an array even on error
        this.conversations = [];
        this.isLoading = false;
      });
    }
  };

  createNewConversation = async (workspaceId: string, title?: string) => {
    if (!workspaceId) return null;

    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = null;
        // Clear current conversation and messages for new chat
        this.currentConversation = null;
        this.messages = [];
      });

      const conversation = await aiService.createConversation(
        workspaceId,
        title,
        this.helpMode
      );

      runInAction(() => {
        this.conversations.unshift(conversation);
        this.currentConversation = conversation;
        this.messages = [];
        this.isLoading = false;
      });

      return conversation;
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : "Failed to create conversation";
        this.isLoading = false;
        // Ensure we're in a clean state on error
        this.currentConversation = null;
        this.messages = [];
      });
      return null;
    }
  };

  selectConversation = async (conversationId: string) => {
    if (!conversationId) {
      console.error("Cannot select conversation: conversationId is undefined");
      return;
    }

    try {
      runInAction(() => {
        this.isLoading = true;
        this.error = null;
      });

      const { conversation, messages } = await aiService.getConversationHistory(
        conversationId
      );

      runInAction(() => {
        this.currentConversation = conversation;
        this.messages = messages;
        // Update help mode based on conversation
        if (conversation.helpMode !== undefined) {
          this.helpMode = conversation.helpMode;
        }
        // Update web search setting if available
        if (conversation.metadata?.webSearchEnabled !== undefined) {
          this.webSearchEnabled = conversation.metadata.webSearchEnabled;
        }
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : "Failed to load conversation";
        this.isLoading = false;
      });
    }
  };

  deleteConversation = async (conversationId: string) => {
    try {
      await aiService.deleteConversation(conversationId);

      runInAction(() => {
        this.conversations = this.conversations.filter(
          (c) => c.id !== conversationId
        );

        // If we deleted the current conversation, clear it
        if (this.currentConversation?.id === conversationId) {
          this.currentConversation = null;
          this.messages = [];
        }
      });
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : "Failed to delete conversation";
      });
    }
  };

  updateConversationTitle = async (conversationId: string, title: string) => {
    try {
      await aiService.updateConversationTitle(conversationId, title);

      runInAction(() => {
        // Update in conversations list
        const conversationIndex = this.conversations.findIndex(
          (c) => c.id === conversationId
        );
        if (conversationIndex !== -1) {
          this.conversations[conversationIndex].title = title;
        }

        // Update current conversation if it's the same
        if (this.currentConversation?.id === conversationId) {
          this.currentConversation.title = title;
        }
      });
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : "Failed to update conversation title";
      });
    }
  };

  // =================== MESSAGE HANDLING ===================

  sendMessage = async (workspaceId: string, message?: string) => {
    const messageToSend = message || this.currentMessage.trim();
    if (!messageToSend || !workspaceId) return;

    // Prevent sending if already typing or loading
    if (this.isTyping || this.isLoading) return;

    // Create user message outside try block so it's accessible in catch
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      content: messageToSend,
      role: "user",
      timestamp: new Date().toISOString(),
    };

    try {
      runInAction(() => {
        this.isTyping = true;
        this.error = null;
      });

      // Add user message immediately to UI
      runInAction(() => {
        this.messages.push(userMessage);
        this.currentMessage = "";
      });

      // Send to AI service with help mode and web search settings
      const response = await aiService.sendChatMessage(
        messageToSend,
        workspaceId,
        this.currentConversation?.id,
        this.helpMode,
        this.webSearchEnabled
      );

      // Create AI response message
      const aiMessage: ChatMessage = {
        id: response.messageId,
        content: response.answer,
        role: "assistant",
        timestamp: new Date().toISOString(),
        citations: response.citations,
      };

      runInAction(() => {
        // Update user message with real ID if needed
        const userMsgIndex = this.messages.findIndex(
          (m) => m.id === userMessage.id
        );
        if (userMsgIndex !== -1) {
          this.messages[userMsgIndex].id = `user-${response.messageId}`;
        }

        // Add AI response
        this.messages.push(aiMessage);

        // Update current conversation ID if this was a new conversation or auto-created
        if (
          response.conversationId &&
          (!this.currentConversation ||
            this.currentConversation.id !== response.conversationId)
        ) {
          const newConversation = {
            id: response.conversationId,
            title:
              messageToSend.slice(0, 50) +
              (messageToSend.length > 50 ? "..." : ""),
            workspaceId,
            userId: "", // Will be set by backend
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            helpMode: this.helpMode,
            metadata: {
              webSearchEnabled: this.webSearchEnabled,
            },
          };

          // Update current conversation
          this.currentConversation = newConversation;

          // Add to conversations list if not already there
          const existingIndex = this.conversations.findIndex(
            (c) => c.id === response.conversationId
          );
          if (existingIndex === -1) {
            this.conversations.unshift(newConversation);
          } else {
            // Update existing conversation
            this.conversations[existingIndex] = newConversation;
          }
        }

        this.isTyping = false;
      });
    } catch (error) {
      runInAction(() => {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";

        // Handle authentication errors specifically
        if (
          errorMessage.includes("authentication token") ||
          errorMessage.includes("401")
        ) {
          this.error =
            "Authentication expired. Please sign in again to use AI features.";
        } else {
          this.error = errorMessage;
        }

        this.isTyping = false;

        // Remove the user message if sending failed
        this.messages = this.messages.filter((m) => m.id !== userMessage.id);
      });
    }
  };

  sendSuggestedPrompt = async (workspaceId: string, prompt: string) => {
    // Don't create a new conversation, just send the message
    // The sendMessage method will handle conversation creation if needed
    await this.sendMessage(workspaceId, prompt);
  };

  // =================== UTILITY METHODS ===================

  getConversationPreview = (conversation: Conversation): string => {
    if (conversation.messages && conversation.messages.length > 0) {
      const lastMessage =
        conversation.messages[conversation.messages.length - 1];
      return (
        lastMessage.content.slice(0, 100) +
        (lastMessage.content.length > 100 ? "..." : "")
      );
    }
    return "No messages yet";
  };

  hasActiveConversation = (): boolean => {
    return this.currentConversation !== null;
  };

  getMessageCount = (): number => {
    return this.messages.length;
  };

  // =================== COMPUTED PROPERTIES ===================

  get canSendMessage(): boolean {
    return (
      this.currentMessage.trim().length > 0 && !this.isTyping && !this.isLoading
    );
  }

  get hasConversations(): boolean {
    return this.conversations.length > 0;
  }

  get isNewConversation(): boolean {
    return this.currentConversation === null || this.messages.length === 0;
  }

  get currentPrompts(): string[] {
    return this.helpMode ? this.helpPrompts : this.suggestedPrompts;
  }

  // =================== GETTERS ===================

  get safeConversations(): Conversation[] {
    return Array.isArray(this.conversations) ? this.conversations : [];
  }
}

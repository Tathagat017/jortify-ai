import React from "react";
import { Box, Text, Paper, Group, Badge, Anchor, Loader } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faRobot,
  faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons";
import { ChatMessage } from "../../../services/ai.service";

interface MessageListProps {
  messages: ChatMessage[];
  isTyping: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isTyping }) => {
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Box>
      {messages.map((message) => (
        <Box
          key={message.id}
          mb="md"
          p="sm"
          style={{
            borderRadius: "8px",
          }}
        >
          <Group spacing="sm" align="flex-start">
            {/* Avatar */}
            <Box
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor:
                  message.role === "user" ? "#4A90E2" : "#28A745",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: `2px solid ${
                  message.role === "user" ? "#357ABD" : "#1E7E34"
                }`,
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <FontAwesomeIcon
                icon={message.role === "user" ? faUser : faRobot}
                size="sm"
                style={{ color: "white" }}
              />
            </Box>

            {/* Message Content */}
            <Box style={{ flex: 1 }}>
              <Group spacing="xs" mb="xs">
                <Text size="sm" weight={500} style={{ color: "#000" }}>
                  {message.role === "user" ? "You" : "AI Assistant"}
                </Text>
                <Text size="xs" style={{ color: "#666" }}>
                  {formatTimestamp(message.timestamp)}
                </Text>
              </Group>

              <Paper
                p="sm"
                style={{
                  backgroundColor:
                    message.role === "user" ? "#f0f8ff" : "#f8fff8",
                  border: `1px solid ${
                    message.role === "user" ? "#e6f3ff" : "#e8ffe8"
                  }`,
                  color: "#000",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <Text
                  size="sm"
                  style={{ whiteSpace: "pre-wrap", color: "#000" }}
                >
                  {message.content}
                </Text>

                {/* Citations */}
                {message.citations && message.citations.length > 0 && (
                  <Box mt="sm">
                    <Text size="xs" mb="xs" style={{ color: "#666" }}>
                      Sources:
                    </Text>
                    {message.citations.map((citation, index) => (
                      <Paper
                        key={index}
                        p="xs"
                        mb="xs"
                        style={{
                          backgroundColor: "#f8f9fa",
                          border: "1px solid #ddd",
                        }}
                      >
                        <Group spacing="xs" align="flex-start">
                          <FontAwesomeIcon
                            icon={faExternalLinkAlt}
                            size="xs"
                            style={{ color: "#666", marginTop: "2px" }}
                          />
                          <Box style={{ flex: 1 }}>
                            <Anchor
                              size="xs"
                              weight={500}
                              href={`#/page/${citation.pageId}`}
                              style={{
                                textDecoration: "none",
                                color: "#000",
                              }}
                            >
                              {citation.pageTitle}
                            </Anchor>
                            <Text size="xs" mt="2px" style={{ color: "#666" }}>
                              {citation.snippet}
                            </Text>
                          </Box>
                        </Group>
                      </Paper>
                    ))}
                  </Box>
                )}
              </Paper>
            </Box>
          </Group>
        </Box>
      ))}

      {/* Typing Indicator */}
      {isTyping && (
        <Box
          mb="md"
          p="sm"
          style={{
            borderRadius: "8px",
          }}
        >
          <Group spacing="sm" align="flex-start">
            <Box
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: "#28A745",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "2px solid #1E7E34",
                boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              <FontAwesomeIcon
                icon={faRobot}
                size="sm"
                style={{ color: "white" }}
              />
            </Box>

            <Box style={{ flex: 1 }}>
              <Group spacing="xs" mb="xs">
                <Text size="sm" weight={500} style={{ color: "#000" }}>
                  AI Assistant
                </Text>
                <Badge size="xs" color="dark" variant="outline">
                  typing...
                </Badge>
              </Group>

              <Paper
                p="sm"
                style={{
                  backgroundColor: "#f8fff8",
                  border: "1px solid #e8ffe8",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <Group spacing="xs">
                  <Loader size="xs" color="dark" />
                  <Text size="sm" style={{ color: "#666" }}>
                    Thinking...
                  </Text>
                </Group>
              </Paper>
            </Box>
          </Group>
        </Box>
      )}
    </Box>
  );
};

export default MessageList;

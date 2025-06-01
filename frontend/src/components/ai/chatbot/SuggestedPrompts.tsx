import React from "react";
import { Box, Text, Button, Stack, Center, Loader } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLightbulb, faRocket } from "@fortawesome/free-solid-svg-icons";

interface SuggestedPromptsProps {
  prompts: string[];
  onPromptClick: (prompt: string) => void;
  isLoading: boolean;
}

const SuggestedPrompts: React.FC<SuggestedPromptsProps> = ({
  prompts,
  onPromptClick,
  isLoading,
}) => {
  return (
    <Box style={{ textAlign: "center", padding: "40px 20px" }}>
      {/* Welcome Icon */}
      <Center mb="xl">
        <Box
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            backgroundColor: "#000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #000",
          }}
        >
          <FontAwesomeIcon
            icon={faRocket}
            size="2x"
            style={{ color: "#fff" }}
          />
        </Box>
      </Center>

      {/* Welcome Text */}
      <Text size="xl" weight={700} mb="sm" style={{ color: "#000" }}>
        Welcome to AI Assistant
      </Text>
      <Text
        size="md"
        color="dimmed"
        mb="xl"
        style={{ color: "#666", maxWidth: "400px", margin: "0 auto 2rem" }}
      >
        I can help you explore your workspace, answer questions about your
        content, and provide insights. Try one of these suggestions to get
        started:
      </Text>

      {/* Suggested Prompts */}
      <Stack spacing="md" style={{ maxWidth: "500px", margin: "0 auto" }}>
        {prompts.map((prompt, index) => (
          <Button
            key={index}
            variant="outline"
            color="dark"
            size="md"
            leftIcon={<FontAwesomeIcon icon={faLightbulb} />}
            onClick={() => onPromptClick(prompt)}
            disabled={isLoading}
            style={{
              textAlign: "left",
              height: "auto",
              padding: "16px",
              borderColor: "#ddd",
              color: "#000",
              backgroundColor: "#fff",
              border: "1px solid #ddd",
            }}
            styles={{
              root: {
                "&:hover": {
                  backgroundColor: "#f8f9fa",
                  borderColor: "#ddd",
                },
                "&:disabled": {
                  backgroundColor: "#f8f9fa",
                  borderColor: "#ccc",
                  color: "#999",
                },
              },
              inner: {
                justifyContent: "flex-start",
              },
              label: {
                whiteSpace: "normal",
                textAlign: "left",
                lineHeight: 1.4,
              },
            }}
          >
            {prompt}
          </Button>
        ))}
      </Stack>

      {/* Loading State */}
      {isLoading && (
        <Center mt="xl">
          <Loader size="sm" color="dark" />
          <Text size="sm" ml="sm" style={{ color: "#666" }}>
            Starting conversation...
          </Text>
        </Center>
      )}
    </Box>
  );
};

export default SuggestedPrompts;

import React, { useState } from "react";
import { Modal, Stack, Button, Text, Loader, Alert } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLightbulb,
  faPencil,
  faChartLine,
  faFileText,
  faTimes,
  faCheck,
} from "@fortawesome/free-solid-svg-icons";
import { aiService } from "../../../services/ai.service";
import { useStore } from "../../../hooks/use-store";

interface AIMenuPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuggestionAccept: (suggestion: string) => void;
}

type AIOperationType = "complete" | "suggestions" | "analyze" | "summarize";

interface AIOperation {
  type: AIOperationType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface BlockContent {
  type?: string;
  text?: string;
}

interface Block {
  type: string;
  content?: BlockContent[] | string;
}

const AI_OPERATIONS: AIOperation[] = [
  {
    type: "complete",
    title: "Complete Text",
    description: "AI will complete your current text",
    icon: <FontAwesomeIcon icon={faPencil} size="sm" />,
    color: "gray",
  },
  {
    type: "suggestions",
    title: "Improvement Suggestions",
    description: "Get AI suggestions for improving content",
    icon: <FontAwesomeIcon icon={faLightbulb} size="sm" />,
    color: "gray",
  },
  {
    type: "analyze",
    title: "Writing Analysis",
    description: "Analyze writing quality and get feedback",
    icon: <FontAwesomeIcon icon={faChartLine} size="sm" />,
    color: "gray",
  },
  {
    type: "summarize",
    title: "Summarize Content",
    description: "Generate a summary of your content",
    icon: <FontAwesomeIcon icon={faFileText} size="sm" />,
    color: "gray",
  },
];

const AIMenuPopup: React.FC<AIMenuPopupProps> = ({
  isOpen,
  onClose,
  onSuggestionAccept,
}) => {
  const { pageStore, workspaceStore } = useStore();
  const [loading, setLoading] = useState(false);
  const [currentOperation, setCurrentOperation] =
    useState<AIOperationType | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getCurrentContent = () => {
    if (!pageStore.selectedPage?.content) return "";

    // Extract text content from BlockNote JSON structure
    try {
      const blocks = pageStore.selectedPage.content as Block[];
      return blocks
        .map((block) => {
          if (block.type === "paragraph" && block.content) {
            return Array.isArray(block.content)
              ? block.content
                  .map((item: BlockContent) => item.text || "")
                  .join("")
              : block.content;
          }
          if (block.type === "heading" && block.content) {
            return Array.isArray(block.content)
              ? block.content
                  .map((item: BlockContent) => item.text || "")
                  .join("")
              : block.content;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    } catch (error) {
      console.error("Error extracting content:", error);
      return "";
    }
  };

  const handleOperationClick = async (operation: AIOperationType) => {
    if (!workspaceStore.selectedWorkspace || !pageStore.selectedPage) {
      setError("No workspace or page selected");
      return;
    }

    setLoading(true);
    setCurrentOperation(operation);
    setError(null);
    setResult(null);

    try {
      const content = getCurrentContent();

      // Handle empty content case - use page summary or show helpful message
      if (!content.trim()) {
        if (operation === "summarize") {
          // For summarize, we can still work with the page structure even if no text content
          // Use the raw BlockNote content object for summarize
          // Ensure we always send a valid array structure (BlockNote content is an array of blocks)
          const contentToSend = pageStore.selectedPage.content || [];

          const response = await aiService.summarizeContent(
            pageStore.selectedPage.title || "Untitled",
            contentToSend,
            "medium"
          );
          setResult(response);
          return;
        } else {
          // For other operations, check if we have a page summary to use as content
          if (pageStore.selectedPage.summary) {
            console.log("Using page summary as content for AI operation");
            const summaryContent = `Page Summary: ${pageStore.selectedPage.summary}`;

            let response: string;
            switch (operation) {
              case "complete": {
                response = await aiService.completeText(summaryContent);
                break;
              }
              case "suggestions": {
                const suggestions = await aiService.generateSuggestions(
                  summaryContent,
                  summaryContent,
                  workspaceStore.selectedWorkspace.id,
                  pageStore.selectedPage.id
                );
                response = suggestions.map((s) => s.content).join("\n\n");
                break;
              }
              case "analyze": {
                const analysis = await aiService.analyzeWriting(summaryContent);
                response = `Writing Quality Score: ${
                  analysis.score
                }/100\n\nSuggestions:\n${analysis.suggestions
                  .map(
                    (s) =>
                      `• [${s.type.toUpperCase()}] ${s.message} (${
                        s.severity
                      } priority)`
                  )
                  .join("\n")}`;
                break;
              }
              default:
                throw new Error("Unknown operation");
            }
            setResult(response);
            return;
          } else {
            setError(
              "No content available to process. Please add some content to the page first."
            );
            return;
          }
        }
      }

      let response: string;

      switch (operation) {
        case "complete": {
          response = await aiService.completeText(content);
          break;
        }
        case "suggestions": {
          const suggestions = await aiService.generateSuggestions(
            content,
            content,
            workspaceStore.selectedWorkspace.id,
            pageStore.selectedPage.id
          );
          response = suggestions.map((s) => s.content).join("\n\n");
          break;
        }
        case "analyze": {
          const analysis = await aiService.analyzeWriting(content);
          response = `Writing Quality Score: ${
            analysis.score
          }/100\n\nSuggestions:\n${analysis.suggestions
            .map(
              (s) =>
                `• [${s.type.toUpperCase()}] ${s.message} (${
                  s.severity
                } priority)`
            )
            .join("\n")}`;
          break;
        }
        case "summarize": {
          // For summarize, always use the raw BlockNote content object
          // Ensure we always send a valid array structure (BlockNote content is an array of blocks)
          const contentToSend = pageStore.selectedPage.content || [];

          response = await aiService.summarizeContent(
            pageStore.selectedPage.title || "Untitled",
            contentToSend,
            "medium"
          );
          break;
        }
        default:
          throw new Error("Unknown operation");
      }

      setResult(response);
    } catch (error) {
      console.error("AI operation failed:", error);
      setError(error instanceof Error ? error.message : "AI operation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (result && currentOperation) {
      onSuggestionAccept(result);
      handleClose();
    }
  };

  const handleClose = () => {
    setLoading(false);
    setCurrentOperation(null);
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title="AI Assistant"
      size="sm"
      centered
    >
      <Stack spacing="sm">
        {!loading && !result && !error && (
          <>
            <Text size="sm" color="dimmed">
              Choose an AI operation to help with your content:
            </Text>

            {AI_OPERATIONS.map((operation) => (
              <Button
                key={operation.type}
                variant="light"
                color={operation.color}
                onClick={() => handleOperationClick(operation.type)}
                style={{
                  height: "auto",
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                  }}
                >
                  {operation.icon}
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <Text weight={500} size="sm">
                      {operation.title}
                    </Text>
                    <Text size="xs" color="dimmed">
                      {operation.description}
                    </Text>
                  </div>
                </div>
              </Button>
            ))}
          </>
        )}

        {loading && (
          <div style={{ textAlign: "center", padding: "16px" }}>
            <Loader size="md" />
            <Text mt="sm" size="sm" color="dimmed">
              Processing with AI...
            </Text>
          </div>
        )}

        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {result && (
          <>
            <Alert color="gray" title={`AI ${currentOperation} Result`}>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {result}
              </Text>
            </Alert>

            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              {/* Analysis only needs OK button */}
              {currentOperation === "analyze" ? (
                <Button variant="filled" color="gray" onClick={handleClose}>
                  OK
                </Button>
              ) : currentOperation === "suggestions" ? (
                /* Improvement suggestions only need OK button */
                <Button variant="filled" color="gray" onClick={handleClose}>
                  OK
                </Button>
              ) : (
                /* Complete and Summarize need Accept/Reject */
                <>
                  <Button variant="outline" color="gray" onClick={handleClose}>
                    <FontAwesomeIcon
                      icon={faTimes}
                      style={{ marginRight: "8px" }}
                    />
                    Reject
                  </Button>
                  <Button color="gray" onClick={handleAccept}>
                    <FontAwesomeIcon
                      icon={faCheck}
                      style={{ marginRight: "8px" }}
                    />
                    Accept & Insert
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </Stack>
    </Modal>
  );
};

export default AIMenuPopup;

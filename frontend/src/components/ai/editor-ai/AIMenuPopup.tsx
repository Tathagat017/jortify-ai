import React, { useState } from "react";
import {
  Modal,
  Stack,
  Button,
  Text,
  Loader,
  Alert,
  useMantineTheme,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLightbulb,
  faPencil,
  faChartLine,
  faFileText,
  faTimes,
  faCheck,
  faWandMagicSparkles,
  faMagic,
  faArrowLeft,
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

interface AnalysisSuggestion {
  type: "grammar" | "style" | "clarity" | "tone";
  message: string;
  severity: "low" | "medium" | "high";
  startIndex?: number;
  endIndex?: number;
}

interface AnalysisResult {
  suggestions: AnalysisSuggestion[];
  score: number;
}

const AI_OPERATIONS: AIOperation[] = [
  {
    type: "complete",
    title: "Complete Text",
    description: "AI will complete your current text",
    icon: (
      <FontAwesomeIcon
        icon={faPencil}
        size="sm"
        style={{ color: "#3b82f6", width: "14px", textAlign: "left" }}
      />
    ),
    color: "gray",
  },
  {
    type: "analyze",
    title: "Writing Analysis",
    description: "Analyze writing quality and get feedback",
    icon: (
      <FontAwesomeIcon
        icon={faChartLine}
        size="sm"
        style={{ color: "#10b981", width: "14px", textAlign: "left" }}
      />
    ),
    color: "gray",
  },
  {
    type: "suggestions",
    title: "Improvement Suggestions",
    description: "Get AI suggestions for improving content",
    icon: (
      <FontAwesomeIcon
        icon={faLightbulb}
        size="sm"
        style={{ color: "#f59e0b", width: "14px", textAlign: "left" }}
      />
    ),
    color: "gray",
  },
  {
    type: "summarize",
    title: "Summarize Content",
    description: "Generate a summary of your content",
    icon: (
      <FontAwesomeIcon
        icon={faFileText}
        size="sm"
        style={{ color: "#8b5cf6", width: "14px", textAlign: "left" }}
      />
    ),
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
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const theme = useMantineTheme();
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

  const formatAnalysisResult = (analysis: AnalysisResult) => {
    const score = analysis.score || 0;
    const suggestions = analysis.suggestions || [];

    let formattedResult = `Writing Quality Score: ${score}/100\n\nSuggestions:\n`;

    suggestions.forEach((suggestion: AnalysisSuggestion) => {
      const icon =
        suggestion.type === "tone"
          ? "🔊"
          : suggestion.type === "clarity"
          ? "👁️"
          : suggestion.type === "style"
          ? "✨"
          : suggestion.type === "grammar"
          ? "📝"
          : "💡";

      const priority = suggestion.severity || "medium";
      formattedResult += `${icon} [${suggestion.type.toUpperCase()}] ${
        suggestion.message
      } (${priority} priority)\n`;
    });

    return formattedResult;
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
                response = formatAnalysisResult(analysis);
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
          response = formatAnalysisResult(analysis);
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

  const handleAcceptGenerated = () => {
    if (generatedContent) {
      onSuggestionAccept(generatedContent);
      handleClose();
    }
  };

  const handleGenerateContent = async () => {
    if (
      !workspaceStore.selectedWorkspace ||
      !pageStore.selectedPage ||
      !result
    ) {
      setError("Missing required data for content generation");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const content = getCurrentContent();
      const firstSuggestion = result.split("\n\n")[0]; // Use first suggestion from the result

      const generated = await aiService.generateContentFromSuggestion(
        firstSuggestion,
        content,
        workspaceStore.selectedWorkspace.id,
        pageStore.selectedPage.id
      );

      setGeneratedContent(generated);
    } catch (error) {
      console.error("Content generation failed:", error);
      setError(
        error instanceof Error ? error.message : "Content generation failed"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setLoading(false);
    setCurrentOperation(null);
    setResult(null);
    setError(null);
    setGeneratedContent(null);
    setIsGenerating(false);
    onClose();
  };

  const handleBack = () => {
    setLoading(false);
    setCurrentOperation(null);
    setResult(null);
    setError(null);
    setGeneratedContent(null);
    setIsGenerating(false);
  };

  const getCurrentOperationIcon = () => {
    const operation = AI_OPERATIONS.find((op) => op.type === currentOperation);
    return operation?.icon || null;
  };

  return (
    <Modal
      opened={isOpen}
      onClose={handleClose}
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {result || generatedContent || loading ? (
            <Button
              variant="subtle"
              size="xs"
              onClick={handleBack}
              style={{ padding: "4px", minWidth: "auto" }}
            >
              <FontAwesomeIcon
                icon={faArrowLeft}
                size="sm"
                style={{ color: theme.colors.indigo[5] }}
              />
            </Button>
          ) : (
            <FontAwesomeIcon
              icon={faWandMagicSparkles}
              size="sm"
              style={{ color: theme.colors.indigo[5] }}
            />
          )}
          {result && getCurrentOperationIcon()}
          <Text weight={600} color="dark" size="md">
            {result
              ? `AI ${currentOperation} Result`
              : generatedContent
              ? "Generated Content"
              : "AI Assistant"}
          </Text>
        </div>
      }
      size="sm"
      centered
    >
      <Stack spacing="sm">
        {!loading && !result && !error && (
          <>
            <Text size="sm" color="dark" style={{ marginBottom: "8px" }}>
              Choose an AI operation to help with your content:
            </Text>

            {AI_OPERATIONS.map((operation) => (
              <Button
                key={operation.type}
                variant="light"
                color={operation.color}
                onClick={() => handleOperationClick(operation.type)}
                styles={{
                  inner: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                  },
                }}
                style={{
                  height: "auto",
                  padding: "12px 16px",
                  justifyContent: "flex-start",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: "30px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    {operation.icon}
                  </div>
                  <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                    <Text
                      weight={500}
                      size="sm"
                      color="dark"
                      style={{ lineHeight: 1.3 }}
                    >
                      {operation.title}
                    </Text>
                    <Text
                      size="xs"
                      color="dimmed"
                      style={{ lineHeight: 1.3, marginTop: "2px" }}
                    >
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

        {result && !generatedContent && (
          <>
            <Alert
              color={
                currentOperation === "analyze"
                  ? "blue"
                  : currentOperation === "suggestions"
                  ? "yellow"
                  : currentOperation === "complete"
                  ? "indigo"
                  : currentOperation === "summarize"
                  ? "violet"
                  : "gray"
              }
              title={
                currentOperation === "analyze"
                  ? "Writing Analysis"
                  : currentOperation === "suggestions"
                  ? "AI Suggestions"
                  : currentOperation === "complete"
                  ? "Text Completion"
                  : currentOperation === "summarize"
                  ? "Content Summary"
                  : "AI Result"
              }
            >
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
                <Button
                  variant="filled"
                  color="dark"
                  onClick={handleClose}
                  style={{ backgroundColor: "#495057" }}
                >
                  OK
                </Button>
              ) : currentOperation === "suggestions" ? (
                /* Improvement suggestions show Cancel and Generate Content buttons */
                <>
                  <Button
                    variant="outline"
                    color="dark"
                    onClick={handleClose}
                    style={{ borderColor: "#495057", color: "#495057" }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="filled"
                    color="dark"
                    onClick={handleGenerateContent}
                    loading={isGenerating}
                    style={{ backgroundColor: "#495057" }}
                  >
                    <FontAwesomeIcon
                      icon={faMagic}
                      style={{ marginRight: "8px" }}
                    />
                    Generate Content
                  </Button>
                </>
              ) : (
                /* Complete and Summarize need Accept/Reject */
                <>
                  <Button
                    variant="outline"
                    color="dark"
                    onClick={handleClose}
                    style={{ borderColor: "#495057", color: "#495057" }}
                  >
                    <FontAwesomeIcon
                      icon={faTimes}
                      style={{ marginRight: "8px" }}
                    />
                    Reject
                  </Button>
                  <Button
                    color="dark"
                    onClick={handleAccept}
                    style={{ backgroundColor: "#495057" }}
                  >
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

        {generatedContent && (
          <>
            <Alert color="green" title="Generated Content">
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
                {generatedContent}
              </Text>
            </Alert>

            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="outline"
                color="dark"
                onClick={handleClose}
                style={{ borderColor: "#495057", color: "#495057" }}
              >
                <FontAwesomeIcon
                  icon={faTimes}
                  style={{ marginRight: "8px" }}
                />
                Cancel
              </Button>
              <Button
                color="dark"
                onClick={handleAcceptGenerated}
                style={{ backgroundColor: "#495057" }}
              >
                <FontAwesomeIcon
                  icon={faCheck}
                  style={{ marginRight: "8px" }}
                />
                Accept & Insert
              </Button>
            </div>
          </>
        )}
      </Stack>
    </Modal>
  );
};

export default AIMenuPopup;

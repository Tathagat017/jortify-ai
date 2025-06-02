import React, { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Paper,
  Stack,
  Text,
  Group,
  Badge,
  Loader,
  ActionIcon,
  Box,
  Divider,
  Button,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faLink,
  faTimes,
  faArrowUp,
  faArrowDown,
  faRobot,
  faFile,
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../../../hooks/use-store";
import { LinkSuggestion } from "../../../services/ai.service";
import classes from "./LinkSuggestionPopup.module.css";

interface LinkSuggestionPopupProps {
  onAccept: (
    suggestion:
      | LinkSuggestion
      | {
          id: string;
          title: string;
          icon_url?: string;
          summary?: string | null;
        }
  ) => void;
  onReject: () => void;
}

const LinkSuggestionPopup: React.FC<LinkSuggestionPopupProps> = observer(
  ({ onAccept, onReject }) => {
    const { aiLinkStore } = useStore();
    const popupRef = useRef<HTMLDivElement>(null);
    const [popupPosition, setPopupPosition] = useState<{
      x: number;
      y: number;
      isAbove: boolean;
    }>({ x: 0, y: 0, isAbove: false });

    // Calculate optimal popup position
    useEffect(() => {
      if (!aiLinkStore.isVisible || !aiLinkStore.position) return;

      const calculatePosition = () => {
        const { x, y } = aiLinkStore.position!;
        const popupHeight = 400; // Max height from CSS
        const popupWidth = 380; // Max width from CSS
        const margin = 10; // Safety margin

        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        // Check if popup would go below viewport
        const spaceBelow = viewportHeight - y;
        const spaceAbove = y;

        let finalX = x;
        let finalY = y + 25; // Default: below cursor
        let isAbove = false;

        // Position above if not enough space below
        if (
          spaceBelow < popupHeight + margin &&
          spaceAbove > popupHeight + margin
        ) {
          finalY = y - popupHeight - 10; // Above cursor
          isAbove = true;
          console.log(
            "🔄 Positioning popover above cursor due to insufficient space below"
          );
        }

        // Adjust horizontal position if needed
        if (finalX + popupWidth > viewportWidth - margin) {
          finalX = viewportWidth - popupWidth - margin;
        }
        if (finalX < margin) {
          finalX = margin;
        }

        setPopupPosition({ x: finalX, y: finalY, isAbove });
      };

      calculatePosition();

      // Recalculate on window resize
      const handleResize = () => calculatePosition();
      window.addEventListener("resize", handleResize);

      return () => window.removeEventListener("resize", handleResize);
    }, [aiLinkStore.isVisible, aiLinkStore.position]);

    // Handle keyboard navigation
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!aiLinkStore.isVisible) return;

        switch (event.key) {
          case "ArrowDown":
            event.preventDefault();
            aiLinkStore.navigateSuggestions("down");
            break;
          case "ArrowUp":
            event.preventDefault();
            aiLinkStore.navigateSuggestions("up");
            break;
          case "Enter":
            event.preventDefault();
            if (aiLinkStore.selectedItem) {
              onAccept(aiLinkStore.selectedItem);
            }
            break;
          case "Escape":
            event.preventDefault();
            onReject();
            break;
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }, [aiLinkStore.isVisible, aiLinkStore.selectedItem, onAccept, onReject]);

    // Handle click outside to close
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          popupRef.current &&
          !popupRef.current.contains(event.target as Node)
        ) {
          onReject();
        }
      };

      if (aiLinkStore.isVisible) {
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
          document.removeEventListener("mousedown", handleClickOutside);
      }
    }, [aiLinkStore.isVisible, onReject]);

    if (!aiLinkStore.isVisible) {
      return null;
    }

    const getConfidenceColor = (confidence: number): string => {
      if (confidence >= 0.8) return "green";
      if (confidence >= 0.6) return "yellow";
      return "orange";
    };

    const getConfidenceLabel = (confidence: number): string => {
      if (confidence >= 0.8) return "High";
      if (confidence >= 0.6) return "Medium";
      return "Low";
    };

    const renderSuggestionItem = (
      item:
        | LinkSuggestion
        | {
            id: string;
            title: string;
            icon_url?: string;
            summary?: string | null;
          },
      index: number,
      isAISuggestion: boolean
    ) => {
      const isSelected = index === aiLinkStore.selectedIndex;
      const isLinkSuggestion = "pageId" in item;

      // DEBUG: Log summary information
      console.log(`🎨 Rendering suggestion item:`, {
        title: isLinkSuggestion ? item.pageTitle : item.title,
        isAISuggestion,
        isLinkSuggestion,
        hasSummary: !!item.summary,
        summary: item.summary,
        summaryLength: item.summary?.length || 0,
      });

      return (
        <Box
          key={isLinkSuggestion ? item.pageId : item.id}
          className={`${classes.suggestionItem} ${
            isSelected ? classes.selected : ""
          }`}
          onClick={() => onAccept(item)}
        >
          <Group position="apart" align="flex-start" spacing="xs">
            <Group spacing="xs" align="center" style={{ flex: 1 }}>
              <FontAwesomeIcon
                icon={isAISuggestion ? faRobot : faFile}
                size="sm"
                className={classes.itemIcon}
              />
              <Stack spacing={2} style={{ flex: 1 }}>
                <Text size="sm" weight={500} className={classes.itemTitle}>
                  {isLinkSuggestion ? item.pageTitle : item.title}
                </Text>

                {/* Show text for AI suggestions */}
                {isLinkSuggestion && item.text && (
                  <Text size="xs" className={classes.itemSnippet}>
                    "{item.text}"
                  </Text>
                )}

                {/* Show summary for both AI suggestions and pages */}
                {isLinkSuggestion && item.summary && (
                  <Text size="xs" className={classes.itemSummary}>
                    {item.summary}
                  </Text>
                )}

                {/* Show summary for regular pages */}
                {!isLinkSuggestion && item.summary && (
                  <Text size="xs" className={classes.itemSummary}>
                    {item.summary}
                  </Text>
                )}
              </Stack>
            </Group>

            {isAISuggestion && isLinkSuggestion && (
              <Badge
                size="xs"
                color={getConfidenceColor(item.confidence)}
                variant="light"
                className={classes.confidenceBadge}
              >
                {getConfidenceLabel(item.confidence)}
              </Badge>
            )}

            {isSelected && (
              <Button
                size="xs"
                className={classes.acceptButton}
                onClick={(e) => {
                  e.stopPropagation();
                  onAccept(item);
                }}
              >
                Accept
              </Button>
            )}
          </Group>
        </Box>
      );
    };

    return (
      <Paper
        ref={popupRef}
        className={classes.popup}
        style={{
          position: "fixed",
          left: popupPosition.x,
          top: popupPosition.y,
          zIndex: 1000,
        }}
        shadow="lg"
        p="sm"
        withBorder
      >
        <Stack spacing="xs">
          {/* Header */}
          <Group position="apart" align="center">
            <Group spacing="xs">
              <FontAwesomeIcon
                icon={faLink}
                size="sm"
                className={classes.headerIcon}
              />
              <Text size="sm" weight={500} className={classes.headerText}>
                {aiLinkStore.triggerType === "manual"
                  ? "Link to Page"
                  : "Link Suggestions"}
              </Text>
            </Group>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={onReject}
              aria-label="Close suggestions"
              className={classes.closeButton}
            >
              <FontAwesomeIcon icon={faTimes} size="xs" />
            </ActionIcon>
          </Group>

          {/* Loading State */}
          {aiLinkStore.isLoading && (
            <Group spacing="xs" position="center" py="md">
              <Loader size="sm" color="dark" />
              <Text size="sm" className={classes.loadingText}>
                {aiLinkStore.triggerType === "manual"
                  ? "Loading pages..."
                  : "Finding relevant pages..."}
              </Text>
            </Group>
          )}

          {/* Error State */}
          {aiLinkStore.error && (
            <Text size="sm" className={classes.errorText}>
              {aiLinkStore.error}
            </Text>
          )}

          {/* Content */}
          {!aiLinkStore.isLoading && (
            <Stack spacing="xs">
              {/* AI Suggestions Section */}
              {aiLinkStore.hasSuggestions && (
                <>
                  <Group spacing="xs" align="center">
                    <FontAwesomeIcon
                      icon={faRobot}
                      size="xs"
                      className={classes.sectionIcon}
                    />
                    <Text
                      size="xs"
                      weight={500}
                      className={classes.sectionTitle}
                    >
                      AI Suggestions
                    </Text>
                  </Group>

                  <Stack spacing={2}>
                    {aiLinkStore.suggestions.map((suggestion, index) =>
                      renderSuggestionItem(suggestion, index, true)
                    )}
                  </Stack>
                </>
              )}

              {/* Divider */}
              {aiLinkStore.hasSuggestions && aiLinkStore.hasPages && (
                <Divider className={classes.divider} />
              )}

              {/* All Pages Section */}
              {aiLinkStore.hasPages && (
                <>
                  <Group spacing="xs" align="center">
                    <FontAwesomeIcon
                      icon={faFile}
                      size="xs"
                      className={classes.sectionIcon}
                    />
                    <Text
                      size="xs"
                      weight={500}
                      className={classes.sectionTitle}
                    >
                      All Pages
                    </Text>
                  </Group>

                  <Stack spacing={2}>
                    {aiLinkStore.allPages.map((page, index) =>
                      renderSuggestionItem(
                        page,
                        aiLinkStore.suggestions.length + index,
                        false
                      )
                    )}
                  </Stack>
                </>
              )}

              {/* No content */}
              {!aiLinkStore.hasSuggestions && !aiLinkStore.hasPages && (
                <Text
                  size="sm"
                  className={classes.noContentText}
                  align="center"
                  py="md"
                >
                  No pages found
                </Text>
              )}
            </Stack>
          )}

          {/* Footer with keyboard hints */}
          {aiLinkStore.totalItems > 0 && (
            <Group
              spacing="xs"
              position="center"
              mt="xs"
              className={classes.footer}
            >
              <Group spacing={4}>
                <FontAwesomeIcon
                  icon={faArrowUp}
                  size="xs"
                  className={classes.keyIcon}
                />
                <FontAwesomeIcon
                  icon={faArrowDown}
                  size="xs"
                  className={classes.keyIcon}
                />
                <Text size="xs" className={classes.keyText}>
                  Navigate
                </Text>
              </Group>
              <Text size="xs" className={classes.keyText}>
                •
              </Text>
              <Text size="xs" className={classes.keyText}>
                Enter to select
              </Text>
              <Text size="xs" className={classes.keyText}>
                •
              </Text>
              <Text size="xs" className={classes.keyText}>
                Esc to close
              </Text>
            </Group>
          )}
        </Stack>
      </Paper>
    );
  }
);

export default LinkSuggestionPopup;

import React, { useState, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { Group, ActionIcon, Tooltip } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTag, faMagicWandSparkles } from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../../../hooks/use-store";
import TagManager from "./TagManager";

interface TagActionsProps {
  pageId: string;
  workspaceId: string;
  size?: "xs" | "sm" | "md";
}

export const TagActions: React.FC<TagActionsProps> = observer(
  ({ pageId, workspaceId, size = "sm" }) => {
    const { tagStore, pageStore } = useStore();
    const [showTagManager, setShowTagManager] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleGenerateTags = async () => {
      if (!pageId || !workspaceId) return;

      setLoading(true);
      try {
        // Get page content for AI generation
        const currentPage = pageStore.pages.find((p) => p.id === pageId);

        if (currentPage) {
          await tagStore.generateTagsForPage(
            currentPage.title,
            currentPage.content || {},
            workspaceId,
            pageId, // Pass pageId for duplicate checking
            false // Mark as manual generation
          );
        }
      } catch (error) {
        console.error("Error generating tags:", error);
      } finally {
        setLoading(false);
      }
    };

    const loadPageTags = useCallback(async () => {
      if (pageId) {
        await tagStore.getPageTags(pageId);
      }
    }, [pageId, tagStore]);

    return (
      <Group spacing="xs" align="center">
        {/* Manage Tags Button */}
        <Tooltip label="Manage tags">
          <ActionIcon
            size={size}
            variant="subtle"
            onClick={() => setShowTagManager(true)}
          >
            <FontAwesomeIcon icon={faTag} />
          </ActionIcon>
        </Tooltip>

        {/* Generate AI Tags Button */}
        <Tooltip label="Generate AI tags">
          <ActionIcon
            size={size}
            variant="subtle"
            loading={loading || tagStore.autoGenerating} // Use central loading state
            onClick={handleGenerateTags}
          >
            <FontAwesomeIcon icon={faMagicWandSparkles} />
          </ActionIcon>
        </Tooltip>

        {/* Tag Manager Modal */}
        <TagManager
          isOpen={showTagManager}
          onClose={() => {
            setShowTagManager(false);
            loadPageTags(); // Refresh tags when manager closes
          }}
          workspaceId={workspaceId}
          pageId={pageId}
        />
      </Group>
    );
  }
);

export default TagActions;

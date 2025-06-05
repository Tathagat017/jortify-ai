import React, { useState, useEffect, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { Group, Badge, ActionIcon } from "@mantine/core";
import { useStore } from "../../../hooks/use-store";
import { Tag } from "../../../stores/tag-store";
import { TagSuggestion } from "../../../services/ai.service";
import TagSuggestions from "./TagSuggestions";

interface PageTagsProps {
  pageId: string;
  workspaceId: string;
  size?: "xs" | "sm" | "md";
}

export const PageTags: React.FC<PageTagsProps> = observer(
  ({ pageId, workspaceId, size = "sm" }) => {
    const { tagStore } = useStore();
    const [pageTags, setPageTags] = useState<Tag[]>([]);
    const [optimisticTags, setOptimisticTags] = useState<Tag[]>([]); // For optimistic rendering

    const loadPageTags = useCallback(async () => {
      if (pageId) {
        const tags = await tagStore.getPageTags(pageId);
        setPageTags(tags);
        // Clear optimistic tags when real data loads
        setOptimisticTags([]);
      }
    }, [pageId, tagStore]);

    useEffect(() => {
      loadPageTags();
    }, [loadPageTags]);

    const handleRemoveTag = async (tagId: string) => {
      // Optimistic update - remove from display immediately
      setPageTags((prev) => prev.filter((tag) => tag.id !== tagId));
      setOptimisticTags((prev) => prev.filter((tag) => tag.id !== tagId));

      try {
        await tagStore.removeTagFromPage(pageId, tagId);
        // Refresh to get accurate state
        await loadPageTags();
      } catch (error) {
        console.error("Error removing tag:", error);
        // Revert optimistic update on error
        await loadPageTags();
      }
    };

    // Handle optimistic tag acceptance from TagSuggestions
    const handleTagAccepted = useCallback(
      (suggestion: TagSuggestion) => {
        // Create a temporary tag object for optimistic rendering
        const optimisticTag: Tag = {
          id: `temp-${suggestion.name}`, // Temporary ID
          name: suggestion.name,
          color: suggestion.color,
          workspace_id: workspaceId,
          created_at: new Date().toISOString(),
        };

        // Add to optimistic tags if not already present
        setOptimisticTags((prev) => {
          const exists =
            prev.some((tag) => tag.name === suggestion.name) ||
            pageTags.some((tag) => tag.name === suggestion.name);
          if (!exists) {
            return [...prev, optimisticTag];
          }
          return prev;
        });
      },
      [workspaceId, pageTags]
    );

    // Combine real tags with optimistic tags for display
    const displayTags = [...pageTags, ...optimisticTags];

    // Show max 4 tags, then +more
    const visibleTags = displayTags.slice(0, 4);
    const remainingCount = displayTags.length - 4;

    return (
      <Group spacing="xs" align="center">
        {/* Display tags as badges */}
        {visibleTags.map((tag) => (
          <Badge
            key={tag.id}
            color={tag.color}
            size={size}
            variant="light"
            style={{
              cursor: "pointer",
              opacity: tag.id.startsWith("temp-") ? 0.7 : 1, // Show optimistic tags with reduced opacity
            }}
            rightSection={
              <ActionIcon
                size="xs"
                color="gray"
                variant="transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveTag(tag.id);
                }}
              >
                ×
              </ActionIcon>
            }
          >
            {tag.name}
          </Badge>
        ))}

        {/* Show +more badge if there are more than 4 tags */}
        {remainingCount > 0 && (
          <Badge
            color="gray"
            size={size}
            variant="outline"
            style={{ cursor: "pointer" }}
          >
            +{remainingCount} more
          </Badge>
        )}

        {/* Tag Suggestions with optimistic rendering callback */}
        <TagSuggestions
          workspaceId={workspaceId}
          pageId={pageId}
          onTagAccepted={handleTagAccepted}
        />
      </Group>
    );
  }
);

export default PageTags;

import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { Group, Text, Button, Badge, Stack, Modal, Alert } from "@mantine/core";
import { useStore } from "../../../hooks/use-store";
import { TagSuggestion } from "../../../services/ai.service";

interface TagSuggestionsProps {
  workspaceId: string;
  pageId?: string;
  onTagAccepted?: (suggestion: TagSuggestion) => void; // Callback for optimistic updates
}

export const TagSuggestions: React.FC<TagSuggestionsProps> = observer(
  ({ workspaceId, pageId, onTagAccepted }) => {
    const { tagStore } = useStore();
    const [acceptedTags, setAcceptedTags] = useState<Set<string>>(new Set()); // Track optimistically accepted tags

    const handleAcceptSuggestion = async (suggestion: TagSuggestion) => {
      // Optimistic update - immediately mark as accepted
      setAcceptedTags((prev) => new Set(prev).add(suggestion.name));

      // Call the callback for parent component optimistic updates
      onTagAccepted?.(suggestion);

      try {
        await tagStore.acceptTagSuggestion(suggestion, workspaceId, pageId);
      } catch (error) {
        // Revert optimistic update on error
        setAcceptedTags((prev) => {
          const newSet = new Set(prev);
          newSet.delete(suggestion.name);
          return newSet;
        });
        console.error("Error accepting tag suggestion:", error);
      }
    };

    const handleAcceptAll = async () => {
      // Optimistic update - mark all as accepted
      const allTagNames = tagStore.tagSuggestions.map((s) => s.name);
      setAcceptedTags((prev) => new Set([...prev, ...allTagNames]));

      // Call callback for all suggestions
      tagStore.tagSuggestions.forEach((suggestion) => {
        onTagAccepted?.(suggestion);
      });

      try {
        for (const suggestion of tagStore.tagSuggestions) {
          await tagStore.acceptTagSuggestion(suggestion, workspaceId, pageId);
        }
      } catch (error) {
        // Revert optimistic updates on error
        setAcceptedTags((prev) => {
          const newSet = new Set(prev);
          allTagNames.forEach((name) => newSet.delete(name));
          return newSet;
        });
        console.error("Error accepting all tag suggestions:", error);
      }
    };

    const handleDismissAll = () => {
      setAcceptedTags(new Set()); // Clear optimistic state
      tagStore.dismissAllTagSuggestions();
    };

    // Filter out accepted tags from display
    const visibleSuggestions = tagStore.tagSuggestions.filter(
      (suggestion) => !acceptedTags.has(suggestion.name)
    );

    return (
      <Modal
        opened={tagStore.showTagSuggestions}
        onClose={handleDismissAll}
        title="AI Generated Tag Suggestions"
        size="md"
        centered
      >
        <Stack spacing="md">
          {/* Show error message for duplicate tags */}
          {tagStore.error && (
            <Alert color="orange" variant="light">
              {tagStore.error}
            </Alert>
          )}

          {/* Show accepted tags with success styling */}
          {acceptedTags.size > 0 && (
            <Stack spacing="xs">
              <Text size="sm" color="green" weight={500}>
                ✓ Tags Added to Page:
              </Text>
              <Group spacing="xs">
                {Array.from(acceptedTags).map((tagName) => (
                  <Badge key={tagName} color="green" variant="filled" size="md">
                    ✓ {tagName}
                  </Badge>
                ))}
              </Group>
            </Stack>
          )}

          {visibleSuggestions.length > 0 ? (
            <>
              <Text size="sm" color="dimmed">
                AI has suggested the following tags for this page:
              </Text>

              <Group spacing="xs">
                {visibleSuggestions.map((suggestion) => (
                  <Badge
                    key={suggestion.name}
                    color={suggestion.color}
                    variant="light"
                    size="md"
                    style={{
                      cursor: "pointer",
                      padding: "8px 12px",
                    }}
                    onClick={() => handleAcceptSuggestion(suggestion)}
                  >
                    + {suggestion.name}
                  </Badge>
                ))}
              </Group>

              <Group position="apart">
                <Button variant="light" color="gray" onClick={handleDismissAll}>
                  Dismiss All
                </Button>
                <Button
                  color="blue"
                  onClick={handleAcceptAll}
                  disabled={visibleSuggestions.length === 0}
                >
                  Accept All Tags
                </Button>
              </Group>
            </>
          ) : acceptedTags.size > 0 ? (
            /* Show when all tags have been accepted */
            <Group position="center">
              <Button variant="light" color="green" onClick={handleDismissAll}>
                Done
              </Button>
            </Group>
          ) : (
            /* Show when no suggestions or all are duplicates */
            <Group position="center">
              <Button variant="light" color="gray" onClick={handleDismissAll}>
                Close
              </Button>
            </Group>
          )}
        </Stack>
      </Modal>
    );
  }
);

export default TagSuggestions;

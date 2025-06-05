import React, { useState, useEffect, useCallback } from "react";
import { observer } from "mobx-react-lite";
import {
  Modal,
  Stack,
  Group,
  Text,
  TextInput,
  Button,
  Badge,
  ActionIcon,
  Alert,
  Select,
  ScrollArea,
  Divider,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faTimes,
  faEdit,
  faTrash,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../../../hooks/use-store";
import { Tag } from "../../../stores/tag-store";
import { TagSuggestion } from "../../../services/ai.service";

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  pageId?: string;
}

const TAG_COLORS = [
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "yellow", label: "Yellow" },
  { value: "red", label: "Red" },
  { value: "purple", label: "Purple" },
  { value: "gray", label: "Gray" },
  { value: "orange", label: "Orange" },
  { value: "pink", label: "Pink" },
];

export const TagManager: React.FC<TagManagerProps> = observer(
  ({ isOpen, onClose, workspaceId, pageId }) => {
    const { tagStore } = useStore();
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("blue");
    const [editingTag, setEditingTag] = useState<Tag | null>(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState("");
    const [pageTags, setPageTags] = useState<Tag[]>([]);

    const loadPageTags = useCallback(async () => {
      if (pageId) {
        const tags = await tagStore.getPageTags(pageId);
        setPageTags(tags);
      }
    }, [pageId, tagStore]);

    useEffect(() => {
      if (isOpen && workspaceId) {
        tagStore.fetchTagsForWorkspace(workspaceId);
        loadPageTags();
      }
    }, [isOpen, workspaceId, tagStore, loadPageTags]);

    const handleCreateTag = async () => {
      if (!newTagName.trim() || !workspaceId) return;

      const success = await tagStore.createTag(
        newTagName.trim(),
        newTagColor,
        workspaceId
      );

      if (success) {
        setNewTagName("");
        setNewTagColor("blue");
      }
    };

    const handleEditTag = (tag: Tag) => {
      setEditingTag(tag);
      setEditName(tag.name);
      setEditColor(tag.color);
    };

    const handleSaveEdit = async () => {
      if (!editingTag || !editName.trim()) return;

      await tagStore.updateTag(editingTag.id, editName.trim(), editColor);
      setEditingTag(null);
      setEditName("");
      setEditColor("");
    };

    const handleCancelEdit = () => {
      setEditingTag(null);
      setEditName("");
      setEditColor("");
    };

    const handleDeleteTag = async (tagId: string) => {
      await tagStore.deleteTag(tagId);
      await loadPageTags(); // Refresh page tags after deletion
    };

    const handleAcceptAllSuggestions = async () => {
      if (!workspaceId) return;

      try {
        for (const suggestion of tagStore.tagSuggestions) {
          await tagStore.acceptTagSuggestion(suggestion, workspaceId, pageId);
        }

        // Refresh page tags after accepting all suggestions
        await loadPageTags();

        // Clear suggestions
        tagStore.dismissAllTagSuggestions();
      } catch (error) {
        console.error("Error accepting all tag suggestions:", error);
      }
    };

    const handleAcceptSuggestion = async (suggestion: TagSuggestion) => {
      if (!workspaceId) return;

      try {
        await tagStore.acceptTagSuggestion(suggestion, workspaceId, pageId);

        // Refresh page tags after accepting suggestion
        await loadPageTags();
      } catch (error) {
        console.error("Error accepting tag suggestion:", error);
      }
    };

    const handleAddToPage = async (tagId: string) => {
      if (!pageId) return;

      try {
        await tagStore.addTagToPage(pageId, tagId);
        await loadPageTags(); // Refresh page tags
      } catch (error) {
        console.error("Error adding tag to page:", error);
      }
    };

    const handleRemoveFromPage = async (tagId: string) => {
      if (!pageId) return;

      try {
        await tagStore.removeTagFromPage(pageId, tagId);
        await loadPageTags(); // Refresh page tags
      } catch (error) {
        console.error("Error removing tag from page:", error);
      }
    };

    const colorOptions = TAG_COLORS.map((color) => ({
      value: color.value,
      label: color.label,
    }));

    return (
      <Modal
        opened={isOpen}
        onClose={onClose}
        title="Tag Manager"
        size="lg"
        centered
      >
        <Stack spacing="md">
          {/* Create New Tag */}
          <Stack spacing="xs">
            <Text weight={500} size="xs">
              Create New Tag
            </Text>
            <Group spacing="xs">
              <TextInput
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                style={{ flex: 1 }}
                size="xs"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleCreateTag();
                  }
                }}
              />
              <Select
                data={colorOptions}
                value={newTagColor}
                onChange={(value) => setNewTagColor(value || "blue")}
                style={{ width: 120 }}
                size="xs"
              />
              <Button
                onClick={handleCreateTag}
                disabled={!newTagName.trim() || tagStore.loading}
                size="xs"
                leftIcon={<FontAwesomeIcon icon={faPlus} />}
              >
                Create
              </Button>
            </Group>
          </Stack>

          {/* AI Suggested Tags */}
          {tagStore.tagSuggestions.length > 0 && (
            <>
              <Divider />
              <Stack spacing="xs">
                <Group position="apart">
                  <Text size="xs" weight={600}>
                    AI Suggested Tags
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    color="blue"
                    onClick={handleAcceptAllSuggestions}
                  >
                    Accept All Tags
                  </Button>
                </Group>
                <Group spacing="xs">
                  {tagStore.tagSuggestions.map((suggestion) => (
                    <Badge
                      key={suggestion.name}
                      color={suggestion.color}
                      variant="light"
                      size="xs"
                      style={{ cursor: "pointer" }}
                      onClick={() => handleAcceptSuggestion(suggestion)}
                    >
                      + {suggestion.name}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </>
          )}

          {/* Show error message for duplicate tags */}
          {tagStore.error && (
            <Alert color="orange" variant="light">
              <Text size="xs">{tagStore.error}</Text>
            </Alert>
          )}

          {/* Tags Added to This Page */}
          {pageId && (
            <>
              <Divider />
              <Stack spacing="xs">
                <Text size="xs" weight={600}>
                  Tags Added to This Page ({pageTags.length})
                </Text>
                {pageTags.length > 0 ? (
                  <Group spacing="xs">
                    {pageTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        color={tag.color}
                        variant="filled"
                        size="xs"
                        rightSection={
                          <ActionIcon
                            size="xs"
                            color="white"
                            variant="transparent"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromPage(tag.id);
                            }}
                          >
                            <FontAwesomeIcon icon={faTimes} size="xs" />
                          </ActionIcon>
                        }
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text size="xs" color="dimmed">
                    No tags added to this page yet.
                  </Text>
                )}
              </Stack>
            </>
          )}

          <Divider />

          {/* All Available Tags */}
          <Text size="xs" weight={600}>
            All Available Tags in Workspace ({tagStore.tags.length})
          </Text>

          <ScrollArea style={{ height: 300 }}>
            <Stack spacing="xs">
              {tagStore.tags.map((tag) => {
                const isOnPage = pageTags.some((pt) => pt.id === tag.id);
                return (
                  <Group key={tag.id} position="apart">
                    <Group spacing="xs">
                      <Badge color={tag.color} variant="light" size="xs">
                        {tag.name}
                      </Badge>
                      {editingTag?.id === tag.id ? (
                        <Group spacing="xs">
                          <TextInput
                            size="xs"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{ width: 120 }}
                          />
                          <Select
                            size="xs"
                            value={editColor}
                            onChange={(value) => setEditColor(value || "")}
                            data={colorOptions}
                            style={{ width: 100 }}
                          />
                        </Group>
                      ) : null}
                    </Group>

                    <Group spacing="xs">
                      {pageId && (
                        <>
                          {isOnPage ? (
                            <ActionIcon
                              size="xs"
                              color="red"
                              variant="light"
                              onClick={() => handleRemoveFromPage(tag.id)}
                            >
                              <FontAwesomeIcon icon={faTimes} />
                            </ActionIcon>
                          ) : (
                            <ActionIcon
                              size="xs"
                              color="black"
                              variant="light"
                              onClick={() => handleAddToPage(tag.id)}
                            >
                              <FontAwesomeIcon icon={faPlus} />
                            </ActionIcon>
                          )}
                        </>
                      )}

                      {editingTag?.id === tag.id ? (
                        <Group spacing="xs">
                          <ActionIcon
                            size="xs"
                            color="green"
                            onClick={handleSaveEdit}
                          >
                            <FontAwesomeIcon icon={faCheck} />
                          </ActionIcon>
                          <ActionIcon
                            size="xs"
                            color="gray"
                            onClick={handleCancelEdit}
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </ActionIcon>
                        </Group>
                      ) : (
                        <Group spacing="xs">
                          <ActionIcon
                            size="xs"
                            color="black"
                            onClick={() => handleEditTag(tag)}
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </ActionIcon>
                          <ActionIcon
                            size="xs"
                            color="red"
                            onClick={() => handleDeleteTag(tag.id)}
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </ActionIcon>
                        </Group>
                      )}
                    </Group>
                  </Group>
                );
              })}
            </Stack>
          </ScrollArea>
        </Stack>
      </Modal>
    );
  }
);

export default TagManager;

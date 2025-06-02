import React, { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
  Stack,
  Group,
  Badge,
  Text,
  ActionIcon,
  Tooltip,
  Collapse,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faChevronDown,
  faChevronRight,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../../../hooks/use-store";

interface TagFilterProps {
  workspaceId: string;
  onFilterChange?: (selectedTags: string[]) => void;
}

export const TagFilter: React.FC<TagFilterProps> = observer(
  ({ workspaceId, onFilterChange }) => {
    const { tagStore } = useStore();
    const [isExpanded, setIsExpanded] = React.useState(false);

    useEffect(() => {
      if (workspaceId) {
        tagStore.fetchTagsForWorkspace(workspaceId);
      }
    }, [workspaceId, tagStore]);

    useEffect(() => {
      onFilterChange?.(tagStore.selectedTags);
    }, [tagStore.selectedTags, onFilterChange]);

    const handleTagToggle = (tagId: string) => {
      tagStore.toggleTagFilter(tagId);
    };

    const handleClearFilters = () => {
      tagStore.clearTagFilters();
    };

    if (tagStore.tags.length === 0) {
      return null;
    }

    return (
      <Stack spacing="xs">
        <Group position="apart" align="center">
          <Group spacing="xs">
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <FontAwesomeIcon
                icon={isExpanded ? faChevronDown : faChevronRight}
                size="xs"
              />
            </ActionIcon>
            <FontAwesomeIcon icon={faFilter} size="xs" />
            <Text size="sm" weight={500}>
              Filter by Tags
            </Text>
            {tagStore.selectedTags.length > 0 && (
              <Badge size="xs" color="blue" variant="filled">
                {tagStore.selectedTags.length}
              </Badge>
            )}
          </Group>
          {tagStore.selectedTags.length > 0 && (
            <Tooltip label="Clear filters">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={handleClearFilters}
              >
                <FontAwesomeIcon icon={faTimes} size="xs" />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        <Collapse in={isExpanded}>
          <Stack spacing="xs" pl="md">
            {tagStore.tags.map((tag) => (
              <Group
                key={tag.id}
                spacing="xs"
                style={{
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  backgroundColor: tagStore.isTagSelected(tag.id)
                    ? "rgba(66, 153, 225, 0.1)"
                    : "transparent",
                }}
                onClick={() => handleTagToggle(tag.id)}
              >
                <Badge
                  color={tag.color}
                  variant={tagStore.isTagSelected(tag.id) ? "filled" : "light"}
                  size="sm"
                  style={{ textTransform: "none" }}
                >
                  {tag.name}
                </Badge>
              </Group>
            ))}

            {tagStore.tags.length === 0 && (
              <Text size="xs" color="dimmed" ta="center" py="sm">
                No tags available
              </Text>
            )}
          </Stack>
        </Collapse>
      </Stack>
    );
  }
);

export default TagFilter;

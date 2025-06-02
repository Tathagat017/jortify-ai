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
  SegmentedControl,
  MultiSelect,
  Box,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faChevronDown,
  faChevronRight,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../../hooks/use-store";

interface FilterByTreeProps {
  workspaceId: string;
}

export const FilterByTree: React.FC<FilterByTreeProps> = observer(
  ({ workspaceId }) => {
    const { searchStore, tagStore } = useStore();
    const [isExpanded, setIsExpanded] = React.useState(false);

    // Debounced filters with 300ms delay for filter changes
    const [debouncedFilters] = useDebouncedValue(
      searchStore.filters.metadata,
      300
    );

    // Load tags for the workspace
    useEffect(() => {
      if (workspaceId) {
        tagStore.fetchTagsForWorkspace(workspaceId);
      }
    }, [workspaceId, tagStore]);

    // Effect to trigger filter-by search when debounced filters change
    useEffect(() => {
      if (workspaceId) {
        const hasFilterByFilters =
          searchStore.filters.metadata.tags.length > 0 ||
          searchStore.filters.metadata.workspaceType !== "all";

        if (hasFilterByFilters) {
          searchStore.performSearch(workspaceId);
        } else {
          // Clear search results when no filter-by filters are active
          searchStore.clearSearch();
        }
      }
    }, [debouncedFilters, workspaceId, searchStore]);

    // Close filter tree when search results are available
    useEffect(() => {
      if (searchStore.results.length > 0 && !searchStore.loading) {
        setIsExpanded(false);
      }
    }, [searchStore.results.length, searchStore.loading]);

    const handleWorkspaceTypeChange = (value: string) => {
      searchStore.setWorkspaceType(value as "public" | "private" | "all");
    };

    const handleTagsChange = (tagIds: string[]) => {
      searchStore.setSelectedTags(tagIds);
    };

    const handleResetFilterBy = () => {
      searchStore.setSelectedTags([]);
      searchStore.setWorkspaceType("all");
    };

    // Prepare tag options for MultiSelect
    const tagOptions = tagStore.tags.map((tag) => ({
      value: tag.id,
      label: tag.name,
      color: tag.color,
    }));

    // Check for active filter-by filters
    const hasActiveFilterByFilters =
      searchStore.filters.metadata.tags.length > 0 ||
      searchStore.filters.metadata.workspaceType !== "all";

    return (
      <Stack spacing="xs">
        {/* Header */}
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 8px",
            borderRadius: "4px",
            cursor: "pointer",
            transition: "background-color 0.15s ease",
          }}
          onClick={() => setIsExpanded(!isExpanded)}
          onMouseEnter={(e) =>
            (e.currentTarget.style.backgroundColor = "#f8f9fa")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.backgroundColor = "transparent")
          }
        >
          <Group spacing="xs">
            <ActionIcon
              size="sm"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              <FontAwesomeIcon
                icon={isExpanded ? faChevronDown : faChevronRight}
                size="xs"
              />
            </ActionIcon>
            <FontAwesomeIcon icon={faFilter} size="sm" color="#666" />
            <Text size="sm" color="#666" weight={500}>
              Filter By
            </Text>
            {hasActiveFilterByFilters && (
              <Badge size="xs" color="green" variant="filled">
                Active
              </Badge>
            )}
          </Group>
          {hasActiveFilterByFilters && (
            <Tooltip label="Reset filters">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetFilterBy();
                }}
              >
                <FontAwesomeIcon icon={faTimes} size="xs" />
              </ActionIcon>
            </Tooltip>
          )}
        </Box>

        {/* Collapsible Content */}
        <Collapse in={isExpanded}>
          <Box
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              paddingLeft: "16px",
            }}
          >
            <Stack spacing="xs">
              <Text size="xs" color="#666">
                Works without search query
              </Text>

              {/* Tags */}
              {tagOptions.length > 0 && (
                <Stack spacing="xs">
                  <Text size="xs" weight={500}>
                    Tags
                  </Text>
                  <MultiSelect
                    placeholder="Select tags..."
                    data={tagOptions}
                    value={searchStore.filters.metadata.tags}
                    onChange={handleTagsChange}
                    searchable
                    clearable
                    size="xs"
                    maxDropdownHeight={120}
                    itemComponent={({ label, color, ...others }) => (
                      <div {...others}>
                        <Group spacing="xs">
                          <Badge
                            color={color}
                            variant="light"
                            size="xs"
                            style={{ textTransform: "none" }}
                          >
                            {label}
                          </Badge>
                        </Group>
                      </div>
                    )}
                    valueComponent={({ label, color, onRemove, ...others }) => (
                      <Badge
                        {...others}
                        color={color}
                        variant="filled"
                        size="xs"
                        rightSection={
                          <ActionIcon
                            size="xs"
                            color="white"
                            radius="xl"
                            variant="transparent"
                            onClick={onRemove}
                          >
                            <FontAwesomeIcon icon={faTimes} size="xs" />
                          </ActionIcon>
                        }
                        style={{ textTransform: "none" }}
                      >
                        {label}
                      </Badge>
                    )}
                  />
                </Stack>
              )}

              {/* Workspace Type */}
              <Stack spacing="xs">
                <Text size="xs" weight={500}>
                  Workspace Type
                </Text>
                <SegmentedControl
                  value={searchStore.filters.metadata.workspaceType}
                  onChange={handleWorkspaceTypeChange}
                  data={[
                    { label: "All", value: "all" },
                    { label: "Public", value: "public" },
                    { label: "Private", value: "private" },
                  ]}
                  size="xs"
                  fullWidth
                />
              </Stack>
            </Stack>
          </Box>
        </Collapse>
      </Stack>
    );
  }
);

export default FilterByTree;

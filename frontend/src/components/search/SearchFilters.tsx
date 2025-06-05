import { faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  MultiSelect,
  SegmentedControl,
  Stack,
  Text,
} from "@mantine/core";
import { observer } from "mobx-react-lite";
import React from "react";
import { useStore } from "../../hooks/use-store";

interface SearchFiltersProps {
  workspaceId: string;
}

export const SearchFilters: React.FC<SearchFiltersProps> = observer(
  ({ workspaceId }) => {
    const { searchStore, tagStore } = useStore();

    // Load tags for the workspace
    React.useEffect(() => {
      if (workspaceId) {
        tagStore.fetchTagsForWorkspace(workspaceId);
      }
    }, [workspaceId, tagStore]);

    const handleSearchBehaviorChange = (value: string) => {
      searchStore.setSearchBehavior(value as "simple" | "semantic");
    };

    const handleSearchInChange = (
      field: "pageName" | "subPageName" | "pageContent"
    ) => {
      searchStore.toggleSearchIn(field);
    };

    const handleWorkspaceTypeChange = (value: string) => {
      searchStore.setWorkspaceType(value as "public" | "private" | "all");
    };

    const handleTagsChange = (tagIds: string[]) => {
      searchStore.setSelectedTags(tagIds);
    };

    const handleResetFilters = () => {
      searchStore.resetFilters();
    };

    // Prepare tag options for MultiSelect
    const tagOptions = tagStore.tags.map((tag) => ({
      value: tag.id,
      label: tag.name,
      color: tag.color,
    }));

    const hasActiveFilters =
      searchStore.filters.searchBehavior !== "simple" ||
      !searchStore.filters.searchIn.pageName ||
      !searchStore.filters.searchIn.subPageName ||
      !searchStore.filters.searchIn.pageContent ||
      searchStore.filters.metadata.tags.length > 0 ||
      searchStore.filters.metadata.workspaceType !== "all";

    return (
      <Stack
        spacing="xs"
        p="xs"
        style={{ width: "100%", maxHeight: "420px", overflowY: "auto" }}
      >
        {/* Header with reset button */}
        <Group position="left" align="center">
          {hasActiveFilters && (
            <Button
              size="xs"
              variant="outline"
              color="gray"
              onClick={handleResetFilters}
            >
              Reset filters
            </Button>
          )}
        </Group>
        {/* Search Behavior */}
        <Stack spacing="xs">
          <Text size="xs" weight={500}>
            Search Behavior
          </Text>
          <SegmentedControl
            value={searchStore.filters.searchBehavior}
            onChange={handleSearchBehaviorChange}
            data={[
              { label: "Simple", value: "simple" },
              { label: "Semantic", value: "semantic" },
            ]}
            size="xs"
            fullWidth
          />
          <Text size="xs" color="dimmed" style={{ fontSize: "10px" }}>
            {searchStore.filters.searchBehavior === "simple"
              ? "Full-text search with exact matches"
              : "AI-powered semantic similarity search"}
          </Text>
        </Stack>

        <Divider />

        {/* Search In - Vertical Layout for compact space */}
        <Stack spacing="xs">
          <Text size="xs" weight={500}>
            Search In
          </Text>
          <Stack spacing="xs">
            <Checkbox
              label="Page names"
              checked={searchStore.filters.searchIn.pageName}
              onChange={() => handleSearchInChange("pageName")}
              size="xs"
            />
            <Checkbox
              label="Sub-pages"
              checked={searchStore.filters.searchIn.subPageName}
              onChange={() => handleSearchInChange("subPageName")}
              size="xs"
            />
            <Checkbox
              label="Content"
              checked={searchStore.filters.searchIn.pageContent}
              onChange={() => handleSearchInChange("pageContent")}
              size="xs"
            />
          </Stack>
        </Stack>

        <Divider />

        {/* Metadata Filters */}
        <Stack spacing="xs">
          <Text size="xs" weight={500}>
            Metadata Filters
          </Text>

          {/* Tag Filter */}
          <Stack spacing="xs">
            <Text size="xs">Tags</Text>
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

          {/* Workspace Type - Vertical Layout */}
          <Stack spacing="xs">
            <Text size="xs">Workspace Type</Text>
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

        {/* Active Filters Summary - Compact */}
        {hasActiveFilters && (
          <>
            <Divider />
            <Stack spacing="xs">
              <Text size="xs" color="dimmed">
                Active Filters:
              </Text>
              <Group spacing="xs">
                {searchStore.filters.searchBehavior === "semantic" && (
                  <Badge size="xs" variant="light" color="blue">
                    Semantic
                  </Badge>
                )}
                {searchStore.filters.metadata.tags.length > 0 && (
                  <Badge size="xs" variant="light" color="green">
                    {searchStore.filters.metadata.tags.length} Tag(s)
                  </Badge>
                )}
                {searchStore.filters.metadata.workspaceType !== "all" && (
                  <Badge size="xs" variant="light" color="orange">
                    {searchStore.filters.metadata.workspaceType}
                  </Badge>
                )}
              </Group>
            </Stack>
          </>
        )}
      </Stack>
    );
  }
);

export default SearchFilters;

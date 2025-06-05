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
  Checkbox,
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

interface SearchFilterTreeProps {
  workspaceId: string;
}

export const SearchFilterTree: React.FC<SearchFilterTreeProps> = observer(
  ({ workspaceId }) => {
    const { searchStore } = useStore();
    const [isExpanded, setIsExpanded] = React.useState(false);

    // Debounced filters with 300ms delay for filter changes
    const [debouncedFilters] = useDebouncedValue(searchStore.filters, 300);

    // Effect to trigger search when debounced search filters change (only if there's a query)
    useEffect(() => {
      if (workspaceId && searchStore.query.trim()) {
        searchStore.performSearch(workspaceId);
      }
    }, [
      debouncedFilters.searchBehavior,
      debouncedFilters.searchIn,
      searchStore.query,
      workspaceId,
      searchStore,
    ]);

    // Close filter tree when search results are available
    useEffect(() => {
      if (
        searchStore.results.length > 0 ||
        (searchStore.query.trim() && !searchStore.loading)
      ) {
        setIsExpanded(false);
      }
    }, [searchStore.results.length, searchStore.query, searchStore.loading]);

    const handleSearchBehaviorChange = (value: string) => {
      searchStore.setSearchBehavior(value as "simple" | "semantic");
    };

    const handleSearchInChange = (
      field: "pageName" | "subPageName" | "pageContent"
    ) => {
      searchStore.toggleSearchIn(field);
    };

    const handleResetSearchFilters = () => {
      searchStore.setSearchBehavior("simple");
      searchStore.filters.searchIn = {
        pageName: true,
        subPageName: true,
        pageContent: true,
      };
    };

    // Check for active search filters only
    const hasActiveSearchFilters =
      searchStore.filters.searchBehavior !== "simple" ||
      !searchStore.filters.searchIn.pageName ||
      !searchStore.filters.searchIn.subPageName ||
      !searchStore.filters.searchIn.pageContent;

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
              Search Filters
            </Text>
            {hasActiveSearchFilters && (
              <Badge size="xs" color="orange" variant="filled">
                Active
              </Badge>
            )}
          </Group>
          {hasActiveSearchFilters && (
            <Tooltip label="Reset search filters">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={(e) => {
                  e.stopPropagation();
                  handleResetSearchFilters();
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
                Requires search query
              </Text>

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
              </Stack>

              {/* Search In */}
              <Stack spacing="xs">
                <Text size="xs" weight={500}>
                  Search In
                </Text>
                <Group spacing="sm">
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
                </Group>
              </Stack>
            </Stack>
          </Box>
        </Collapse>
      </Stack>
    );
  }
);

export default SearchFilterTree;

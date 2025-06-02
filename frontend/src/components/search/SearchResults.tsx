import React from "react";
import { observer } from "mobx-react-lite";
import {
  Stack,
  Group,
  Text,
  Paper,
  Badge,
  Loader,
  Button,
  Alert,
  Box,
  Highlight,
  Avatar,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFile,
  faExclamationTriangle,
  faSearch,
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../../hooks/use-store";
import { SearchResult } from "../../services/search.service";

interface SearchResultsProps {
  workspaceId: string;
  onPageSelect: (pageId: string) => void;
}

interface BlockContent {
  text?: string;
  [key: string]: unknown;
}

interface Block {
  content?: BlockContent[];
  [key: string]: unknown;
}

const SearchResultItem: React.FC<{
  result: SearchResult;
  query: string;
  onSelect: (pageId: string) => void;
}> = ({ result, query, onSelect }) => {
  const handleClick = () => {
    onSelect(result.id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getContentPreview = (content: object | undefined): string => {
    if (!content) return "";

    try {
      // Handle BlockNote content structure
      if (Array.isArray(content)) {
        return content
          .map((block: Block) => {
            if (block.content && Array.isArray(block.content)) {
              return block.content
                .map((item: BlockContent) => item.text || "")
                .join(" ");
            }
            return "";
          })
          .join(" ")
          .slice(0, 200);
      }

      return JSON.stringify(content).slice(0, 200);
    } catch {
      return "";
    }
  };

  const contentPreview = getContentPreview(result.content);

  return (
    <Paper
      p="sm"
      withBorder
      style={{
        cursor: "pointer",
        transition: "all 0.15s ease",
        borderColor: "#e5e5e5",
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#339af0";
        e.currentTarget.style.backgroundColor = "#f8f9fa";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e5e5e5";
        e.currentTarget.style.backgroundColor = "white";
      }}
    >
      <Stack spacing="xs">
        {/* Header */}
        <Group position="apart" align="flex-start">
          <Group spacing="xs" align="flex-start" style={{ flex: 1 }}>
            {/* Icon */}
            <Box style={{ marginTop: "2px" }}>
              {result.icon_url ? (
                <Avatar src={result.icon_url} size="xs" radius="sm" />
              ) : (
                <FontAwesomeIcon icon={faFile} size="xs" color="#666" />
              )}
            </Box>

            {/* Title and metadata */}
            <Stack spacing="xs" style={{ flex: 1 }}>
              <Highlight
                highlight={query}
                size="sm"
                weight={600}
                style={{ lineHeight: 1.3 }}
              >
                {result.title || "Untitled"}
              </Highlight>

              <Group spacing="xs">
                <Text size="xs" color="dimmed">
                  {formatDate(result.updated_at)}
                </Text>
                {result.rank && (
                  <Badge size="xs" variant="light" color="blue">
                    {result.rank.toFixed(1)}
                  </Badge>
                )}
                {result.similarity && (
                  <Badge size="xs" variant="light" color="green">
                    {Math.round(result.similarity * 100)}%
                  </Badge>
                )}
              </Group>
            </Stack>
          </Group>
        </Group>

        {/* Content Preview */}
        {contentPreview && (
          <Text size="xs" color="dimmed" lineClamp={2}>
            <Highlight highlight={query}>{contentPreview}</Highlight>
          </Text>
        )}

        {/* Tags */}
        {result.tags && result.tags.length > 0 && (
          <Group spacing="xs">
            {result.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag.id}
                color={tag.color}
                variant="light"
                size="xs"
                style={{ textTransform: "none" }}
              >
                {tag.name}
              </Badge>
            ))}
            {result.tags.length > 2 && (
              <Text size="xs" color="dimmed">
                +{result.tags.length - 2}
              </Text>
            )}
          </Group>
        )}
      </Stack>
    </Paper>
  );
};

export const SearchResults: React.FC<SearchResultsProps> = observer(
  ({ workspaceId, onPageSelect }) => {
    const { searchStore } = useStore();

    const handleLoadMore = () => {
      searchStore.loadMore(workspaceId);
    };

    if (searchStore.loading && searchStore.results.length === 0) {
      return (
        <Stack align="center" spacing="md" py="xl">
          <Loader size="md" />
          <Text size="sm" color="dimmed">
            {searchStore.filters.searchBehavior === "semantic"
              ? "Performing semantic search..."
              : "Searching pages..."}
          </Text>
        </Stack>
      );
    }

    if (searchStore.error) {
      return (
        <Alert
          icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
          title="Search Error"
          color="red"
          variant="light"
        >
          {searchStore.error}
        </Alert>
      );
    }

    if (!searchStore.query.trim()) {
      return (
        <Stack align="center" spacing="md" py="xl">
          <FontAwesomeIcon icon={faSearch} size="2x" color="#ccc" />
          <Text size="sm" color="dimmed" ta="center">
            Enter a search query to find pages
          </Text>
        </Stack>
      );
    }

    if (searchStore.results.length === 0) {
      return (
        <Stack align="center" spacing="md" py="xl">
          <FontAwesomeIcon icon={faSearch} size="2x" color="#ccc" />
          <Text size="sm" color="dimmed" ta="center">
            No pages found for "{searchStore.query}"
          </Text>
          <Text size="xs" color="dimmed" ta="center">
            Try adjusting your search terms or filters
          </Text>
        </Stack>
      );
    }

    return (
      <Stack spacing="sm">
        {/* Results header */}
        <Group position="apart" align="center">
          <Text size="xs" color="dimmed">
            {searchStore.pagination.total} result(s)
          </Text>
          {searchStore.filters.searchBehavior === "semantic" && (
            <Badge size="xs" variant="light" color="blue">
              Semantic
            </Badge>
          )}
        </Group>

        {/* Results list */}
        <Stack spacing="xs">
          {searchStore.results.map((result) => (
            <SearchResultItem
              key={result.id}
              result={result}
              query={searchStore.query}
              onSelect={onPageSelect}
            />
          ))}
        </Stack>

        {/* Load more button */}
        {searchStore.pagination.hasMore && (
          <Group position="center" mt="sm">
            <Button
              variant="light"
              onClick={handleLoadMore}
              loading={searchStore.loading}
              size="xs"
              compact
            >
              Load More
            </Button>
          </Group>
        )}

        {/* Loading indicator for load more */}
        {searchStore.loading && searchStore.results.length > 0 && (
          <Group position="center" mt="xs">
            <Loader size="xs" />
            <Text size="xs" color="dimmed">
              Loading...
            </Text>
          </Group>
        )}
      </Stack>
    );
  }
);

export default SearchResults;

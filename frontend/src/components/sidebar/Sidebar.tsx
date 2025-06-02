import {
  faArrowsAlt,
  faChevronDown,
  faChevronRight,
  faCog,
  faCopy,
  faEllipsisH,
  faFile,
  faPlus,
  faSearch,
  faTimes,
  faTrash,
  faTrashRestore,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Menu,
  Popover,
  ScrollArea,
  Text,
  TextInput,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useMutation, useQuery } from "@tanstack/react-query";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import { useStore } from "../../hooks/use-store";
import { Page } from "../../stores/page-store";
import FilterByTree from "../search/FilterByTree";
import SearchFilterTree from "../search/SearchFilterTree";
import SearchResults from "../search/SearchResults";
import WorkspaceSelector from "./WorkspaceSelector";

interface SidebarProps {
  isOpen: boolean;
}

interface PageTreeItemProps {
  page: Page & { children?: Page[] };
  level: number;
  onPageSelect: (page: Page) => void;
  onCreateSubPage: (parentId: string) => void;
  onDuplicatePage: (pageId: string) => void;
  onMovePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  selectedPageId?: string;
  maxLevel?: number;
}

const PageTreeItem: React.FC<PageTreeItemProps> = observer(
  ({
    page,
    level,
    onPageSelect,
    onCreateSubPage,
    onDuplicatePage,
    onMovePage,
    onDeletePage,
    selectedPageId,
    maxLevel = 1,
  }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);
    const hasChildren = page.children && page.children.length > 0;
    const canExpand = level < maxLevel && hasChildren;

    const handleDeleteConfirm = () => {
      onDeletePage(page.id);
      setDeletePopoverOpen(false);
    };

    return (
      <Box>
        <Box
          onClick={() => onPageSelect(page)}
          className="page-item"
          style={{
            padding: "4px 8px",
            paddingLeft: `${8 + level * 16}px`,
            borderRadius: "4px",
            cursor: "pointer",
            backgroundColor:
              selectedPageId === page.id ? "#f5f5f5" : "transparent",
            marginBottom: "1px",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minHeight: "28px",
          }}
          onMouseEnter={(e) => {
            if (selectedPageId !== page.id) {
              e.currentTarget.style.backgroundColor = "#f8f9fa";
            }
          }}
          onMouseLeave={(e) => {
            if (selectedPageId !== page.id) {
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
        >
          {/* Expand/Collapse button */}
          {canExpand ? (
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              style={{ color: "#666", minWidth: "16px" }}
            >
              <FontAwesomeIcon
                icon={isExpanded ? faChevronDown : faChevronRight}
                size="xs"
              />
            </ActionIcon>
          ) : (
            <Box style={{ minWidth: "16px" }} />
          )}

          {/* Page Icon */}
          <Box style={{ minWidth: "16px" }}>
            {page.icon ? (
              <Text size="sm">{page.icon}</Text>
            ) : (
              <FontAwesomeIcon icon={faFile} size="sm" color="#666" />
            )}
          </Box>

          {/* Page Title */}
          <Text
            size="sm"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              color: "#000",
              fontSize: "14px",
            }}
          >
            {page.title || "Untitled"}
          </Text>

          {/* Page Actions Menu */}
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon
                size="xs"
                variant="subtle"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                style={{
                  opacity: 0,
                  color: "#666",
                  transition: "opacity 0.15s ease",
                }}
                title="Page options"
                className="page-options-btn"
              >
                <FontAwesomeIcon icon={faEllipsisH} size="xs" />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown>
              {level < maxLevel && (
                <Menu.Item
                  icon={<FontAwesomeIcon icon={faPlus} size="sm" />}
                  onClick={() => onCreateSubPage(page.id)}
                >
                  Add sub-page
                </Menu.Item>
              )}
              <Menu.Item
                icon={<FontAwesomeIcon icon={faCopy} size="sm" />}
                onClick={() => onDuplicatePage(page.id)}
              >
                Duplicate
              </Menu.Item>
              <Menu.Item
                icon={<FontAwesomeIcon icon={faArrowsAlt} size="sm" />}
                onClick={() => onMovePage(page.id)}
              >
                Move to...
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          {/* Add sub-page button - only show on hover and if level allows */}
          {level < maxLevel && (
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation();
                onCreateSubPage(page.id);
              }}
              style={{
                opacity: 0,
                color: "#666",
                transition: "opacity 0.15s ease",
              }}
              title="Add sub-page"
              className="add-subpage-btn"
            >
              <FontAwesomeIcon icon={faPlus} size="xs" />
            </ActionIcon>
          )}
          {/* Delete Button with Confirmation Popover */}
          <Popover
            opened={deletePopoverOpen}
            onClose={() => setDeletePopoverOpen(false)}
            position="bottom"
            withArrow
            shadow="md"
            width={280}
          >
            <Popover.Target>
              <ActionIcon
                size="xs"
                variant="subtle"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletePopoverOpen(true);
                }}
                style={{
                  opacity: 0,
                  color: "#dc3545",
                  transition: "opacity 0.15s ease",
                }}
                title="Delete page"
                className="page-options-btn"
              >
                <FontAwesomeIcon icon={faTimes} size="xs" />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Box p="sm">
                <Text size="sm" weight={500} mb="xs">
                  Move to trash?
                </Text>
                <Text size="xs" color="dimmed" mb="md">
                  This page will be moved to trash. You can restore it later if
                  needed.
                </Text>
                <Group spacing="xs">
                  <Button size="xs" color="red" onClick={handleDeleteConfirm}>
                    Move to trash
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => setDeletePopoverOpen(false)}
                  >
                    Cancel
                  </Button>
                </Group>
              </Box>
            </Popover.Dropdown>
          </Popover>
        </Box>

        {/* Children - only show if level allows */}
        {isExpanded && canExpand && (
          <Box>
            {page.children!.map((child) => (
              <PageTreeItem
                key={child.id}
                page={child}
                level={level + 1}
                onPageSelect={onPageSelect}
                onCreateSubPage={onCreateSubPage}
                onDuplicatePage={onDuplicatePage}
                onMovePage={onMovePage}
                onDeletePage={onDeletePage}
                selectedPageId={selectedPageId}
                maxLevel={maxLevel}
              />
            ))}
          </Box>
        )}

        {/* Show "No pages inside" when expanded but empty */}
        {isExpanded &&
          canExpand &&
          (!page.children || page.children.length === 0) && (
            <Box
              style={{
                padding: "4px 8px 4px",
                paddingLeft: `${24 + level * 16}px`,
              }}
            >
              <Text size="xs" color="#999">
                No pages inside
              </Text>
            </Box>
          )}
      </Box>
    );
  }
);

const Sidebar: React.FC<SidebarProps> = observer(({ isOpen }) => {
  const { pageStore, uiStore, authStore, workspaceStore, searchStore } =
    useStore();

  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchMode, setSearchMode] = useState<"simple" | "advanced">("simple");

  // Debounced search query with 500ms delay for advanced search
  const [debouncedQuery] = useDebouncedValue(searchStore.query, 500);

  // Watch for search focus trigger from keyboard shortcut
  useEffect(() => {
    if (uiStore.searchFocusTrigger > 0) {
      setShowSearchInput(true);
      setSearchMode("simple");
      uiStore.setSearchQuery("");
      searchStore.clearSearch();
    }
  }, [uiStore.searchFocusTrigger, uiStore, searchStore]);

  // Fetch pages for the selected workspace
  useQuery({
    queryKey: ["pages", workspaceStore.selectedWorkspace?.id],
    queryFn: async () => {
      if (!workspaceStore.selectedWorkspace?.id) {
        return [];
      }
      return await pageStore.fetchPagesForWorkspace(
        workspaceStore.selectedWorkspace.id
      );
    },
    enabled: !!workspaceStore.selectedWorkspace?.id,
  });

  const createPageMutation = useMutation({
    mutationFn: async (parentId?: string) => {
      if (!workspaceStore.selectedWorkspace?.id) {
        throw new Error("No workspace selected");
      }
      return await pageStore.createNewPage(
        workspaceStore.selectedWorkspace.id,
        parentId
      );
    },
    onSuccess: () => {
      pageStore.queryClient.invalidateQueries({
        queryKey: ["pages", workspaceStore.selectedWorkspace?.id],
      });
    },
  });

  const duplicatePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      return await pageStore.duplicatePage(pageId);
    },
    onSuccess: () => {
      pageStore.queryClient.invalidateQueries({
        queryKey: ["pages", workspaceStore.selectedWorkspace?.id],
      });
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      return await pageStore.deletePage(pageId);
    },
    onSuccess: () => {
      pageStore.queryClient.invalidateQueries({
        queryKey: ["pages", workspaceStore.selectedWorkspace?.id],
      });
    },
  });

  const restorePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      return await pageStore.restorePage(pageId);
    },
    onSuccess: () => {
      pageStore.queryClient.invalidateQueries({
        queryKey: ["pages", workspaceStore.selectedWorkspace?.id],
      });
    },
  });

  const handlePageSelect = (page: Page) => {
    pageStore.selectPage(page);
    setSearchMode("simple");
    setShowSearchInput(false);
    searchStore.clearSearch();
  };

  const handlePageSelectFromSearch = (pageId: string) => {
    const page = searchStore.results.find((r) => r.id === pageId);
    if (page) {
      // Convert SearchResult to Page format
      const pageData: Page = {
        id: page.id,
        title: page.title,
        user_id: "", // Will be populated by backend
        workspace_id: workspaceStore.selectedWorkspace?.id || "",
        content: page.content as Page["content"],
        icon_url: page.icon_url,
        cover_url: page.cover_url,
        created_at: page.created_at,
        updated_at: page.updated_at,
        summary: page.summary,
        tags: page.tags,
        parent_id: page.parent_id,
      };
      pageStore.selectPage(pageData);
      setSearchMode("simple");
      setShowSearchInput(false);
      searchStore.clearSearch();
    }
  };

  const handleCreatePage = () => {
    if (!workspaceStore.selectedWorkspace?.id) {
      // TODO: Show notification that workspace is required
      return;
    }
    createPageMutation.mutate(undefined);
  };

  const handleCreateSubPage = (parentId: string) => {
    if (!workspaceStore.selectedWorkspace?.id) {
      return;
    }
    createPageMutation.mutate(parentId);
  };

  const handleDuplicatePage = (pageId: string) => {
    duplicatePageMutation.mutate(pageId);
  };

  const handleMovePage = (pageId: string) => {
    // TODO: Implement move page modal/selector
    console.log("Move page:", pageId);
  };

  const handleDeletePage = (pageId: string) => {
    deletePageMutation.mutate(pageId);
  };

  const handleRestorePage = (pageId: string) => {
    restorePageMutation.mutate(pageId);
  };

  const handleSearchClick = () => {
    setShowSearchInput(true);
    setSearchMode("simple");
    uiStore.setSearchQuery("");
    searchStore.clearSearch();
  };

  const handleSimpleSearchChange = (value: string) => {
    uiStore.setSearchQuery(value);
    // Also update search store for unified search
    searchStore.setQuery(value);
  };

  const handleAdvancedSearchChange = (value: string) => {
    searchStore.setQuery(value);
  };

  // Effect to trigger search when debounced query changes (unified approach)
  useEffect(() => {
    if (workspaceStore.selectedWorkspace?.id) {
      // Always use search store for consistency
      searchStore.performSearch(workspaceStore.selectedWorkspace.id);
    }
  }, [debouncedQuery, workspaceStore.selectedWorkspace?.id, searchStore]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (searchMode === "advanced") {
        searchStore.clearSearch();
        setSearchMode("simple");
      } else {
        uiStore.setSearchQuery("");
        searchStore.setQuery("");
        setShowSearchInput(false);
      }
    } else if (e.key === "Enter" && searchStore.query.trim()) {
      if (workspaceStore.selectedWorkspace?.id) {
        searchStore.performSearch(workspaceStore.selectedWorkspace.id);
      }
    }
  };

  // Check if we should be in advanced mode (when there are active search filters)
  const hasActiveSearchFilters =
    searchStore.filters.searchBehavior !== "simple" ||
    !searchStore.filters.searchIn.pageName ||
    !searchStore.filters.searchIn.subPageName ||
    !searchStore.filters.searchIn.pageContent;

  // Check for filter-by filters (work without query)
  const hasFilterByFilters =
    searchStore.filters.metadata.tags.length > 0 ||
    searchStore.filters.metadata.workspaceType !== "all";

  // Auto-switch to advanced mode only when search filters are active (not filter-by filters)
  useEffect(() => {
    if (hasActiveSearchFilters && searchMode === "simple") {
      setSearchMode("advanced");
      setShowSearchInput(true);
    }
  }, [hasActiveSearchFilters, searchMode]);

  // Get filtered pages based on search and current view
  const getDisplayPages = () => {
    if (uiStore.sidebarView === "trash") {
      return pageStore.trashedPages;
    }

    // If we have search results or are loading, return empty to show SearchResults component
    if (
      searchStore.results.length > 0 ||
      searchStore.loading ||
      searchStore.query.trim() ||
      hasFilterByFilters
    ) {
      return [];
    }

    return pageStore.getPageTree();
  };

  const displayPages = getDisplayPages();

  // Get user email from authStore
  const userEmail = authStore.user?.email || "User";

  if (!isOpen) {
    return (
      <Box
        style={{
          width: "0px",
          height: "100vh",
          transition: "width 0.2s ease",
          overflow: "hidden",
        }}
      />
    );
  }

  const sidebarStyles = `
    .add-subpage-btn {
      opacity: 0 !important;
    }
    .page-item:hover .add-subpage-btn {
      opacity: 1 !important;
    }
    .page-options-btn {
      opacity: 0 !important;
    }
    .page-item:hover .page-options-btn {
      opacity: 1 !important;
    }
  `;

  return (
    <>
      <style>{sidebarStyles}</style>
      <Box
        style={{
          height: "100vh",
          backgroundColor: "white",
          // borderRight: "1px solid #e5e5e5",
          position: "relative",
          transition: "all 0.2s ease",
          minWidth: "240px",
          overflowX: "hidden",
          width: "100%",
        }}
      >
        {/* Sidebar Content */}
        <Box
          style={{
            height: "100%",
            padding: "12px 8px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Workspace Selector */}
          <WorkspaceSelector userEmail={userEmail} />

          {/* Search Bar */}
          <Box mb="sm">
            <Box style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              {showSearchInput ? (
                <TextInput
                  placeholder={
                    searchMode === "advanced"
                      ? "Advanced search..."
                      : "Search pages..."
                  }
                  value={
                    searchMode === "advanced"
                      ? searchStore.query
                      : uiStore.searchQuery
                  }
                  onChange={(e) =>
                    searchMode === "advanced"
                      ? handleAdvancedSearchChange(e.target.value)
                      : handleSimpleSearchChange(e.target.value)
                  }
                  icon={<FontAwesomeIcon icon={faSearch} size="sm" />}
                  size="sm"
                  autoFocus
                  onBlur={() => {
                    if (
                      searchMode === "simple" &&
                      !uiStore.searchQuery.trim()
                    ) {
                      setShowSearchInput(false);
                    }
                  }}
                  onKeyDown={handleSearchKeyDown}
                  style={{ flex: 1 }}
                />
              ) : (
                <Box
                  onClick={handleSearchClick}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                    flex: 1,
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f8f9fa")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  <FontAwesomeIcon icon={faSearch} size="sm" color="#666" />
                  <Text size="sm" color="#666">
                    Search
                  </Text>
                  <Box style={{ marginLeft: "auto" }}>
                    <Text size="xs" color="#999">
                      ⌘ K
                    </Text>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          {/* Search Filter Tree */}
          {workspaceStore.selectedWorkspace && (
            <Box mb="sm">
              <SearchFilterTree
                workspaceId={workspaceStore.selectedWorkspace.id}
              />
            </Box>
          )}

          {/* Filter By Tree */}
          {workspaceStore.selectedWorkspace && (
            <Box mb="sm">
              <FilterByTree workspaceId={workspaceStore.selectedWorkspace.id} />
            </Box>
          )}

          {/* New Page */}
          <Box mb="sm">
            <Box
              onClick={handleCreatePage}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                borderRadius: "4px",
                cursor: workspaceStore.selectedWorkspace
                  ? "pointer"
                  : "not-allowed",
                transition: "background-color 0.15s ease",
                opacity: workspaceStore.selectedWorkspace ? 1 : 0.5,
              }}
              onMouseEnter={(e) => {
                if (workspaceStore.selectedWorkspace) {
                  e.currentTarget.style.backgroundColor = "#f8f9fa";
                }
              }}
              onMouseLeave={(e) => {
                if (workspaceStore.selectedWorkspace) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <FontAwesomeIcon icon={faPlus} size="sm" color="#666" />
              <Text size="sm" color="#666">
                New page
              </Text>
            </Box>
          </Box>

          {/* Main Content Area */}
          <Box
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {!workspaceStore.selectedWorkspace ? (
              <Box
                style={{
                  padding: "20px 8px",
                  textAlign: "center",
                  color: "#999",
                }}
              >
                <Text size="sm">Select a workspace to view pages</Text>
              </Box>
            ) : (searchStore.query.trim() || hasFilterByFilters) &&
              (searchStore.results.length > 0 || searchStore.loading) ? (
              // Show search results for search queries or filter-by results
              <Box style={{ flex: 1, overflow: "hidden" }}>
                <ScrollArea style={{ height: "100%" }}>
                  <Box style={{ padding: "8px" }}>
                    <SearchResults
                      workspaceId={workspaceStore.selectedWorkspace.id}
                      onPageSelect={handlePageSelectFromSearch}
                    />
                  </Box>
                </ScrollArea>
              </Box>
            ) : (
              // Regular page tree view with proper overflow
              <Box style={{ flex: 1, overflow: "hidden" }}>
                <ScrollArea style={{ height: "100%" }}>
                  {uiStore.sidebarView === "pages" && (
                    <>
                      {displayPages.length === 0 ? (
                        <Box
                          style={{
                            padding: "20px 8px",
                            textAlign: "center",
                            color: "#999",
                          }}
                        >
                          <Text size="sm">
                            {searchStore.query.trim() || hasFilterByFilters
                              ? "No pages found"
                              : "No pages yet"}
                          </Text>
                        </Box>
                      ) : (
                        // Regular page tree view
                        displayPages.map((page) => (
                          <PageTreeItem
                            key={page.id}
                            page={page}
                            level={0}
                            onPageSelect={handlePageSelect}
                            onCreateSubPage={handleCreateSubPage}
                            onDuplicatePage={handleDuplicatePage}
                            onMovePage={handleMovePage}
                            onDeletePage={handleDeletePage}
                            selectedPageId={pageStore.selectedPage?.id}
                            maxLevel={1}
                          />
                        ))
                      )}
                    </>
                  )}

                  {uiStore.sidebarView === "trash" && (
                    <>
                      {pageStore.trashedPages.length === 0 ? (
                        <Box
                          style={{
                            padding: "20px 8px",
                            textAlign: "center",
                            color: "#999",
                          }}
                        >
                          <Text size="sm">Trash is empty</Text>
                        </Box>
                      ) : (
                        // Trash view
                        pageStore.trashedPages.map((page) => (
                          <Box
                            key={page.id}
                            style={{
                              padding: "6px 8px",
                              borderRadius: "4px",
                              marginBottom: "2px",
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              cursor: "pointer",
                              transition: "background-color 0.15s ease",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "#f8f9fa")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.backgroundColor =
                                "transparent")
                            }
                          >
                            <FontAwesomeIcon
                              icon={faTrash}
                              size="sm"
                              color="#999"
                            />
                            <Text
                              size="sm"
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                color: "#999",
                              }}
                            >
                              {page.title || "Untitled"}
                            </Text>
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRestorePage(page.id);
                              }}
                              style={{ color: "#666" }}
                              title="Restore page"
                            >
                              <FontAwesomeIcon
                                icon={faTrashRestore}
                                size="xs"
                              />
                            </ActionIcon>
                          </Box>
                        ))
                      )}
                    </>
                  )}
                </ScrollArea>
              </Box>
            )}
          </Box>

          {/* Bottom Section - Fixed at bottom */}
          <Box style={{ marginTop: "auto", paddingTop: "8px" }}>
            {/* Trash */}
            <Box style={{ marginBottom: "8px" }}>
              <Box
                onClick={() =>
                  uiStore.setSidebarView(
                    uiStore.sidebarView === "trash" ? "pages" : "trash"
                  )
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                  backgroundColor:
                    uiStore.sidebarView === "trash" ? "#f5f5f5" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (uiStore.sidebarView !== "trash") {
                    e.currentTarget.style.backgroundColor = "#f8f9fa";
                  }
                }}
                onMouseLeave={(e) => {
                  if (uiStore.sidebarView !== "trash") {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                <FontAwesomeIcon icon={faTrash} size="sm" color="#666" />
                <Text size="sm" color="#666">
                  Trash
                </Text>
              </Box>
            </Box>

            {/* Settings */}
            <Box>
              <Box
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#f8f9fa")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <FontAwesomeIcon icon={faCog} size="sm" color="#666" />
                <Text size="sm" color="#666">
                  Settings
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
});

export default Sidebar;

import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import {
  Box,
  Text,
  ActionIcon,
  Menu,
  TextInput,
  Button,
  Loader,
  Popover,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronDown,
  faPlus,
  faEdit,
  faTrash,
  faBuilding,
  faSignOutAlt,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { useStore } from "../../hooks/use-store";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Workspace } from "../../stores/workspace-store";

interface WorkspaceSelectorProps {
  userEmail: string;
}

const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = observer(
  ({ userEmail }) => {
    const { workspaceStore, authStore, pageStore } = useStore();
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [newWorkspaceName, setNewWorkspaceName] = useState("");
    const [editWorkspaceName, setEditWorkspaceName] = useState("");
    const [userPopoverOpen, setUserPopoverOpen] = useState(false);

    // Fetch workspaces
    const { data: workspaces = [], isLoading } = useQuery({
      queryKey: ["workspaces"],
      queryFn: async () => {
        return await workspaceStore.fetchWorkspaces();
      },
    });

    // Create workspace mutation
    const createWorkspaceMutation = useMutation({
      mutationFn: async (name: string) => {
        return await workspaceStore.createWorkspace(name);
      },
      onSuccess: () => {
        setIsCreating(false);
        setNewWorkspaceName("");
        // Refetch workspaces
        workspaceStore.queryClient.invalidateQueries({
          queryKey: ["workspaces"],
        });
      },
    });

    // Update workspace mutation
    const updateWorkspaceMutation = useMutation({
      mutationFn: async ({ id, name }: { id: string; name: string }) => {
        return await workspaceStore.updateWorkspace(id, name);
      },
      onSuccess: () => {
        setIsEditing(null);
        setEditWorkspaceName("");
        workspaceStore.queryClient.invalidateQueries({
          queryKey: ["workspaces"],
        });
      },
    });

    // Delete workspace mutation
    const deleteWorkspaceMutation = useMutation({
      mutationFn: async (id: string) => {
        return await workspaceStore.deleteWorkspace(id);
      },
      onSuccess: () => {
        workspaceStore.queryClient.invalidateQueries({
          queryKey: ["workspaces"],
        });
      },
    });

    const handleCreateWorkspace = () => {
      if (newWorkspaceName.trim()) {
        createWorkspaceMutation.mutate(newWorkspaceName.trim());
      }
    };

    const handleUpdateWorkspace = (id: string) => {
      if (editWorkspaceName.trim()) {
        updateWorkspaceMutation.mutate({ id, name: editWorkspaceName.trim() });
      }
    };

    const handleDeleteWorkspace = (id: string) => {
      if (
        confirm(
          "Are you sure you want to delete this workspace? This action cannot be undone."
        )
      ) {
        deleteWorkspaceMutation.mutate(id);
      }
    };

    const handleWorkspaceSelect = (workspace: Workspace) => {
      workspaceStore.selectWorkspace(workspace);
      pageStore.setSelectedPageAsNull();
    };

    const handleLogout = async () => {
      await authStore.signOut();
      setUserPopoverOpen(false);
    };

    const selectedWorkspace = workspaceStore.selectedWorkspace;
    const displayName = userEmail;

    if (isLoading) {
      return (
        <Box
          style={{
            padding: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Loader size="sm" />
          <Text size="sm">Loading workspaces...</Text>
        </Box>
      );
    }

    return (
      <Box style={{ marginBottom: "12px" }}>
        {/* User info with logout popover */}
        <Popover
          width={"target"}
          position="bottom-start"
          withArrow
          shadow="md"
          opened={userPopoverOpen}
          onChange={setUserPopoverOpen}
          zIndex={1002}
        >
          <Popover.Target>
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                marginBottom: "8px",
                fontSize: "12px",
                color: "#666",
                width: "100%",
                cursor: "pointer",
                borderRadius: "4px",
                transition: "background-color 0.15s ease",
                position: "relative",
                zIndex: 1,
              }}
              onClick={() => setUserPopoverOpen(!userPopoverOpen)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#f8f9fa")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              <FontAwesomeIcon icon={faUser} size="sm" color="#666" />
              <Text
                size="sm"
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginRight: "8px",
                }}
                color="#666"
              >
                {displayName}
              </Text>
              <FontAwesomeIcon icon={faChevronDown} size="xs" color="#666" />
            </Box>
          </Popover.Target>
          <Popover.Dropdown>
            <Box style={{ padding: "4px" }}>
              <Button
                variant="white"
                size="sm"
                color="dark"
                fullWidth
                leftIcon={<FontAwesomeIcon icon={faSignOutAlt} size="sm" />}
                onClick={handleLogout}
                style={{ justifyContent: "flex-start" }}
              >
                Log out
              </Button>
            </Box>
          </Popover.Dropdown>
        </Popover>

        {/* Workspace Selector and Add Button */}
        <Box style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Workspace Selector */}
          <Menu
            shadow="md"
            width={"target"}
            position="bottom-start"
            closeOnClickOutside={true}
          >
            <Menu.Target>
              <Box
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                  border: "1px solid #e5e5e5",
                  flex: 1,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#f8f9fa")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                <FontAwesomeIcon icon={faBuilding} size="sm" color="#666" />
                <Text
                  size="sm"
                  weight={500}
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {selectedWorkspace?.name || "Select Workspace"}
                </Text>
                <FontAwesomeIcon icon={faChevronDown} size="xs" color="#666" />
              </Box>
            </Menu.Target>

            <Menu.Dropdown>
              {/* Existing Workspaces */}
              {workspaces.map((workspace) => (
                <Box key={workspace.id}>
                  {isEditing === workspace.id ? (
                    <Box
                      style={{ padding: "8px" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <TextInput
                        value={editWorkspaceName}
                        onChange={(e) => setEditWorkspaceName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUpdateWorkspace(workspace.id);
                          } else if (e.key === "Escape") {
                            setIsEditing(null);
                            setEditWorkspaceName("");
                          }
                        }}
                        size="sm"
                        autoFocus
                      />
                      <Box
                        style={{
                          display: "flex",
                          gap: "4px",
                          marginTop: "4px",
                          justifyContent: "flex-end",
                        }}
                      >
                        <Button
                          size="xs"
                          color="dark"
                          variant="filled"
                          onClick={() => {
                            handleUpdateWorkspace(workspace.id);
                            pageStore.setSelectedPageAsNull();
                          }}
                          loading={updateWorkspaceMutation.isLoading}
                        >
                          Save
                        </Button>
                        <Button
                          color="dark"
                          size="xs"
                          variant="subtle"
                          onClick={() => {
                            setIsEditing(null);
                            setEditWorkspaceName("");
                          }}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Menu.Item
                      onClick={() => handleWorkspaceSelect(workspace)}
                      style={{
                        backgroundColor:
                          selectedWorkspace?.id === workspace.id
                            ? "#f5f5f5"
                            : "transparent",
                      }}
                    >
                      <Box
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <Text
                          size="sm"
                          weight={
                            selectedWorkspace?.id === workspace.id ? 600 : 400
                          }
                        >
                          {workspace.name}
                        </Text>
                        <Box style={{ display: "flex", gap: "4px" }}>
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsEditing(workspace.id);
                              setEditWorkspaceName(workspace.name);
                            }}
                            title="Edit workspace"
                          >
                            <FontAwesomeIcon icon={faEdit} size="xs" />
                          </ActionIcon>
                          {workspaces.length > 1 && (
                            <ActionIcon
                              size="xs"
                              variant="subtle"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteWorkspace(workspace.id);
                              }}
                              title="Delete workspace"
                              color="red"
                            >
                              <FontAwesomeIcon icon={faTrash} size="xs" />
                            </ActionIcon>
                          )}
                        </Box>
                      </Box>
                    </Menu.Item>
                  )}
                </Box>
              ))}
            </Menu.Dropdown>
          </Menu>

          {/* Add Workspace Button with Popover */}
          <Popover
            width={250}
            position="bottom-end"
            withArrow
            shadow="md"
            opened={isCreating}
            onChange={setIsCreating}
          >
            <Popover.Target>
              <ActionIcon
                size="lg"
                variant="subtle"
                onClick={() => setIsCreating(true)}
                title="Add workspace"
                style={{
                  border: "1px solid #e5e5e5",
                  borderRadius: "4px",
                }}
              >
                <FontAwesomeIcon icon={faPlus} size="sm" />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown>
              <Box style={{ padding: "4px" }}>
                <Text size="sm" weight={500} style={{ marginBottom: "8px" }}>
                  Create New Workspace
                </Text>
                <TextInput
                  placeholder="Workspace name"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateWorkspace();
                    } else if (e.key === "Escape") {
                      setIsCreating(false);
                      setNewWorkspaceName("");
                    }
                  }}
                  size="sm"
                  autoFocus
                  style={{ marginBottom: "8px" }}
                />
                <Box
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button
                    size="xs"
                    color="dark"
                    variant="subtle"
                    onClick={() => {
                      setIsCreating(false);
                      setNewWorkspaceName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="xs"
                    color="dark"
                    variant="filled"
                    onClick={handleCreateWorkspace}
                    loading={createWorkspaceMutation.isLoading}
                    disabled={!newWorkspaceName.trim()}
                  >
                    Create
                  </Button>
                </Box>
              </Box>
            </Popover.Dropdown>
          </Popover>
        </Box>
      </Box>
    );
  }
);

export default WorkspaceSelector;

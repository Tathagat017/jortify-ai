import React from "react";
import { Box, Text, Group, ActionIcon, Menu } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisH,
  faShare,
  faCodeMerge,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { observer } from "mobx-react-lite";
import { useStore } from "../../hooks/use-store";
import PageTags from "../ai/tags/PageTags";
import TagActions from "../ai/tags/TagActions";
import KnowledgeGraphModal from "../graph/KnowledgeGraphModal";

const TitleBar: React.FC = observer(() => {
  const { pageStore, workspaceStore, graphViewStore } = useStore();
  const selectedPage = pageStore.selectedPage;
  let workspaceName = "Your workspace";
  if (selectedPage) {
    workspaceName = workspaceStore.workspaceName;
  }

  const handleGraphClick = () => {
    if (selectedPage) {
      graphViewStore.openModal();
    }
  };

  return (
    <>
      <Box
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #e9ecef",
          backgroundColor: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Workspace > Page Hierarchy */}
        <Group spacing="xs">
          <Text size="sm" color="dimmed">
            {workspaceName}
          </Text>
          <Text size="sm" color="dimmed">
            /
          </Text>
          <Text size="sm" weight={500}>
            {selectedPage ? selectedPage?.title : "Untitled"}
          </Text>

          {/* Page Tags */}
          {selectedPage && workspaceStore.selectedWorkspace && (
            <PageTags
              pageId={selectedPage.id}
              workspaceId={workspaceStore.selectedWorkspace.id}
              size="xs"
            />
          )}
        </Group>

        {/* Actions */}
        <Group spacing="xs">
          {/* Tag Actions - positioned left of share icon */}
          {selectedPage && workspaceStore.selectedWorkspace && (
            <TagActions
              pageId={selectedPage.id}
              workspaceId={workspaceStore.selectedWorkspace.id}
              size="sm"
            />
          )}

          <ActionIcon variant="subtle" size="sm">
            <FontAwesomeIcon icon={faShare} />
          </ActionIcon>

          {/* Knowledge Graph Icon - replaces the favorite star */}
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleGraphClick}
            disabled={!selectedPage}
            title="View Knowledge Graph"
          >
            <FontAwesomeIcon icon={faCodeMerge} />
          </ActionIcon>

          <Menu position="bottom-end" shadow="md">
            <Menu.Target>
              <ActionIcon variant="subtle" size="sm">
                <FontAwesomeIcon icon={faEllipsisH} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                icon={<FontAwesomeIcon icon={faTrash} />}
                color="red"
                onClick={() => {
                  // TODO: Implement page deletion
                  console.log("Delete page");
                }}
              >
                Delete page
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Box>

      {/* Knowledge Graph Modal */}
      <KnowledgeGraphModal />
    </>
  );
});

export default TitleBar;

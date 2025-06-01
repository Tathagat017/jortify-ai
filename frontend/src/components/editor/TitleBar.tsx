import React from "react";
import { Box, Text, Group, ActionIcon, Menu } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEllipsisH,
  faShare,
  faStar,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { observer } from "mobx-react-lite";
import { useStore } from "../../hooks/use-store";

const TitleBar: React.FC = observer(() => {
  const { pageStore } = useStore();
  const selectedPage = pageStore.selectedPage;
  let workspaceName = "Your workspace";
  if (selectedPage) {
    workspaceName = pageStore.getWorkspaceNameForPage(selectedPage.id);
  }
  return (
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
      </Group>

      {/* Actions */}
      <Group spacing="xs">
        <ActionIcon variant="subtle" size="sm">
          <FontAwesomeIcon icon={faShare} />
        </ActionIcon>
        <ActionIcon variant="subtle" size="sm">
          <FontAwesomeIcon icon={faStar} />
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
  );
});

export default TitleBar;

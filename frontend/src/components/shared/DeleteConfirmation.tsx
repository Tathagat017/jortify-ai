import { useState } from "react";
import {
  Popover,
  Button,
  Group,
  Text,
  Stack,
  ActionIcon,
  Loader,
} from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";

interface DeleteConfirmationProps {
  onConfirm: () => Promise<void>;
  itemName?: string;
  buttonSize?: "xs" | "sm" | "md" | "lg" | "xl";
  buttonVariant?: "subtle" | "filled" | "outline" | "light" | "default";
  buttonColor?: string;
  iconColor?: string;
  position?: "top" | "bottom" | "left" | "right";
  width?: number;
}

export const DeleteConfirmation = ({
  onConfirm,
  itemName = "this item",
  buttonSize = "xs",
  buttonVariant = "subtle",
  buttonColor = "dark",
  iconColor = "#DC3545",
  position = "top",
  width = 250,
}: DeleteConfirmationProps) => {
  const [opened, setOpened] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    console.log(
      `🗑️ STEP: Delete confirmation - User confirmed deletion of ${itemName}`
    );
    setIsDeleting(true);
    try {
      await onConfirm();
      
      setOpened(false);
    } catch (error) {
      console.error(
        `❌ STEP: Delete failed - Error deleting ${itemName}:`,
        error
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    console.log(
      `❌ STEP: Delete cancelled - User cancelled deletion of ${itemName}`
    );
    setOpened(false);
  };

  return (
    <Popover
      width={width}
      position={position}
      withArrow
      shadow="md"
      opened={opened}
      onChange={setOpened}
    >
      <Popover.Target>
        <ActionIcon
          size={buttonSize}
          color={buttonColor}
          variant={buttonVariant}
          onClick={(e) => {
            e.stopPropagation();
            setOpened((o) => !o);
          }}
          disabled={isDeleting}
          style={{ position: "relative" }}
        >
          {isDeleting ? (
            <Loader size="xs" color={iconColor} />
          ) : (
            <FontAwesomeIcon icon={faTrash} style={{ color: iconColor }} />
          )}
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown
        style={{
          backgroundColor: "#fff",
          border: "1px solid #000",
        }}
      >
        <Stack spacing="sm">
          <Group spacing="xs">
            <FontAwesomeIcon
              icon={faExclamationTriangle}
              style={{ color: "#FFA500" }}
            />
            <Text size="sm" weight={600}>
              Delete {itemName}?
            </Text>
          </Group>

          <Text size="xs" color="dimmed">
            This action cannot be undone.
          </Text>

          <Group position="right" spacing="xs">
            <Button
              size="xs"
              variant="outline"
              color="gray"
              onClick={handleCancel}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              color="red"
              onClick={handleConfirm}
              loading={isDeleting}
              leftIcon={!isDeleting && <FontAwesomeIcon icon={faTrash} />}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};

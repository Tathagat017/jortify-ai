import { Modal as MantineModal, Text } from "@mantine/core";
import React from "react";

interface ModalProps {
  opened: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: string | number;
}

export const Modal: React.FC<ModalProps> = ({
  opened,
  onClose,
  title,
  children,
  size = "md",
}) => (
  <MantineModal
    opened={opened}
    onClose={onClose}
    title={
      <Text size="xl" weight={700} align="left" mb={2}>
        {title}
      </Text>
    }
    size={size}
    centered
  >
    {children}
  </MantineModal>
);

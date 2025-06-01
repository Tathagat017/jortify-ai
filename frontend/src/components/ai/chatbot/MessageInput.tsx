import React, { useState, KeyboardEvent } from "react";
import { TextInput, ActionIcon, Group, Loader } from "@mantine/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
}

const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  isLoading = false,
  placeholder = "Type your message...",
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (value.trim() && !disabled) {
      onSend(value.trim());
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <Group spacing="xs" style={{ width: "100%" }}>
      <TextInput
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyPress={handleKeyPress}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ flex: 1 }}
        styles={{
          input: {
            borderColor: isFocused ? "#999" : "#ddd",
            borderWidth: "1px",
            backgroundColor: "#fff",
            color: "#000",
            "&:focus": {
              borderColor: "#999",
            },
            "&::placeholder": {
              color: "#999",
            },
          },
        }}
        rightSection={
          isLoading ? (
            <Loader size="xs" color="dark" />
          ) : (
            <ActionIcon
              size="sm"
              color="dark"
              variant={canSend ? "filled" : "subtle"}
              onClick={handleSend}
              disabled={!canSend}
              style={{
                backgroundColor: canSend ? "#000" : "transparent",
                color: canSend ? "#fff" : "#999",
                border: canSend ? "none" : "1px solid #ccc",
              }}
            >
              <FontAwesomeIcon icon={faPaperPlane} size="sm" />
            </ActionIcon>
          )
        }
      />
    </Group>
  );
};

export default MessageInput;

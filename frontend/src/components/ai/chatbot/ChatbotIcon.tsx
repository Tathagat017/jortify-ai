import { faRobot } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ActionIcon } from "@mantine/core";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../hooks/use-store";

const ChatbotIcon = observer(() => {
  const { chatStore } = useStore();

  return (
    <ActionIcon
      size="xl"
      radius="xl"
      onClick={chatStore.openChat}
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 1000,
        backgroundColor: "#000",
        color: "#fff",
        border: "2px solid #000",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        transition: "all 0.3s ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#333";
        e.currentTarget.style.transform = "scale(1.1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "#000";
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      <FontAwesomeIcon
        icon={faRobot}
        size="lg"
        style={{
          color: "#fff",
          animation: chatStore.isTyping ? "pulse 1.5s infinite" : "none",
        }}
      />
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}
      </style>
    </ActionIcon>
  );
});

export default ChatbotIcon;

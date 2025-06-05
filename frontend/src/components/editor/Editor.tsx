/* eslint-disable @typescript-eslint/no-explicit-any */
import { Box } from "@mantine/core";
import { observer } from "mobx-react-lite";
import { useStore } from "../../hooks/use-store";
import BlockNoteEditorComponent from "./BlockNoteEditor";

const Editor = observer(() => {
  const { pageStore } = useStore();
  const selectedPage = pageStore.selectedPage;

  if (!selectedPage) {
    return (
      <Box
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9B9A97",
          fontSize: "16px",
          backgroundColor: "white",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        }}
      >
        <Box style={{ textAlign: "center" }}>
          <Box style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>
            📄
          </Box>
          <Box
            style={{ fontSize: "18px", fontWeight: 500, marginBottom: "8px" }}
          >
            Select a page to start editing
          </Box>
          <Box style={{ fontSize: "14px", opacity: 0.7 }}>
            Choose a page from the sidebar or create a new one
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box style={{ height: "100%", backgroundColor: "white" }}>
      <BlockNoteEditorComponent />
    </Box>
  );
});

export default Editor;

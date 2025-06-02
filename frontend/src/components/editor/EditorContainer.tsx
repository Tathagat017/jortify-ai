import { Box, Text, Loader } from "@mantine/core";
import { observer } from "mobx-react-lite";
import { useStore } from "../../hooks/use-store";
import BlockNoteEditorComponent from "./BlockNoteEditor";
import PageHeader from "./PageHeader";
import TitleBar from "./TitleBar";
import NoPageSelectedImage from "../../assets/no_page_selected.png";

const EditorContainer = observer(() => {
  const { pageStore, workspaceStore } = useStore();
  const selectedPage = pageStore.selectedPage;

  // Show loading state when workspace or pages are loading
  if (workspaceStore.loading || pageStore.loading) {
    return (
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <Loader size="lg" color="dark" />
        <Text size="sm" color="dimmed">
          {workspaceStore.loading ? "Loading workspace..." : "Loading pages..."}
        </Text>
      </Box>
    );
  }

  if (!selectedPage) {
    return (
      <Box
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <img
          src={NoPageSelectedImage}
          alt="No page selected"
          style={{
            width: "200px",
            height: "auto",
            opacity: 0.6,
          }}
        />
        <Text size="lg" weight={700} color="dimmed">
          No page selected yet
        </Text>
      </Box>
    );
  }

  return (
    <Box
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
        flex: 1,
      }}
    >
      {/* Title Bar */}
      <TitleBar />

      {/* Main Editor Area */}
      <Box
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Scrollable Content Area */}
        <Box
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 60px",

            margin: "0 auto",
            width: "100%",
          }}
        >
          {/* Page Header (Cover, Icon, Title) */}
          <PageHeader />

          {/* BlockNote Editor */}
          <BlockNoteEditorComponent />
        </Box>
      </Box>
    </Box>
  );
});

export default EditorContainer;

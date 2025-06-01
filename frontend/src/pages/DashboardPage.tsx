import { Box } from "@mantine/core";
import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";
import Split from "react-split";
import EditorContainer from "../components/editor/EditorContainer";
import Sidebar from "../components/sidebar/Sidebar";

import { useStore } from "../hooks/use-store";

const DashboardPage: React.FC = observer(() => {
  const { uiStore } = useStore();

  // Handle save function for TitleBar

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle ⌘K (Mac) or Ctrl+K (Windows/Linux) for search
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        uiStore.triggerSearchFocus();
      }

      // Handle Ctrl+S (Save)
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [uiStore]);

  // Simple thin gutter styling
  const gutterStyle = `
    .gutter {
      background-color: #e5e5e5;
      background-repeat: no-repeat;
      background-position: center;
    }
    
    .gutter.gutter-horizontal {
      cursor: col-resize;
      width: 1px;
      background-color: #e5e5e5;
    }
    
    .gutter:hover {
      background-color: #ccc;
    }
    
    .gutter:active {
      background-color: #999;
    }
  `;

  return (
    <>
      <style>{gutterStyle}</style>
      <Box
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {uiStore.sidebarOpen ? (
            <Split
              sizes={[30, 70]}
              direction="horizontal"
              style={{ height: "100%", display: "flex", flex: 1 }}
              onDragEnd={(sizes) => {
                // Update sidebar width in store
                const newWidth = (sizes[0] / 100) * window.innerWidth;
                uiStore.setSidebarWidth(newWidth);
              }}
            >
              {/* Sidebar */}
              <div style={{ height: "100%", overflow: "hidden" }}>
                <Sidebar isOpen={uiStore.sidebarOpen} />
              </div>

              {/* Editor Container */}
              <div
                style={{
                  height: "100%",
                  flex: 1,
                  overflow: "hidden",
                }}
              >
                <EditorContainer />
              </div>
            </Split>
          ) : (
            /* When sidebar is closed, editor takes full width */
            <Box style={{ height: "100%", display: "flex" }}>
              <Sidebar isOpen={false} />
              <Box style={{ flex: 1, overflow: "hidden" }}>
                <EditorContainer />
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
});

export default DashboardPage;

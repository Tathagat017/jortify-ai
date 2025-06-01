import React, { useEffect, useCallback, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import editorStore from "../../stores/editor-store";
import { useStore } from "../../hooks/use-store";
import type { PartialBlock } from "@blocknote/core";
// import { customSchema } from "./blocks/custom-schema";

const SAVE_DEBOUNCE_MS = 1000; // 1 second debounce

const BlockNoteEditorComponent = () => {
  const { pageStore } = useStore();
  const editor = useCreateBlockNote();
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Set the editor instance in the store on mount
  useEffect(() => {
    if (!editorStore.editor) {
      editorStore.setEditor(editor);
    }
  }, [editor]);

  // Handle content changes and save
  const handleContentChange = useCallback(async () => {
    if (!pageStore.selectedPage) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for saving
    saveTimeoutRef.current = setTimeout(async () => {
      await editorStore.save();
    }, SAVE_DEBOUNCE_MS);
  }, [pageStore.selectedPage]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Set initial content when page changes
  useEffect(() => {
    if (pageStore.selectedPage?.content && editor) {
      const content = pageStore.selectedPage.content as PartialBlock[];
      editor.replaceBlocks(editor.topLevelBlocks, content);
      // Update last saved content after setting initial content
      editorStore.setEditor(editor);
    }
  }, [pageStore.selectedPage, editor]);

  // Cleanup editor when component unmounts
  useEffect(() => {
    return () => {
      if (editorStore.editor === editor) {
        editorStore.setEditor(null);
      }
    };
  }, [editor]);

  return (
    <BlockNoteView
      editor={editor}
      theme={"light"}
      onChange={handleContentChange}
      editable={true}
    />
  );
};

export default BlockNoteEditorComponent;

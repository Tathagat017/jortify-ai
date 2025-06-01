import { useEffect, useCallback, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import editorStore from "../../stores/editor-store";
import { useStore } from "../../hooks/use-store";
import { UploadService } from "../../services/upload.service";
import { LinkSuggestion } from "../../services/ai.service";
import LinkSuggestionPopup from "../ai/auto-linking/LinkSuggestionPopup";
import type { PartialBlock } from "@blocknote/core";
// import { customSchema } from "./blocks/custom-schema";

const SAVE_DEBOUNCE_MS = 1000; // 1 second debounce

const BlockNoteEditorComponent = () => {
  const { pageStore, aiLinkStore, workspaceStore } = useStore();

  // Create editor with custom upload function
  const editor = useCreateBlockNote({
    uploadFile: async (file: File) => {
      try {
        if (!pageStore.selectedPage?.id) {
          throw new Error("No page selected");
        }

        // Upload the file using our upload service
        const url = await UploadService.uploadContentImage(
          file,
          pageStore.selectedPage.id
        );
        return url;
      } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
      }
    },
  });

  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Set the editor instance in the store on mount
  useEffect(() => {
    if (!editorStore.editor) {
      editorStore.setEditor(editor);
    }
  }, [editor]);

  // Get cursor position for popup placement
  const getCursorPosition = useCallback((): { x: number; y: number } => {
    try {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        return {
          x: rect.left || 100,
          y: rect.bottom || 100,
        };
      }
    } catch (error) {
      console.error("Error getting cursor position:", error);
    }

    // Fallback position
    return { x: 100, y: 100 };
  }, []);

  // Handle @link trigger detection
  const handleLinkTrigger = useCallback(
    (text: string) => {
      if (!workspaceStore.selectedWorkspace) return;

      // Check if text contains @link
      if (text.toLowerCase().includes("@link")) {
        const position = getCursorPosition();

        // Set current text for AI suggestions (extract context around @link)
        const linkIndex = text.toLowerCase().indexOf("@link");
        const contextStart = Math.max(0, linkIndex - 50);
        const contextEnd = Math.min(text.length, linkIndex + 50);
        const contextText = text.substring(contextStart, contextEnd);

        aiLinkStore.setCurrentText(contextText);

        // Trigger with page store
        aiLinkStore.handleLinkTrigger(
          workspaceStore.selectedWorkspace.id,
          pageStore.selectedPage?.id,
          position,
          pageStore // Pass the entire page store
        );
      }
    },
    [
      workspaceStore.selectedWorkspace,
      pageStore,
      aiLinkStore,
      getCursorPosition,
    ]
  );

  // Handle content changes and save
  const handleContentChange = useCallback(async () => {
    if (!pageStore.selectedPage || !workspaceStore.selectedWorkspace) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for saving
    saveTimeoutRef.current = setTimeout(async () => {
      await editorStore.save();
    }, SAVE_DEBOUNCE_MS);

    // Only check for @link triggers, no auto-suggestions
    try {
      // Get current text content from all blocks
      const blocks = editor.topLevelBlocks;
      const textContent = blocks
        .map((block) => {
          // Simple text extraction - just get the basic text content
          if (block.type === "paragraph" && block.content) {
            return JSON.stringify(block.content)
              .replace(/[{}"[\]]/g, " ")
              .trim();
          }
          return "";
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      // Only check for @link trigger
      handleLinkTrigger(textContent);
    } catch (error) {
      console.error("Error handling @link trigger:", error);
    }
  }, [
    pageStore.selectedPage,
    workspaceStore.selectedWorkspace,
    editor,
    handleLinkTrigger,
  ]);

  // Handle link acceptance
  const handleLinkAccept = useCallback(
    (
      item:
        | LinkSuggestion
        | {
            id: string;
            title: string;
            icon_url?: string;
            summary?: string | null;
          }
    ) => {
      if (!editor) return;

      try {
        const isLinkSuggestion = "pageId" in item;
        const pageId = isLinkSuggestion ? item.pageId : item.id;
        const pageTitle = isLinkSuggestion ? item.pageTitle : item.title;

        // Remove @link and insert the actual link
        removeAtLinkAndInsertLink(pageId, pageTitle);

        aiLinkStore.hideSuggestions();
      } catch (error) {
        console.error("Error inserting link:", error);
      }
    },
    [editor, aiLinkStore]
  );

  // Function to remove @link and insert actual link
  const removeAtLinkAndInsertLink = useCallback(
    (pageId: string, pageTitle: string) => {
      if (!editor) return;

      try {
        // Get current blocks
        const blocks = editor.topLevelBlocks;
        let linkInserted = false;

        // Find and replace @link with the actual link
        for (const block of blocks) {
          if (block.type === "paragraph" && block.content) {
            // Convert content to string to search for @link
            const contentStr = JSON.stringify(block.content);

            if (contentStr.toLowerCase().includes("@link")) {
              // Insert the link at current position
              editor.insertInlineContent([
                {
                  type: "link",
                  href: `/page/${pageId}`,
                  content: pageTitle,
                },
              ]);

              linkInserted = true;
              break;
            }
          }
        }

        // If no @link found in content, just insert at current position
        if (!linkInserted) {
          editor.insertInlineContent([
            {
              type: "link",
              href: `/page/${pageId}`,
              content: pageTitle,
            },
          ]);
        }

        // Remove any remaining @link text
        removeAtLinkText();
      } catch (error) {
        console.error("Error in removeAtLinkAndInsertLink:", error);
      }
    },
    [editor]
  );

  // Function to remove @link text from editor
  const removeAtLinkText = useCallback(() => {
    if (!editor) return;

    try {
      // Get the editor's Tiptap instance
      const tiptapEditor = editor._tiptapEditor;

      // Get current document content
      const doc = tiptapEditor.state.doc;
      const tr = tiptapEditor.state.tr;
      let hasChanges = false;

      // Search for @link text and remove it
      doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          const text = node.text;
          const linkRegex = /@link\b/gi; // Match @link as whole word, case insensitive
          let match;

          // Find all @link occurrences in reverse order to avoid position shifts
          const matches = [];
          while ((match = linkRegex.exec(text)) !== null) {
            matches.unshift({
              from: pos + match.index,
              to: pos + match.index + match[0].length,
            });
          }

          // Remove all @link occurrences
          matches.forEach(({ from, to }) => {
            tr.delete(from, to);
            hasChanges = true;
          });
        }
      });

      // Apply the transaction if there were changes
      if (hasChanges) {
        tiptapEditor.dispatch(tr);
      }
    } catch (error) {
      console.error("Error removing @link text:", error);

      // Fallback: try to remove @link using BlockNote's content manipulation
      try {
        const blocks = editor.topLevelBlocks;
        blocks.forEach((block) => {
          if (block.type === "paragraph" && block.content) {
            // Convert content to string and check for @link
            const contentStr = JSON.stringify(block.content);
            if (contentStr.toLowerCase().includes("@link")) {
              // Get the text content and remove @link
              const textContent = block.content
                .filter(
                  (item: { type?: string; text?: string }) =>
                    item.type === "text"
                )
                .map(
                  (item: { type?: string; text?: string }) => item.text || ""
                )
                .join("");

              const cleanedText = textContent.replace(/@link\b/gi, "").trim();

              if (cleanedText !== textContent) {
                // Update the block with cleaned content - use simple string format
                editor.updateBlock(block, {
                  type: "paragraph",
                  content: cleanedText || "",
                });
              }
            }
          }
        });
      } catch (fallbackError) {
        console.error("Fallback @link removal also failed:", fallbackError);
      }
    }
  }, [editor]);

  // Handle link rejection
  const handleLinkReject = useCallback(() => {
    aiLinkStore.hideSuggestions();
  }, [aiLinkStore]);

  // Handle clicking on links - navigate to page without opening new page
  const handleLinkClick = useCallback(
    (event: Event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a[href^="/page/"]');

      if (link) {
        event.preventDefault();
        event.stopPropagation();

        const href = link.getAttribute("href");
        if (href) {
          const pageId = href.replace("/page/", "");

          // Find the page in the store and select it (don't open new page)
          const targetPage = pageStore.pages.find((page) => page.id === pageId);
          if (targetPage) {
            pageStore.selectPage(targetPage);
          } else {
            // If page not found in current pages, try to load it
            pageStore.selectPageFromUrl(pageId);
          }
        }
      }
    },
    [pageStore]
  );

  // Add click listener for links
  useEffect(() => {
    const editorElement = document.querySelector(".bn-editor");
    if (editorElement) {
      editorElement.addEventListener("click", handleLinkClick, true); // Use capture phase
      return () => {
        editorElement.removeEventListener("click", handleLinkClick, true);
      };
    }
  }, [handleLinkClick]);

  // Listen for AI link acceptance events
  useEffect(() => {
    const handleAILinkAccepted = (event: CustomEvent) => {
      const { suggestion } = event.detail;
      handleLinkAccept(suggestion);
    };

    const handleAILinkCleanup = (event: CustomEvent) => {
      const { action } = event.detail;
      if (action === "remove-link-trigger") {
        // Remove @link text when popover closes
        removeAtLinkText();
      }
    };

    window.addEventListener(
      "ai-link-accepted",
      handleAILinkAccepted as EventListener
    );
    window.addEventListener(
      "ai-link-cleanup",
      handleAILinkCleanup as EventListener
    );

    return () => {
      window.removeEventListener(
        "ai-link-accepted",
        handleAILinkAccepted as EventListener
      );
      window.removeEventListener(
        "ai-link-cleanup",
        handleAILinkCleanup as EventListener
      );
    };
  }, [handleLinkAccept, removeAtLinkText]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      aiLinkStore.cleanup();
    };
  }, [aiLinkStore]);

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
    <div style={{ position: "relative" }}>
      <BlockNoteView
        editor={editor}
        theme={"light"}
        onChange={handleContentChange}
        editable={true}
      />

      {/* Link Suggestion Popup */}
      <LinkSuggestionPopup
        onAccept={handleLinkAccept}
        onReject={handleLinkReject}
      />
    </div>
  );
};

export default BlockNoteEditorComponent;

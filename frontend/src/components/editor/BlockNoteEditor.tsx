import { useEffect, useCallback, useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { filterSuggestionItems } from "@blocknote/core";
import "@blocknote/core/style.css";
import "@blocknote/mantine/style.css";
import editorStore from "../../stores/editor-store";
import { useStore } from "../../hooks/use-store";
import { UploadService } from "../../services/upload.service";
import { LinkSuggestion } from "../../services/ai.service";
import LinkSuggestionPopup from "../ai/auto-linking/LinkSuggestionPopup";
import AIMenuPopup from "../ai/editor-ai/AIMenuPopup";
import { createAISlashCommand } from "../ai/editor-ai/AISlashCommand";
import type { PartialBlock } from "@blocknote/core";
import { DocumentService } from "../../services/document.service";
import { notifications } from "@mantine/notifications";
// import { customSchema } from "./blocks/custom-schema";

const SAVE_DEBOUNCE_MS = 1000; // 1 second debounce

const BlockNoteEditorComponent = () => {
  const { pageStore, aiLinkStore, workspaceStore } = useStore();
  const [isAIMenuOpen, setIsAIMenuOpen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const previousPageIdRef = useRef<string | null>(null);

  // Create editor with custom upload function
  const editor = useCreateBlockNote({
    uploadFile: async (file: File) => {
      try {
        if (
          !pageStore.selectedPage?.id ||
          !workspaceStore.selectedWorkspace?.id
        ) {
          throw new Error("No page or workspace selected");
        }

        // Check if it's a document file
        const extension = file.name.split(".").pop()?.toLowerCase();
        if (extension && ["pdf", "docx"].includes(extension)) {
          // Validate file
          const validation = DocumentService.validateFile(file);
          if (!validation.valid) {
            notifications.show({
              title: "Invalid file",
              message: validation.error,
              color: "red",
            });
            throw new Error(validation.error);
          }

          // Upload document
          const response = await DocumentService.uploadDocument(
            file,
            pageStore.selectedPage.id,
            workspaceStore.selectedWorkspace.id
          );

          notifications.show({
            title: "Document uploaded",
            message: `${response.file_name} has been uploaded successfully`,
            color: "green",
          });

          // Return a special URL format for documents
          return `document://${response.id}/${response.file_name}`;
        } else {
          // Handle image uploads as before
          const url = await UploadService.uploadContentImage(
            file,
            pageStore.selectedPage.id
          );
          return url;
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
      }
    },
  });

  // Set the editor instance in the store on mount
  useEffect(() => {
    if (!editorStore.editor) {
      editorStore.setEditor(editor);
    }
  }, [editor]);

  // Handle AI suggestion acceptance
  const handleAISuggestionAccept = useCallback(
    (suggestion: string) => {
      if (!editor) return;

      try {
        // Get current cursor position
        const currentPosition = editor.getTextCursorPosition();
        const currentBlock = currentPosition.block;

        // Insert the AI suggestion as a new paragraph block at current position
        editor.insertBlocks(
          [
            {
              type: "paragraph",
              content: suggestion,
            },
          ],
          currentBlock,
          "after"
        );

        // Move cursor to the end of the newly inserted block
        setTimeout(() => {
          try {
            const blocks = editor.topLevelBlocks;
            const currentBlockIndex = blocks.findIndex(
              (block) => block.id === currentBlock.id
            );
            const insertedBlockIndex = currentBlockIndex + 1;
            if (blocks[insertedBlockIndex]) {
              editor.setTextCursorPosition(blocks[insertedBlockIndex], "end");
            }
          } catch (error) {
            
          }
        }, 10);
      } catch (error) {
        console.error("Error inserting AI suggestion:", error);
      }
    },
    [editor]
  );

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

        // IMPROVED: Extract much more context for better AI suggestions
        // Instead of just 100 characters, get the entire current block + surrounding blocks
        try {
          const blocks = editor.topLevelBlocks;
          let enhancedContext = "";
          let currentBlockIndex = -1;

          // Find the block containing @link
          for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];
            if (block.type === "paragraph" && block.content) {
              const blockText = JSON.stringify(block.content)
                .replace(/[{}"[\]]/g, " ")
                .trim();

              if (blockText.toLowerCase().includes("@link")) {
                currentBlockIndex = i;
                break;
              }
            }
          }

          if (currentBlockIndex !== -1) {
            // Get context: 2 blocks before + current block + 2 blocks after
            const contextStart = Math.max(0, currentBlockIndex - 2);
            const contextEnd = Math.min(blocks.length, currentBlockIndex + 3);

            for (let i = contextStart; i < contextEnd; i++) {
              const block = blocks[i];
              if (block.type === "paragraph" && block.content) {
                const blockText = JSON.stringify(block.content)
                  .replace(/[{}"[\]]/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();

                if (blockText) {
                  enhancedContext += blockText + "\n";
                }
              } else if (block.type === "heading" && block.content) {
                // Include headings for better context
                const headingText = JSON.stringify(block.content)
                  .replace(/[{}"[\]]/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();

                if (headingText) {
                  enhancedContext += "# " + headingText + "\n";
                }
              }
            }
          }

          // Fallback: if we couldn't find the block or get good context,
          // use a larger window around @link (500 characters instead of 100)
          if (!enhancedContext.trim()) {
            const linkIndex = text.toLowerCase().indexOf("@link");
            const contextStart = Math.max(0, linkIndex - 250);
            const contextEnd = Math.min(text.length, linkIndex + 250);
            enhancedContext = text.substring(contextStart, contextEnd);
          }

          // Ensure we have at least some meaningful context
          const finalContext =
            enhancedContext.trim() ||
            text.substring(0, Math.min(500, text.length));

          console.log("📝 Enhanced context for AI suggestions:", {
            originalTextLength: text.length,
            enhancedContextLength: finalContext.length,
            context: finalContext,
            blocksAnalyzed:
              currentBlockIndex !== -1
                ? `Block ${currentBlockIndex} + surrounding`
                : "Fallback text window",
          });

          aiLinkStore.setCurrentText(finalContext);
        } catch (error) {
          console.error("Error extracting enhanced context:", error);

          // Fallback to improved simple extraction (500 chars instead of 100)
          const linkIndex = text.toLowerCase().indexOf("@link");
          const contextStart = Math.max(0, linkIndex - 250);
          const contextEnd = Math.min(text.length, linkIndex + 250);
          const fallbackContext = text.substring(contextStart, contextEnd);

          console.log("📝 Using fallback context:", {
            contextLength: fallbackContext.length,
            context: fallbackContext,
          });

          aiLinkStore.setCurrentText(fallbackContext);
        }

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
      editor, // Add editor to dependencies
    ]
  );

  // Handle content changes and save
  const handleContentChange = useCallback(async () => {
    if (!pageStore.selectedPage || !workspaceStore.selectedWorkspace) return;

    // Get current text content from all blocks to check for "/ai"
    let textContent = "";
    try {
      const blocks = editor.topLevelBlocks;
      textContent = blocks
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
    } catch (error) {
      console.error("Error extracting text content:", error);
    }

    // Skip auto-save if "/ai" is present in the content
    const hasAICommand = textContent.toLowerCase().includes("/ai");

    if (!hasAICommand) {
      // Clear any existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for saving
      saveTimeoutRef.current = setTimeout(async () => {
        await editorStore.save();
      }, SAVE_DEBOUNCE_MS);
    }

    // Only check for @link triggers, no auto-suggestions
    try {
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

  // Add blur/focus listeners for auto-tag generation
  useEffect(() => {
    const editorElement = document.querySelector(".bn-editor");
    if (editorElement) {
      const handleBlur = () => {
        if (!pageStore.selectedPage || !workspaceStore.selectedWorkspace)
          return;

        // Trigger auto-tag generation with debouncing
        pageStore.handleEditorBlur(
          pageStore.selectedPage.id,
          workspaceStore.selectedWorkspace.id
        );
      };

      const handleFocus = () => {
        // Cancel any pending auto-tag generation when user starts editing again
        pageStore.cancelAutoTagGeneration();
      };

      editorElement.addEventListener("blur", handleBlur, true);
      editorElement.addEventListener("focus", handleFocus, true);

      return () => {
        editorElement.removeEventListener("blur", handleBlur, true);
        editorElement.removeEventListener("focus", handleFocus, true);
      };
    }
  }, [pageStore, workspaceStore]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Only replace content if it's actually different to avoid cursor jumps
      const currentBlocks = editor.topLevelBlocks;
      const newContent = pageStore.selectedPage.content as PartialBlock[];
      const currentPageId = pageStore.selectedPage.id;

      // Simple comparison - if lengths are different or page changed, update content
      const shouldUpdate =
        currentBlocks.length !== newContent.length ||
        currentPageId !== previousPageIdRef.current;

      if (shouldUpdate) {
        // Store current cursor position before replacing content
        let cursorPosition;
        try {
          cursorPosition = editor.getTextCursorPosition();
        } catch (error) {
          
        }

        editor.replaceBlocks(editor.topLevelBlocks, newContent);

        // Try to restore cursor position after a brief delay
        if (cursorPosition && newContent.length > 0) {
          setTimeout(() => {
            try {
              // Try to set cursor to the last block since we can't reliably restore exact position
              const blocks = editor.topLevelBlocks;
              if (blocks.length > 0) {
                // Set cursor to the end of the last block to avoid jumping to random positions
                editor.setTextCursorPosition(blocks[blocks.length - 1], "end");
              }
            } catch (error) {
              
            }
          }, 10);
        }

        // Update the previous page ID
        previousPageIdRef.current = currentPageId;
      }

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
        slashMenu={false}
      >
        {/* Custom Slash Menu with AI command */}
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const defaultItems = getDefaultReactSlashMenuItems(editor);
            const aiCommand = createAISlashCommand(editor, () =>
              setIsAIMenuOpen(true)
            );

            return filterSuggestionItems([...defaultItems, aiCommand], query);
          }}
        />
      </BlockNoteView>

      {/* Link Suggestion Popup */}
      <LinkSuggestionPopup
        onAccept={handleLinkAccept}
        onReject={handleLinkReject}
      />

      {/* AI Menu Popup */}
      <AIMenuPopup
        isOpen={isAIMenuOpen}
        onClose={() => setIsAIMenuOpen(false)}
        onSuggestionAccept={handleAISuggestionAccept}
      />
    </div>
  );
};

export default BlockNoteEditorComponent;

import { makeAutoObservable } from "mobx";
import { BlockNoteEditor } from "@blocknote/core";
import { store } from "./store-context-provider";

class EditorStore {
  editor: BlockNoteEditor | null = null;
  content: unknown = null;
  isSaving = false;
  error: string | null = null;
  lastSavedContent: unknown = null;
  isDirty = false;

  constructor() {
    makeAutoObservable(this);
  }

  setEditor(editor: BlockNoteEditor | null) {
    this.editor = editor;
    if (editor) {
      this.lastSavedContent = editor.topLevelBlocks;
      this.isDirty = false;
    }
  }

  setContent(content: unknown) {
    this.content = content;
  }

  async save() {
    if (!this.editor || !store.pageStore.selectedPage) return;

    this.isSaving = true;
    try {
      // Get current content
      const currentContent = this.editor.topLevelBlocks;

      // Only save if content has changed
      if (
        JSON.stringify(currentContent) !== JSON.stringify(this.lastSavedContent)
      ) {
        // Update page store with new content
        await store.pageStore.updatePageContent(
          store.pageStore.selectedPage.id,
          currentContent
        );

        // Update last saved content
        this.lastSavedContent = currentContent;
        this.isDirty = false;
        this.error = null;
      }
    } catch (e) {
      this.error = (e as Error).message || "Failed to save";
    } finally {
      this.isSaving = false;
    }
  }

  // Check if there are unsaved changes
  hasUnsavedChanges(): boolean {
    if (!this.editor || !this.lastSavedContent) return false;
    const hasChanges =
      JSON.stringify(this.editor.topLevelBlocks) !==
      JSON.stringify(this.lastSavedContent);
    this.isDirty = hasChanges;
    return hasChanges;
  }

  // Force save without checking for changes
  async forceSave() {
    if (!this.editor || !store.pageStore.selectedPage) return false;

    this.isSaving = true;
    try {
      const currentContent = this.editor.topLevelBlocks;
      await store.pageStore.updatePageContent(
        store.pageStore.selectedPage.id,
        currentContent
      );
      this.lastSavedContent = currentContent;
      this.isDirty = false;
      this.error = null;
      return true;
    } catch (e) {
      this.error = (e as Error).message || "Failed to save";
      return false;
    } finally {
      this.isSaving = false;
    }
  }
}

const editorStore = new EditorStore();
export default editorStore;

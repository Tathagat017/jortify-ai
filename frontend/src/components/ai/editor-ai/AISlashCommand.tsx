import { BlockNoteEditor } from "@blocknote/core";

export interface AISlashCommandItem {
  title: string;
  onItemClick: () => void;
  subtext?: string;
  aliases?: string[];
  group?: string;
  badge?: string;
}

export const createAISlashCommand = (
  _editor: BlockNoteEditor,
  onAIMenuOpen: () => void
): AISlashCommandItem => ({
  title: "AI Assistant",
  onItemClick: () => {
    onAIMenuOpen();
  },
  subtext: "Get AI help with writing, completion, and analysis",
  aliases: ["ai", "assistant", "help", "complete", "analyze", "suggest"],
  group: "AI",
  badge: "AI",
});

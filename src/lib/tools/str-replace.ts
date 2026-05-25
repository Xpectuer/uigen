import { z } from "zod";
import { VirtualFileSystem } from "@/lib/file-system";

const TextEditorParameters = z.object({
  command: z.enum(["view", "create", "str_replace", "insert", "undo_edit"]),
  path: z.string(),
  file_text: z.string().optional(),
  insert_line: z.number().optional(),
  new_str: z.string().optional(),
  old_str: z.string().optional(),
  view_range: z.array(z.number()).optional(),
});

export const buildStrReplaceTool = (fileSystem: VirtualFileSystem) => {
  return {
    id: "str_replace_editor" as const,
    args: {},
    parameters: TextEditorParameters,
    execute: async ({
      command,
      path,
      file_text,
      insert_line,
      new_str,
      old_str,
      view_range,
    }: z.infer<typeof TextEditorParameters>) => {
      switch (command) {
        case "view": {
          const content = fileSystem.viewFile(
            path,
            view_range as [number, number] | undefined
          );
          return { content, changed: false };
        }

        case "create": {
          const content = fileSystem.createFileWithParents(path, file_text || "");
          const changed = !content.startsWith("Error:");
          return { content, changed };
        }

        case "str_replace": {
          const content = fileSystem.replaceInFile(path, old_str || "", new_str || "");
          const changed = !content.startsWith("Error:");
          return { content, changed };
        }

        case "insert": {
          const content = fileSystem.insertInFile(path, insert_line || 0, new_str || "");
          const changed = !content.startsWith("Error:");
          return { content, changed };
        }

        case "undo_edit":
          return {
            content: `Error: undo_edit command is not supported in this version. Use str_replace to revert changes.`,
            changed: false,
          };
      }
    },
  };
};

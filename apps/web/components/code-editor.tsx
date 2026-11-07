"use client";
import Editor, { loader } from "@monaco-editor/react";
loader.config({ paths: { vs: "/monaco/vs" } });
export default function CodeEditor({
  value,
  language,
  readOnly,
  onChange,
  onCopy,
}: {
  value: string;
  language: string;
  readOnly: boolean;
  onChange: (s: string) => void;
  onCopy: (s: string) => void;
}) {
  return (
    <Editor
      height="360px"
      loading={<div className="editor-skeleton" role="status" aria-label="Загрузка редактора"><i/><i/><i/><i/><i/></div>}
      language={language === "cpp" ? "cpp" : "python"}
      value={value}
      theme="fairround"
      beforeMount={(monaco) => {
        monaco.editor.defineTheme("fairround", {
          base: "vs-dark",
          inherit: true,
          rules: [
            { token: "comment", foreground: "96928B" },
            { token: "keyword", foreground: "EEB581" },
            { token: "string", foreground: "B5CAAB" },
            { token: "number", foreground: "D9B99C" },
          ],
          colors: {
            "editor.background": "#17181A",
            "editor.foreground": "#ECEAE4",
            "editorLineNumber.foreground": "#8D8A84",
            "editorCursor.foreground": "#FF4D00",
            "editor.selectionBackground": "#494037",
            "editor.lineHighlightBackground": "#202123",
            "editor.inactiveSelectionBackground": "#34312E",
          },
        });
      }}
      onMount={(editor) => {
        editor.onKeyDown((e) => {
          if ((e.ctrlKey || e.metaKey) && e.code === "KeyC") {
            const selection = editor.getSelection();
            const model = editor.getModel();
            if (selection && model) onCopy(model.getValueInRange(selection));
          }
        });
      }}
      onChange={(v) => onChange(v || "")}
      options={{
        ariaLabel: "Код решения",
        fontFamily: "var(--plex-mono), monospace",
        fontSize: 14,
        readOnly,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 16 },
        tabSize: 4,
        wordWrap: "on",
        fixedOverflowWidgets: true,
      }}
    />
  );
}

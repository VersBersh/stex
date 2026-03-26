import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import type { SerializedEditorState } from 'lexical';
import seedData from './debug-seed.json';

declare const __SEED_EDITOR__: boolean;

export function DebugEditorPlugin() {
  const [editor] = useLexicalComposerContext();
  const seeded = useRef(false);

  // Always expose the export function
  useEffect(() => {
    (window as any).__exportEditor = () => {
      const json = editor.getEditorState().toJSON();
      const str = JSON.stringify(json, null, 2);
      navigator.clipboard.writeText(str).then(
        () => console.log('[DebugEditor] Editor state copied to clipboard (%d chars)', str.length),
        () => console.log('[DebugEditor] Clipboard write failed — JSON logged below'),
      );
      console.log(str);
      return json;
    };
    return () => { delete (window as any).__exportEditor; };
  }, [editor]);

  // Seed from fixture after session start clears the editor.
  // Listen for SESSION_START and seed once after it fires, so we don't
  // race with the clearEditor() that runs on onShow: 'fresh'.
  useEffect(() => {
    if (!__SEED_EDITOR__) return;

    const unsub = window.api.onSessionStart(() => {
      if (seeded.current) return;
      if (seedData.root.children.length === 0) {
        console.warn('[DebugEditor] debug-seed.json is empty — speak into the app then run __exportEditor() to capture data');
        return;
      }
      seeded.current = true;
      // Use setTimeout to run after all other onSessionStart handlers (clear hooks)
      setTimeout(() => {
        const state = editor.parseEditorState(seedData as unknown as SerializedEditorState);
        editor.setEditorState(state);
        console.log('[DebugEditor] Editor seeded from debug-seed.json');
      }, 0);
    });

    return unsub;
  }, [editor]);

  return null;
}

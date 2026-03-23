import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $isParagraphNode,
  $createParagraphNode,
  $createRangeSelection,
  $setSelection,
} from 'lexical';

/**
 * Returns true if the current selection is a collapsed caret at the end of committed text
 * (last text node of the last paragraph, at its end offset).
 */
export function $isCursorAtDocumentEnd(): boolean {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

  const root = $getRoot();
  const lastParagraph = root.getLastChild();
  if (!$isParagraphNode(lastParagraph)) return true; // empty root = cursor trivially at end

  const anchorNode = selection.anchor.getNode();
  const lastTextNode = lastParagraph.getLastChild();

  if ($isTextNode(lastTextNode)) {
    return (
      anchorNode.getKey() === lastTextNode.getKey() &&
      selection.anchor.offset === lastTextNode.getTextContentSize()
    );
  }

  if (anchorNode.getKey() === lastParagraph.getKey()) {
    return selection.anchor.offset === lastParagraph.getChildrenSize();
  }

  return false;
}

/**
 * Moves the cursor to the end of the document (end of last text node in last paragraph).
 */
export function $moveCursorToDocumentEnd(): void {
  const root = $getRoot();
  const rootLast = root.getLastChild();
  let lastParagraph;
  if ($isParagraphNode(rootLast)) {
    lastParagraph = rootLast;
  } else {
    // Empty root (e.g. after $getRoot().clear()) — create an empty paragraph
    // so the cursor has somewhere to land.
    lastParagraph = $createParagraphNode();
    root.append(lastParagraph);
  }

  const selection = $createRangeSelection();
  const lastChild = lastParagraph.getLastChild();
  if ($isTextNode(lastChild)) {
    const offset = lastChild.getTextContentSize();
    selection.anchor.set(lastChild.getKey(), offset, 'text');
    selection.focus.set(lastChild.getKey(), offset, 'text');
  } else {
    const offset = lastParagraph.getChildrenSize();
    selection.anchor.set(lastParagraph.getKey(), offset, 'element');
    selection.focus.set(lastParagraph.getKey(), offset, 'element');
  }
  $setSelection(selection);
}

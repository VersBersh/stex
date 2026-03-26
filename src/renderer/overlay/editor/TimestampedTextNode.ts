import {
  TextNode,
  type NodeKey,
  type SerializedTextNode,
  type EditorConfig,
  type Spread,
} from 'lexical';

export type SerializedTimestampedTextNode = Spread<
  {
    startMs: number;
    endMs: number;
    originalText: string;
  },
  SerializedTextNode
>;

export class TimestampedTextNode extends TextNode {
  __startMs: number;
  __endMs: number;
  __originalText: string;

  constructor(text: string, startMs: number, endMs: number, originalText: string, key?: NodeKey) {
    super(text, key);
    this.__startMs = startMs;
    this.__endMs = endMs;
    this.__originalText = originalText;
  }

  static getType(): string {
    return 'timestamped-text';
  }

  static clone(node: TimestampedTextNode): TimestampedTextNode {
    return new TimestampedTextNode(
      node.__text,
      node.__startMs,
      node.__endMs,
      node.__originalText,
      node.__key,
    );
  }

  getStartMs(): number {
    return this.getLatest().__startMs;
  }

  getEndMs(): number {
    return this.getLatest().__endMs;
  }

  getOriginalText(): string {
    return this.getLatest().__originalText;
  }

  createDOM(config: EditorConfig): HTMLElement {
    return super.createDOM(config);
  }

  exportJSON(): SerializedTimestampedTextNode {
    return {
      ...super.exportJSON(),
      startMs: this.__startMs,
      endMs: this.__endMs,
      originalText: this.__originalText,
      type: 'timestamped-text',
    };
  }

  static importJSON(serializedNode: SerializedTimestampedTextNode): TimestampedTextNode {
    const node = new TimestampedTextNode(
      serializedNode.text,
      serializedNode.startMs,
      serializedNode.endMs,
      serializedNode.originalText,
    );
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }
}

export function $createTimestampedTextNode(
  text: string,
  startMs: number,
  endMs: number,
  originalText: string = text,
): TimestampedTextNode {
  return new TimestampedTextNode(text, startMs, endMs, originalText);
}

export function $isTimestampedTextNode(node: unknown): node is TimestampedTextNode {
  return node instanceof TimestampedTextNode;
}

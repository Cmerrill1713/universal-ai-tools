/**
 * TypeScript declarations for tree-sitter and language bindings
 */

declare module 'tree-sitter' {
  export interface SyntaxNode {
    type: string;
    text: string;
    startPosition: Point;
    endPosition: Point;
    startIndex: number;
    endIndex: number;
    parent: SyntaxNode | null;
    children: SyntaxNode[];
    namedChildren: SyntaxNode[];
    childCount: number;
    namedChildCount: number;
    firstChild: SyntaxNode | null;
    lastChild: SyntaxNode | null;
    firstNamedChild: SyntaxNode | null;
    lastNamedChild: SyntaxNode | null;
    nextSibling: SyntaxNode | null;
    previousSibling: SyntaxNode | null;
    nextNamedSibling: SyntaxNode | null;
    previousNamedSibling: SyntaxNode | null;
    hasChanges(): boolean;
    hasError(): boolean;
    isMissing(): boolean;
    toString(): string;
    child(index: number): SyntaxNode | null;
    namedChild(index: number): SyntaxNode | null;
    childForFieldName(fieldName: string): SyntaxNode | null;
    childrenForFieldName(fieldName: string): SyntaxNode[];
    descendantForIndex(startIndex: number, endIndex?: number): SyntaxNode;
    namedDescendantForIndex(startIndex: number, endIndex?: number): SyntaxNode;
    descendantForPosition(startPosition: Point, endPosition?: Point): SyntaxNode;
    namedDescendantForPosition(startPosition: Point, endPosition?: Point): SyntaxNode;
    walk(): TreeCursor;
  }

  export interface Point {
    row: number;
    column: number;
  }

  export interface Range {
    startIndex: number;
    endIndex: number;
    startPosition: Point;
    endPosition: Point;
  }

  export interface Edit {
    startIndex: number;
    oldEndIndex: number;
    newEndIndex: number;
    startPosition: Point;
    oldEndPosition: Point;
    newEndPosition: Point;
  }

  export interface TreeCursor {
    nodeType: string;
    nodeText: string;
    startPosition: Point;
    endPosition: Point;
    startIndex: number;
    endIndex: number;
    currentNode(): SyntaxNode;
    reset(node: SyntaxNode): void;
    gotoParent(): boolean;
    gotoFirstChild(): boolean;
    gotoNextSibling(): boolean;
    gotoFirstChildForIndex(index: number): boolean;
    gotoDescendant(index: number): void;
  }

  export interface Tree {
    rootNode: SyntaxNode;
    edit(edit: Edit): void;
    walk(): TreeCursor;
    getChangedRanges(other: Tree): Range[];
    getEditedRange(other: Tree): Range;
    copy(): Tree;
    delete(): void;
  }

  export interface Language {
    version: number;
    nodeTypeCount: number;
    nodeTypeNames: string[];
    fieldCount: number;
    fieldNames: string[];
  }

  export interface Query {
    matches(node: SyntaxNode): QueryMatch[];
    captures(node: SyntaxNode): QueryCapture[];
    delete(): void;
  }

  export interface QueryMatch {
    pattern: number;
    captures: QueryCapture[];
  }

  export interface QueryCapture {
    name: string;
    node: SyntaxNode;
  }

  export interface LookaheadIterator {
    currentTypeId: number;
    currentType: string;
    next(): boolean;
    reset(state: number): boolean;
    resetState(state: number): boolean;
    language: Language;
    delete(): void;
  }

  export default class Parser {
    constructor();
    parse(input: string | Input, oldTree?: Tree): Tree | null;
    parseTextBuffer(buffer: TextBuffer, oldTree?: Tree): Tree | null;
    parseTextBufferSync(buffer: TextBuffer, oldTree?: Tree): Tree | null;
    reset(): void;
    setTimeoutMicros(timeout: number): void;
    getTimeoutMicros(): number;
    setLogger(logger: Logger): void;
    getLogger(): Logger;
    setLanguage(language: Language): void;
    getLanguage(): Language;
    static Query: typeof Query;
    static Point: typeof Point;
    static Range: typeof Range;
    static Tree: typeof Tree;
    static TreeCursor: typeof TreeCursor;
    static SyntaxNode: typeof SyntaxNode;
    static Language: typeof Language;
    static LookaheadIterator: typeof LookaheadIterator;
  }

  export interface Input {
    (startIndex: number, startPosition?: Point): string | null;
  }

  export interface TextBuffer {
    text: string;
    length: number;
  }

  export interface Logger {
    (message: string, params: { [key: string]: any }, type: 'parse' | 'lex'): void;
  }
}

declare module 'tree-sitter-typescript' {
  import { Language } from 'tree-sitter';
  export const typescript: Language;
  export const tsx: Language;
  export default typescript;
}

declare module 'tree-sitter-javascript' {
  import { Language } from 'tree-sitter';
  const javascript: Language;
  export default javascript;
}

declare module 'tree-sitter-python' {
  import { Language } from 'tree-sitter';
  const python: Language;
  export default python;
}

declare module 'tree-sitter-go' {
  import { Language } from 'tree-sitter';
  const go: Language;
  export default go;
}

declare module 'tree-sitter-rust' {
  import { Language } from 'tree-sitter';
  const rust: Language;
  export default rust;
}

declare module 'tree-sitter-java' {
  import { Language } from 'tree-sitter';
  const java: Language;
  export default java;
}

declare module 'tree-sitter-c' {
  import { Language } from 'tree-sitter';
  const c: Language;
  export default c;
}

declare module 'tree-sitter-cpp' {
  import { Language } from 'tree-sitter';
  const cpp: Language;
  export default cpp;
}
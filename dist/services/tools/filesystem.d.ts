export interface FileInfo {
    name: string;
    path: string;
    isDir: boolean;
    size?: number;
}
export declare function listFilesSafe(root: string, subpath?: string, maxEntries?: number): Promise<FileInfo[]>;
export declare function readFileSnippetSafe(root: string, subpath: string, maxBytes?: number): Promise<string>;
//# sourceMappingURL=filesystem.d.ts.map
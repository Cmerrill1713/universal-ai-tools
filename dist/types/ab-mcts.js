export function isABMCTSNode(obj) {
    return (!!obj &&
        typeof obj.id === 'string' &&
        typeof obj.visits === 'number' &&
        obj.children instanceof Map);
}
export function isTerminalNode(node) {
    return node.isTerminal || node.depth >= 10;
}
//# sourceMappingURL=ab-mcts.js.map
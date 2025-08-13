export function safeCalculate(expression) {
    if (!/^[-+*/%.() 0-9]+$/.test(expression))
        return null;
    try {
        const fn = new Function(`return (${expression})`);
        const res = fn();
        if (typeof res === 'number' && Number.isFinite(res))
            return res;
        return null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=calculator.js.map
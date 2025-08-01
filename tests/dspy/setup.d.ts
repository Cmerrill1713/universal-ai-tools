declare global {
    namespace jest {
        interface Matchers<R> {
            toBeWithinRange(floor: number, ceiling: number): R;
            toContainObject(expected: object): R;
        }
    }
}
export {};
//# sourceMappingURL=setup.d.ts.map
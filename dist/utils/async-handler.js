export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
export default asyncHandler;
//# sourceMappingURL=async-handler.js.map
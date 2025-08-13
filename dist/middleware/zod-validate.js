export function zodValidate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
            });
        }
        req.body = result.data;
        return next();
    };
}
//# sourceMappingURL=zod-validate.js.map
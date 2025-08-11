// Ambient module declarations for optional/externally provided packages
// These allow TypeScript to compile even when types are not installed or modules are optional.

declare module 'swagger-ui-express' {
  const anyExport: any;
  export = anyExport;
}

declare module 'express-openapi-validator' {
  const anyExport: any;
  export = anyExport;
}

declare module 'drizzle-orm/node-postgres' {
  const anyExport: any;
  export = anyExport;
}

declare module 'bullmq' {
  const anyExport: any;
  export = anyExport;
}

declare module 'pg-boss' {
  const anyExport: any;
  export = anyExport;
}

declare module 'casbin' {
  const anyExport: any;
  export = anyExport;
}



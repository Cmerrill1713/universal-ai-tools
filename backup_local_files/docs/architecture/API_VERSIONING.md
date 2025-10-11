# API Versioning Guide
## Overview
The Universal AI Tools API implements a comprehensive versioning system to ensure backward compatibility and smooth transitions between API versions. All API endpoints are versioned under the `/api/v{version}/` URL structure.
## Current Version
- **Current Stable Version**: `v1`

- **Default Version**: `v1`

- **Base URL Pattern**: `https://api.universal-ai-tools.com/api/v1/`
## Specifying API Version
You can specify the API version in three ways:
### 1. URL Path (Recommended)

```

GET /api/v1/memory

POST /api/v1/tools/execute

```
### 2. Accept Header

```

Accept: application/vnd.universal-ai-tools.v1+json

```
### 3. Custom Header

```

X-API-Version: v1

```
## Version Detection Priority
1. URL path version (highest priority)

2. Accept header version

3. X-API-Version header

4. Default version (v1)
## Response Headers
All API responses include version information:
```

X-API-Version: v1

X-API-Latest-Version: v1

Content-Type: application/vnd.universal-ai-tools.v1+json

```
## Deprecation Policy
When an API version is deprecated:
1. **Deprecation Notice**: 6 months before sunset

2. **Deprecation Headers**: Added to all responses

3. **Sunset Date**: Clearly communicated

4. **Migration Guide**: Provided for breaking changes
### Deprecation Response Headers

```

X-API-Deprecation-Warning: API version v1 is deprecated and will be sunset on 2025-12-31

X-API-Sunset-Date: 2025-12-31T00:00:00Z

```
## Version Information Endpoint
Get information about all API versions:
```bash

GET /api/versions

```
Response:

```json

{

  "success": true,

  "currentVersion": "v1",

  "defaultVersion": "v1",

  "latestVersion": "v1",

  "versions": [

    {

      "version": "v1",

      "active": true,

      "deprecated": false,

      "changes": [

        "Initial API version",

        "All endpoints available under /api/v1/"

      ]

    }

  ]

}

```
## Client Implementation
### JavaScript/TypeScript Client
```typescript

import { createClient } from '@universal-ai-tools/client';
const client = createClient({

  baseUrl: 'https://api.universal-ai-tools.com',

  apiKey: 'your-api-key',

  aiService: 'your-service',

  version: 'v1', // Optional, defaults to v1

  autoUpgrade: true, // Auto-switch to latest supported version

  onDeprecationWarning: (warning) => {

    console.warn('API Deprecation:', warning);

  }

});
// Check current version

console.log(client.getVersion()); // 'v1'
// Get version information

const versions = await client.getVersions();
// Make API calls (version handled automatically)

const response = await client.storeMemory('Hello, world!');

```
### Manual HTTP Requests
```bash
# Using URL path version

curl -X POST https://api.universal-ai-tools.com/api/v1/memory \

  -H "X-API-Key: your-api-key" \

  -H "X-AI-Service: your-service" \

  -H "Content-Type: application/json" \

  -d '{"content": "Hello, world!"}'

# Using header version

curl -X POST https://api.universal-ai-tools.com/api/memory \

  -H "X-API-Key: your-api-key" \

  -H "X-AI-Service: your-service" \

  -H "X-API-Version: v1" \

  -H "Content-Type: application/json" \

  -d '{"content": "Hello, world!"}'

```
## Backward Compatibility
### URL Compatibility

- Legacy URLs without version (`/api/memory`) are automatically rewritten to the default version (`/api/v1/memory`)

- This ensures existing integrations continue to work
### Response Format

- All responses include a `metadata` object with version information

- Response structure remains consistent within a major version
### Example Response

```json

{

  "success": true,

  "data": {

    "id": "123",

    "content": "Hello, world!"

  },

  "metadata": {

    "apiVersion": "v1",

    "timestamp": "2025-01-19T12:00:00Z",

    "requestId": "req_123"

  }

}

```
## Migration Between Versions
When migrating to a new API version:
1. **Review Changes**: Check the version changelog

2. **Test Integration**: Use the new version in development

3. **Gradual Migration**: Update endpoints one at a time

4. **Monitor Warnings**: Watch for deprecation notices
### Migration Checklist
- [ ] Review API version changelog

- [ ] Update client library to latest version

- [ ] Test all endpoints with new version

- [ ] Update API version in configuration

- [ ] Monitor for any errors or warnings

- [ ] Update documentation
## Version Lifecycle
1. **Preview**: New features in beta (not production-ready)

2. **Active**: Fully supported and recommended

3. **Deprecated**: Still functional but not recommended

4. **Sunset**: No longer available
## Best Practices
1. **Always Specify Version**: Explicitly set the API version in your client

2. **Monitor Deprecations**: Set up alerts for deprecation warnings

3. **Stay Updated**: Regularly check for new versions

4. **Test Before Upgrading**: Thoroughly test with new versions

5. **Use Latest Stable**: Use the latest stable version for new projects
## Error Handling
### Invalid Version Error

```json

{

  "success": false,

  "error": {

    "code": "INVALID_API_VERSION",

    "message": "API version v99 is not supported",

    "supportedVersions": ["v1"],

    "latestVersion": "v1"

  }

}

```
### Inactive Version Error

```json

{

  "success": false,

  "error": {

    "code": "VERSION_NOT_ACTIVE",

    "message": "API version v0 is no longer active",

    "latestVersion": "v1",

    "sunsetDate": "2024-01-01T00:00:00Z"

  }

}

```
## Future Versions
Future API versions will include:
- **v2** (Planned): Enhanced agent capabilities, improved performance

- **v3** (Future): Advanced orchestration features
Each new version will:

- Maintain backward compatibility where possible

- Provide clear migration paths

- Include comprehensive documentation

- Offer extended support periods
## Support
For version-related questions:

- Documentation: https://docs.universal-ai-tools.com/api/versions

- Support: support@universal-ai-tools.com

- Status: https://status.universal-ai-tools.com
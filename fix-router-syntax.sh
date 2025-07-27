#!/bin/bash

# Fix router syntax errors script

echo "Fixing syntax errors in src/routers directory..."

# Fix all _error patterns to error:
echo "Fixing _error patterns..."
find src/routers -name "*.ts" -type f -exec sed -i '' 's/_error error\./_error: error\./g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/_error error instanceof/error: error instanceof/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/_error}/error:}/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/_error {/error: {/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/_error\s*any)/error: any)/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/_error throw/error: throw/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/_error\&\&/error \&\&/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/_errorcode/error.code/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/_error\||/error ||/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/\. _error/, error:/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/logger\.error('\''.*_error'\''/logger.error('\''&/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/_error'\''/error'\''/g' {} \;

# Fix specific patterns
echo "Fixing specific patterns..."
find src/routers -name "*.ts" -type f -exec sed -i '' 's/const request Partial/const request: Partial/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/\.requestrequest/.request(request)/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/requestfailed/request failed/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/String(_error/String(error)/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/} catch (_error/} catch (error:/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/const { _error}/const { error }/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/if (_error/if (error)/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/, { _error}/, { error }/g' {} \;
find src/routers -name "*.ts" -type f -exec sed -i '' 's/status: '\''_error/status: '\''error'\''/g' {} \;

# Fix router paths missing quotes
echo "Fixing router paths..."
find src/routers -name "*.ts" -type f -exec sed -i '' 's|'\''/request,|'\''/request'\'',|g' {} \;

# Additional specific fixes
echo "Applying additional fixes..."
find src/routers -name "*.ts" -type f -exec sed -i '' 's/error: error instanceof Error ? error\.message : '\''Request failed'\'',/error: error instanceof Error ? error.message : '\''Request failed'\''/g' {} \;

echo "Syntax fixes completed!"
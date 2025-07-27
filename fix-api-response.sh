#!/bin/bash

# Fix all apiResponse.error calls
sed -i '' "s/apiResponse\.error('\([^']*\)', '\([^']*\)')/sendError(res, '\2', '\1'/g" src/routers/mlx-fine-tuning.ts

# Fix all apiResponse.success calls with message
sed -i '' "s/apiResponse\.success(\([^,]*\), '\([^']*\)')/sendSuccess(res, \1/g" src/routers/mlx-fine-tuning.ts

# Fix remaining status codes
sed -i '' 's/\.status(400)\.json(sendError/sendError/g' src/routers/mlx-fine-tuning.ts
sed -i '' 's/\.status(401)\.json(sendError/sendError/g' src/routers/mlx-fine-tuning.ts
sed -i '' 's/\.status(404)\.json(sendError/sendError/g' src/routers/mlx-fine-tuning.ts
sed -i '' 's/\.status(500)\.json(sendError/sendError/g' src/routers/mlx-fine-tuning.ts
sed -i '' 's/\.status(503)\.json(sendError/sendError/g' src/routers/mlx-fine-tuning.ts

# Fix res.json(sendSuccess to just sendSuccess
sed -i '' 's/res\.json(sendSuccess/sendSuccess/g' src/routers/mlx-fine-tuning.ts

echo "Fixed API response patterns in mlx-fine-tuning.ts"
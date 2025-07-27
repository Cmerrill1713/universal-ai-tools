#!/bin/bash

echo "Comprehensive router syntax error fix..."

# Find all TypeScript files in src/routers
ROUTER_FILES=$(find src/routers -name "*.ts" -type f)

for file in $ROUTER_FILES; do
    echo "Processing: $file"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Fix malformed JSDoc comments
    sed -i '' 's/\/\*\*;/\/\*\*/g' "$file"
    
    # Fix _error patterns
    sed -i '' 's/_error\([^a-zA-Z0-9_]\)/error\1/g' "$file"
    sed -i '' 's/_errorinstanceof/error instanceof/g' "$file"
    sed -i '' 's/_errormessage/error.message/g' "$file"
    sed -i '' 's/_errorcode/error.code/g' "$file"
    sed -i '' 's/_erroras /error as /g' "$file"
    
    # Fix _content, _request, _input patterns
    sed -i '' 's/_content\([^a-zA-Z0-9_]\)/content\1/g' "$file"
    sed -i '' 's/_contentlength/content.length/g' "$file"
    sed -i '' 's/_contentrequired/content required/g' "$file"
    sed -i '' 's/_contenttype/content-type/g' "$file"
    sed -i '' 's/_request\([^a-zA-Z0-9_]\)/request\1/g' "$file"
    sed -i '' 's/_requestendpoint/request endpoint/g' "$file"
    sed -i '' 's/_input\([^a-zA-Z0-9_]\)/input\1/g' "$file"
    sed -i '' 's/_inputfor /input for /g' "$file"
    sed -i '' 's/_analysis=/analysis =/g' "$file"
    sed -i '' 's/_analysisendpoint/analysis endpoint/g' "$file"
    sed -i '' 's/_pattern_analysis/pattern analysis/g' "$file"
    sed -i '' 's/_patterntype/pattern type/g' "$file"
    
    # Fix content-type and content-length headers
    sed -i '' "s/'content-type'/'Content-Type'/g" "$file"
    sed -i '' 's/"content-type"/"Content-Type"/g' "$file"
    sed -i '' "s/'content-length'/'Content-Length'/g" "$file"
    sed -i '' 's/"content-length"/"Content-Length"/g' "$file"
    
    # Fix double colons
    sed -i '' 's/::/:/g' "$file"
    
    # Fix router method calls with semicolons
    sed -i '' 's/router\.post(;)/router.post(/g' "$file"
    sed -i '' 's/router\.get(;)/router.get(/g' "$file"
    sed -i '' 's/router\.put(;)/router.put(/g' "$file"
    sed -i '' 's/router\.delete(;)/router.delete(/g' "$file"
    sed -i '' 's/router\.patch(;)/router.patch(/g' "$file"
    
    # Fix array/object patterns with semicolons
    sed -i '' 's/\[;/[/g' "$file"
    sed -i '' 's/;]/]/g' "$file"
    
    # Fix specific patterns
    sed -i '' 's/contentcontext/content, context/g' "$file"
    sed -i '' 's/contentmetadata/content, metadata/g' "$file"
    sed -i '' 's/requestpartial/request: Partial/g' "$file"
    sed -i '' 's/requestrequest/request(request/g' "$file"
    sed -i '' 's/requestoutputSchema/request, outputSchema/g' "$file"
    sed -i '' 's/inputparameters/input.parameters/g' "$file"
    sed -i '' 's/content{/content {/g' "$file"
    sed -i '' 's/if (error: & /if (error \&\& /g' "$file"
    sed -i '' 's/if (error: throw error:/if (error) throw error/g' "$file"
    sed -i '' 's/const { error:  = /const { error } = /g' "$file"
    sed -i '' 's/const { data, error:  = /const { data, error } = /g' "$file"
    sed -i '' 's/userrequest:/user_request:/g' "$file"
    sed -i '' 's/logger\.error(\([^,)]*\), error:/logger.error(\1, error)/g' "$file"
    sed -i '' "s/logger\.error'/logger.error('/g" "$file"
    sed -i '' 's/error:;/error;/g' "$file"
    sed -i '' 's/error:)/error)/g' "$file"
    sed -i '' 's/content:/content,/g' "$file"
    sed -i '' 's/res\.status(400)\.json({ error:  /res.status(400).json({ error: /g' "$file"
    sed -i '' 's/res\.status(500)\.json({ error:  /res.status(500).json({ error: /g' "$file"
    sed -i '' 's/return res\.status(200)\.json( /return res.status(200).json(/g' "$file"
    sed -i '' 's/category as: any/category as any/g' "$file"
    sed -i '' 's/const { error, /const { error: err, /g' "$file"
    sed -i '' 's/error, instanceof Error/error instanceof Error/g' "$file"
    sed -i '' 's/: error instanceof Error/error instanceof Error/g' "$file"
    sed -i '' 's/analyzeCognitive(contentcontext)/analyzeCognitive(content, context)/g' "$file"
    sed -i '' 's/await fs\./await promises./g' "$file"
    sed -i '' 's/next();/next();/g' "$file"
    
    # Fix string/template literal issues
    sed -i '' "s/error: 'Invalid request;/error: 'Invalid request'/g" "$file"
    sed -i '' "s/error: 'Context not found';/error: 'Context not found'/g" "$file"
    sed -i '' "s/error: 'Failed to provide widget assistance;/error: 'Failed to provide widget assistance'/g" "$file"
    sed -i '' "s/error: 'Failed to generate widget from voice input;/error: 'Failed to generate widget from voice input'/g" "$file"
    sed -i '' "s/input;/input'/g" "$file"
    sed -i '' "s/\.from('ai_contexts');/\.from('ai_contexts')/g" "$file"
    sed -i '' "s/\.single();/\.single();/g" "$file"
    sed -i '' "s/});/});/g" "$file"
    sed -i '' "s/);/);/g" "$file"
    sed -i '' "s/timestamp: new Date();/timestamp: new Date(),/g" "$file"
    sed -i '' 's/const validation = /const validation = /g' "$file"
    sed -i '' 's/\.json({ error:validation\.error:/\.json({ error: validation.error.message/g' "$file"
    sed -i '' 's/if (!content{/if (!content) {/g' "$file"
    sed -i '' 's/if (status) query = /if (status) query = /g' "$file"
    sed -i '' 's/\.setHeader('\''Content-Type'\'', mimeType);'\''/\.setHeader('\''Content-Type'\'', mimeType);/g' "$file"
    sed -i '' 's/\.filter(([_, available]) => available);/\.filter(([_, available]) => available)/g' "$file"
    sed -i '' 's/\.map(([name]) => name);/\.map(([name]) => name)/g' "$file"
    sed -i '' 's/supportedEvents: \[;/supportedEvents: [/g' "$file"
    sed -i '' 's/private async /private async /g' "$file"
    sed -i '' 's/(;/()/g' "$file"
    sed -i '' 's/stream = / stream = /g' "$file"
    sed -i '' 's/content= chunk/content += chunk/g' "$file"
    sed -i '' 's/stream\.on('\''error:  /stream.on('\''error'\'', /g' "$file"
    sed -i '' 's/(error:=> {/(error) => {/g' "$file"
    sed -i '' 's/error: '\''Unknown error:/error: '\''Unknown error'\''/g' "$file"
    sed -i '' 's/\._errormessage/\.error.message/g' "$file"
    sed -i '' 's/(error as Error)/(error as Error)/g' "$file"
    sed -i '' 's/(_erroras Error)/(error as Error)/g' "$file"
    sed -i '' 's/undefined, error:/undefined, error)/g' "$file"
    
    # Check if changes were made
    if ! diff -q "$file" "$file.backup" > /dev/null; then
        echo "  - Fixed syntax errors in $file"
        rm "$file.backup"
    else
        echo "  - No changes needed in $file"
        rm "$file.backup"
    fi
done

echo "Router syntax fix complete!"
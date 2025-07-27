#\!/bin/bash

echo "Fixing remaining router syntax errors..."

# Find all TypeScript files in src/routers
ROUTER_FILES=$(find src/routers -name "*.ts" -type f)

for file in $ROUTER_FILES; do
    echo "Processing: $file"
    
    # Create backup
    cp "$file" "$file.backup"
    
    # Fix specific remaining patterns
    
    # Fix patterns like "const { data, error:  =" to "const { data, error } ="
    sed -i '' 's/const { data, error:  =/const { data, error } =/g' "$file"
    sed -i '' 's/const { error:  =/const { error } =/g' "$file"
    
    # Fix patterns like "if (error:{" to "if (error) {"
    sed -i '' 's/if (error:{/if (error) {/g' "$file"
    
    # Fix patterns like "} catch (error:" to "} catch (error)"
    sed -i '' 's/} catch (error:/} catch (error)/g' "$file"
    
    # Fix patterns like "router.get()" to "router.get("
    sed -i '' 's/router\.get()/router.get(/g' "$file"
    sed -i '' 's/router\.post()/router.post(/g' "$file"
    sed -i '' 's/router\.put()/router.put(/g' "$file"
    sed -i '' 's/router\.delete()/router.delete(/g' "$file"
    
    # Fix patterns like ".from('table');" to ".from('table')"
    sed -i '' "s/\.from('\([^']*\)');/\.from('\1')/g" "$file"
    sed -i '' "s/\.select('\([^']*\)');/\.select('\1')/g" "$file"
    sed -i '' "s/\.eq('\([^']*\)', \([^)]*\));/\.eq('\1', \2)/g" "$file"
    
    # Fix patterns like "error:" at end of lines
    sed -i '' 's/error:$/error/g' "$file"
    sed -i '' 's/error:;$/error;/g' "$file"
    
    # Fix patterns like "content," to "content:"
    sed -i '' 's/content,\s*\([a-zA-Z]\)/content: \1/g' "$file"
    
    # Fix patterns like "error as Error" patterns
    sed -i '' 's/} catch (error: Error | unknown)/} catch (error)/g' "$file"
    sed -i '' 's/errorerror/error: error/g' "$file"
    sed -i '' 's/stackerror/stack: error/g' "$file"
    sed -i '' 's/messageerror/message: error/g' "$file"
    
    # Fix more patterns
    sed -i '' 's/Promise\.all())/Promise.all(/g' "$file"
    sed -i '' 's/data\.map((snippet: any) =>;/data.map((snippet: any) =>/g' "$file"
    sed -i '' 's/\[;/[/g' "$file"
    sed -i '' 's/detailserror/details: error/g' "$file"
    sed -i '' 's/if (error) throw error$/if (error) throw error;/g' "$file"
    sed -i '' 's/logger\.error('\''.*: , /logger.error('\''&/g' "$file"
    sed -i '' "s/logger\.error('Backup creation error: , error;/logger.error('Backup creation error:', error);/g" "$file"
    sed -i '' "s/logger\.error('Restore error: , error;/logger.error('Restore error:', error);/g" "$file"
    sed -i '' "s/logger\.error('Delete backup error: , error;/logger.error('Delete backup error:', error);/g" "$file"
    sed -i '' "s/logger\.error('Verify backup error: , error;/logger.error('Verify backup error:', error);/g" "$file"
    sed -i '' "s/logger\.error('Cleanup error: , error;/logger.error('Cleanup error:', error);/g" "$file"
    
    # Fix sendError patterns
    sed -i '' 's/sendError()/sendError(/g' "$file"
    
    # Fix async patterns
    sed -i '' 's/await initializeWithTimeout()/await initializeWithTimeout(/g' "$file"
    sed -i '' 's/createKnowledgeUpdateAutomation()/createKnowledgeUpdateAutomation(/g' "$file"
    
    # Fix stray semicolons
    sed -i '' 's/5000;/5000/g' "$file"
    sed -i '' 's/\?;/?/g' "$file"
    sed -i '' 's/'\''Unknown error;/'\''Unknown error'\''/g' "$file"
    
    # Fix object property patterns
    sed -i '' 's/error:{/error: {/g' "$file"
    sed -i '' 's/\.json({ error:validation\./\.json({ error: validation./g' "$file"
    
    # Fix template literal patterns  
    sed -i '' 's/message:;/message:/g' "$file"
    
    # Fix patterns like pattern; instead of pattern
    sed -i '' 's/_pattern$/pattern/g' "$file"
    
    # Check if changes were made
    if \! diff -q "$file" "$file.backup" > /dev/null; then
        echo "  - Fixed syntax errors in $file"
        rm "$file.backup"
    else
        echo "  - No changes needed in $file"
        rm "$file.backup"
    fi
done

echo "Remaining router syntax fixes complete\!"

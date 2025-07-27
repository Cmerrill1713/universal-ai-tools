#!/bin/bash

# Fix common syntax errors in TypeScript files

echo "Fixing common syntax errors in TypeScript files..."

# Fix object property syntax: content, -> content:
find src -name "*.ts" -type f -exec sed -i '' 's/content, \([a-zA-Z_]\)/content: \1/g' {} \;

# Fix catch syntax: } catch (error) any) { -> } catch (error: any) {
find src -name "*.ts" -type f -exec sed -i '' 's/} catch (error) any) {/} catch (error: any) {/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/} catch (error) Error | unknown) {/} catch (error: Error | unknown) {/g' {} \;

# Fix logger calls missing parentheses
find src -name "*.ts" -type f -exec sed -i '' "s/logger\.error'/logger.error\('/g" {} \;
find src -name "*.ts" -type f -exec sed -i '' "s/logger\.warn'/logger.warn\('/g" {} \;
find src -name "*.ts" -type f -exec sed -i '' "s/logger\.info'/logger.info\('/g" {} \;

# Fix error properties
find src -name "*.ts" -type f -exec sed -i '' 's/_errormessage/error.message/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/_errorstack/error.stack/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/_errorerrors/error.errors/g' {} \;

# Fix header names
find src -name "*.ts" -type f -exec sed -i '' 's/_contentlength/content-length/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/_contenttype/content-type/g' {} \;

# Fix colon syntax in object properties
find src -name "*.ts" -type f -exec sed -i '' 's/error, \([a-zA-Z_]\)/error: \1/g' {} \;
find src -name "*.ts" -type f -exec sed -i '' 's/message, \([a-zA-Z_]\)/message: \1/g' {} \;

echo "Common syntax fixes applied!"
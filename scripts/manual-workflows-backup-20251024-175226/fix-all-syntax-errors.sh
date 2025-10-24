#!/bin/bash

# Comprehensive Syntax Error Fix Script for Universal AI Tools
# This script fixes common syntax errors found throughout the codebase

echo "================================================"
echo "Universal AI Tools - Syntax Error Auto-Fix"
echo "================================================"
echo

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create backup
echo -e "${YELLOW}Creating backup of src directory...${NC}"
cp -r src src.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✓ Backup created${NC}"
echo

# Function to count occurrences
count_pattern() {
    grep -r "$1" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l
}

# Function to show progress
fix_pattern() {
    local pattern=$1
    local replacement=$2
    local description=$3
    
    echo -n "Fixing: $description... "
    local before=$(count_pattern "$pattern")
    
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' "s/${pattern}/${replacement}/g" {} +
    
    local after=$(count_pattern "$pattern")
    local fixed=$((before - after))
    
    if [ $fixed -gt 0 ]; then
        echo -e "${GREEN}✓ Fixed $fixed occurrences${NC}"
    else
        echo -e "${YELLOW}No occurrences found${NC}"
    fi
}

echo -e "${YELLOW}Phase 1: Fixing Object Property Syntax Errors${NC}"
echo "-----------------------------------------------"

# Fix _error with single quotes to error:
fix_pattern "_error '" "error: '" "_error ' → error: '"
fix_pattern '_error "' 'error: "' '_error " → error: "'
fix_pattern "_error:" "error:" "_error: → error:"
fix_pattern "_errorCode" "errorCode" "_errorCode → errorCode"
fix_pattern "_errorMessage" "errorMessage" "_errorMessage → errorMessage"
fix_pattern "_errorStack" "errorStack" "_errorStack → errorStack"
fix_pattern "_errorDetails" "errorDetails" "_errorDetails → errorDetails"

echo
echo -e "${YELLOW}Phase 2: Fixing instanceof Operator Errors${NC}"
echo "-----------------------------------------"

# Fix _errorinstanceof patterns
fix_pattern "_errorinstanceof" "error instanceof" "_errorinstanceof → error instanceof"
fix_pattern "_error instanceof" "error instanceof" "_error instanceof → error instanceof"
fix_pattern "_errormessage" "error.message" "_errormessage → error.message"
fix_pattern "_errorstack" "error.stack" "_errorstack → error.stack"
fix_pattern "_errorname" "error.name" "_errorname → error.name"

echo
echo -e "${YELLOW}Phase 3: Fixing Logger Call Errors${NC}"
echo "---------------------------------"

# Fix logger calls missing parentheses
fix_pattern "logger\.error'" "logger.error('" "logger.error' → logger.error('"
fix_pattern 'logger\.error"' 'logger.error("' 'logger.error" → logger.error("'
fix_pattern "logger\.info'" "logger.info('" "logger.info' → logger.info('"
fix_pattern 'logger\.info"' 'logger.info("' 'logger.info" → logger.info("'
fix_pattern "logger\.warn'" "logger.warn('" "logger.warn' → logger.warn('"
fix_pattern 'logger\.warn"' 'logger.warn("' 'logger.warn" → logger.warn("'
fix_pattern "logger\.debug'" "logger.debug('" "logger.debug' → logger.debug('"
fix_pattern 'logger\.debug"' 'logger.debug("' 'logger.debug" → logger.debug("'

echo
echo -e "${YELLOW}Phase 4: Fixing Catch Block Parameters${NC}"
echo "-------------------------------------"

# Fix catch block parameter names
fix_pattern "catch (_error)" "catch (error)" "catch (_error) → catch (error)"
fix_pattern "catch(_error)" "catch (error)" "catch(_error) → catch (error)"
fix_pattern "} catch (_error:" "} catch (error:" "catch (_error: → catch (error:"

echo
echo -e "${YELLOW}Phase 5: Fixing Common Variable Names${NC}"
echo "------------------------------------"

# Fix common variable patterns
fix_pattern "const _error " "const error " "const _error → const error"
fix_pattern "let _error " "let error " "let _error → let error"
fix_pattern "var _error " "var error " "var _error → var error"
fix_pattern "{ _error }" "{ error }" "{ _error } → { error }"
fix_pattern "{ _error," "{ error," "{ _error, → { error,"
fix_pattern ", _error }" ", error }" ", _error } → , error }"
fix_pattern ", _error," ", error," ", _error, → , error,"

echo
echo -e "${YELLOW}Phase 6: Fixing Return Statements${NC}"
echo "--------------------------------"

# Fix return statements
fix_pattern "return { _error " "return { error: " "return { _error → return { error:"
fix_pattern "return _error " "return error " "return _error → return error"

echo
echo -e "${YELLOW}Phase 7: Fixing Function Parameters${NC}"
echo "----------------------------------"

# Fix function parameters
fix_pattern "function(_error)" "function(error)" "function(_error) → function(error)"
fix_pattern "(_error:" "(error:" "(_error: → (error:"
fix_pattern "_error =>" "error =>" "_error => → error =>"
fix_pattern "(_error) =>" "(error) =>" "(_error) => → (error) =>"

echo
echo -e "${YELLOW}Phase 8: Fixing Import/Export Statements${NC}"
echo "---------------------------------------"

# Fix any imports/exports
fix_pattern "LogContext.ERROR = '_error" "LogContext.ERROR = 'error'" "LogContext enum fix"
fix_pattern "LogLevel.ERROR = '_error" "LogLevel.ERROR = 'error'" "LogLevel enum fix"

echo
echo -e "${YELLOW}Phase 9: Fixing Template Literals${NC}"
echo "--------------------------------"

# Fix template literals
fix_pattern '\${_error}' '${error}' '${_error} → ${error}'
fix_pattern '\${_errormessage}' '${error.message}' '${_errormessage} → ${error.message}'

echo
echo -e "${YELLOW}Phase 10: Fixing Special Cases${NC}"
echo "-----------------------------"

# Fix special patterns that might have been missed
fix_pattern "throw _error" "throw error" "throw _error → throw error"
fix_pattern "reject(_error)" "reject(error)" "reject(_error) → reject(error)"
fix_pattern "Promise.reject(_error)" "Promise.reject(error)" "Promise.reject(_error) → Promise.reject(error)"

# Fix user__input pattern
fix_pattern "user__input:" "user_input:" "user__input: → user_input:"
fix_pattern "user__input " "user_input " "user__input → user_input"

# Fix _request patterns
fix_pattern "_request " "request " "_request → request"
fix_pattern "_requestto" "request to" "_requestto → request to"
fix_pattern "execute:_request" "execute:request" "execute:_request → execute:request"

echo
echo -e "${YELLOW}Phase 11: Final Cleanup${NC}"
echo "----------------------"

# Fix any remaining patterns
fix_pattern "response\._error" "response.error" "response._error → response.error"
fix_pattern "data\._error" "data.error" "data._error → data.error"
fix_pattern "result\._error" "result.error" "result._error → result.error"

# Fix logger in enhanced-logger.ts specifically
echo -n "Fixing logger export in enhanced-logger.ts... "
sed -i '' 's/_error (/error: (/g' src/utils/enhanced-logger.ts
echo -e "${GREEN}✓ Fixed${NC}"

echo
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Syntax error fixes completed!${NC}"
echo -e "${GREEN}================================================${NC}"
echo
echo "Next steps:"
echo "1. Run: npm run lint:fix"
echo "2. Run: npm run type-check"
echo "3. Review any remaining errors manually"
echo
echo -e "${YELLOW}Note: A backup was created in src.backup.*${NC}"
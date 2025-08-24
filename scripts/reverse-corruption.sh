#!/bin/bash

# Script to reverse the character corruption caused by automated fix scripts
# This script reverses patterns like "impor.t" back to "import"

set -e

echo "🔧 Reversing automated script corruption..."

# Create backup before making changes
BACKUP_DIR="src.backup.$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup at $BACKUP_DIR..."
cp -r src "$BACKUP_DIR"

# Define common corrupted patterns and their fixes
declare -A CORRUPTION_PATTERNS=(
    ["impor.t"]="import"
    ["expor.t"]="export"
    ["fro.m"]="from"
    ["typ.e"]="type"
    ["cons.t"]="const"
    ["le.t"]="let"
    ["functio.n"]="function"
    ["clas.s"]="class"
    ["interfac.e"]="interface"
    ["asyn.c"]="async"
    ["awai.t"]="await"
    ["retur.n"]="return"
    ["i.f"]="if"
    ["els.e"]="else"
    ["fo.r"]="for"
    ["whil.e"]="while"
    ["tr.y"]="try"
    ["catc.h"]="catch"
    ["thro.w"]="throw"
    ["ne.w"]="new"
    ["thi.s"]="this"
    ["supe.r"]="super"
    ["cas.e"]="case"
    ["switc.h"]="switch"
    ["brea.k"]="break"
    ["continu.e"]="continue"
    ["defaul.t"]="default"
    ["nul.l"]="null"
    ["undefine.d"]="undefined"
    ["tru.e"]="true"
    ["fals.e"]="false"
    ["strin.g"]="string"
    ["numbe.r"]="number"
    ["boolea.n"]="boolean"
    ["arra.y"]="array"
    ["objec.t"]="object"
    ["proces.s"]="process"
    ["erro.r"]="error"
    ["resul.t"]="result"
    ["reques.t"]="request"
    ["respons.e"]="response"
    ["serve.r"]="server"
    ["clien.t"]="client"
    ["servic.e"]="service"
    ["manage.r"]="manager"
    ["contex.t"]="context"
    ["configu.r"]="config"
    ["option.s"]="options"
    ["param.s"]="params"
    ["argument.s"]="arguments"
    ["bod.y"]="body"
    ["heade.r"]="header"
    ["quer.y"]="query"
    ["dat.a"]="data"
    ["metadat.a"]="metadata"
    ["conten.t"]="content"
    ["messag.e"]="message"
    ["statu.s"]="status"
    ["cod.e"]="code"
    ["nam.e"]="name"
    ["valu.e"]="value"
    ["ke.y"]="key"
    ["i.d"]="id"
    ["pat.h"]="path"
    ["ur.l"]="url"
    ["fil.e"]="file"
    ["directo.ry"]="directory"
    ["folde.r"]="folder"
    ["agen.t"]="agent"
    ["memor.y"]="memory"
    ["knowledg.e"]="knowledge"
    ["tas.k"]="task"
    ["orchestratio.n"]="orchestration"
    ["coordinatio.n"]="coordination"
    ["executio.n"]="execution"
    ["validatio.n"]="validation"
    ["authentica.tion"]="authentication"
    ["authorizatio.n"]="authorization"
    ["middlewar.e"]="middleware"
    ["route.r"]="router"
    ["logge.r"]="logger"
    ["cach.e"]="cache"
    ["databas.e"]="database"
    ["tabl.e"]="table"
    ["colum.n"]="column"
    ["ro.w"]="row"
    ["inde.x"]="index"
    ["relatio.n"]="relation"
    ["quer.y"]="query"
    ["migratio.n"]="migration"
    ["schem.a"]="schema"
    ["mode.l"]="model"
    ["entit.y"]="entity"
    ["repositor.y"]="repository"
    ["facto.ry"]="factory"
    ["builde.r"]="builder"
    ["helpe.r"]="helper"
    ["utilit.y"]="utility"
    ["constan.t"]="constant"
    ["variab.le"]="variable"
    ["propert.y"]="property"
    ["metho.d"]="method"
    ["functio.n"]="function"
    ["callbac.k"]="callback"
    ["promis.e"]="promise"
    ["observab.le"]="observable"
    ["strea.m"]="stream"
    ["buffe.r"]="buffer"
    ["tim.e"]="time"
    ["timestam.p"]="timestamp"
    ["da.te"]="date"
    ["fo.r"]="for"
    ["o.f"]="of"
    ["i.n"]="in"
    ["an.d"]="and"
    ["o.r"]="or"
    ["no.t"]="not"
    ["i.s"]="is"
    ["a.s"]="as"
    ["t.o"]="to"
    ["fro.m"]="from"
    ["wit.h"]="with"
    ["b.y"]="by"
    ["a.t"]="at"
    ["o.n"]="on"
    ["o.f"]="of"
    ["instanceo.f"]="instanceof"
)

# Function to safely replace patterns
safe_replace() {
    local file="$1"
    local pattern="$2"
    local replacement="$3"
    
    # Use sed with word boundaries to avoid partial replacements
    sed -i.bak "s/\\b${pattern}\\b/${replacement}/g" "$file"
    rm -f "$file.bak"
}

# Find all TypeScript files in src directory
echo "🔍 Finding TypeScript files..."
TS_FILES=$(find src -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/coverage/*")

# Count total files
TOTAL_FILES=$(echo "$TS_FILES" | wc -l)
echo "📄 Found $TOTAL_FILES TypeScript files to process"

# Process each file
CURRENT=0
for file in $TS_FILES; do
    CURRENT=$((CURRENT + 1))
    echo "🔄 Processing ($CURRENT/$TOTAL_FILES): $file"
    
    # Check if file contains corruption patterns
    if grep -q "\\.t\\|impor\\.t\\|expor\\.t\\|fro\\.m" "$file"; then
        echo "   ✨ Fixing corruption patterns in $file"
        
        # Apply all pattern fixes
        for pattern in "${!CORRUPTION_PATTERNS[@]}"; do
            replacement="${CORRUPTION_PATTERNS[$pattern]}"
            if grep -q "$pattern" "$file"; then
                safe_replace "$file" "$pattern" "$replacement"
            fi
        done
        
        # Special case for complex patterns
        sed -i.bak 's/erro\.r)/error)/g' "$file"
        sed -i.bak 's/error instanceo\.f Error/error instanceof Error/g' "$file"
        sed -i.bak 's/\.\([a-zA-Z]\)/\1/g' "$file"  # Remove stray dots before letters
        rm -f "$file.bak" 2>/dev/null || true
        
        echo "   ✅ Fixed $file"
    else
        echo "   ⏭️  No corruption found in $file"
    fi
done

echo ""
echo "🎉 Corruption reversal complete!"
echo "📦 Original files backed up to: $BACKUP_DIR"
echo "🔍 Run 'npm run type-check:dev' to verify fixes"
echo "🚀 Run 'npm run lint:dev:fix' to clean up any remaining issues"
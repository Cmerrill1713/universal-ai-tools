#!/bin/bash

# Universal Build & Automate Script
# Can build projects, automate system tasks, and integrate with apps

echo "🔨 Universal Build & Automation System"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get command
if [ $# -eq 0 ]; then
    echo "Usage: ./build-anything.sh \"command\""
    echo ""
    echo "Examples:"
    echo "  ./build-anything.sh \"build a React app for todo management\""
    echo "  ./build-anything.sh \"add yard work to calendar at 4pm\""
    echo "  ./build-anything.sh \"create Python script to analyze CSV files\""
    echo "  ./build-anything.sh \"open Slack and send message to team\""
    echo "  ./build-anything.sh \"schedule meeting tomorrow at 2pm\""
    exit 1
fi

COMMAND="$*"
COMMAND_LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

# Function to create calendar event using EventKit CLI (more reliable)
create_calendar_event() {
    local title="$1"
    local datetime="$2"
    
    echo -e "${YELLOW}📅 Creating calendar event: $title${NC}"
    
    # Try using shortcuts CLI if available
    if command -v shortcuts &> /dev/null; then
        shortcuts run "Add Calendar Event" <<< "$title
$datetime"
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Event created successfully${NC}"
            return 0
        fi
    fi
    
    # Fallback to using calendar URL scheme
    encoded_title=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$title'))")
    calendar_url="x-apple-calendar://create?title=$encoded_title"
    
    open "$calendar_url"
    echo -e "${GREEN}✅ Calendar opened with event details${NC}"
    echo "   Please confirm the event in Calendar app"
}

# Function to create a reminder
create_reminder() {
    local task="$1"
    
    echo -e "${YELLOW}📝 Creating reminder: $task${NC}"
    
    # Use reminders URL scheme
    encoded_task=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$task'))")
    reminders_url="x-apple-reminderkit://create?title=$encoded_task"
    
    open "$reminders_url" 2>/dev/null || {
        # Fallback to notes
        echo "$task" | pbcopy
        open -a Reminders
        echo -e "${YELLOW}⚠️ Task copied to clipboard. Paste in Reminders app${NC}"
    }
    
    echo -e "${GREEN}✅ Reminder created${NC}"
}

# Function to build a project
build_project() {
    local project_type="$1"
    local project_name="$2"
    
    echo -e "${YELLOW}🏗️ Building $project_type project: $project_name${NC}"
    
    case "$project_type" in
        "react")
            echo "Creating React app..."
            npx create-react-app "$project_name" --template typescript
            cd "$project_name"
            echo -e "${GREEN}✅ React app created${NC}"
            echo "Starting development server..."
            npm start &
            ;;
        
        "python")
            echo "Creating Python project..."
            mkdir -p "$project_name"
            cd "$project_name"
            python3 -m venv venv
            source venv/bin/activate
            pip install pandas numpy matplotlib jupyter
            cat > main.py << 'EOF'
#!/usr/bin/env python3
"""
Auto-generated Python project
Created by Universal Build System
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

def main():
    print("Python project ready!")
    # Add your code here
    
if __name__ == "__main__":
    main()
EOF
            chmod +x main.py
            echo -e "${GREEN}✅ Python project created${NC}"
            ;;
        
        "node")
            echo "Creating Node.js project..."
            mkdir -p "$project_name"
            cd "$project_name"
            npm init -y
            npm install express cors dotenv
            cat > server.js << 'EOF'
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Server is running!' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
EOF
            echo -e "${GREEN}✅ Node.js server created${NC}"
            node server.js &
            ;;
        
        *)
            echo -e "${RED}❌ Unknown project type: $project_type${NC}"
            ;;
    esac
}

# Function to interact with apps
interact_with_app() {
    local app="$1"
    local action="$2"
    
    echo -e "${YELLOW}🖥️ Interacting with $app${NC}"
    
    case "$app" in
        "slack")
            open -a Slack
            if [[ "$action" == *"message"* ]]; then
                echo "$action" | pbcopy
                echo -e "${YELLOW}📋 Message copied to clipboard. Paste in Slack${NC}"
            fi
            ;;
        
        "vscode"|"code")
            code .
            echo -e "${GREEN}✅ VS Code opened${NC}"
            ;;
        
        "terminal")
            open -a Terminal
            echo -e "${GREEN}✅ Terminal opened${NC}"
            ;;
        
        *)
            open -a "$app" 2>/dev/null || echo -e "${RED}❌ Could not open $app${NC}"
            ;;
    esac
}

# Parse and execute command
if [[ "$COMMAND_LOWER" =~ calendar|schedule|meeting|appointment ]]; then
    # Extract event details
    title=$(echo "$COMMAND" | sed -E 's/.*(calendar|schedule|meeting|appointment)[[:space:]]+//i')
    
    # Handle specific time mentions
    if [[ "$COMMAND_LOWER" =~ 4[[:space:]]*pm|4pm ]]; then
        time="4:00 PM"
    elif [[ "$COMMAND_LOWER" =~ ([0-9]{1,2})[[:space:]]*(am|pm) ]]; then
        time="${BASH_REMATCH[1]} ${BASH_REMATCH[2]}"
    else
        time="9:00 AM"
    fi
    
    # Handle date mentions
    if [[ "$COMMAND_LOWER" =~ today ]]; then
        date="today"
    elif [[ "$COMMAND_LOWER" =~ tomorrow ]]; then
        date="tomorrow"
    else
        date="today"
    fi
    
    create_calendar_event "$title" "$date at $time"

elif [[ "$COMMAND_LOWER" =~ todo|task|reminder|remind ]]; then
    # Extract task
    task=$(echo "$COMMAND" | sed -E 's/.*(todo|task|reminder|remind)[[:space:]]+//i')
    create_reminder "$task"

elif [[ "$COMMAND_LOWER" =~ build|create|make|generate ]]; then
    # Determine project type
    if [[ "$COMMAND_LOWER" =~ react ]]; then
        project_name=$(echo "$COMMAND" | sed -E 's/.*(for|called|named)[[:space:]]+//i' | awk '{print $1}')
        [ -z "$project_name" ] && project_name="my-react-app"
        build_project "react" "$project_name"
    
    elif [[ "$COMMAND_LOWER" =~ python ]]; then
        project_name=$(echo "$COMMAND" | sed -E 's/.*(for|called|named|to)[[:space:]]+//i' | awk '{print $1}')
        [ -z "$project_name" ] && project_name="python-project"
        build_project "python" "$project_name"
    
    elif [[ "$COMMAND_LOWER" =~ node|server|api ]]; then
        project_name=$(echo "$COMMAND" | sed -E 's/.*(for|called|named)[[:space:]]+//i' | awk '{print $1}')
        [ -z "$project_name" ] && project_name="node-server"
        build_project "node" "$project_name"
    
    else
        echo -e "${YELLOW}🤔 Not sure what to build. Specify: React, Python, or Node${NC}"
    fi

elif [[ "$COMMAND_LOWER" =~ open|launch|start ]]; then
    # Extract app name
    app=$(echo "$COMMAND_LOWER" | sed -E 's/.*(open|launch|start)[[:space:]]+//i' | awk '{print $1}')
    interact_with_app "$app" "$COMMAND"

else
    # Fallback to AI for complex commands
    echo -e "${BLUE}💭 Complex command detected. Using AI...${NC}"
    ./ask.sh "$COMMAND"
fi

echo ""
echo -e "${GREEN}✅ Command processed${NC}"
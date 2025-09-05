#!/usr/bin/env python3
"""
AppFlowy Project Management Setup Script
Creates a complete project management and requirements tracking system
"""

import asyncio
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Any

# Add the appflowy_mcp directory to the path
sys.path.append('/Users/christianmerrill/Desktop/universal-ai-tools/appflowy-cloud/appflowy_mcp')

try:
    from appflowy_mcp import (
        make_api_request, get_workspace_list, get_workspace_folder, 
        create_new_page, ViewLayout, DEFAULT_BASE_URL
    )
except ImportError as e:
    print(f"Error importing AppFlowy MCP: {e}")
    print("Please ensure appflowy_mcp.py is available")
    sys.exit(1)

class ProjectManagementSetup:
    def __init__(self, base_url="http://localhost", access_token=None):
        self.base_url = base_url
        self.access_token = access_token or self._get_default_token()
        self.workspace_id = None
        self.project_templates = self._load_project_templates()
        
    def _get_default_token(self):
        """Get or create a default access token for local setup"""
        # For local AppFlowy setup, we need to implement token generation
        # This would typically involve user registration/login
        return os.getenv("APPFLOWY_ACCESS_TOKEN", "demo-token-please-replace")
    
    def _load_project_templates(self) -> Dict[str, Any]:
        """Load project management templates"""
        return {
            "requirements_template": {
                "type": "page",
                "children": [
                    {
                        "type": "heading",
                        "data": {
                            "level": 1,
                            "delta": [{"insert": "Software Requirements Document"}]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Project: ", "attributes": {"bold": True}},
                                {"insert": "[Enter Project Name]"}
                            ]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Version: ", "attributes": {"bold": True}},
                                {"insert": "1.0"}
                            ]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Date: ", "attributes": {"bold": True}},
                                {"insert": datetime.now().strftime("%Y-%m-%d")}
                            ]
                        }
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "type": "heading",
                        "data": {
                            "level": 2,
                            "delta": [{"insert": "1. Functional Requirements"}]
                        }
                    },
                    {
                        "type": "bulleted_list",
                        "data": {
                            "delta": [{"insert": "FR-001: User Authentication"}]
                        },
                        "children": [
                            {
                                "type": "bulleted_list",
                                "data": {
                                    "delta": [{"insert": "Description: Users must be able to securely log in and out"}]
                                }
                            },
                            {
                                "type": "bulleted_list",
                                "data": {
                                    "delta": [{"insert": "Priority: High"}]
                                }
                            },
                            {
                                "type": "bulleted_list",
                                "data": {
                                    "delta": [{"insert": "Status: "}] 
                                }
                            }
                        ]
                    },
                    {
                        "type": "heading",
                        "data": {
                            "level": 2,
                            "delta": [{"insert": "2. Non-Functional Requirements"}]
                        }
                    },
                    {
                        "type": "bulleted_list",
                        "data": {
                            "delta": [{"insert": "NFR-001: Performance"}]
                        },
                        "children": [
                            {
                                "type": "bulleted_list",
                                "data": {
                                    "delta": [{"insert": "System must respond within 200ms for 95% of requests"}]
                                }
                            }
                        ]
                    },
                    {
                        "type": "heading",
                        "data": {
                            "level": 2,
                            "delta": [{"insert": "3. Acceptance Criteria"}]
                        }
                    },
                    {
                        "type": "todo_list",
                        "data": {
                            "delta": [{"insert": "User can log in with valid credentials"}]
                        }
                    },
                    {
                        "type": "todo_list",
                        "data": {
                            "delta": [{"insert": "Invalid credentials show appropriate error message"}]
                        }
                    }
                ]
            },
            
            "user_story_template": {
                "type": "page",
                "children": [
                    {
                        "type": "heading",
                        "data": {
                            "level": 1,
                            "delta": [{"insert": "User Story"}]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Story ID: ", "attributes": {"bold": True}},
                                {"insert": "US-001"}
                            ]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Epic: ", "attributes": {"bold": True}},
                                {"insert": "[Enter Epic Name]"}
                            ]
                        }
                    },
                    {
                        "type": "divider"
                    },
                    {
                        "type": "heading",
                        "data": {
                            "level": 2,
                            "delta": [{"insert": "Story"}]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "As a ", "attributes": {"italic": True}},
                                {"insert": "[type of user]"},
                                {"insert": ", I want ", "attributes": {"italic": True}},
                                {"insert": "[some goal]"},
                                {"insert": " so that ", "attributes": {"italic": True}},
                                {"insert": "[some reason/benefit]"}
                            ]
                        }
                    },
                    {
                        "type": "heading",
                        "data": {
                            "level": 2,
                            "delta": [{"insert": "Acceptance Criteria"}]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Given ", "attributes": {"bold": True}},
                                {"insert": "[initial context]"}
                            ]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "When ", "attributes": {"bold": True}},
                                {"insert": "[action is performed]"}
                            ]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Then ", "attributes": {"bold": True}},
                                {"insert": "[expected outcome]"}
                            ]
                        }
                    },
                    {
                        "type": "heading",
                        "data": {
                            "level": 2,
                            "delta": [{"insert": "Definition of Done"}]
                        }
                    },
                    {
                        "type": "todo_list",
                        "data": {
                            "delta": [{"insert": "Code complete and reviewed"}]
                        }
                    },
                    {
                        "type": "todo_list",
                        "data": {
                            "delta": [{"insert": "Unit tests passing"}]
                        }
                    },
                    {
                        "type": "todo_list",
                        "data": {
                            "delta": [{"insert": "Integration tests passing"}]
                        }
                    },
                    {
                        "type": "todo_list",
                        "data": {
                            "delta": [{"insert": "Documentation updated"}]
                        }
                    }
                ]
            },
            
            "project_charter_template": {
                "type": "page",
                "children": [
                    {
                        "type": "heading",
                        "data": {
                            "level": 1,
                            "delta": [{"insert": "Project Charter"}]
                        }
                    },
                    {
                        "type": "heading",
                        "data": {
                            "level": 2,
                            "delta": [{"insert": "Project Overview"}]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Project Name: ", "attributes": {"bold": True}},
                                {"insert": "[Enter Project Name]"}
                            ]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Project Manager: ", "attributes": {"bold": True}},
                                {"insert": "[Enter PM Name]"}
                            ]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Start Date: ", "attributes": {"bold": True}},
                                {"insert": datetime.now().strftime("%Y-%m-%d")}
                            ]
                        }
                    },
                    {
                        "type": "heading",
                        "data": {
                            "level": 2,
                            "delta": [{"insert": "Project Objectives"}]
                        }
                    },
                    {
                        "type": "bulleted_list",
                        "data": {
                            "delta": [{"insert": "Primary objective: [Enter primary goal]"}]
                        }
                    },
                    {
                        "type": "bulleted_list",
                        "data": {
                            "delta": [{"insert": "Success criteria: [Define measurable outcomes]"}]
                        }
                    },
                    {
                        "type": "heading",
                        "data": {
                            "level": 2,
                            "delta": [{"insert": "Scope"}]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "In Scope:", "attributes": {"bold": True}}
                            ]
                        }
                    },
                    {
                        "type": "bulleted_list",
                        "data": {
                            "delta": [{"insert": "[Feature/component included]"}]
                        }
                    },
                    {
                        "type": "paragraph",
                        "data": {
                            "delta": [
                                {"insert": "Out of Scope:", "attributes": {"bold": True}}
                            ]
                        }
                    },
                    {
                        "type": "bulleted_list",
                        "data": {
                            "delta": [{"insert": "[Feature/component excluded]"}]
                        }
                    },
                    {
                        "type": "heading",
                        "data": {
                            "level": 2,
                            "delta": [{"insert": "Stakeholders"}]
                        }
                    },
                    {
                        "type": "bulleted_list",
                        "data": {
                            "delta": [{"insert": "Product Owner: [Name]"}]
                        }
                    },
                    {
                        "type": "bulleted_list",
                        "data": {
                            "delta": [{"insert": "Development Team: [Names]"}]
                        }
                    },
                    {
                        "type": "bulleted_list",
                        "data": {
                            "delta": [{"insert": "QA Team: [Names]"}]
                        }
                    }
                ]
            }
        }
    
    async def setup_workspace_structure(self):
        """Set up the workspace structure for project management"""
        print("🚀 Setting up AppFlowy Project Management System...")
        
        try:
            # Get workspace list
            print("📋 Getting workspace information...")
            workspaces = await get_workspace_list(self.base_url, self.access_token)
            
            if "error" in workspaces:
                print(f"❌ Error getting workspaces: {workspaces['error']}")
                return False
                
            print(f"✅ Found workspaces: {json.dumps(workspaces, indent=2)}")
            
            # For now, we'll work with the first available workspace
            # In a real setup, you'd select or create a specific workspace
            if workspaces and len(workspaces) > 0:
                self.workspace_id = workspaces[0].get('workspace_id')
                print(f"📁 Using workspace ID: {self.workspace_id}")
            else:
                print("❌ No workspaces found. Please create a workspace first.")
                return False
                
            return True
            
        except Exception as e:
            print(f"❌ Error setting up workspace: {e}")
            return False
    
    async def create_project_templates(self):
        """Create project management templates"""
        print("📝 Creating project management templates...")
        
        if not self.workspace_id:
            print("❌ No workspace available")
            return False
        
        try:
            # Get workspace folder structure to find root
            folder_structure = await get_workspace_folder(
                self.base_url, self.access_token, self.workspace_id
            )
            
            if "error" in folder_structure:
                print(f"❌ Error getting folder structure: {folder_structure['error']}")
                return False
            
            print(f"📂 Workspace structure: {json.dumps(folder_structure, indent=2)}")
            
            # Create main project management folder
            print("📁 Creating 'Project Management' folder...")
            
            # For now, we'll assume the root view ID from the folder structure
            # In a real implementation, you'd parse this properly
            root_view_id = "root"  # This needs to be extracted from folder_structure
            
            # Create templates
            templates_to_create = [
                ("Requirements Template", self.project_templates["requirements_template"]),
                ("User Story Template", self.project_templates["user_story_template"]),
                ("Project Charter Template", self.project_templates["project_charter_template"])
            ]
            
            created_pages = []
            for template_name, template_data in templates_to_create:
                print(f"📄 Creating {template_name}...")
                
                result = await create_new_page(
                    base_url=self.base_url,
                    access_token=self.access_token,
                    workspace_id=self.workspace_id,
                    parent_view_id=root_view_id,
                    view_layout=ViewLayout.Document,
                    name=template_name,
                    page_data=template_data
                )
                
                if "error" in result:
                    print(f"⚠️  Error creating {template_name}: {result['error']}")
                else:
                    created_pages.append((template_name, result))
                    print(f"✅ Created {template_name}")
            
            return len(created_pages) > 0
            
        except Exception as e:
            print(f"❌ Error creating templates: {e}")
            return False
    
    async def create_sample_project(self):
        """Create a sample project to demonstrate the system"""
        print("🎯 Creating sample project...")
        
        sample_requirement = {
            "type": "page",
            "children": [
                {
                    "type": "heading",
                    "data": {
                        "level": 1,
                        "delta": [{"insert": "Universal AI Tools - Requirements"}]
                    }
                },
                {
                    "type": "paragraph",
                    "data": {
                        "delta": [
                            {"insert": "Project: ", "attributes": {"bold": True}},
                            {"insert": "Universal AI Tools Platform"}
                        ]
                    }
                },
                {
                    "type": "paragraph",
                    "data": {
                        "delta": [
                            {"insert": "Version: ", "attributes": {"bold": True}},
                            {"insert": "2.0.0"}
                        ]
                    }
                },
                {
                    "type": "divider"
                    },
                {
                    "type": "heading",
                    "data": {
                        "level": 2,
                        "delta": [{"insert": "FR-001: AI Chat Interface"}]
                    }
                },
                {
                    "type": "paragraph",
                    "data": {
                        "delta": [
                            {"insert": "Description: ", "attributes": {"bold": True}},
                            {"insert": "Users must be able to interact with AI agents through a chat interface"}
                        ]
                    }
                },
                {
                    "type": "paragraph",
                    "data": {
                        "delta": [
                            {"insert": "Priority: ", "attributes": {"bold": True}},
                            {"insert": "High", "attributes": {"color": "#ff0000"}}
                        ]
                    }
                },
                {
                    "type": "paragraph",
                    "data": {
                        "delta": [
                            {"insert": "Status: ", "attributes": {"bold": True}},
                            {"insert": "✅ Implemented", "attributes": {"color": "#00ff00"}}
                        ]
                    }
                },
                {
                    "type": "heading",
                    "data": {
                        "level": 2,
                        "delta": [{"insert": "FR-002: Vision Analysis"}]
                    }
                },
                {
                    "type": "paragraph",
                    "data": {
                        "delta": [
                            {"insert": "Description: ", "attributes": {"bold": True}},
                            {"insert": "System must analyze images and provide AI-powered insights"}
                        ]
                    }
                },
                {
                    "type": "paragraph",
                    "data": {
                        "delta": [
                            {"insert": "Priority: ", "attributes": {"bold": True}},
                            {"insert": "High", "attributes": {"color": "#ff0000"}}
                        ]
                    }
                },
                {
                    "type": "paragraph",
                    "data": {
                        "delta": [
                            {"insert": "Status: ", "attributes": {"bold": True}},
                            {"insert": "✅ Implemented", "attributes": {"color": "#00ff00"}}
                        ]
                    }
                },
                {
                    "type": "heading",
                    "data": {
                        "level": 2,
                        "delta": [{"insert": "NFR-001: Performance"}]
                    }
                },
                {
                    "type": "paragraph",
                    "data": {
                        "delta": [
                            {"insert": "Requirement: ", "attributes": {"bold": True}},
                            {"insert": "Backend must respond within 2ms average for 95% of requests"}
                        ]
                    }
                },
                {
                    "type": "paragraph",
                    "data": {
                        "delta": [
                            {"insert": "Current Performance: ", "attributes": {"bold": True}},
                            {"insert": "✅ 1.28ms average - EXCEEDS REQUIREMENT", "attributes": {"color": "#00ff00"}}
                        ]
                    }
                }
            ]
        }
        
        try:
            result = await create_new_page(
                base_url=self.base_url,
                access_token=self.access_token,
                workspace_id=self.workspace_id,
                parent_view_id="root",
                view_layout=ViewLayout.Document,
                name="Universal AI Tools - Requirements",
                page_data=sample_requirement
            )
            
            if "error" in result:
                print(f"⚠️  Error creating sample project: {result['error']}")
                return False
            else:
                print("✅ Created sample project requirements document")
                return True
                
        except Exception as e:
            print(f"❌ Error creating sample project: {e}")
            return False
    
    def print_usage_guide(self):
        """Print usage guide for the project management system"""
        print("\n" + "="*60)
        print("🎯 APPFLOWY PROJECT MANAGEMENT SYSTEM READY!")
        print("="*60)
        print()
        print("📍 Access your project management system:")
        print(f"   🌐 Web Interface: {self.base_url}")
        print(f"   📁 Workspace ID: {self.workspace_id}")
        print()
        print("📋 Available Templates:")
        print("   • Requirements Template - For detailed software requirements")
        print("   • User Story Template - For agile development stories") 
        print("   • Project Charter Template - For project initialization")
        print()
        print("🔧 How to Use:")
        print("   1. Open AppFlowy web interface")
        print("   2. Navigate to your workspace")
        print("   3. Use templates to create new requirements")
        print("   4. Collaborate with your team in real-time")
        print("   5. Track progress and manage requirements")
        print()
        print("💡 Pro Tips:")
        print("   • Use @mentions to notify team members")
        print("   • Link related requirements and user stories")
        print("   • Update status fields to track progress")
        print("   • Use the database view for requirement tracking")
        print()
        print("🔗 Next Steps:")
        print("   • Customize templates for your team's needs")
        print("   • Set up user permissions and access controls")
        print("   • Integrate with your development workflow")
        print("   • Create automated reports and dashboards")
        print()

async def main():
    """Main setup function"""
    print("🚀 AppFlowy Project Management Setup")
    print("=====================================")
    
    # Initialize setup
    setup = ProjectManagementSetup()
    
    # Setup workspace structure
    if not await setup.setup_workspace_structure():
        print("❌ Failed to setup workspace structure")
        return
    
    # Create project templates
    if not await setup.create_project_templates():
        print("⚠️  Warning: Some templates may not have been created")
    
    # Create sample project
    if await setup.create_sample_project():
        print("✅ Sample project created successfully")
    
    # Print usage guide
    setup.print_usage_guide()

if __name__ == "__main__":
    asyncio.run(main())
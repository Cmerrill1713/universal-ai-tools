#!/usr/bin/env ruby

require 'xcodeproj'

# Path to the Xcode project
project_path = './UniversalAITools.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# Get the main target
target = project.targets.first

# Model files to add
model_files = [
  'Models/AppState.swift',
  'Models/SidebarItem.swift', 
  'Models/RAGSettings.swift',
  'Models/ViewMode.swift',
  'Models/SharedTypes.swift',
  'Models/ChartDataPoint.swift',
  'Models/Message.swift',
  'Models/Agent.swift',
  'Models/AgentTypes.swift',
  'Models/Chat.swift',
  'Models/SystemMetrics.swift',
  'Models/VoiceInteraction.swift',
  'Models/ConversationModels.swift',
  'Models/TrendDirection.swift',
  'Models/LoggingTypes.swift'
]

# Create Models group if it doesn't exist
models_group = project.main_group.groups.find { |g| g.name == 'Models' }
if models_group.nil?
  models_group = project.main_group.new_group('Models')
end

# Add each model file
model_files.each do |file_path|
  if File.exist?(file_path)
    # Add file reference
    file_ref = models_group.new_reference(file_path)
    
    # Add to target
    target.add_file_references([file_ref])
    
    puts "Added #{file_path}"
  else
    puts "File not found: #{file_path}"
  end
end

# Save the project
project.save

puts "Models added to Xcode project successfully!"

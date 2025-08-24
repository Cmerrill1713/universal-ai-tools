#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseKey)

class KnowledgeRetriever {
  async getCodebaseOverview(): Promise<void> {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('📊 Retrieving codebase overview...')
    
    const { data, error } = await supabase
      .from('context_storage')
      .select('*')
      .eq('category', 'architecture_patterns')
      .eq('source', 'automated-extraction-2025')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Error retrieving codebase overview:', error)
      return
    }

    if (data && data.length > 0) {
      const overview = JSON.parse(data[0].content)
      console.log('✅ Codebase Overview:')
      console.log(`   📁 Total Files: ${overview.structure.totalFiles.toLocaleString()}`)
      console.log(`   📝 Total Lines: ${overview.structure.totalLines.toLocaleString()}`)
      console.log(`   🗓️ Extracted: ${new Date(overview.extractionDate).toLocaleString()}`)
      console.log('\n🔤 Top Languages:')
      
      overview.summary.primaryLanguages.forEach((lang: unknown, index: number) => {
        console.log(`   ${index + 1}. ${lang.language}: ${lang.files} files, ${lang.lines.toLocaleString()} lines`)
      })

      console.log('\n📂 Key Directories:')
      overview.summary.keyDirectories.forEach((dir: string, index: number) => {
        console.log(`   ${index + 1}. ${dir}`)
      })

      console.log(`\n📄 Key Files: ${overview.structure.keyFiles.length} identified`)
      console.log('   Top 10 by lines:')
      overview.structure.keyFiles
        .sort((a: unknown, b: unknown) => b.lines - a.lines)
        .slice(0, 10)
        .forEach((file: unknown, index: number) => {
          console.log(`   ${index + 1}. ${file.path} (${file.type}, ${file.lines} lines)`)
        })
    }
  }

  async getAccomplishments(): Promise<void> {
    console.log('\n🎯 Retrieving project accomplishments...')
    
    const { data, error } = await supabase
      .from('context_storage')
      .select('*')
      .eq('category', 'project_info')
      .eq('source', 'system-achievements-2025')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('❌ Error retrieving accomplishments:', error)
      return
    }

    if (data && data.length > 0) {
      const accomplishmentsData = JSON.parse(data[0].content)
      console.log('✅ Project Accomplishments:')
      console.log(`   📊 Total: ${accomplishmentsData.summary.totalAccomplishments}`)
      console.log(`   ✅ Completed: ${accomplishmentsData.summary.completedCount}`)
      console.log(`   🚀 High Impact: ${accomplishmentsData.summary.highImpactCount}`)
      
      console.log('\n🏆 Major Accomplishments:')
      accomplishmentsData.accomplishments.forEach((acc: unknown, index: number) => {
        const statusIcon = acc.status === 'completed' ? '✅' : acc.status === 'in_progress' ? '🔄' : '📋'
        const impactIcon = acc.impact === 'high' ? '🚀' : acc.impact === 'medium' ? '⚡' : '💡'
        console.log(`\n   ${index + 1}. ${statusIcon} ${impactIcon} ${acc.title}`)
        console.log(`      Category: ${acc.category}`)
        console.log(`      Description: ${acc.description}`)
        console.log(`      Technical Details:`)
        acc.technicalDetails.slice(0, 3).forEach((detail: string) => {
          console.log(`        • ${detail}`)
        })
        if (acc.dateCompleted) {
          console.log(`      ✅ Completed: ${acc.dateCompleted}`)
        }
      })
    }
  }

  async getCodeSnippets(): Promise<void> {
    console.log('\n💻 Retrieving key code snippets...')
    
    const { data, error } = await supabase
      .from('context_storage')
      .select('*')
      .eq('category', 'code_patterns')
      .eq('source', 'codebase-extraction-2025')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('❌ Error retrieving code snippets:', error)
      return
    }

    if (data && data.length > 0) {
      const snippetsData = JSON.parse(data[0].content)
      console.log('✅ Key Code Snippets:')
      console.log(`   📝 Total Snippets: ${snippetsData.summary.totalSnippets}`)
      console.log(`   🔤 Languages: ${snippetsData.summary.languages.join(', ')}`)
      console.log(`   📂 Categories: ${snippetsData.summary.categories.join(', ')}`)
      
      console.log('\n🔍 Code Snippets:')
      snippetsData.snippets.forEach((snippet: unknown, index: number) => {
        console.log(`\n   ${index + 1}. ${snippet.title} (${snippet.language})`)
        console.log(`      Category: ${snippet.category}`)
        console.log(`      Description: ${snippet.description}`)
        console.log(`      Code Preview: ${snippet.code.substring(0, 200)}${snippet.code.length > 200 ? '...' : ''}`)
      })
    }
  }

  async getSystemStatus(): Promise<void> {
    console.log('\n🔧 Retrieving current system status...')
    
    const { data, error } = await supabase
      .from('context_storage')
      .select('*')
      .eq('category', 'project_info')
      .eq('source', 'real-time-monitoring-2025')
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('❌ Error retrieving system status:', error)
      return
    }

    if (data && data.length > 0) {
      const statusData = JSON.parse(data[0].content)
      console.log('✅ Current System Status:')
      console.log(`   🕐 Last Updated: ${new Date(statusData.timestamp).toLocaleString()}`)
      
      console.log('\n🔧 Backend Services:')
      Object.entries(statusData.services).forEach(([name, service]: [string, any]) => {
        const serviceName = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
        console.log(`   • ${serviceName}: Port ${service.port} - ✅ Running`)
      })

      console.log('\n🤖 AI Integration:')
      Object.entries(statusData.aiIntegration).forEach(([key, value]: [string, any]) => {
        const keyName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
        console.log(`   • ${keyName}: ${value}`)
      })

      console.log('\n🌐 Frontend:')
      Object.entries(statusData.frontend).forEach(([name, frontend]: [string, any]) => {
        const frontendName = name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
        console.log(`   • ${frontendName}: Port ${frontend.port} - ✅ ${frontend.status}`)
      })

      console.log('\n📊 Performance Metrics:')
      Object.entries(statusData.performance).forEach(([key, value]: [string, any]) => {
        const keyName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
        console.log(`   • ${keyName}: ${value}`)
      })
    }
  }

  async getStorageSummary(): Promise<void> {
    console.log('\n📚 Knowledge Storage Summary:')
    
    const { data, error } = await supabase
      .from('context_storage')
      .select('category, source, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('❌ Error retrieving storage summary:', error)
      return
    }

    if (data) {
      const categorySummary: Record<string, number> = {}
      
      data.forEach(item => {
        categorySummary[item.category] = (categorySummary[item.category] || 0) + 1
      })

      console.log('📊 Storage by Category:')
      Object.entries(categorySummary).forEach(([category, count]) => {
        console.log(`   • ${category}: ${count} entries`)
      })

      console.log('\n📅 Recent Entries:')
      data.slice(0, 10).forEach((item, index) => {
        const type = item.metadata?.type || 'unknown'
        console.log(`   ${index + 1}. ${item.category} - ${type} (${new Date(item.created_at).toLocaleDateString()})`)
      })
    }
  }
}

// Main execution
async function main() {
  console.log('🚀 Universal AI Tools - Knowledge Retrieval System')
  console.log('=' .repeat(60))
  console.log('🔗 Supabase URL:', supabaseUrl)
  console.log('🕐 Retrieved at:', new Date().toLocaleString())
  console.log('=' .repeat(60))
  
  const retriever = new KnowledgeRetriever()
  
  try {
    await retriever.getCodebaseOverview()
    await retriever.getAccomplishments()
    await retriever.getCodeSnippets()
    await retriever.getSystemStatus()
    await retriever.getStorageSummary()
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ Knowledge retrieval complete!')
    console.log('📚 All codebase knowledge is now accessible for system reference')
    console.log('🤖 AI assistants can now access comprehensive project context')
    console.log('=' .repeat(60))
    
  } catch (error) {
    console.error('❌ Retrieval failed:', error)
    process.exit(1)
  }
}

main()
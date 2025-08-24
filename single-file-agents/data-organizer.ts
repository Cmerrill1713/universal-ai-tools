#!/usr/bin/env tsx
/**
 * Data Organizer Agent - Single File Agent (IndyDevDan style)
 * 
 * This agent does ONE thing really well: Organizes data into structured profiles
 * Takes face detection results, metadata, and creates organized profiles
 * Groups by relationships, time periods, locations
 * 
 * Usage:
 *   npx tsx single-file-agents/data-organizer.ts --input face-detection-results.json
 *   npx tsx single-file-agents/data-organizer.ts --organize-by age
 *   npx tsx single-file-agents/data-organizer.ts --create-profiles
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { FaceDetection, ProcessedImage } from './face-detector';

// Profile structure
interface PersonProfile {
  id: string;
  name?: string;
  estimatedAge: number;
  ageRange: string;
  gender: string;
  appearances: Array<{
    imageId: string;
    imagePath: string;
    timestamp: string;
    boundingBox: any;
    confidence: number;
    expression?: string;
  }>;
  statistics: {
    totalAppearances: number;
    averageConfidence: number;
    commonExpressions: Record<string, number>;
    firstSeen: string;
    lastSeen: string;
  };
  relationships?: Array<{
    personId: string;
    type: 'appears_with' | 'family' | 'friend';
    coAppearances: number;
  }>;
  metadata?: Record<string, any>;
}

interface OrganizedData {
  profiles: PersonProfile[];
  groups: {
    byAge: Record<string, PersonProfile[]>;
    byGender: Record<string, PersonProfile[]>;
    byTimeframe: Record<string, PersonProfile[]>;
  };
  statistics: {
    totalPeople: number;
    totalImages: number;
    averageAge: number;
    genderDistribution: Record<string, number>;
  };
  relationships: Array<{
    person1: string;
    person2: string;
    strength: number;
  }>;
}

/**
 * Calculate similarity between two face descriptors
 */
function calculateSimilarity(desc1: number[], desc2: number[]): number {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return 0;
  
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    sum += Math.pow(desc1[i] - desc2[i], 2);
  }
  return 1 / (1 + Math.sqrt(sum));
}

/**
 * Group faces into individual profiles based on similarity
 */
function groupFacesIntoProfiles(images: ProcessedImage[]): Map<string, PersonProfile> {
  const profiles = new Map<string, PersonProfile>();
  let profileIdCounter = 1;
  
  // Collect all faces with their image context
  const allFaces: Array<{face: FaceDetection, imagePath: string, imageId: string}> = [];
  
  for (const image of images) {
    for (const face of image.faces) {
      allFaces.push({
        face,
        imagePath: image.path,
        imageId: `img_${image.path.replace(/[^a-z0-9]/gi, '_')}`
      });
    }
  }
  
  // Group similar faces together
  const faceGroups: Array<typeof allFaces> = [];
  const assigned = new Set<number>();
  
  for (let i = 0; i < allFaces.length; i++) {
    if (assigned.has(i)) continue;
    
    const group = [allFaces[i]];
    assigned.add(i);
    
    // Find similar faces
    for (let j = i + 1; j < allFaces.length; j++) {
      if (assigned.has(j)) continue;
      
      // Simple similarity check based on age and gender
      const face1 = allFaces[i].face;
      const face2 = allFaces[j].face;
      
      const ageDiff = Math.abs((face1.age || 0) - (face2.age || 0));
      const sameGender = face1.gender === face2.gender;
      
      if (ageDiff < 5 && sameGender) {
        group.push(allFaces[j]);
        assigned.add(j);
      }
    }
    
    faceGroups.push(group);
  }
  
  // Create profiles from groups
  for (const group of faceGroups) {
    const profileId = `person_${profileIdCounter++}`;
    
    // Calculate statistics
    const ages = group.map(g => g.face.age).filter(Boolean) as number[];
    const avgAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
    const gender = group[0].face.gender || 'unknown';
    
    const expressionCounts: Record<string, number> = {};
    const timestamps: string[] = [];
    
    const appearances = group.map(g => {
      if (g.face.expression) {
        expressionCounts[g.face.expression] = (expressionCounts[g.face.expression] || 0) + 1;
      }
      if (g.face.metadata?.timestamp) {
        timestamps.push(g.face.metadata.timestamp);
      }
      
      return {
        imageId: g.imageId,
        imagePath: g.imagePath,
        timestamp: g.face.metadata?.timestamp || new Date().toISOString(),
        boundingBox: g.face.boundingBox,
        confidence: g.face.confidence,
        expression: g.face.expression
      };
    });
    
    timestamps.sort();
    
    const profile: PersonProfile = {
      id: profileId,
      estimatedAge: avgAge,
      ageRange: `${Math.floor(avgAge / 10) * 10}-${Math.floor(avgAge / 10) * 10 + 9}`,
      gender,
      appearances,
      statistics: {
        totalAppearances: group.length,
        averageConfidence: group.reduce((sum, g) => sum + g.face.confidence, 0) / group.length,
        commonExpressions: expressionCounts,
        firstSeen: timestamps[0] || new Date().toISOString(),
        lastSeen: timestamps[timestamps.length - 1] || new Date().toISOString()
      }
    };
    
    profiles.set(profileId, profile);
  }
  
  return profiles;
}

/**
 * Detect relationships between profiles based on co-appearances
 */
function detectRelationships(profiles: Map<string, PersonProfile>, images: ProcessedImage[]): void {
  // Track co-appearances
  const coAppearances = new Map<string, Map<string, number>>();
  
  for (const [id1, profile1] of profiles) {
    coAppearances.set(id1, new Map());
    
    for (const [id2, profile2] of profiles) {
      if (id1 === id2) continue;
      
      let count = 0;
      
      // Check how many images they appear in together
      for (const app1 of profile1.appearances) {
        for (const app2 of profile2.appearances) {
          if (app1.imageId === app2.imageId) {
            count++;
            break;
          }
        }
      }
      
      if (count > 0) {
        coAppearances.get(id1)!.set(id2, count);
      }
    }
  }
  
  // Add relationships to profiles
  for (const [profileId, profile] of profiles) {
    const relationships: PersonProfile['relationships'] = [];
    const profileCoAppearances = coAppearances.get(profileId);
    
    if (profileCoAppearances) {
      for (const [otherId, count] of profileCoAppearances) {
        relationships.push({
          personId: otherId,
          type: count > 5 ? 'family' : 'friend',
          coAppearances: count
        });
      }
    }
    
    profile.relationships = relationships;
  }
}

/**
 * Organize profiles into groups
 */
function organizeIntoGroups(profiles: PersonProfile[]): OrganizedData['groups'] {
  const byAge: Record<string, PersonProfile[]> = {};
  const byGender: Record<string, PersonProfile[]> = {};
  const byTimeframe: Record<string, PersonProfile[]> = {};
  
  for (const profile of profiles) {
    // Group by age
    if (!byAge[profile.ageRange]) {
      byAge[profile.ageRange] = [];
    }
    byAge[profile.ageRange].push(profile);
    
    // Group by gender
    if (!byGender[profile.gender]) {
      byGender[profile.gender] = [];
    }
    byGender[profile.gender].push(profile);
    
    // Group by year (from first seen date)
    const year = new Date(profile.statistics.firstSeen).getFullYear().toString();
    if (!byTimeframe[year]) {
      byTimeframe[year] = [];
    }
    byTimeframe[year].push(profile);
  }
  
  return { byAge, byGender, byTimeframe };
}

/**
 * Generate statistics from all profiles
 */
function generateStatistics(profiles: PersonProfile[], images: ProcessedImage[]): OrganizedData['statistics'] {
  const totalPeople = profiles.length;
  const totalImages = images.length;
  
  const ages = profiles.map(p => p.estimatedAge).filter(age => age > 0);
  const averageAge = ages.length > 0 ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
  
  const genderDistribution: Record<string, number> = {};
  for (const profile of profiles) {
    genderDistribution[profile.gender] = (genderDistribution[profile.gender] || 0) + 1;
  }
  
  return {
    totalPeople,
    totalImages,
    averageAge,
    genderDistribution
  };
}

/**
 * Extract relationship graph
 */
function extractRelationships(profiles: PersonProfile[]): OrganizedData['relationships'] {
  const relationships: OrganizedData['relationships'] = [];
  const seen = new Set<string>();
  
  for (const profile of profiles) {
    if (!profile.relationships) continue;
    
    for (const rel of profile.relationships) {
      const key = [profile.id, rel.personId].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        relationships.push({
          person1: profile.id,
          person2: rel.personId,
          strength: rel.coAppearances
        });
      }
    }
  }
  
  return relationships.sort((a, b) => b.strength - a.strength);
}

/**
 * Create organized data structure from face detection results
 */
async function createOrganizedProfiles(inputPath: string): Promise<OrganizedData> {
  console.log('📂 Loading face detection results...');
  const data = await readFile(inputPath, 'utf-8');
  const images: ProcessedImage[] = JSON.parse(data);
  
  console.log(`✅ Loaded ${images.length} images with faces`);
  
  // Group faces into profiles
  console.log('👤 Creating person profiles...');
  const profilesMap = groupFacesIntoProfiles(images);
  
  // Detect relationships
  console.log('🔗 Detecting relationships...');
  detectRelationships(profilesMap, images);
  
  const profiles = Array.from(profilesMap.values());
  
  // Organize into groups
  console.log('📊 Organizing into groups...');
  const groups = organizeIntoGroups(profiles);
  
  // Generate statistics
  const statistics = generateStatistics(profiles, images);
  
  // Extract relationships
  const relationships = extractRelationships(profiles);
  
  console.log(`✅ Created ${profiles.length} profiles`);
  
  return {
    profiles,
    groups,
    statistics,
    relationships
  };
}

/**
 * Print a summary report
 */
function printReport(data: OrganizedData): void {
  console.log('\n📊 DATA ORGANIZATION REPORT');
  console.log('='.repeat(50));
  
  console.log('\n📈 Overall Statistics:');
  console.log(`  Total People: ${data.statistics.totalPeople}`);
  console.log(`  Total Images: ${data.statistics.totalImages}`);
  console.log(`  Average Age: ${data.statistics.averageAge}`);
  
  console.log('\n👥 Gender Distribution:');
  Object.entries(data.statistics.genderDistribution).forEach(([gender, count]) => {
    const percentage = Math.round(count / data.statistics.totalPeople * 100);
    console.log(`  ${gender}: ${count} (${percentage}%)`);
  });
  
  console.log('\n👶 Age Groups:');
  Object.entries(data.groups.byAge)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([ageRange, profiles]) => {
      console.log(`  ${ageRange}: ${profiles.length} people`);
    });
  
  console.log('\n📅 By Year:');
  Object.entries(data.groups.byTimeframe)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([year, profiles]) => {
      console.log(`  ${year}: ${profiles.length} people`);
    });
  
  console.log('\n🔗 Top Relationships:');
  data.relationships.slice(0, 5).forEach(rel => {
    console.log(`  ${rel.person1} ↔ ${rel.person2}: ${rel.strength} co-appearances`);
  });
  
  console.log('\n👤 Sample Profiles:');
  data.profiles.slice(0, 3).forEach(profile => {
    console.log(`\n  ${profile.id}:`);
    console.log(`    Age: ${profile.estimatedAge} (${profile.ageRange})`);
    console.log(`    Gender: ${profile.gender}`);
    console.log(`    Appearances: ${profile.statistics.totalAppearances}`);
    console.log(`    Confidence: ${(profile.statistics.averageConfidence * 100).toFixed(1)}%`);
    
    const topExpression = Object.entries(profile.statistics.commonExpressions)
      .sort((a, b) => b[1] - a[1])[0];
    if (topExpression) {
      console.log(`    Most Common Expression: ${topExpression[0]}`);
    }
    
    if (profile.relationships && profile.relationships.length > 0) {
      console.log(`    Relationships: ${profile.relationships.length}`);
    }
  });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Data Organizer Agent - Single File Agent
Usage:
  --input <path>     Process face detection results JSON file
  --create-profiles  Create organized profiles from input
  --help            Show this help message

Example:
  npx tsx single-file-agents/data-organizer.ts --input face-detection-results.json
    `);
    return;
  }
  
  if (args[0] === '--input' && args[1]) {
    const organizedData = await createOrganizedProfiles(args[1]);
    
    // Print report
    printReport(organizedData);
    
    // Save organized data
    const outputPath = join(process.cwd(), 'organized-profiles.json');
    await writeFile(outputPath, JSON.stringify(organizedData, null, 2));
    console.log(`\n💾 Organized profiles saved to: ${outputPath}`);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use by other agents
export { 
  createOrganizedProfiles,
  type PersonProfile,
  type OrganizedData
};
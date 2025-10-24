/**
 * Republic Service - Democratic Governance for Universal AI Tools
 * Manages citizens, roles, voting power, and democratic processes
 */

import { createClient } from '@supabase/supabase-js';

export interface RepublicConfig {
  supabaseUrl: string;
  supabaseKey: string;
  enableNeuralCitizenship: boolean;
  enableUATPromptCitizenship: boolean;
  reputationDecayRate: number;
  votingPowerMultiplier: number;
}

export interface Citizen {
  id: string;
  username: string;
  email: string;
  role: 'citizen' | 'senator' | 'consul' | 'dictator';
  votingPower: number;
  reputation: number;
  neuralContribution: number;
  uatPromptContribution: number;
  contributions: Contribution[];
  achievements: Achievement[];
  joinedAt: Date;
  lastActive: Date;
  isActive: boolean;
}

export interface Contribution {
  id: string;
  citizenId: string;
  type: 'proposal' | 'vote' | 'discussion' | 'implementation' | 'review';
  description: string;
  impact: number;
  neuralValue: number;
  uatPromptValue: number;
  timestamp: Date;
  recognized: boolean;
}

export interface Achievement {
  id: string;
  citizenId: string;
  title: string;
  description: string;
  category: 'governance' | 'technical' | 'community' | 'innovation';
  points: number;
  neuralPoints: number;
  uatPromptPoints: number;
  earnedAt: Date;
}

export interface RepublicStats {
  totalCitizens: number;
  activeCitizens: number;
  senators: number;
  consuls: number;
  dictators: number;
  totalContributions: number;
  averageReputation: number;
  neuralContributionRate: number;
  uatPromptContributionRate: number;
  democraticHealth: number;
}

export class RepublicService {
  private supabase: any;
  private config: RepublicConfig;

  constructor(config: RepublicConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Register a new citizen in the republic
   */
  async registerCitizen(citizenData: {
    username: string;
    email: string;
    initialRole?: 'citizen' | 'senator' | 'consul' | 'dictator';
  }): Promise<Citizen> {
    console.log('🏛️ Registering new citizen in the republic...');

    const now = new Date();
    const citizen: Citizen = {
      id: `citizen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username: citizenData.username,
      email: citizenData.email,
      role: citizenData.initialRole || 'citizen',
      votingPower: this.calculateInitialVotingPower(citizenData.initialRole),
      reputation: 100, // Starting reputation
      neuralContribution: 0,
      uatPromptContribution: 0,
      contributions: [],
      achievements: [],
      joinedAt: now,
      lastActive: now,
      isActive: true
    };

    // Store citizen in database
    const { error } = await this.supabase
      .from('republic_citizens')
      .insert([citizen]);

    if (error) {
      throw new Error(`Failed to register citizen: ${error.message}`);
    }

    // Award initial achievement
    await this.awardAchievement(citizen.id, {
      title: 'First Citizen',
      description: 'Welcome to the Universal AI Tools Republic!',
      category: 'community',
      points: 10,
      neuralPoints: 0,
      uatPromptPoints: 0
    });

    console.log(`✅ Citizen registered: ${citizen.username} (${citizen.role})`);
    return citizen;
  }

  /**
   * Update citizen role based on contributions and reputation
   */
  async updateCitizenRole(citizenId: string): Promise<Citizen> {
    console.log('👑 Updating citizen role...');

    // Get current citizen data
    const { data: citizen, error: fetchError } = await this.supabase
      .from('republic_citizens')
      .select('*')
      .eq('id', citizenId)
      .single();

    if (fetchError || !citizen) {
      throw new Error(`Citizen not found: ${citizenId}`);
    }

    // Calculate new role based on reputation and contributions
    const newRole = this.calculateRole(citizen);
    
    if (newRole !== citizen.role) {
      // Update role
      const { error: updateError } = await this.supabase
        .from('republic_citizens')
        .update({ 
          role: newRole,
          votingPower: this.calculateVotingPower(newRole, citizen.reputation)
        })
        .eq('id', citizenId);

      if (updateError) {
        throw new Error(`Failed to update role: ${updateError.message}`);
      }

      // Award role change achievement
      await this.awardAchievement(citizenId, {
        title: `Promoted to ${newRole}`,
        description: `Congratulations on your promotion to ${newRole}!`,
        category: 'governance',
        points: this.getRolePoints(newRole),
        neuralPoints: citizen.neuralContribution,
        uatPromptPoints: citizen.uatPromptContribution
      });

      console.log(`✅ Role updated: ${citizen.username} -> ${newRole}`);
    }

    return { ...citizen, role: newRole };
  }

  /**
   * Record a contribution from a citizen
   */
  async recordContribution(contribution: Omit<Contribution, 'id' | 'timestamp'>): Promise<Contribution> {
    console.log('📝 Recording citizen contribution...');

    const now = new Date();
    const newContribution: Contribution = {
      ...contribution,
      id: `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now
    };

    // Store contribution
    const { error } = await this.supabase
      .from('republic_contributions')
      .insert([newContribution]);

    if (error) {
      throw new Error(`Failed to record contribution: ${error.message}`);
    }

    // Update citizen stats
    await this.updateCitizenStats(contribution.citizenId, newContribution);

    // Check for achievements
    await this.checkAchievements(contribution.citizenId);

    console.log(`✅ Contribution recorded: ${newContribution.type}`);
    return newContribution;
  }

  /**
   * Award an achievement to a citizen
   */
  async awardAchievement(citizenId: string, achievementData: Omit<Achievement, 'id' | 'citizenId' | 'earnedAt'>): Promise<Achievement> {
    console.log('🏆 Awarding achievement...');

    const now = new Date();
    const achievement: Achievement = {
      ...achievementData,
      id: `achieve_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      citizenId,
      earnedAt: now
    };

    // Store achievement
    const { error } = await this.supabase
      .from('republic_achievements')
      .insert([achievement]);

    if (error) {
      throw new Error(`Failed to award achievement: ${error.message}`);
    }

    // Update citizen points
    await this.updateCitizenPoints(citizenId, achievement);

    console.log(`✅ Achievement awarded: ${achievement.title}`);
    return achievement;
  }

  /**
   * Get republic statistics
   */
  async getRepublicStats(): Promise<RepublicStats> {
    console.log('📊 Calculating republic statistics...');

    const { data: citizens } = await this.supabase
      .from('republic_citizens')
      .select('*');

    const { data: contributions } = await this.supabase
      .from('republic_contributions')
      .select('*');

    if (!citizens) {
      return this.getEmptyStats();
    }

    const activeCitizens = citizens.filter(c => c.isActive).length;
    const senators = citizens.filter(c => c.role === 'senator').length;
    const consuls = citizens.filter(c => c.role === 'consul').length;
    const dictators = citizens.filter(c => c.role === 'dictator').length;

    const totalContributions = contributions?.length || 0;
    const averageReputation = citizens.reduce((sum, c) => sum + c.reputation, 0) / citizens.length;

    const neuralContributions = contributions?.filter(c => c.neuralValue > 0).length || 0;
    const uatPromptContributions = contributions?.filter(c => c.uatPromptValue > 0).length || 0;

    const neuralContributionRate = totalContributions > 0 ? neuralContributions / totalContributions : 0;
    const uatPromptContributionRate = totalContributions > 0 ? uatPromptContributions / totalContributions : 0;

    const democraticHealth = this.calculateDemocraticHealth(citizens, contributions || []);

    return {
      totalCitizens: citizens.length,
      activeCitizens,
      senators,
      consuls,
      dictators,
      totalContributions,
      averageReputation,
      neuralContributionRate,
      uatPromptContributionRate,
      democraticHealth
    };
  }

  /**
   * Get citizen leaderboard
   */
  async getCitizenLeaderboard(limit: number = 10): Promise<Citizen[]> {
    const { data: citizens, error } = await this.supabase
      .from('republic_citizens')
      .select('*')
      .eq('isActive', true)
      .order('reputation', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch leaderboard: ${error.message}`);
    }

    return citizens || [];
  }

  /**
   * Calculate initial voting power based on role
   */
  private calculateInitialVotingPower(role?: string): number {
    switch (role) {
      case 'dictator': return 1000;
      case 'consul': return 100;
      case 'senator': return 50;
      case 'citizen':
      default: return 10;
    }
  }

  /**
   * Calculate voting power based on role and reputation
   */
  private calculateVotingPower(role: string, reputation: number): number {
    const basePower = this.calculateInitialVotingPower(role);
    const reputationMultiplier = 1 + (reputation - 100) / 1000; // Scale reputation impact
    return Math.floor(basePower * reputationMultiplier * this.config.votingPowerMultiplier);
  }

  /**
   * Calculate role based on reputation and contributions
   */
  private calculateRole(citizen: any): string {
    const reputation = citizen.reputation;
    const contributions = citizen.contributions?.length || 0;
    const neuralContribution = citizen.neuralContribution || 0;
    const uatPromptContribution = citizen.uatPromptContribution || 0;

    // Dictator: Highest reputation and significant contributions
    if (reputation >= 1000 && contributions >= 50 && (neuralContribution >= 100 || uatPromptContribution >= 100)) {
      return 'dictator';
    }

    // Consul: High reputation and good contributions
    if (reputation >= 500 && contributions >= 25 && (neuralContribution >= 50 || uatPromptContribution >= 50)) {
      return 'consul';
    }

    // Senator: Moderate reputation and some contributions
    if (reputation >= 250 && contributions >= 10) {
      return 'senator';
    }

    // Citizen: Default role
    return 'citizen';
  }

  /**
   * Update citizen statistics
   */
  private async updateCitizenStats(citizenId: string, contribution: Contribution): Promise<void> {
    const { data: citizen } = await this.supabase
      .from('republic_citizens')
      .select('*')
      .eq('id', citizenId)
      .single();

    if (!citizen) return;

    const updates: any = {
      lastActive: new Date(),
      reputation: Math.min(1000, citizen.reputation + contribution.impact),
      neuralContribution: citizen.neuralContribution + contribution.neuralValue,
      uatPromptContribution: citizen.uatPromptContribution + contribution.uatPromptValue
    };

    await this.supabase
      .from('republic_citizens')
      .update(updates)
      .eq('id', citizenId);
  }

  /**
   * Update citizen points from achievement
   */
  private async updateCitizenPoints(citizenId: string, achievement: Achievement): Promise<void> {
    const { data: citizen } = await this.supabase
      .from('republic_citizens')
      .select('*')
      .eq('id', citizenId)
      .single();

    if (!citizen) return;

    const updates: any = {
      reputation: Math.min(1000, citizen.reputation + achievement.points),
      neuralContribution: citizen.neuralContribution + achievement.neuralPoints,
      uatPromptContribution: citizen.uatPromptContribution + achievement.uatPromptPoints
    };

    await this.supabase
      .from('republic_citizens')
      .update(updates)
      .eq('id', citizenId);
  }

  /**
   * Check for new achievements
   */
  private async checkAchievements(citizenId: string): Promise<void> {
    const { data: citizen } = await this.supabase
      .from('republic_citizens')
      .select('*')
      .eq('id', citizenId)
      .single();

    if (!citizen) return;

    const { data: contributions } = await this.supabase
      .from('republic_contributions')
      .select('*')
      .eq('citizenId', citizenId);

    const { data: achievements } = await this.supabase
      .from('republic_achievements')
      .select('*')
      .eq('citizenId', citizenId);

    const contributionCount = contributions?.length || 0;
    const achievementCount = achievements?.length || 0;

    // Check for contribution milestones
    if (contributionCount >= 10 && !achievements?.find(a => a.title === 'Contributor')) {
      await this.awardAchievement(citizenId, {
        title: 'Contributor',
        description: 'Made 10 contributions to the republic',
        category: 'community',
        points: 25,
        neuralPoints: 0,
        uatPromptPoints: 0
      });
    }

    if (contributionCount >= 50 && !achievements?.find(a => a.title === 'Dedicated Citizen')) {
      await this.awardAchievement(citizenId, {
        title: 'Dedicated Citizen',
        description: 'Made 50 contributions to the republic',
        category: 'community',
        points: 50,
        neuralPoints: 0,
        uatPromptPoints: 0
      });
    }

    // Check for neural contribution achievements
    if (citizen.neuralContribution >= 100 && !achievements?.find(a => a.title === 'Neural Pioneer')) {
      await this.awardAchievement(citizenId, {
        title: 'Neural Pioneer',
        description: 'Made significant neural network contributions',
        category: 'innovation',
        points: 75,
        neuralPoints: 25,
        uatPromptPoints: 0
      });
    }

    // Check for UAT-prompt achievements
    if (citizen.uatPromptContribution >= 100 && !achievements?.find(a => a.title === 'Prompt Engineer')) {
      await this.awardAchievement(citizenId, {
        title: 'Prompt Engineer',
        description: 'Made significant UAT-prompt contributions',
        category: 'technical',
        points: 75,
        neuralPoints: 0,
        uatPromptPoints: 25
      });
    }
  }

  /**
   * Calculate democratic health score
   */
  private calculateDemocraticHealth(citizens: any[], contributions: any[]): number {
    if (citizens.length === 0) return 0;

    const activeCitizens = citizens.filter(c => c.isActive).length;
    const participationRate = activeCitizens / citizens.length;

    const avgReputation = citizens.reduce((sum, c) => sum + c.reputation, 0) / citizens.length;
    const reputationHealth = Math.min(1, avgReputation / 500);

    const recentContributions = contributions.filter(c => 
      new Date(c.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    const activityHealth = Math.min(1, recentContributions / (citizens.length * 0.1));

    return (participationRate + reputationHealth + activityHealth) / 3;
  }

  /**
   * Get role points for achievements
   */
  private getRolePoints(role: string): number {
    switch (role) {
      case 'dictator': return 200;
      case 'consul': return 100;
      case 'senator': return 50;
      case 'citizen':
      default: return 0;
    }
  }

  /**
   * Get empty stats for new republic
   */
  private getEmptyStats(): RepublicStats {
    return {
      totalCitizens: 0,
      activeCitizens: 0,
      senators: 0,
      consuls: 0,
      dictators: 0,
      totalContributions: 0,
      averageReputation: 0,
      neuralContributionRate: 0,
      uatPromptContributionRate: 0,
      democraticHealth: 0
    };
  }
}
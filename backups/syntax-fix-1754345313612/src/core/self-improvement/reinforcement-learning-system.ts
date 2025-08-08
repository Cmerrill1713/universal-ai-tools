import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as tf from '@tensorflow/tfjs-node';
import { LogContext, logger } from '../../utils/enhanced-logger';

// State and Action Interfaces;
export interface StateSpace {
  type: 'discrete' | 'continuous' | 'mixed';
  dimensions: number;
  bounds?: { min: number; max: number }[];
  discreteValues?: any[];
}

export interface ActionSpace {
  type: 'discrete' | 'continuous' | 'mixed';
  dimensions: number;
  bounds?: { min: number; max: number }[];
  discreteActions?: Action[];
}

export interface Action {
  id: string;
  name: string;
  parameters?: any;
}

export interface State {
  values: number[];
  features?: Map<string, any>;
  timestamp: Date;
}

export interface Experience {
  id: string;
  state: State;
  action: Action | number[];
  reward: number;
  nextState: State;
  done: boolean;
  metadata?: any;
}

export interface RewardFunction {
  type: 'sparse' | 'dense' | 'shaped';
  calculate: (state: State, action: Action | number[], nextState: State) => number;
}

export interface TerminationCondition {
  maxSteps?: number;
  targetReward?: number;
  customCondition?: (state: State) => boolean;
}

// Environment and Agent Interfaces;
export interface RLEnvironment {
  id: string;
  name: string;
  description: string;
  stateSpace: StateSpace;
  actionSpace: ActionSpace;
  rewardFunction: RewardFunction;
  terminationCondition: TerminationCondition;
  metadata: any;
}

export interface RLAgent {
  id: string;
  type: 'q-learning' | 'dqn' | 'policy-gradient' | 'actor-critic' | 'ppo';
  environmentId: string;
  hyperparameters: RLHyperparameters;
  performance: RLPerformance;
  model?: tf?.LayersModel;
  training: boolean;
}

export interface RLHyperparameters {
  learningRate: number;
  discountFactor: number;
  epsilon?: number; // For epsilon-greedy;
  epsilonDecay?: number;
  batchSize?: number;
  updateFrequency?: number;
  targetUpdateFrequency?: number; // For DQN;
  entropy?: number; // For policy gradient;
  clipRange?: number; // For PPO;
}

export interface RLPerformance {
  episodesCompleted: number;
  totalReward: number;
  averageReward: number;
  bestReward: number;
  convergenceRate: number;
  explorationRate: number;
}

export interface TrainingSession {
  id: string;
  agentId: string;
  startTime: Date;
  endTime?: Date;
  episodes: Episode[];
  metrics: TrainingMetrics;
}

export interface Episode {
  number: number;
  steps: number;
  totalReward: number;
  experiences: Experience[];
  startState: State;
  finalState: State;
}

export interface TrainingMetrics {
  episodeRewards: number[];
  lossHistory: number[];
  explorationHistory: number[];
  valueEstimates?: number[];
  policyEntropy?: number[];
}

export class ReinforcementLearningSystem extends EventEmitter {
  private environments: Map<string, RLEnvironment> = new Map();
  private agents: Map<string, RLAgent> = new Map();
  private replayBuffer: Map<string, Experience[]> = new Map();
  private trainingSessions: Map<string, TrainingSession> = new Map();
  
  constructor(
    private supabase: SupabaseClient,
    private config: {
      maxReplayBufferSize: number;
      saveFrequency: number; // Episodes between saves;
      enableTensorBoard: boolean;
    } = {
      maxReplayBufferSize: 100000,
      saveFrequency: 100,
      enableTensorBoard: false;
    }
  ) {
    super();
    this?.initialize();
  }

  /**
   * Initialize the RL system;
   */
  private async initialize(): Promise<void> {
    try {
      // Load existing environments and agents;
      await this?.loadEnvironments();
      await this?.loadAgents();
      
      logger?.info('Reinforcement Learning System initialized', LogContext?.SYSTEM);
    } catch (error) {
      logger?.error('Failed to initialize RL System', LogContext?.SYSTEM, { error });
    }
  }

  /**
   * Create a new RL environment;
   */
  async createEnvironment(config: {
    name: string;
    description: string;
    stateSpace: StateSpace;
    actionSpace: ActionSpace;
    rewardFunction: RewardFunction;
    terminationCondition: TerminationCondition;
  }): Promise<RLEnvironment> {
    const environment: RLEnvironment = {
      id: uuidv4(),
      ...config,
      metadata: {
        created: new Date(),
        version: '1?.0?.0'
      }
    };

    this?.environments?.set(environment?.id, environment);
    await this?.storeEnvironment(environment);
    this?.emit('environment-created', environment);
    return environment;
  }

  /**
   * Create a new RL agent;
   */
  async createAgent(config: {
    type: RLAgent['type'];
    environmentId: string;
    hyperparameters?: Partial<RLHyperparameters>;
  }): Promise<RLAgent> {
    const environment = this?.environments?.get(config?.environmentId);
    if (!environment) {
      throw new Error(`Environment ${config?.environmentId} not found`);
    }

    const defaultHyperparameters: RLHyperparameters = {
      learningRate: 001,
      discountFactor: 99,
      epsilon: 0,
      epsilonDecay: 995,
      batchSize: 32,
      updateFrequency: 4,
      targetUpdateFrequency: 1000,
      entropy: 01,
      clipRange: 2;
    };

    const agent: RLAgent = {
      id: uuidv4(),
      type: config?.type,
      environmentId: config?.environmentId,
      hyperparameters: { ...defaultHyperparameters, ...config?.hyperparameters },
      performance: {
        episodesCompleted: 0,
        totalReward: 0,
        averageReward: 0,
        bestReward: -Infinity,
        convergenceRate: 0,
        explorationRate: 0,
      },
      training: false;
    };

    // Create neural network model based on agent type;
    agent?.model = await this?.createModel(agent, environment);

    this?.agents?.set(agent?.id, agent);
    this?.replayBuffer?.set(agent?.id, []);
    
    await this?.storeAgent(agent);
    this?.emit('agent-created', agent);
    return agent;
  }

  /**
   * Train an agent;
   */
  async train(
    agentId: string,
    episodes: number,
    callbacks?: {
      onEpisodeComplete?: (episode: Episode) => void;
      onTrainingComplete?: (session: TrainingSession) => void;
    }
  ): Promise<TrainingSession> {
    const agent = this?.agents?.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const environment = this?.environments?.get(agent?.environmentId);
    if (!environment) {
      throw new Error(`Environment ${agent?.environmentId} not found`);
    }

    agent?.training = true;
    const session: TrainingSession = {
      id: uuidv4(),
      agentId,
      startTime: new Date(),
      episodes: [],
      metrics: {
        episodeRewards: [],
        lossHistory: [],
        explorationHistory: [],
        valueEstimates: [],
        policyEntropy: []
      }
    };

    this?.trainingSessions?.set(session?.id, session);

    try {
      for (let ep = 0; ep < episodes; ep++) {
        const episode = await this?.runEpisode(agent, environment, ep);
        session?.episodes?.push(episode);
        session?.metrics?.episodeRewards?.push(episode?.totalReward);
        
        // Update agent performance;
        agent?.performance?.episodesCompleted++;
        agent?.performance?.totalReward += episode?.totalReward;
        agent?.performance?.averageReward = 
          agent?.performance?.totalReward / agent?.performance?.episodesCompleted;
        agent?.performance?.bestReward = Math?.max(
          agent?.performance?.bestReward,
          episode?.totalReward;
        );

        // Train on experiences;
        if (agent?.type !== 'q-learning') {
          const loss = await this?.updateAgent(agent, episode?.experiences);
          session?.metrics?.lossHistory?.push(loss);
        }

        // Update exploration rate;
        if (agent?.hyperparameters?.epsilon) {
          agent?.hyperparameters?.epsilon *= agent?.hyperparameters?.epsilonDecay!;
          agent?.performance?.explorationRate = agent?.hyperparameters?.epsilon;
          session?.metrics?.explorationHistory?.push(agent?.hyperparameters?.epsilon);
        }

        // Callback;
        if (callbacks?.onEpisodeComplete) {
          callbacks?.onEpisodeComplete(episode);
        }

        // Save periodically;
        if ((ep + 1) % this?.config?.saveFrequency === 0) {
          await this?.saveAgent(agent);
        }

        // Emit progress;
        this?.emit('training-progress', {
          agentId,
          episode: ep + 1,
          totalEpisodes: episodes,
          reward: episode?.totalReward;
        });
      }

      session?.endTime = new Date();
      agent?.training = false;

      // Final save;
      await this?.saveAgent(agent);
      await this?.storeTrainingSession(session);

      if (callbacks?.onTrainingComplete) {
        callbacks?.onTrainingComplete(session);
      }

      this?.emit('training-complete', session);
      return session;
    } catch (error) {
      agent?.training = false;
      logger?.error(`Training failed for agent ${agentId}`, LogContext?.SYSTEM, { error });
      throw error;
    }
  }

  /**
   * Run a single episode;
   */
  private async runEpisode(
    agent: RLAgent,
    environment: RLEnvironment,
    episodeNumber: number;
  ): Promise<Episode> {
    const experiences: Experience[] = [];
    let state = this?.resetEnvironment(environment);
    let totalReward = 0,
    let steps = 0,
    let done = false;

    const episode: Episode = {
      number: episodeNumber,
      steps: 0,
      totalReward: 0,
      experiences: [],
      startState: state,
      finalState: state;
    };

    while (!done && steps < (environment?.terminationCondition?.maxSteps || 1000)) {
      // Select action;
      const action = await this?.selectAction(agent, state, environment);

      // Execute action;
      const { nextState, reward, isDone } = await this?.step(
        environment,
        state,
        action;
      );

      // Store experience;
      const experience: Experience = {
        id: uuidv4(),
        state,
        action,
        reward,
        nextState,
        done: isDone;
      };

      experiences?.push(experience);
      this?.addToReplayBuffer(agent?.id, experience);

      // Update for Q-learning (online learning)
      if (agent?.type === 'q-learning') {
        await this?.updateQLearning(agent, experience);
      }

      totalReward += reward;
      state = nextState;
      done = isDone;
      steps++;
    }

    episode?.steps = steps;
    episode?.totalReward = totalReward;
    episode?.experiences = experiences;
    episode?.finalState = state;

    return episode;
  }

  /**
   * Select action based on agent policy;
   */
  private async selectAction(
    agent: RLAgent,
    state: State,
    environment: RLEnvironment;
  ): Promise<Action | number[]> {
    switch (agent?.type) {
      case 'q-learning':
        return this?.selectActionQLearning(agent, state, environment);
      
      case 'dqn':
        return this?.selectActionDQN(agent, state, environment);
      
      case 'policy-gradient':
      case 'actor-critic':
      case 'ppo':
        return this?.selectActionPolicyBased(agent, state, environment);
      
      default:
        throw new Error(`Unknown agent type: ${agent?.type}`);
    }
  }

  /**
   * Q-Learning action selection (epsilon-greedy)
   */
  private async selectActionQLearning(
    agent: RLAgent,
    state: State,
    environment: RLEnvironment;
  ): Promise<Action> {
    if (Math?.random() < agent?.hyperparameters?.epsilon!) {
      // Explore: random action;
      const actions = environment?.actionSpace?.discreteActions!;
      return actions[Math?.floor(Math?.random() * actions?.length)];
    } else {
      // Exploit: best action based on Q-values;
      // This is simplified - would need Q-table implementation;
      const actions = environment?.actionSpace?.discreteActions!;
      return actions[0]; // Placeholder;
    }
  }

  /**
   * DQN action selection;
   */
  private async selectActionDQN(
    agent: RLAgent,
    state: State,
    environment: RLEnvironment;
  ): Promise<Action> {
    if (Math?.random() < agent?.hyperparameters?.epsilon!) {
      // Explore;
      const actions = environment?.actionSpace?.discreteActions!;
      return actions[Math?.floor(Math?.random() * actions?.length)];
    } else {
      // Exploit using neural network;
      const stateTensor = tf?.tensor2d([state?.values]);
      const qValues = agent?.model!.predict(stateTensor) as tf?.Tensor;
      const actionIndex = (await qValues?.argMax(-1).data())[0];
      stateTensor?.dispose();
      qValues?.dispose();
      
      return environment?.actionSpace?.discreteActions![actionIndex];
    }
  }

  /**
   * Policy-based action selection;
   */
  private async selectActionPolicyBased(
    agent: RLAgent,
    state: State,
    environment: RLEnvironment;
  ): Promise<Action | number[]> {
    const stateTensor = tf?.tensor2d([state?.values]);
    
    if (environment?.actionSpace?.type === 'discrete') {
      // Get action probabilities;
      const probs = agent?.model!.predict(stateTensor) as tf?.Tensor;
      const actionIndex = await this?.sampleFromDistribution(probs);
      
      stateTensor?.dispose();
      probs?.dispose();
      
      return environment?.actionSpace?.discreteActions![actionIndex];
    } else {
      // Continuous actions;
      const actionTensor = agent?.model!.predict(stateTensor) as tf?.Tensor;
      const actions = await actionTensor?.data();
      
      stateTensor?.dispose();
      actionTensor?.dispose();
      
      return Array?.from(actions);
    }
  }

  /**
   * Sample action from probability distribution;
   */
  private async sampleFromDistribution(probs: tf?.Tensor): Promise<number> {
    const probsArray = await probs?.data();
    const cumSum = [];
    let sum = 0,
    
    for (let i = 0; i < probsArray?.length; i++) {
      sum += probsArray[i];
      cumSum?.push(sum);
    }
    
    const random = Math?.random() * sum;
    
    for (let i = 0; i < cumSum?.length; i++) {
      if (random < cumSum[i]) {
        return i;
      }
    }
    
    return cumSum?.length - 1;
  }

  /**
   * Execute environment step;
   */
  private async step(
    environment: RLEnvironment,
    state: State,
    action: Action | number[]
  ): Promise<{ nextState: State; reward: number; isDone: boolean }> {
    // This is environment-specific and would be implemented based on the task;
    // For now, a simple simulation;
    
    const nextState: State = {
      values: state?.values?.map(v => v + Math?.random() * 0?.1 - 0?.05),
      timestamp: new Date()
    };
    
    const reward = environment?.rewardFunction?.calculate(state, action, nextState);
    
    const isDone = environment?.terminationCondition?.customCondition;
      ? environment?.terminationCondition?.customCondition(nextState)
      : false;
    
    return { nextState, reward, isDone };
  }

  /**
   * Update agent based on experiences;
   */
  private async updateAgent(
    agent: RLAgent,
    experiences: Experience[]
  ): Promise<number> {
    switch (agent?.type) {
      case 'dqn':
        return this?.updateDQN(agent, experiences);
      
      case 'policy-gradient':
        return this?.updatePolicyGradient(agent, experiences);
      
      case 'actor-critic':
        return this?.updateActorCritic(agent, experiences);
      
      case 'ppo':
        return this?.updatePPO(agent, experiences);
      
      default:
        return 0,
    }
  }

  /**
   * Update Q-Learning (tabular)
   */
  private async updateQLearning(
    agent: RLAgent,
    experience: Experience;
  ): Promise<void> {
    // Simplified Q-learning update;
    // In practice, would maintain Q-table;
    const alpha = agent?.hyperparameters?.learningRate;
    const gamma = agent?.hyperparameters?.discountFactor;
    
    // Q(s,a) = Q(s,a) + α[r + γ max Q(s',a') - Q(s,a)]
    // This is a placeholder - actual implementation would update Q-table;
  }

  /**
   * Update DQN;
   */
  private async updateDQN(
    agent: RLAgent,
    experiences: Experience[]
  ): Promise<number> {
    if (experiences?.length < agent?.hyperparameters?.batchSize!) {
      return 0,
    }

    // Sample batch from replay buffer;
    const batch = this?.sampleBatch(agent?.id, agent?.hyperparameters?.batchSize!);
    
    // Prepare training data;
    const states = tf?.tensor2d(batch?.map(e => e?.state?.values));
    const nextStates = tf?.tensor2d(batch?.map(e => e?.nextState?.values));
    
    // Calculate target Q-values;
    const rewards = tf?.tensor1d(batch?.map(e => e?.reward));
    const dones = tf?.tensor1d(batch?.map(e => e?.done ? 1 : 0));
    
    // Get Q-values for next states (target network)
    const nextQValues = agent?.model!.predict(nextStates) as tf?.Tensor;
    const maxNextQValues = nextQValues?.max(-1);
    
    // Calculate targets: r + γ * max Q(s',a') * (1 - done)
    const gamma = tf?.scalar(agent?.hyperparameters?.discountFactor);
    const targets = rewards?.add(gamma?.mul(maxNextQValues).mul(dones?.sub(1).abs()));
    
    // Train the model;
    const currentQValues = agent?.model!.predict(states) as tf?.Tensor;
    
    // Calculate loss (MSE)
    const loss = tf?.losses?.meanSquaredError(targets, currentQValues);
    const lossValue = await loss?.data();
    
    // Cleanup tensors;
    states?.dispose();
    nextStates?.dispose();
    rewards?.dispose();
    dones?.dispose();
    nextQValues?.dispose();
    maxNextQValues?.dispose();
    gamma?.dispose();
    targets?.dispose();
    currentQValues?.dispose();
    loss?.dispose();
    
    return lossValue[0];
  }

  /**
   * Update Policy Gradient;
   */
  private async updatePolicyGradient(
    agent: RLAgent,
    experiences: Experience[]
  ): Promise<number> {
    // Simplified policy gradient implementation;
    // In practice, would compute gradients and update policy network;
    return 0,
  }

  /**
   * Update Actor-Critic;
   */
  private async updateActorCritic(
    agent: RLAgent,
    experiences: Experience[]
  ): Promise<number> {
    // Simplified actor-critic implementation;
    // In practice, would update both actor and critic networks;
    return 0,
  }

  /**
   * Update PPO;
   */
  private async updatePPO(
    agent: RLAgent,
    experiences: Experience[]
  ): Promise<number> {
    // Simplified PPO implementation;
    // In practice, would implement clipped surrogate objective;
    return 0,
  }

  /**
   * Create neural network model based on agent type and environment;
   */
  private async createModel(agent: RLAgent, environment: RLEnvironment): Promise<tf?.LayersModel> {
    const inputDim = environment?.stateSpace?.dimensions;
    const outputDim = environment?.actionSpace?.type === 'discrete' 
      ? environment?.actionSpace?.discreteActions?.length || 1;
      : environment?.actionSpace?.dimensions;

    const model = tf?.sequential({
      layers: [
        tf?.layers?.dense({ inputShape: [inputDim], units: 64, activation: 'relu' }),
        tf?.layers?.dense({ units: 64, activation: 'relu' }),
        tf?.layers?.dense({ units: outputDim, activation: agent?.type === 'dqn' ? 'linear' : 'softmax' })
      ]
    });

    model?.compile({
      optimizer: tf?.train?.adam(agent?.hyperparameters?.learningRate),
      loss: agent?.type === 'dqn' ? 'meanSquaredError' : 'categoricalCrossentropy'
    });

    return model;
  }

  /**
   * Reset environment to initial state;
   */
  private resetEnvironment(environment: RLEnvironment): State {
    // Generate initial state based on environment configuration;
    const values = Array?.from(
      { length: environment?.stateSpace?.dimensions },
      () => Math?.random()
    );

    return {
      values,
      timestamp: new Date()
    };
  }

  /**
   * Add experience to replay buffer;
   */
  private addToReplayBuffer(agentId: string, experience: Experience): void {
    const buffer = this?.replayBuffer?.get(agentId) || [];
    buffer?.push(experience);

    // Maintain buffer size limit;
    if (buffer?.length > this?.config?.maxReplayBufferSize) {
      buffer?.shift(); // Remove oldest experience;
    }

    this?.replayBuffer?.set(agentId, buffer);
  }

  /**
   * Sample batch from replay buffer;
   */
  private sampleBatch(agentId: string, batchSize: number): Experience[] {
    const buffer = this?.replayBuffer?.get(agentId) || [];
    if (buffer?.length < batchSize) {
      return buffer;
    }

    const batch: Experience[] = [];
    const indices = new Set<number>();

    while (indices?.size < batchSize) {
      const index = Math?.floor(Math?.random() * buffer?.length);
      if (!indices?.has(index)) {
        indices?.add(index);
        batch?.push(buffer[index]);
      }
    }

    return batch;
  }

  /**
   * Load environments from storage;
   */
  private async loadEnvironments(): Promise<void> {
    try {
      const { data } = await this?.supabase;
        .from('rl_environments')
        .select('*');

      if (data) {
        for (const env of data) {
          this?.environments?.set(env?.id, env);
        }
      }
    } catch (error) {
      logger?.error('Failed to load environments', LogContext?.SYSTEM, { error });
    }
  }

  /**
   * Load agents from storage;
   */
  private async loadAgents(): Promise<void> {
    try {
      const { data } = await this?.supabase;
        .from('rl_agents')
        .select('*');

      if (data) {
        for (const agentData of data) {
          // Reconstruct agent (model would need to be loaded separately)
          const agent: RLAgent = {
            ...agentData,
            training: false // Always start as not training;
          };
          this?.agents?.set(agent?.id, agent);
          this?.replayBuffer?.set(agent?.id, []);
        }
      }
    } catch (error) {
      logger?.error('Failed to load agents', LogContext?.SYSTEM, { error });
    }
  }

  /**
   * Store environment in database;
   */
  private async storeEnvironment(environment: RLEnvironment): Promise<void> {
    try {
      await this?.supabase;
        .from('rl_environments')
        .upsert({
          id: environment?.id,
          name: environment?.name,
          description: environment?.description,
          state_space: environment?.stateSpace,
          action_space: environment?.actionSpace,
          reward_function: environment?.rewardFunction,
          termination_condition: environment?.terminationCondition,
          metadata: environment?.metadata;
        });
    } catch (error) {
      logger?.error('Failed to store environment', LogContext?.SYSTEM, { error });
    }
  }

  /**
   * Store agent in database;
   */
  private async storeAgent(agent: RLAgent): Promise<void> {
    try {
      await this?.supabase;
        .from('rl_agents')
        .upsert({
          id: agent?.id,
          type: agent?.type,
          environment_id: agent?.environmentId,
          hyperparameters: agent?.hyperparameters,
          performance: agent?.performance,
          training: agent?.training;
        });
    } catch (error) {
      logger?.error('Failed to store agent', LogContext?.SYSTEM, { error });
    }
  }

  /**
   * Save agent model and state;
   */
  private async saveAgent(agent: RLAgent): Promise<void> {
    try {
      await this?.storeAgent(agent);
      
      // Save model if it exists;
      if (agent?.model) {
        // In practice, would save model to file system or cloud storage;
        // agent?.model?.save(`file://./models/${agent?.id}`);
      }
    } catch (error) {
      logger?.error('Failed to save agent', LogContext?.SYSTEM, { error });
    }
  }

  /**
   * Store training session in database;
   */
  private async storeTrainingSession(session: TrainingSession): Promise<void> {
    try {
      await this?.supabase;
        .from('rl_training_sessions')
        .insert({
          id: session?.id,
          agent_id: session?.agentId,
          start_time: session?.startTime?.toISOString(),
          end_time: session?.endTime?.toISOString(),
          episodes: session?.episodes?.length,
          metrics: session?.metrics;
        });

      // Store individual episodes;
      for (const episode of session?.episodes) {
        await this?.supabase;
          .from('rl_episodes')
          .insert({
            session_id: session?.id,
            episode_number: episode?.number,
            steps: episode?.steps,
            total_reward: episode?.totalReward,
            start_state: episode?.startState,
            final_state: episode?.finalState;
          });
      }
    } catch (error) {
      logger?.error('Failed to store training session', LogContext?.SYSTEM, { error });
    }
  }

  /**
   * Public API;
   */
  async getEnvironments(): Promise<RLEnvironment[]> {
    return Array?.from(this?.environments?.values());
  }

  async getAgents(): Promise<RLAgent[]> {
    return Array?.from(this?.agents?.values());
  }

  async getAgent(agentId: string): Promise<RLAgent | null> {
    return this?.agents?.get(agentId) || null;
  }

  async getTrainingHistory(agentId: string): Promise<TrainingSession[]> {
    const { data } = await this?.supabase;
      .from('rl_training_sessions')
      .select('*')
      .eq('agent_id', agentId)
      .order('start_time', { ascending: false });
    
    return data || [];
  }

  async evaluateAgent(
    agentId: string,
    episodes = 10,
  ): Promise<{ averageReward: number; successRate: number }> {
    const agent = this?.agents?.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const environment = this?.environments?.get(agent?.environmentId);
    if (!environment) {
      throw new Error(`Environment ${agent?.environmentId} not found`);
    }

    // Disable exploration for evaluation;
    const originalEpsilon = agent?.hyperparameters?.epsilon;
    agent?.hyperparameters?.epsilon = 0,

    let totalReward = 0,
    let successCount = 0,

    for (let i = 0; i < episodes; i++) {
      const episode = await this?.runEpisode(agent, environment, i);
      totalReward += episode?.totalReward;
      
      if (episode?.totalReward > (environment?.terminationCondition?.targetReward || 0)) {
        successCount++;
      }
    }

    // Restore exploration;
    agent?.hyperparameters?.epsilon = originalEpsilon;

    return {
      averageReward: totalReward / episodes,
      successRate: successCount / episodes;
    };
  }
}
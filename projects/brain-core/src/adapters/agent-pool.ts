export type AgentState = 'idle' | 'busy' | 'completed' | 'failed';

export interface PoolAgent {
  id: string;
  model: string;
  state: AgentState;
  cost: number;
  task_count: number;
}

export class AgentPool {
  private agents: Map<string, PoolAgent> = new Map();
  private poolSize: number;
  private totalCost: number = 0;

  constructor(size: number = 3) {
    this.poolSize = size;
    this.initializePool();
  }

  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const agent: PoolAgent = {
        id: `agent_${i}`,
        model: 'haiku',
        state: 'idle',
        cost: 0,
        task_count: 0,
      };
      this.agents.set(agent.id, agent);
    }
  }

  getIdleAgent(): PoolAgent | null {
    for (const agent of this.agents.values()) {
      if (agent.state === 'idle') {
        return agent;
      }
    }
    return null;
  }

  markBusy(agent_id: string): boolean {
    const agent = this.agents.get(agent_id);
    if (agent) {
      agent.state = 'busy';
      return true;
    }
    return false;
  }

  markCompleted(agent_id: string, cost: number): boolean {
    const agent = this.agents.get(agent_id);
    if (agent) {
      agent.state = 'idle';
      agent.cost += cost;
      agent.task_count++;
      this.totalCost += cost;
      return true;
    }
    return false;
  }

  getStats() {
    return {
      total_agents: this.agents.size,
      idle_count: Array.from(this.agents.values()).filter(a => a.state === 'idle').length,
      busy_count: Array.from(this.agents.values()).filter(a => a.state === 'busy').length,
      total_cost: this.totalCost,
      agents: Array.from(this.agents.values()),
    };
  }
}

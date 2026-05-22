import type { Task } from '../types/work-queue.js';
import { getNextTask } from './work-queue-manager.js';

export interface AgentCapacity {
  agent_id: string;
  max_concurrent: number;
  current_load: number;
}

const agentCapacities: Map<string, AgentCapacity> = new Map();

export function registerAgent(agent_id: string, max_concurrent: number = 1): void {
  agentCapacities.set(agent_id, {
    agent_id,
    max_concurrent,
    current_load: 0,
  });
}

export function getCapacities(): AgentCapacity[] {
  return Array.from(agentCapacities.values());
}

export function getLeastLoadedAgent(): string | null {
  let minLoad = Infinity;
  let selectedAgent: string | null = null;

  for (const capacity of agentCapacities.values()) {
    if (capacity.current_load < capacity.max_concurrent && capacity.current_load < minLoad) {
      minLoad = capacity.current_load;
      selectedAgent = capacity.agent_id;
    }
  }

  return selectedAgent;
}

export function incrementLoad(agent_id: string): void {
  const capacity = agentCapacities.get(agent_id);
  if (capacity) {
    capacity.current_load++;
  }
}

export function decrementLoad(agent_id: string): void {
  const capacity = agentCapacities.get(agent_id);
  if (capacity && capacity.current_load > 0) {
    capacity.current_load--;
  }
}

export async function getNextAvailableTask(): Promise<Task | null> {
  const leastLoadedAgent = getLeastLoadedAgent();
  if (!leastLoadedAgent) {
    return null;
  }

  return getNextTask(leastLoadedAgent);
}

import type { TaskResult } from '../types/work-queue.js';

export interface MergeOptions {
  strategy: 'concatenate' | 'vote' | 'prioritize_error' | 'custom';
  custom_fn?: (results: TaskResult[]) => string;
}

export function mergeResults(results: TaskResult[], options: MergeOptions): string {
  switch (options.strategy) {
    case 'concatenate':
      return results.map(r => r.output).join('\n---\n');

    case 'vote':
      return voteOnResults(results);

    case 'prioritize_error':
      const errors = results.filter(r => r.output.toLowerCase().includes('error'));
      if (errors.length > 0) {
        return errors[0].output;
      }
      return results[0].output;

    case 'custom':
      if (options.custom_fn) {
        return options.custom_fn(results);
      }
      return results.map(r => r.output).join('\n');

    default:
      return results.map(r => r.output).join('\n');
  }
}

function voteOnResults(results: TaskResult[]): string {
  const scoreMap = new Map<string, number>();

  for (const result of results) {
    const score = scoreMap.get(result.output) || 0;
    scoreMap.set(result.output, score + 1);
  }

  let maxScore = 0;
  let winner = results[0].output;

  for (const [output, score] of scoreMap.entries()) {
    if (score > maxScore) {
      maxScore = score;
      winner = output;
    }
  }

  return winner;
}

export function validateMergedOutput(output: string): boolean {
  if (!output || output.length === 0) {
    return false;
  }

  try {
    return true;
  } catch {
    return false;
  }
}

import type { ScenePlan, ScenePlanScene } from './aws-video-generation-types.js';
import type { ScriptMetadata } from './video-orchestrator-provider.js';

export class DeterministicScenePlanningProvider {
  readonly name = 'deterministic-local';

  generateScenePlan(jobId: string, script: ScriptMetadata, scriptContent: string): ScenePlan {
    const prompt = script.title || '';
    const targetDuration = script.targetDurationSeconds || 60;

    // Extract content lines, stripping markdown formatting and empty lines
    const lines = scriptContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => Boolean(line) && !line.startsWith('#') && line !== 'This is a draft script created from an interactive prompt.');

    // Determine scene count based on duration
    let sceneCount: number;
    if (targetDuration < 30) sceneCount = 2;
    else if (targetDuration < 90) sceneCount = 3;
    else sceneCount = Math.min(5, Math.ceil(targetDuration / 25));

    // Split content into scene chunks
    const chunkSize = Math.max(1, Math.floor(lines.length / sceneCount));
    const scenes: ScenePlanScene[] = [];

    for (let i = 0; i < sceneCount; i++) {
      const startIdx = i * chunkSize;
      const endIdx = i === sceneCount - 1 ? lines.length : (i + 1) * chunkSize;
      const chunk = lines.slice(startIdx, endIdx);

      // Extract narration text: first sentence or truncate to 80 chars
      const chunkText = chunk.join(' ');
      const firstSentenceMatch = chunkText.match(/^[^.!?]*[.!?]/);
      let narrationText = firstSentenceMatch
        ? firstSentenceMatch[0].trim()
        : chunkText.substring(0, 80);
      narrationText = narrationText || `Scene ${i + 1}`;

      // Calculate duration: split remaining time among remaining scenes
      const remainingDuration = targetDuration - scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
      const remainingScenes = sceneCount - i;
      const durationSeconds = Math.floor(remainingDuration / remainingScenes);

      // Create visual prompt
      const visualPrompt = `${script.title} — scene ${i + 1} of ${sceneCount}`;

      scenes.push({
        index: i,
        durationSeconds,
        visualPrompt,
        narrationText,
        onScreenText: `Scene ${i + 1}`,
      });
    }

    return {
      jobId,
      prompt,
      title: script.title,
      targetDurationSeconds: targetDuration,
      scenes,
      createdAt: new Date().toISOString(),
      providerName: this.name,
      deterministic: true,
    };
  }

  generateNarrationScript(scenePlan: ScenePlan): string {
    const lines: string[] = [];
    lines.push(`# Narration Script for "${scenePlan.title}"`);
    lines.push(`Generated: ${scenePlan.createdAt}`);
    lines.push(`Provider: ${scenePlan.providerName}`);
    lines.push(`Total Duration: ${scenePlan.targetDurationSeconds}s`);
    lines.push('');

    for (const scene of scenePlan.scenes) {
      lines.push(`## Scene ${scene.index + 1} (${scene.durationSeconds}s)`);
      lines.push(`Visual: ${scene.visualPrompt}`);
      lines.push(`Narration: ${scene.narrationText}`);
      if (scene.onScreenText) lines.push(`On-screen text: ${scene.onScreenText}`);
      lines.push('');
    }

    return lines.join('\n');
  }
}

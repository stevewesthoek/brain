import type { ScenePlan, ScenePlanScene } from './aws-video-generation-types.js';
import type { ScriptMetadata } from './video-orchestrator-provider.js';

export class DeterministicScenePlanningProvider {
  readonly name = 'deterministic-local';

  generateScenePlan(jobId: string, script: ScriptMetadata, scriptContent: string): ScenePlan {
    const prompt = script.title || '';
    const targetDuration = script.targetDurationSeconds || 60;

    const lines = scriptContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => Boolean(line) && !line.startsWith('#') && line !== 'This is a draft script created from an interactive prompt.');

    let sceneCount: number;
    if (targetDuration < 30) sceneCount = 2;
    else if (targetDuration < 90) sceneCount = 3;
    else sceneCount = Math.min(5, Math.ceil(targetDuration / 25));

    const chunkSize = Math.max(1, Math.ceil(lines.length / sceneCount));
    const scenes: ScenePlanScene[] = [];
    const cleanTitle = script.title?.replace(/^\[PIPELINE PROOF\]\s*/i, '').trim() || prompt || 'The story';
    const subject = this.cleanSubject(cleanTitle);
    const beats = ['Hook', 'Build', 'Payoff', 'Reflection', 'Close'];
    const shotStyles = [
      'opening wide shot with slow cinematic push-in',
      'medium tracking shot with visible foreground depth',
      'dynamic close-up with motivated camera movement',
      'smooth reveal shot with parallax and atmospheric detail',
      'closing hero shot with gentle pull-back',
    ];

    for (let i = 0; i < sceneCount; i++) {
      const startIdx = i * chunkSize;
      const endIdx = i === sceneCount - 1 ? lines.length : Math.min(lines.length, (i + 1) * chunkSize);
      const chunk = lines.slice(startIdx, endIdx);
      const chunkText = chunk.join(' ').replace(/\s+/g, ' ').trim();
      const firstSentenceMatch = chunkText.match(/^[^.!?]*[.!?]/);
      const baseNarration = firstSentenceMatch ? firstSentenceMatch[0].trim() : chunkText.substring(0, 120).trim();

      const beat = beats[Math.min(i, beats.length - 1)] ?? 'Scene';
      const durationSeconds = Math.max(6, Math.floor((targetDuration - scenes.reduce((sum, s) => sum + s.durationSeconds, 0)) / (sceneCount - i)));
      const scenePrompt = baseNarration || `${beat}: ${subject}`;
      const visualPrompt = [
        `${cleanTitle} — ${beat.toLowerCase()} scene ${i + 1} of ${sceneCount}`,
        shotStyles[i % shotStyles.length],
        `clear subject continuity: ${subject}`,
        `visual story beat: ${scenePrompt}`,
        'high-quality cinematic composition, natural lighting, realistic texture, HD 16:9 frame, no text burned into image',
      ].join('. ');

      const narrationText = this.polishNarration(beat, baseNarration, subject, i, sceneCount);
      const onScreenText = i === 0
        ? cleanTitle
        : beat === 'Payoff'
          ? 'The moment everything changes'
          : beat;

      const scene: ScenePlanScene = {
        index: i,
        durationSeconds,
        visualPrompt,
        narrationText,
      };
      if (onScreenText) scene.onScreenText = onScreenText;
      scenes.push(scene);
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
    lines.push('Style: cinematic short-form narration with a clear hook, build, and payoff.');
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

  private cleanSubject(title: string): string {
    return title
      .replace(/^make\s+(a|an|the)?\s*/i, '')
      .replace(/^(a|an|the)?\s*video\s+(of|about)\s+/i, '')
      .replace(/^video\s+(of|about)\s+/i, '')
      .replace(/[.\s]+$/g, '')
      .trim() || title.trim();
  }

  private lowerFirst(text: string): string {
    const trimmed = text.trim().replace(/[.\s]+$/g, '');
    return trimmed ? `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}` : trimmed;
  }

  private polishNarration(beat: string, baseNarration: string, subject: string, index: number, sceneCount: number): string {
    const core = this.lowerFirst(baseNarration || subject);
    const subjectPhrase = this.lowerFirst(subject);
    if (index === 0) {
      return `At first glance, we see ${subjectPhrase}. But the real story begins in the details.`;
    }
    if (index === sceneCount - 1) {
      return `By the end, ${subjectPhrase} becomes more than a still image — it becomes a moment with motion, tension, and release.`;
    }
    if (beat === 'Build') {
      return `As the scene develops, ${core}. Each movement pulls us deeper into the story.`;
    }
    if (beat === 'Payoff') {
      return `Then the moment turns: ${core}. The visual rhythm gives the scene its payoff.`;
    }
    return core;
  }
}

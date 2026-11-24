import type * as Tone from 'tone';

/**
 * Connects `input → active stages… → output`, re-wiring only when the set of
 * active stages changes. Inactive processors are fully disconnected so they
 * cost no CPU (Tone effects keep processing at wet = 0 otherwise).
 */
export class InsertChain {
  private wired: Tone.ToneAudioNode[] = [];

  constructor(
    private readonly input: Tone.ToneAudioNode,
    private readonly output: Tone.InputNode,
  ) {
    this.input.connect(this.output);
  }

  set(stages: (Tone.ToneAudioNode | null | undefined | false)[]): void {
    const active = stages.filter((s): s is Tone.ToneAudioNode => !!s);
    if (active.length === this.wired.length && active.every((s, i) => s === this.wired[i])) return;
    this.input.disconnect();
    for (const s of this.wired) s.disconnect();
    const nodes = [this.input, ...active];
    for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
    nodes[nodes.length - 1].connect(this.output);
    this.wired = active;
  }
}

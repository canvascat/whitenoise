type Options = {
  frequency: number;
  windowMs: number;
  variants: string[];
  playOneShot: (name: string) => void;
  random: () => number;
  schedule: (fn: () => void, ms: number) => number;
  clear: (id: number) => void;
};

export class PointScheduler {
  private readonly options: Options;
  private pending: number[] = [];

  constructor(options: Options) {
    this.options = options;
  }

  start() {
    this.stop();
    const { frequency, windowMs, variants, playOneShot, random, schedule } = this.options;

    for (let i = 0; i < frequency; i++) {
      const delay = random() * windowMs;
      const id = schedule(() => {
        const variant = variants[Math.floor(random() * variants.length)];
        playOneShot(variant);
      }, delay);
      this.pending.push(id);
    }
  }

  stop() {
    const { clear } = this.options;
    for (const id of this.pending) {
      clear(id);
    }
    this.pending = [];
  }
}

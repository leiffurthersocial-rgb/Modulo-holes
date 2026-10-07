/**
 * Fixed-timestep accumulator. Physics always advances in identical increments (deterministic,
 * stable), while rendering runs at whatever rate the device manages.
 */
export class FixedStepper {
  private acc = 0;
  constructor(
    public readonly step: number,
    private readonly maxSubSteps: number,
  ) {}

  /** Calls `fn(step)` as many times as needed for `dt`. Returns interpolation alpha. */
  advance(dt: number, fn: (h: number) => void): number {
    this.acc += dt;
    let n = 0;
    while (this.acc >= this.step && n < this.maxSubSteps) {
      fn(this.step);
      this.acc -= this.step;
      n++;
    }
    if (n === this.maxSubSteps) this.acc = Math.min(this.acc, this.step); // spiral-of-death guard
    return this.acc / this.step;
  }

  reset() {
    this.acc = 0;
  }
}

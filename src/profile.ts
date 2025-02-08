import { map } from "./iter";

type StackFrame = {
  name: string;
  startTime: number;
  resumeTime: number;
  ownTime: number;
};
type Stats = {
  name: string;
  startTime: number;
  ownTime: number;
  totalTime: number;
};

export class Profile {
  private stack: StackFrame[] = [
    {
      name: "<root>",
      startTime: performance.now(),
      resumeTime: performance.now(),
      ownTime: 0,
    },
  ];
  private stats: Stats[] = [];
  call(name: string) {
    const now = performance.now();
    const prev = this.stack.at(-1)!;
    prev.ownTime += now - prev.resumeTime;

    this.stack.push({
      name,
      startTime: now,
      resumeTime: now,
      ownTime: 0,
    });
  }
  return() {
    const frame = this.stack.pop()!;
    const now = performance.now();
    this.stats.push({
      name: frame.name,
      startTime: frame.startTime,
      ownTime: frame.ownTime + (now - frame.resumeTime),
      totalTime: now - frame.startTime,
    });
    this.stack.at(-1)!.resumeTime = now;
  }
  statsMap() {
    const result = new Map<string, { ownTime: number; totalTime: number }>();
    for (const stat of this.stats) {
      const prev = result.get(stat.name) ?? { ownTime: 0, totalTime: 0 };
      prev.ownTime += stat.ownTime;
      prev.totalTime += stat.totalTime;
      result.set(stat.name, prev);
    }

    const ownTime = Array.from(
      map(([k, v]) => [k, v.ownTime] as const, result.entries()),
    ).sort(([, a], [, b]) => b - a);
    const totalTime = Array.from(
      map(([k, v]) => [k, v.totalTime] as const, result.entries()),
    ).sort(([, a], [, b]) => b - a);
    return { ownTime: new Map(ownTime), totalTime: new Map(totalTime) };
  }
}

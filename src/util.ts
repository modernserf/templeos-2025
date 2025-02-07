export function deepEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      if (!deepEqual(left[i], right[i])) return false;
    }
    return true;
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    const keys = Object.keys(left);
    if (Object.keys(right).length !== keys.length) return false;
    for (const key of keys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!deepEqual((left as any)[key], (right as any)[key])) return false;
    }
    return true;
  }
  return false;
}

export function debounce<Args extends unknown[]>(
  timeout: number,
  f: (...v: Args) => void,
): (...v: Args) => void {
  let handler = 0;
  return (...v) => {
    clearTimeout(handler);
    handler = setTimeout(() => f(...v), timeout);
  };
}

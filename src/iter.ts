// TODO: put these into DB (filter -> "where", take -> "limit", etc)
export function* filter<T>(f: (t: T) => boolean, iter: Iterable<T>) {
  for (const item of iter) {
    if (f(item)) {
      yield item;
    }
  }
}

export function* map<T, U>(f: (t: T) => U, iter: Iterable<T>): Iterable<U> {
  for (const item of iter) {
    yield f(item);
  }
}

export function* take<T>(count: number, iter: Iterable<T>) {
  let i = 0;
  for (const item of iter) {
    if (i < count) {
      i++;
      yield item;
    }
  }
}

export function* flatMap<T, U, R>(
  f: (t: T) => Generator<U>,
  gen: Generator<T, R>
): Generator<U, R> {
  while (true) {
    const next = gen.next();
    if (next.done) return next.value;
    yield* f(next.value);
  }
}

// reminder of  what a generator looks like on the inside
export function* id<T, TReturn, TNext>(
  gen: Generator<T, TReturn, TNext>,
): Generator<T, TReturn, TNext> {
  let next = gen.next();
  while (!next.done) {
    const result = yield next.value;
    next = gen.next(result);
  }
  return next.value;
}

export function* filter<T, U extends T>(
  f: (t: T) => t is U,
  iter: Iterable<T>,
): Iterable<U> {
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
  gen: Generator<T, R>,
): Generator<U, R> {
  while (true) {
    const next = gen.next();
    if (next.done) return next.value;
    yield* f(next.value);
  }
}

export function reduce<State, Item>(
  initState: State,
  f: (state: State, item: Item) => State,
  gen: Generator<Item>,
): State {
  let state = initState;
  for (const item of gen) {
    state = f(state, item);
  }
  return state;
}

const MAX = 5;
const SPLIT = (MAX + 1) >> 1;

export class Tree<K, V> {
  constructor(
    private ord: Ord<K>,
    private node: TreeNode<K, V> = new Leaf<K, V>(ord, [])
  ) {}
  insert(key: K, value: V) {
    const res = this.node.insert(key, value);
    if (res) {
      this.node = new Subtree(this.ord, [res.split], [res.left, res.right]);
    }
  }
  *entries() {
    yield* this.node.entries();
  }
  *range(min: K, max: K) {
    yield* this.node.range(min, max);
  }
}

export interface Ord<K> {
  lt(left: K, right: K): boolean;
  eq(left: K, right: K): boolean;
}

export const asc: Ord<number> = {
  lt(left, right) {
    return left < right;
  },
  eq(left, right) {
    return left == right;
  },
};

export const desc: Ord<number> = {
  lt(left, right) {
    return left > right;
  },
  eq(left, right) {
    return left == right;
  },
};

interface TreeNode<K, V> {
  insert(key: K, value: V): TreeSplit<K, V> | null;
  entries(): Generator<[K, V]>;
  range(min: K, max: K): Generator<[K, V]>;
}

type TreeSplit<K, V> = {
  left: TreeNode<K, V>;
  split: K;
  right: TreeNode<K, V>;
};

class Leaf<K, V> implements TreeNode<K, V> {
  constructor(private ord: Ord<K>, private items: { key: K; value: V }[]) {}
  insert(key: K, value: V) {
    this.insertInOrder(key, value);
    if (this.items.length < MAX) {
      return null;
    } else {
      const left = new Leaf(this.ord, this.items.slice(0, SPLIT));
      const split = this.items[SPLIT].key;
      const right = new Leaf(this.ord, this.items.slice(SPLIT));
      return { left, split, right };
    }
  }
  private insertInOrder(key: K, value: V) {
    for (const [i, item] of this.items.entries()) {
      if (this.ord.lt(key, item.key)) {
        this.items.splice(i, 0, { key, value });
        return;
      }
    }
    this.items.push({ key, value });
  }
  *entries() {
    for (const { key, value } of this.items) {
      yield [key, value] as [K, V];
    }
  }
  *range(min: K, max: K) {
    for (const { key, value } of this.items) {
      if (this.ord.lt(max, key)) return;
      if (this.ord.lt(key, min)) continue;
      yield [key, value] as [K, V];
    }
  }
}

class Subtree<K, V> implements TreeNode<K, V> {
  constructor(
    private ord: Ord<K>,
    private keys: K[],
    private values: TreeNode<K, V>[]
  ) {}
  insert(key: K, value: V) {
    for (const [i, k] of this.keys.entries()) {
      if (this.ord.lt(key, k)) {
        return this.insertAt(i, key, value);
      }
    }
    return this.insertAt(this.keys.length, key, value);
  }
  private insertAt(i: number, key: K, value: V) {
    const subtree = this.values[i];
    const res = subtree.insert(key, value);
    if (!res) return null;

    this.keys.splice(i, 0, res.split);
    this.values.splice(i, 1, res.left, res.right);
    if (this.keys.length < MAX) return null;

    return this.split();
  }
  private split(): TreeSplit<K, V> {
    // [v0, k0, v1, k1, v2, k2, v3] -> [v0, k0, v1] , k1 , [v2, k2, v3]
    const left = new Subtree(
      this.ord,
      this.keys.slice(0, SPLIT - 1),
      this.values.slice(0, SPLIT)
    );
    const split = this.keys[SPLIT - 1];
    const right = new Subtree(
      this.ord,
      this.keys.slice(SPLIT),
      this.values.slice(SPLIT)
    );
    return { left, split, right };
  }
  *entries() {
    for (const value of this.values) {
      yield* value.entries();
    }
  }
  *range(min: K, max: K) {
    for (const [i, value] of this.values.entries()) {
      const nextKey = this.keys[i];
      if (nextKey && this.ord.lt(max, nextKey)) {
        yield* value.range(min, max);
        return;
      }
      if (nextKey && this.ord.lt(nextKey, min)) continue;
      yield* value.range(min, max);
    }
  }
}

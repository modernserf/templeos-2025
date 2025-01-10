import { expect, test } from "vitest";

type Cmp = -1 | 0 | 1;
type Order = "asc" | "desc";

interface Ord<T> {
  cmp(left: T, right: T): Cmp;
}

interface Where<T> {
  cmp(item: T): Cmp;
  order: Order;
}

type Node<K, V> = {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
};

const numberOrd = {
  cmp(a: number, b: number) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  },
};

class Tree<K, V> {
  private root: Node<K, V> | null = null;
  private _size = 0;
  constructor(private ord: Ord<K>) {}
  size() {
    return this._size;
  }
  get(key: K): V | null {
    const res = this.where({
      cmp: (k) => this.ord.cmp(key, k),
      order: "asc",
    }).next();
    return res.value?.[1] ?? null;
  }
  *where(f: Where<K>) {
    yield* this.whereNode(this.root, f);
  }
  private *whereNode(
    node: Node<K, V> | null,
    where: Where<K>
  ): Generator<[K, V]> {
    if (!node) return;
    switch (where.cmp(node.key)) {
      case -1:
        yield* this.whereNode(node.prev, where);
        return;
      case 0:
        if (where.order === "asc") {
          yield* this.whereNode(node.prev, where);
          yield [node.key, node.value];
          yield* this.whereNode(node.next, where);
        } else {
          yield* this.whereNode(node.next, where);
          yield [node.key, node.value];
          yield* this.whereNode(node.prev, where);
        }
        return;
      case 1:
        yield* this.whereNode(node.next, where);
    }
  }
  set(key: K, value: V): V | null {
    const res = this.setNode(this.root, key, value);
    this.root = res.node;
    if (!res.prevValue) {
      this._size += 1;
    }
    return res.prevValue;
  }
  private setNode(
    node: Node<K, V> | null,
    key: K,
    value: V
  ): { node: Node<K, V>; prevValue: V | null } {
    if (!node) {
      return { node: { key, value, prev: null, next: null }, prevValue: null };
    }
    switch (this.ord.cmp(key, node.key)) {
      case -1: {
        const res = this.setNode(node.prev, key, value);
        node.prev = res.node;
        res.node = node;
        return res;
      }
      case 0: {
        const prevValue = node.value;
        node.value = value;
        return { node, prevValue };
      }
      case 1: {
        const res = this.setNode(node.next, key, value);
        node.next = res.node;
        res.node = node;
        return res;
      }
    }
  }
  delete(key: K): V | null {
    const res = this.deleteNode(this.root, key);
    this.root = res.node;
    if (res.prevValue) {
      this._size -= 1;
    }
    return res.prevValue;
  }
  private deleteNode(
    node: Node<K, V> | null,
    key: K
  ): { node: Node<K, V> | null; prevValue: V | null } {
    if (!node) return { node: null, prevValue: null };
    switch (this.ord.cmp(key, node.key)) {
      case -1: {
        const res = this.deleteNode(node.prev, key);
        node.prev = res.node;
        res.node = node;
        return res;
      }
      case 0:
        if (node.prev && node.next) {
          // rebalance
          // remove leftmost node
          let parent = node;
          while (parent.prev && parent.prev.prev) {
            parent = parent.prev;
          }
          const leftParent = parent.prev!;
          parent.prev = null;

          // find rightmost child of leftmost
          let rightParent = leftParent;
          while (rightParent.next) {
            rightParent = rightParent.next;
          }

          // attach subtrees
          leftParent.prev = node.prev;
          rightParent.next = node.next;
          return { node: leftParent, prevValue: node.value };
        } else if (node.prev) {
          return { node: node.prev, prevValue: node.value };
        } else {
          return { node: node.next, prevValue: node.value };
        }
      case 1: {
        const res = this.deleteNode(node.next, key);
        node.next = res.node;
        res.node = node;
        return res;
      }
    }
  }
}

export const allWhere: Where<never> = {
  order: "asc",
  cmp: () => 0,
};

test("set", () => {
  const tree = new Tree(numberOrd);
  const keys = [10, 5, 1, 25, 20, 3];

  for (const [value, key] of keys.entries()) {
    expect(tree.set(key, value)).toBe(null);
  }

  expect(tree.size()).toEqual(keys.length);

  for (const [value, key] of keys.entries()) {
    expect(tree.get(key)).toEqual(value);
  }

  expect(tree.set(keys[1], -1)).toEqual(1);
  expect(tree.get(keys[1])).toEqual(-1);
  expect(tree.size()).toEqual(keys.length);
});

test("complex keys", () => {
  type K = { a: number; b: number };
  const ord: Ord<K> = {
    cmp(left, right) {
      return numberOrd.cmp(left.a, right.a) || numberOrd.cmp(left.b, right.b);
    },
  };
  const tree = new Tree<K, null>(ord);
  const keys = [
    { a: 3, b: 3 },
    { a: 1, b: 10 },
    { a: 2, b: 25 },
    { a: 1, b: 5 },
    { a: 2, b: 1 },
    { a: 3, b: 10 },
    { a: 1, b: 25 },
  ];

  for (const key of keys) {
    tree.set(key, null);
  }

  const a1s = tree.where({
    order: "desc",
    cmp(item) {
      return numberOrd.cmp(1, item.a);
    },
  });

  expect(Array.from(a1s)).toEqual([
    [{ a: 1, b: 25 }, null],
    [{ a: 1, b: 10 }, null],
    [{ a: 1, b: 5 }, null],
  ]);
});

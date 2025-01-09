import { expect, test } from "vitest";

type K = number;

type BTreeNode<V> =
  | { tag: "leaf"; entries: [K, V][] }
  | { tag: "subtree"; left: BTree<V>; split: K; right: BTree<V> };

class BTree<V> {
  constructor(private node: BTreeNode<V>) {}
  static empty() {
    return new BTree({ tag: "leaf", entries: [] });
  }
  *entries(): Generator<[K, V]> {
    switch (this.node.tag) {
      case "leaf":
        yield* this.node.entries;
        return;
      case "subtree":
        yield* this.node.left.entries();
        yield* this.node.right.entries();
    }
  }
  insert(key: K, value: V) {
    switch (this.node.tag) {
      case "leaf": {
        for (const [i, [k]] of this.node.entries.entries()) {
          if (key < k) {
            const left = this.node.entries.slice(0, i);
            left.push([key, value]);
            const right = this.node.entries.slice(i);

            this.node = {
              tag: "subtree",
              left: new BTree({ tag: "leaf", entries: left }),
              split: k,
              right: new BTree({ tag: "leaf", entries: right }),
            };

            return;
          }
        }
        this.node.entries.push([key, value]);
        return;
      }
      case "subtree": {
        if (key < this.node.split) {
          this.node.left.insert(key, value);
        } else {
          this.node.right.insert(key, value);
        }
      }
    }
  }
}

test("simple btree", () => {
  const tree = BTree.empty();

  for (let i = 0; i < 100; i++) {
    tree.insert(Math.random(), i);
  }

  const items = Array.from(tree.entries());
  const sorted = items.slice().sort(([k0], [k1]) => k0 - k1);

  expect(items.length).toBe(100);
  expect(items).toEqual(sorted);
});

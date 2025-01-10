export type Cmp = -1 | 0 | 1;
export type Order = "asc" | "desc";

export interface Ord<T> {
  cmp(left: T, right: T): Cmp;
}

export const numberOrd = {
  cmp<T>(a: T, b: T) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  },
};

export interface Where<T> {
  cmp(item: T): Cmp;
  order: Order;
}

export const allWhere: Where<never> = {
  order: "asc",
  cmp: () => 0,
};

type Node<K, V> = {
  key: K;
  value: V;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
};

export class Tree<K, V> {
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

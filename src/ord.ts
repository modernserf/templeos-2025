export type Cmp = -1 | 0 | 1;
export type Order = "asc" | "desc";

export interface Ord<T> {
  cmp(left: T, right: T): Cmp;
}

export const defaultOrd = {
  cmp<T>(a: T, b: T) {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  },
};

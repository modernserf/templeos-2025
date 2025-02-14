export type Id = string;
export type Ident = string;

export type Expr =
  | string
  | number
  | { tag: "placeholder" }
  | { tag: "ident"; ident: Ident }
  | { tag: "box"; id: Id; args: Expr[] };

export type Struct<Id, Args extends Expr[]> = {
  tag: "box";
  id: Id;
  args: Args;
};
export type List<T extends Expr> = Struct<"", T[]>;
export type AnyStruct = Struct<string, Expr[]>;

export const s = new Proxy(
  <T extends Id, Args extends Expr[]>(id: T, ...args: Args) =>
    ({ tag: "box", id, args } as const),
  {
    get<T extends string>(_: unknown, tag: T) {
      return (...args: Expr[]) => s(tag, ...args);
    },
  },
) as (<T extends Id, Args extends Expr[]>(
  id: T,
  ...args: Args
) => Struct<T, Args>) & { [Tag in Id]: S<Tag> } & Ss<"call"> &
  Ss<"apply"> &
  Ss<"section"> &
  Ss<"link"> &
  Ss<"location"> &
  Ss<"ref"> &
  Ss<"multiRef"> &
  Ss<"sorted"> &
  Ss<"code"> &
  Ss<"field"> &
  Ss<"field_optional">;

export const seq = (head: Expr, ...tail: Expr[]) =>
  tail.reduce((l, r) => s(",", l, r), head) as AnyStruct;
export const alt = (head: Expr, ...tail: Expr[]) =>
  tail.reduce((l, r) => s(";", l, r), head) as AnyStruct;
export const u = (l: Expr, r: Expr) => s("=", l, r);

type Ss<Tag extends string> = { [t in Tag]: S<Tag> };

type S<Tag extends string> = <Args extends Expr[]>(
  ...args: Args
) => Struct<Tag, Args>;

export const __ = { tag: "placeholder" } as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const $: any = new Proxy(
  function v(ident: string) {
    return { tag: "ident", ident };
  },
  {
    get(_, ident) {
      return { tag: "ident", ident };
    },
  },
);

export function l<Args extends Expr[]>(...args: Args) {
  return s("", ...args);
}

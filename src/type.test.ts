import { expect, test } from "vitest";
import { State } from "./state";
import { Expr, r, s, $ } from "./expr";
import { data } from "./data";
import { t } from "./type";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _t: any = { tag: "ident" };

function runAll(...clauses: Expr[]) {
  const state = State.root(data);
  return Array.from(state.runAll(s(",", ...clauses)));
}

// test("value_type", () => {
//   expect(
//     runAll(
//       ///
//       s.value_type( "hello", t.string),
//       s.value_type( 123, t.number),
//       s.value_type( s.foo(), t.struct("foo")),
//       s(
//         "value_type",
//         s.pair( "hello", 123),
//         t.struct("pair", t.string, t.number)
//       )
//     )
//   ).toEqual([{}]);
// });

test("union_member", () => {
  expect(
    //
    runAll(s.union_member(t.bottom, $.t)),
  ).toEqual([]);
  expect(
    //
    runAll(s.union_member(t.number, s.number())),
  ).toEqual([{}]);

  expect(
    //
    runAll(s.union_member(t.union(t.string, t.number), $.t)),
  ).toEqual([{ t: t.string }, { t: t.number }]);

  expect(
    //
    runAll(
      s.union_member(
        t.union(t.string, t.union(t.struct("foo"), t.number)),
        $.t,
      ),
    ),
  ).toEqual([{ t: t.string }, { t: t.struct("foo") }, { t: t.number }]);
});

test("subtype_supertype match", () => {
  expect(
    runAll(
      //
      s.subtype_supertype(t.number, t.number),
      s.subtype_supertype(t.number, t.union(t.number, t.string)),
      s.subtype_supertype(
        t.number,
        t.union(t.union(t.struct("foo"), t.number), t.string),
      ),
      s.subtype_supertype(
        t.number,
        t.union(t.string, t.union(t.struct("foo"), t.number)),
      ),
      s.subtype_supertype(t.number, t.top),

      s.subtype_supertype(
        t.struct("foo", t.number, t.string),
        t.struct("foo", t.union(t.string, t.number), t.top),
      ),
    ),
  ).toEqual([{}]);
});

// test("list_type", () => {
//   expect(
//     runAll(
//       ///
//       s.list_type( l(), t.bottom),
//       s.list_type( l(123, 456), t.number),
//       s.list_type( l(123, "hello", 456), t.union(t.number, t.string))
//     )
//   );
// });

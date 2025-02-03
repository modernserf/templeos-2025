import { Rec } from "./data";
import { l, r, s, v, Expr, Struct, __ } from "./expr";

export type ValueType<Rest extends Expr> =
  | Struct<"bottom", []>
  | Struct<"top", []>
  | Struct<"string", []>
  | Struct<"number", []>
  | Struct<"union", [ValueType<Rest>, ValueType<Rest>]>
  // | Struct<"intersection", [ValueType<Rest>, ValueType<Rest>]>
  | Struct<"any_struct", []>
  | Struct<"list", [ValueType<Rest>]>
  | Struct<"struct", [string, ...ValueType<Rest>[]]>
  | Rest;
//

export const t = {
  bottom: s("bottom"),
  top: s("top"),
  string: s("string"),
  number: s("number"),
  union: <T extends Expr>(...xs: ValueType<T>[]) => {
    if (xs.length === 0) return t.bottom;
    return xs.reduce((l, r) => s("union", l, r));
  },
  // intersection: <T extends Expr>(...xs: ValueType<T>[]) => {
  //   if (xs.length === 0) return t.top;
  //   return xs.reduce((l, r) => s("intersection", l, r));
  // },
  struct: <T extends Expr>(tag: string, ...args: ValueType<T>[]) =>
    s("struct", tag, ...args),
  list: <T extends Expr>(item: ValueType<T>) => s("list", item),
  anyStruct: s("any_struct"),
};

export type TypeId = keyof typeof coreTypes;
export const coreTypes = {
  type__any: {
    db__schema: "schema__type",
    file__name: "Any",
  },
  type__string: {
    db__schema: "schema__type",
    file__name: "String",
    // db__type: s("string"),
  },
  type__number: {
    db__schema: "schema__type",
    file__name: "Number",
    // db__type: s("number"),
  },
  type__time: {
    db__schema: "schema__type",
    file__name: "Time",
  },
  type__ref: {
    db__schema: "schema__type",
    file__name: "Ref",
    // db__type: s("number"),
  },
  type__multiRef: {
    db__schema: "schema__type",
    file__name: "Multi ref",
    // db__type: s("list,s("number")),
  },
  type__text: {
    db__schema: "schema__type",
    file__name: "Text",
    // db__type: s(
    //   "list",
    //   s("oneof", s("string"), s("struct", "link", s("string"), s("ref")))
    // ),
  },
} satisfies Record<string, Rec>;

export const typeRecs = {
  // semidet
  value_type: {
    file__description: l(
      "semidet.",
      "get narrowest value of type. lists are treated as structs"
    ),
    rule__params: l(v.value, v.type),
    rule__body: r.or(
      r(s("number", v.value), s("=", v.type, t.number)),
      r(s("string", v.value), s("=", v.type, t.string)),
      r(
        s("struct", v.value),
        s("struct_tag_list", v.value, v.id, v.args),
        s("_maplist", s("value_type"), v.args, v.t_args),
        s("list_list_append", l(v.id), v.t_args, v.t_body),
        s("struct_tag_list", v.type, "struct", v.t_body)
      )
    ),
  },
  subtype_supertype: {
    rule__params: l(v.sub, v.super),
    rule__body: r.or(
      // exact type
      s("=", v.sub, v.super),
      // struct items
      s("struct_supertype", v.sub, v.super),
      // any type
      s("=", l(v.sub, v.super), l(__, t.top)),
      // union membership
      r(
        s("=", v.super, t.union(v.l, v.r)),
        r.or(
          r(s("subtype_supertype", v.sub, v.l)),
          r(s("subtype_supertype", v.sub, v.r))
        )
      )
    ),
  },
  struct_supertype: {
    rule__params: l(v.sub, v.super),
    rule__body: r(
      s("structType_id_args", v.sub, v.id, v.sub_args),
      s("structType_id_args", v.super, v.id, v.super_args),
      s("sublist_superlist", v.sub_args, v.super_args),
      s("/=", v.sub, v.super)
    ),
  },
  structType_id_args: {
    rule__params: l(v.struct, v.id, v.args),
    rule__body: r(
      s("struct_tag_list", v.struct, "struct", v.body),
      s("list_list_append", l(v.id), v.args, v.body)
    ),
  },
  sublist_superlist: {
    rule__params: l(v.sub, v.super),
    rule__body: r.or(
      s("=", l(v.sub, v.super), l(l(), l())),
      r(
        s("list_list_append", v.sub_stack, l(v.sub_pop), v.sub),
        s("list_list_append", v.super_stack, l(v.super_pop), v.super),
        s("subtype_supertype", v.sub_pop, v.super_pop),
        s("sublist_superlist", v.sub_stack, v.super_stack)
      )
    ),
  },
  union_subset: {
    file__description: l(
      "nondet.",
      "get the concrete types that inhabit type u."
    ),
    rule__params: l(t.union(v.l, v.r), v.x),
    rule__body: r.or(
      s("=", v.l, v.x),
      s("=", v.r, v.x),
      r(s("nonvar", v.l), s("union_subset", v.l, v.x)),
      r(s("nonvar", v.l), s("union_subset", v.r, v.x))
    ),
  },

  union_member: {
    file__description: l(
      "nondet.",
      "get the concrete types that inhabit type u."
    ),
    rule__params: l(v.u, v.x),
    rule__body: s(
      "if_then_else",
      s("=", v.u, t.union(v.l, v.r)),
      r.or(s("union_member", v.l, v.x), s("union_member", v.r, v.x)),
      r(s("/=", v.u, t.bottom), s("=", v.u, v.x))
    ),
  },

  // left_right_union: {
  //   file__description: l("nondet.", "iterates through union"),
  //   rule__params: l(v.l, v.r, v.u),
  //   rule__body: r(
  //     s("=", t.union(v.ul, v.ur), v.u),
  //     r.or(
  //       l("=", l(v.l, v.r), l(v.ul, v.ur)),
  //       r.or(
  //         s("left_right_union", v.ull, v.ulr, v.ul),

  //       )
  //     )
  //   )
  // },

  // type_type_union: {
  //   file__description: l(
  //     "semidet.",
  //     "if l & r are identical, u = l = r.",
  //     "if l & r are different and not unions, u is `union(l, r)`.",
  //     "This is mostly intended for building list types."
  //   ),
  //   rule__params: l(v.l, v.r, v.u),
  //   rule__body: r.or(
  //     r(s("=", v.l, v.r), s("=", v.l, v.u)),
  //     r(
  //       s("/=", v.l, v.r), r.or(
  //         r(s('=', v.l, t.bottom), s("=", v.r, v.u)),
  //         r(s("=", v.r, t.bottom), s("=", v.l, v.u)),
  //         r(s("/=", v.l, t.bottom), s("/=", v.r, t.bottom))
  //       )
  //     ),
  //     r(s("/=", v.l, v.r), r.cond(
  //       s('=', v.l, t.bottom), s('=', v.r, v.u),
  //       r.cond(
  //         s('=', v.r, t.bottom, s('=', v.l, v.u)),

  //       )
  //     ))
  //     // r(s("=", v.u, s("union", v.l, v.r)))
  //   ),
  // },
  _apply: {
    rule__params: l(v.fn, v.args),
    rule__body: r(
      s("struct_tag_list", v.fn, v.id, v.base_args),
      s("list_list_append", v.base_args, v.args, v.full_args),
      s("struct_tag_list", v.fn1, v.id, v.full_args),
      v.fn1
    ),
  },
  _maplist: {
    rule__params: l(v.f, v.xs, v.ys),
    rule__body: r.or(
      r(s("=", l(), v.xs), s("=", l(), v.ys)),
      r(
        s("list_list_append", l(v.x), v.x_rest, v.xs),
        s("_apply", v.f, l(v.x, v.y)),
        s("_maplist", v.f, v.x_rest, v.y_rest),
        s("list_list_append", l(v.y), v.y_rest, v.ys)
      )
    ),
  },
} satisfies Record<string, Rec>;

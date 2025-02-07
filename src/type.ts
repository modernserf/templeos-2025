import { Rec } from "./data";
import { l, r, s, $, Expr, Struct, __ } from "./expr";

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
    db__default_value: l(),
    db__default_view: "view__type__any",
  },
  type__string: {
    db__schema: "schema__type",
    file__name: "String",
    db__default_value: "",
    db__default_view: "view__type__string",
    // db__type: s("string"),
  },
  type__number: {
    db__schema: "schema__type",
    file__name: "Number",
    db__default_value: 0,
    // db__type: s("number"),
  },
  type__time: {
    db__schema: "schema__type",
    file__name: "Time",
    db__default_value: 0,
    db__default_view: "view__type__time",
  },
  type__ref: {
    db__schema: "schema__type",
    file__name: "Ref",
    db__default_value: "",
    db__default_view: "view__type__ref",
    // db__type: s("number"),
  },
  type__multiRef: {
    db__schema: "schema__type",
    file__name: "Multi ref",
    db__default_value: l(),
    // db__type: s("list,s("number")),
  },
  type__text: {
    db__schema: "schema__type",
    file__name: "Text",
    db__default_value: l(),
    db__default_view: "view__type__text",
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
      "get narrowest value of type. lists are treated as structs",
    ),
    rule__params: l($.value, $.type),
    rule__body: r.or(
      r(s("number", $.value), s("=", $.type, t.number)),
      r(s("string", $.value), s("=", $.type, t.string)),
      r(
        s("struct", $.value),
        s("struct_tag_list", $.value, $.id, $.args),
        s("_maplist", s("value_type"), $.args, $.t_args),
        s("list_list_append", l($.id), $.t_args, $.t_body),
        s("struct_tag_list", $.type, "struct", $.t_body),
      ),
    ),
  },
  subtype_supertype: {
    rule__params: l($.sub, $.super),
    rule__body: r.or(
      // exact type
      s("=", $.sub, $.super),
      // struct items
      s("struct_supertype", $.sub, $.super),
      // any type
      s("=", l($.sub, $.super), l(__, t.top)),
      // union membership
      r(
        s("=", $.super, t.union($.l, $.r)),
        r.or(
          r(s("subtype_supertype", $.sub, $.l)),
          r(s("subtype_supertype", $.sub, $.r)),
        ),
      ),
    ),
  },
  struct_supertype: {
    rule__params: l($.sub, $.super),
    rule__body: r(
      s("structType_id_args", $.sub, $.id, $.sub_args),
      s("structType_id_args", $.super, $.id, $.super_args),
      s("sublist_superlist", $.sub_args, $.super_args),
      s("/=", $.sub, $.super),
    ),
  },
  structType_id_args: {
    rule__params: l($.struct, $.id, $.args),
    rule__body: r(
      s("struct_tag_list", $.struct, "struct", $.body),
      s("list_list_append", l($.id), $.args, $.body),
    ),
  },
  sublist_superlist: {
    rule__params: l($.sub, $.super),
    rule__body: r.or(
      s("=", l($.sub, $.super), l(l(), l())),
      r(
        s("list_list_append", $.sub_stack, l($.sub_pop), $.sub),
        s("list_list_append", $.super_stack, l($.super_pop), $.super),
        s("subtype_supertype", $.sub_pop, $.super_pop),
        s("sublist_superlist", $.sub_stack, $.super_stack),
      ),
    ),
  },
  union_subset: {
    file__description: l(
      "nondet.",
      "get the concrete types that inhabit type u.",
    ),
    rule__params: l(t.union($.l, $.r), $.x),
    rule__body: r.or(
      s("=", $.l, $.x),
      s("=", $.r, $.x),
      r(s("nonvar", $.l), s("union_subset", $.l, $.x)),
      r(s("nonvar", $.l), s("union_subset", $.r, $.x)),
    ),
  },

  union_member: {
    file__description: l(
      "nondet.",
      "get the concrete types that inhabit type u.",
    ),
    rule__params: l($.u, $.x),
    rule__body: s(
      "if_then_else",
      s("=", $.u, t.union($.l, $.r)),
      r.or(s("union_member", $.l, $.x), s("union_member", $.r, $.x)),
      r(s("/=", $.u, t.bottom), s("=", $.u, $.x)),
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
    rule__params: l($.fn, $.args),
    rule__body: r(
      s("struct_tag_list", $.fn, $.id, $.base_args),
      s("list_list_append", $.base_args, $.args, $.full_args),
      s("struct_tag_list", $.fn1, $.id, $.full_args),
      $.fn1,
    ),
  },
  _maplist: {
    rule__params: l($.f, $.xs, $.ys),
    rule__body: r.or(
      r(s("=", l(), $.xs), s("=", l(), $.ys)),
      r(
        s("list_list_append", l($.x), $.x_rest, $.xs),
        s("_apply", $.f, l($.x, $.y)),
        s("_maplist", $.f, $.x_rest, $.y_rest),
        s("list_list_append", l($.y), $.y_rest, $.ys),
      ),
    ),
  },
} satisfies Record<string, Rec>;

import { whereValue } from "./db";
import {
  Exception,
  k,
  State,
  StateNext,
  Value,
  View,
  ensure,
  check,
  uniqueStates,
  sv,
} from "./state";

function semidet<Args extends unknown[]>(
  fn: (...args: Args) => State | null | undefined
) {
  return function* (...args: Args) {
    const res = fn(...args);
    if (res) yield res.yield();
  };
}

function unknownContext(ctx: Value) {
  throw new Exception(sv("unknown_context", ctx));
}

type RulePrimitive = (state: State, ...args: Value[]) => Generator<StateNext>;

export const primitives: Record<string, RulePrimitive> = {
  // Control flow & basic matching
  fail: semidet(() => null),
  ok: semidet((state) => state),
  "=": semidet((state, left, right) => state.unify(left, right)),
  "/=": (state, left, right) => state.dif(left, right),
  ",": function* (state, ...items) {
    if (items.length === 0) {
      yield state.yield();
      return;
    }

    const stack = [state.runClause(items[0])];
    while (stack.length) {
      const frame = stack.at(-1)!;
      const res = frame.next();
      if (res.done) {
        stack.pop();
        continue;
      }

      if (res.value.tag === "view") {
        yield res.value;
        continue;
      }

      const nextClause = items[stack.length];

      if (nextClause) {
        stack.push(res.value.state.runClause(nextClause));
      } else {
        yield res.value;
      }
    }
  },
  ";": function* (state, ...items) {
    yield* uniqueStates(function* () {
      for (const arg of items) {
        // buffer views until there's a result
        let views = [];
        for (const res of state.runClause(arg)) {
          switch (res.tag) {
            case "view":
              views.push(res);
              continue;
            case "state":
              yield* views;
              views = [];
              yield res;
          }
        }
      }
    });
  },
  "¬": semidet((state, goal) => {
    for (const _ of state.runClause(goal)) {
      // success -> failure
      return null;
    }
    return state;
  }),
  call: function* (state, id, ...args) {
    ensure(id, "string");
    yield* state.call(id.value, args);
  },
  throw: (state, exception) => {
    throw new Exception(state.resolve(exception));
  },
  try_error_catch: function* (state, tryGoal, exception, catchGoal) {
    try {
      yield* state.runClause(tryGoal);
    } catch (e) {
      if (e instanceof Exception) {
        const ns = state.unify(exception, e.error);
        if (!ns) throw ns;
        yield* ns.runClause(catchGoal);
      } else {
        throw e;
      }
    }
  },
  if_then_else: function* (state, cond, ifSuccess, ifFail) {
    let didSucceed = false;
    for (const res0 of state.runClause(cond)) {
      if (res0.tag === "view") {
        yield res0;
        continue;
      }
      didSucceed = true;
      yield* res0.state.runClause(ifSuccess);
    }
    if (!didSucceed) {
      yield* state.runClause(ifFail);
    }
  },
  collect: semidet((state, into, goal, out) => {
    const initState = state;
    let didSucceed = false;
    const results: Value[] = [];
    for (const res of state.runClause(goal)) {
      if (res.tag === "view") throw "todo";
      didSucceed = true;
      state = res.state;
      if (out.tag !== "placeholder") {
        const val = state.resolve(into);
        results.push(val);
      }
    }
    if (didSucceed) {
      if (out.tag === "placeholder") {
        return initState;
      }
      return initState.unify(out, { tag: "struct", id: "", args: results });
    }
    return null;
  }),
  limit: function* (state, limit, clause) {
    ensure(limit, "number");
    let count = 0;
    for (const res of state.runClause(clause)) {
      if (count >= limit.value) return;
      yield res;
      if (res.tag === "state") count++;
    }
  },
  // context
  has_context: semidet((state, ctx) => {
    ensure(ctx, "string");
    if (state.context[ctx.value]) return state;
    return null;
  }),
  get_context: semidet((state, ctx, value) => {
    ensure(ctx, "string");
    if (!state.context[ctx.value]) unknownContext(ctx);
    return state.unify(state.context[ctx.value], value);
  }),
  set_context: semidet((state, ctx, value) => {
    ensure(ctx, "string");
    return state.setContext(ctx.value, value);
  }),
  // values
  value_type: semidet((state, value, type) => {
    switch (value.tag) {
      case "string":
        return state.unify(type, sv("string"));
      case "number":
        return state.unify(type, sv("number"));
      case "placeholder":
      case "var":
        return state.unify(type, sv("var"));
      case "struct":
        return state.unify(type, sv("struct"));
    }
  }),
  value_constraint: function* (state, value, constraint) {
    switch (value.tag) {
      case "string":
      case "number":
      case "struct":
        yield* state.runClause(constraint);
        return;
      case "placeholder":
        return;
      case "var":
        yield state.addConstraint(value.id, constraint).yield();
    }
  },
  var_name: semidet((state, value, name) => {
    switch (value.tag) {
      case "placeholder":
        return state.unify(k("__"), name);
      case "var":
        return state.unify(k(value.name), name);
      case "struct":
      case "string":
      case "number":
        return null;
    }
  }),
  string_number: semidet((state, string, number) => {
    if (check(string, "string")) {
      const parsed = Number(string);
      if (Number.isFinite(parsed)) {
        return state.unify(k(parsed), number);
      }
      return null;
    }
    if (check(number, "number")) {
      const strung = String(number.value);
      return state.unify(k(strung), string);
    }
    return null;
  }),
  string_substring: semidet((state, string, sub) => {
    ensure(string, "string");
    ensure(sub, "string");
    if (string.value.toLowerCase().match(sub.value.toLowerCase())) {
      return state;
    }
    return null;
  }),
  struct_arity: semidet((state, struct, arity) => {
    ensure(struct, "struct");
    return state.unify(k(struct.args.length), arity);
  }),
  struct_tag_list: semidet((state, struct, tag, list) => {
    // ensureVar(struct, "struct");
    // ensureVar(tag, "string");
    // ensureVar(list, "struct");
    if (check(struct, "struct")) {
      const { id, args } = struct;
      return state.unify(k(id), tag)?.unify(sv("", ...args), list);
    }
    if (check(tag, "string") && check(list, "struct")) {
      return state.unify(struct, sv(tag.value, ...list.args));
    }
    return null;
  }),
  struct_at_value: function* (state, struct, index, value) {
    ensure(struct, "struct");
    if (check(index, "number")) {
      const i = index.value;
      if (i < 0 || i >= struct.args.length) return;
      const res = state.unify(value, struct.args[i]);
      if (res) yield res.yield();
    } else {
      yield* uniqueStates(function* () {
        for (let i = 0; i < struct.args.length; i++) {
          const res = state.unify(index, k(i))?.unify(value, struct.args[i]);
          if (res) yield res.yield();
        }
      });
    }
  },
  struct_at_value_updated: semidet((state, struct, index, value, updated) => {
    ensure(struct, "struct");
    ensure(index, "number");
    if (index.value < 0 || index.value >= struct.args.length) return null;
    const nextArgs = struct.args.slice();
    nextArgs[index.value] = value;
    return state.unify(updated, { ...struct, args: nextArgs });
  }),
  list_from_to_slice: semidet((state, list, from, to, slice) => {
    ensure(list, "struct");
    const fromVal = check(from, "number") ? from.value : 0;
    const toVal = check(to, "number") ? to.value : list.args.length;
    return state
      .unify(from, k(fromVal))
      ?.unify(to, k(toVal))
      ?.unify(slice, { ...list, args: list.args.slice(fromVal, toVal) });
  }),
  list_list_append: function* (state, left, right, append) {
    if (check(left, "struct") && check(right, "struct")) {
      if (left.tag !== right.tag) return null;
      const ns = state.unify(append, sv(left.id, ...left.args, ...right.args));
      if (ns) yield ns.yield();
      return;
    }

    ensure(append, "struct");
    const unifySplit = (split: number) =>
      state
        .unify(left, {
          tag: "struct",
          id: append.id,
          args: append.args.slice(0, split),
        })
        ?.unify(right, {
          tag: "struct",
          id: append.id,
          args: append.args.slice(split),
        });

    if (check(left, "struct")) {
      const ns = unifySplit(left.args.length);
      if (ns) yield ns.yield();
    } else if (check(right, "struct")) {
      const ns = unifySplit(append.args.length - right.args.length);
      if (ns) yield ns.yield();
    } else {
      yield* uniqueStates(function* () {
        for (let i = 0; i <= append.args.length; i++) {
          const ns = unifySplit(i);
          if (ns) yield ns.yield();
        }
      });
    }
  },
  // I/O
  log: semidet((state, ...args) => {
    state.log(args);
    return state;
  }),
  id: semidet((state, id) => state.unify(id, k(crypto.randomUUID()))),
  timestamp: semidet((state, ts) => state.unify(ts, k(Date.now()))),
  tx: semidet((state, tx) => state.unify(tx, k(state.db.beginTx()))),
  commit: semidet((state, tx) => {
    ensure(tx, "number");
    state.db.commitTx(tx.value);
    return state;
  }),
  rollback: semidet((state, tx) => {
    ensure(tx, "number");
    state.db.rollbackTx(tx.value);
    return state;
  }),
  tx_update_field_value: semidet((state, tx, id, field, value) => {
    ensure(tx, "number");
    ensure(id, "string");
    ensure(field, "string");
    state.db.updateTx(tx.value, id.value, field.value, state.factToExpr(value));
    return state;
  }),
  tx_delete_field_value: function* (state, tx, id, field, value) {
    ensure(tx, "number");
    ensure(id, "string");
    const prev = state.db.get(id.value);
    if (!prev) return null;

    if (check(field, "string")) {
      // delete specific field
      const val = state.exprValue(prev[field.value], {});
      const ns = state.unify(val, value);
      if (!ns) return;
      ns.db.updateTx(tx.value, id.value, field.value, null);
      yield ns.yield();
      return;
    }

    // delete whole record
    state.db.insertTx(tx.value, id.value, null);
    yield* uniqueStates(function* () {
      for (const f in prev) {
        const prevValue = prev[f];
        if (!prevValue) continue;
        const val = state.exprValue(prevValue, {});
        const ns = state
          .unify(k(f), field) //
          ?.unify(val, value);
        if (!ns) return;
        yield ns.yield();
      }
    });
  },
  get_field_value: function* (state, id, field, value) {
    if (check(id, "string")) {
      const rec = state.db.get(id.value);
      if (!rec) return;
      if (check(field, "string")) {
        // get single field
        const val = rec[field.value];
        if (!val) return;
        const ns = state.unify(value, state.exprValue(val, {}));
        if (ns) yield ns.yield();
        return;
      }
      // get all fields
      yield* uniqueStates(function* () {
        for (const f in rec) {
          const val = rec[f];
          if (!val) continue;
          const ns = state
            .unify(field, k(f))
            ?.unify(value, state.exprValue(val, {}));
          if (ns) yield ns.yield();
        }
      });
      return;
    }
    // get from index
    if (check(field, "string")) {
      const idx = state.db.getIndex(field.value);
      if (idx) {
        yield* uniqueStates(function* () {
          for (const [{ entityId }] of idx.tree.where(
            whereValue(state.factToExpr(value))
          )) {
            const ns = state.unify(id, k(entityId));
            if (ns) yield ns.yield();
          }
        });
        return;
      }
    }
    // get everything
    yield* uniqueStates(function* () {
      for (const key of state.db.keys()) {
        const ns = state.unify(id, k(key));
        const rec = state.db.get(key)!;
        for (const f in rec) {
          const val = rec[f];
          if (!val) continue;
          const nns = ns
            ?.unify(field, k(f))
            ?.unify(value, ns.exprValue(val, {}));
          if (nns) yield nns.yield();
        }
      }
    });
  },
  view: function* (state, view) {
    ensure(view, "struct");
    yield {
      tag: "view",
      id: view.id,
      args: view.args.map((arg) => state.factToExpr(arg)),
      state,
    };
    yield state.yield();
  },
  view_children: function* (state, view, body) {
    ensure(view, "struct");
    const children: View[] = [];
    for (const res of state.runClause(body)) {
      switch (res.tag) {
        case "view":
          children.push(res);
          continue;
        case "state":
          state = res.state;
      }
    }

    yield {
      tag: "view",
      id: view.id,
      args: view.args.map((arg) => state.factToExpr(arg)),
      children,
      state,
    };
    yield state.yield();
  },
};

import { whereValue } from "./db";
import {
  Exception,
  k,
  State,
  StateNext,
  Value,
  View,
  check,
  uniqueStates,
  sv,
  printFact,
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
    const value = state.resolveString(id);
    yield* state.call(value, args);
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
    into = state.resolveShallow(into);
    let didSucceed = false;
    const results: Value[] = [];
    for (const res of state.runClause(goal)) {
      if (res.tag === "view") throw "todo";
      didSucceed = true;
      if (out.tag !== "placeholder") {
        const val = res.state.resolve(into);
        results.push(val);
      }
    }
    if (didSucceed) {
      if (out.tag === "placeholder") {
        return state;
      }
      return state.unify(out, { tag: "struct", id: "", args: results });
    }
    return null;
  }),
  limit: function* (state, limit, clause) {
    const value = state.resolveNumber(limit);
    let count = 0;
    for (const res of state.runClause(clause)) {
      if (count >= value) return;
      yield res;
      if (res.tag === "state") count++;
    }
  },
  // context
  has_context: semidet((state, ctx) => {
    const key = state.resolveString(ctx);
    if (state.context[key]) return state;
    return null;
  }),
  get_context: semidet((state, ctx, value) => {
    const key = state.resolveString(ctx);
    if (!state.context[key]) unknownContext(ctx);
    return state.unify(state.context[key], value);
  }),
  set_context: semidet((state, ctx, value) => {
    const key = state.resolveString(ctx);
    return state.setContext(key, value);
  }),
  // values
  value_type: semidet((state, value, type) => {
    switch (state.resolveShallow(value).tag) {
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
    value = state.resolveShallow(value);
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
    value = state.resolveShallow(value);
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
    string = state.resolveShallow(string);
    number = state.resolveShallow(number);
    if (check(string, "string")) {
      const parsed = Number(string.value);
      console.log({ string, parsed });
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
    if (
      state
        .resolveString(string)
        .toLowerCase()
        .match(state.resolveString(sub).toLowerCase())
    ) {
      return state;
    }
    return null;
  }),
  struct_arity: semidet((state, struct, arity) => {
    return state.unify(k(state.resolveStruct(struct).args.length), arity);
  }),
  struct_tag_list: semidet((state, struct, tag, list) => {
    struct = state.resolveShallow(struct);
    tag = state.resolveShallow(tag);
    list = state.resolveShallow(list);
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
    const { args } = state.resolveStruct(struct);
    index = state.resolveShallow(index);
    if (check(index, "number")) {
      const i = index.value;
      if (i < 0 || i >= args.length) return;
      const res = state.unify(value, args[i]);
      if (res) yield res.yield();
    } else {
      yield* uniqueStates(function* () {
        for (let i = 0; i < args.length; i++) {
          const res = state.unify(index, k(i))?.unify(value, args[i]);
          if (res) yield res.yield();
        }
      });
    }
  },
  struct_at_value_updated: semidet((state, struct, index, value, updated) => {
    const { id, args } = state.resolveStruct(struct);
    const i = state.resolveNumber(index);
    if (i < 0 || i >= args.length) return null;
    const nextArgs = args.slice();
    nextArgs[i] = value;
    return state.unify(updated, { tag: "struct", id, args: nextArgs });
  }),
  list_from_to_slice: semidet((state, list, from, to, slice) => {
    const { id, args } = state.resolveStruct(list);
    from = state.resolveShallow(from);
    to = state.resolveShallow(to);
    const fromVal = check(from, "number") ? from.value : 0;
    const toVal = check(to, "number") ? to.value : args.length;
    return state
      .unify(from, k(fromVal))
      ?.unify(to, k(toVal))
      ?.unify(slice, { tag: "struct", id, args: args.slice(fromVal, toVal) });
  }),
  list_list_append: function* (state, left, right, append) {
    left = state.resolveShallow(left);
    right = state.resolveShallow(right);
    if (check(left, "struct") && check(right, "struct")) {
      if (left.tag !== right.tag) return null;
      const ns = state.unify(append, sv(left.id, ...left.args, ...right.args));
      if (ns) yield ns.yield();
      return;
    }
    const { id, args } = state.resolveStruct(append);
    const unifySplit = (split: number) =>
      state
        .unify(left, {
          tag: "struct",
          id: id,
          args: args.slice(0, split),
        })
        ?.unify(right, {
          tag: "struct",
          id: id,
          args: args.slice(split),
        });

    if (check(left, "struct")) {
      const ns = unifySplit(left.args.length);
      if (ns) yield ns.yield();
    } else if (check(right, "struct")) {
      const ns = unifySplit(args.length - right.args.length);
      if (ns) yield ns.yield();
    } else {
      yield* uniqueStates(function* () {
        for (let i = 0; i <= args.length; i++) {
          const ns = unifySplit(i);
          if (ns) yield ns.yield();
        }
      });
    }
  },
  // I/O
  log: semidet((state, ...args) => {
    console.log(...args.map((arg) => printFact(state.resolve(arg))));
    return state;
  }),
  id: semidet((state, id) => state.unify(id, k(crypto.randomUUID()))),
  timestamp: semidet((state, ts) => state.unify(ts, k(Date.now()))),
  tx: semidet((state, tx) => state.unify(tx, k(state.db.beginTx()))),
  commit: semidet((state, tx) => {
    state.db.commitTx(state.resolveNumber(tx));
    return state;
  }),
  rollback: semidet((state, tx) => {
    state.db.rollbackTx(state.resolveNumber(tx));
    return state;
  }),
  tx_update_field_value: semidet((state, tx, id, field, value) => {
    state.db.updateTx(
      state.resolveNumber(tx),
      state.resolveString(id),
      state.resolveString(field),
      state.factToExpr(value)
    );
    return state;
  }),
  tx_delete_field_value: function* (state, tx, id, field, value) {
    const id_ = state.resolveString(id);
    const tx_ = state.resolveNumber(tx);
    const field_ = state.resolve(field);
    const value_ = state.resolve(value);

    const prev = state.db.get(id_);
    if (!prev) return null;

    if (field_.tag === "string") {
      // delete specific field
      const val = state.exprValue(prev[field_.value], {});
      const ns = state.unify(val, value_);
      if (!ns) return;
      ns.db.updateTx(tx_, id_, field_.value, null);
      yield ns.yield();
      return;
    }

    // delete whole record
    state.db.insertTx(tx_, id_, null);
    yield* uniqueStates(function* () {
      for (const f in prev) {
        const prevValue = prev[f];
        if (!prevValue) continue;
        const val = state.exprValue(prevValue, {});
        const ns = state
          .unify(k(f), field_) //
          ?.unify(val, value_);
        if (!ns) return;
        yield ns.yield();
      }
    });
  },
  get_field_value: function* (state, id, field, value) {
    id = state.resolveShallow(id);
    field = state.resolveShallow(field);
    value = state.resolveShallow(value);
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
    const { id, args } = state.resolveStruct(view);
    yield {
      tag: "view",
      id: id,
      args: args.map((arg) => state.factToExpr(arg)),
      state,
      callbacks: [],
    };
    yield state.yield();
  },

  view_children: function* (state, view, body) {
    const { id, args } = state.resolveStruct(view);
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
      id: id,
      args: args.map((arg) => state.factToExpr(arg)),
      children,
      callbacks: [],
      state,
    };
    yield state.yield();
  },
  view_callback: function* (state, view, params, callback, body) {
    const { id, args } = state.resolveStruct(view);
    const children: View[] = [];
    if (body) {
      for (const res of state.runClause(body)) {
        switch (res.tag) {
          case "view":
            children.push(res);
            continue;
          case "state":
            state = res.state;
        }
      }
    }
    yield {
      tag: "view",
      id: id,
      args: args.map((arg) => state.factToExpr(arg)),
      state,
      callbacks: [{ params, body: callback }],
      children,
    };
    yield state.yield();
  },
  view_results: function* (state, body, out) {
    for (const res of state.runClause(body)) {
      if (res.tag === "view") {
        const ns = res.state.unify(out, {
          tag: "struct",
          id: res.id,
          args: [
            {
              tag: "struct",
              id: "",
              //this conversion seems suspect, especially wrt on_change
              args: res.args.map((arg) => res.state.exprValue(arg, {})),
            },
            // children goes here
          ],
        });
        if (ns) yield ns.yield();
      }
    }
  },
};

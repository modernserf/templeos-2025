import { AnyStruct, l, s } from "./expr";
import {
  Exception,
  k,
  State,
  StateNext,
  Value,
  uniqueStates,
  sv,
  printFact,
  exprValue,
} from "./state";
import { clearState } from "./storage";

function semidet<Args extends unknown[]>(
  fn: (...args: Args) => State | null | undefined,
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
  do: function* (state, ...items) {
    if (items.length === 0) {
      yield state.yield();
      return;
    }

    const stack = [state.eval(items[0])];
    while (stack.length) {
      const frame = stack.at(-1)!;
      const res = frame.next();
      if (res.done) {
        stack.pop();
        continue;
      }

      const nextClause = items[stack.length];

      if (nextClause) {
        stack.push(res.value.state.eval(nextClause));
      } else {
        yield res.value;
      }
    }
  },
  fork: function* (state, ...items) {
    yield* uniqueStates(function* () {
      for (const arg of items) {
        yield* state.fork().eval(arg);
      }
    });
  },
  "¬": semidet((state, goal) => {
    for (const _ of state.fork().eval(goal)) {
      // success -> failure
      return null;
    }
    return state;
  }),
  call: function* (state, id, ...args) {
    const value = state.resolveString(id);
    yield* state.call(value, args);
  },
  apply: function* (state, head, ...argLists) {
    const { id, args } = state.resolveStruct(head);
    let argsConcat = args.slice();
    for (let i = 0; i < argLists.length; i++) {
      const { args } = state.resolveStruct(argLists[i]);
      argsConcat = argsConcat.concat(args);
    }
    yield* state.call(id, argsConcat);
  },
  throw: (state, exception) => {
    throw new Exception(state.resolve(exception));
  },
  try_error_catch: function* (state, tryGoal, exception, catchGoal) {
    try {
      yield* state.fork().eval(tryGoal);
    } catch (e) {
      if (e instanceof Exception) {
        const ns = state.unify(exception, e.error);
        if (!ns) throw e;
        yield* ns.eval(catchGoal);
      } else {
        throw e;
      }
    }
  },
  if_then_else: function* (state, cond, ifSuccess, ifFail) {
    let didSucceed = false;
    for (const res0 of state.fork().eval(cond)) {
      didSucceed = true;
      yield* res0.state.eval(ifSuccess);
    }
    if (!didSucceed) {
      yield* state.eval(ifFail);
    }
  },
  collect: semidet((state, into, goal, out) => {
    let didSucceed = false;
    const results: Value[] = [];
    for (const res of state.fork().eval(goal)) {
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
      return state.unify(out, { tag: "box", id: "", args: results });
    }
    return null;
  }),
  limit: function* (state, limit, clause) {
    const value = state.resolveNumber(limit);
    let count = 0;
    for (const res of state.fork().eval(clause)) {
      yield res;
      if (res.tag === "state") count++;
      if (count >= value) return;
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
    switch (value.tag) {
      case "string":
        return state.unify(type, sv("string"));
      case "number":
        return state.unify(type, sv("number"));
      case "placeholder":
      case "var":
        return state.unify(type, sv("var"));
      case "box":
        return state.unify(type, sv("box"));
    }
  }),
  value_constraint: function* (state, value, constraint) {
    switch (value.tag) {
      case "string":
      case "number":
      case "box":
        yield* state.eval(constraint);
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
      case "box":
      case "string":
      case "number":
        return null;
    }
  }),
  string_number: semidet((state, string, number) => {
    if (string.tag == "string") {
      const parsed = Number(string.value);
      if (Number.isFinite(parsed)) {
        return state.unify(k(parsed), number);
      }
      return null;
    }
    if (number.tag == "number") {
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
  number_min_max: function* (state, num, min, max) {
    if (num.tag == "number") {
      if (min.tag == "number") {
        if (min.value > num.value) return;
      } else {
        const ns = state.unify(num, min);
        if (!ns) return;
        state = ns;
      }
      if (max.tag == "number") {
        if (max.value < num.value) return;
      } else {
        const ns = state.unify(num, max);
        if (!ns) return;
        state = ns;
      }
      yield state.yield();
    } else {
      const minVal = min.tag == "number" ? min.value : 0;
      const maxVal = max.tag == "number" ? max.value : Infinity;
      if (minVal > maxVal) return;
      for (let i = minVal; i <= maxVal; i++) {
        const ns = state.fork().unify(num, k(i));
        if (!ns) return;
        yield ns.yield();
      }
    }
  },
  timestamp_date: semidet((state, ts, date) => {
    if (ts.tag === "number") {
      const d = new Date(ts.value);
      const dateValue = exprValue(
        s.date(
          d.getFullYear(),
          d.getMonth() + 1,
          d.getDate(),
          d.getHours(),
          d.getMinutes(),
          d.getSeconds(),
          d.getMilliseconds(),
        ),
        {},
      );
      return state.unify(date, dateValue);
    } else {
      const { id, args } = state.resolveStruct(date);
      if (id !== "date") return null;
      const d = new Date(
        state.resolveNumber(args[0]),
        state.resolveNumber(args[1]) - 1,
        state.resolveNumber(args[2]),
        state.resolveNumber(args[3]),
        state.resolveNumber(args[4]),
        state.resolveNumber(args[5]),
        state.resolveNumber(args[6]),
      );
      return state.unify(ts, k(d.getTime()));
    }
    return null;
  }),
  box_length: semidet((state, box, arity) => {
    return state.unify(k(state.resolveStruct(box).args.length), arity);
  }),
  box_tag_list: semidet((state, box, tag, list) => {
    if (box.tag == "box") {
      const { id, args } = box;
      return state.unify(k(id), tag)?.unify(sv("", ...args), list);
    }
    if (tag.tag == "string" && list.tag == "box") {
      return state.unify(box, sv(tag.value, ...list.args));
    }
    return null;
  }),

  box_at_value: function* (state, box, index, value) {
    const { args } = state.resolveStruct(box);
    if (index.tag == "number") {
      const i = index.value;
      if (i < 0 || i >= args.length) return;
      const res = state.unify(value, args[i]);
      if (res) yield res.yield();
    } else {
      yield* uniqueStates(function* () {
        for (let i = 0; i < args.length; i++) {
          const res = state.fork().unify(index, k(i))?.unify(value, args[i]);
          if (res) yield res.yield();
        }
      });
    }
  },
  box_at_value_updated: semidet((state, box, index, value, updated) => {
    const { id, args } = state.resolveStruct(box);
    const i = state.resolveNumber(index);
    if (i < 0 || i >= args.length) return null;
    const nextArgs = args.slice();
    nextArgs[i] = value;
    return state.unify(updated, { tag: "box", id, args: nextArgs });
  }),
  box_changelist_updated: semidet((state, box, changelist, updated) => {
    const { id, args } = state.resolveStruct(box);
    const nextArgs = args.slice();
    const { args: changes } = state.resolveStruct(changelist);
    for (let i = 0; i < changes.length; i++) {
      const {
        args: [index, value],
      } = state.resolveStruct(changes[i]);
      const i_ = state.resolveNumber(index);
      if (i_ < 0 || i_ >= args.length) return null;
      nextArgs[i_] = value;
    }

    return state.unify(updated, { tag: "box", id, args: nextArgs });
  }),

  box_from_to_slice: semidet((state, list, from, to, slice) => {
    const { id, args } = state.resolveStruct(list);
    const fromVal = from.tag == "number" ? from.value : 0;
    const toVal = to.tag == "number" ? to.value : args.length;
    return state
      .unify(from, k(fromVal))
      ?.unify(to, k(toVal))
      ?.unify(slice, { tag: "box", id, args: args.slice(fromVal, toVal) });
  }),
  list_item: function* (state, list, item) {
    const { id, args } = state.resolveStruct(list);
    if (id !== "" || args.length === 0) return;
    for (let i = 0; i < args.length; i++) {
      const res = state.fork()?.unify(item, args[i]);
      if (res) yield res.yield();
    }
  },
  box_box_append: function* (state, left, right, append) {
    if (left.tag == "box" && right.tag == "box") {
      if (left.tag !== right.tag) return null;
      if (left.args.length === 0) {
        const ns = state.unify(right, append);
        if (ns) yield ns.yield();
      } else {
        const ns = state.unify(
          append,
          sv(left.id, ...left.args, ...right.args),
        );
        if (ns) yield ns.yield();
      }
      return;
    }
    const { id, args } = state.resolveStruct(append);
    const unifySplit = (st: State, split: number) =>
      st
        .unify(left, {
          tag: "box",
          id: id,
          args: args.slice(0, split),
        })
        ?.unify(right, {
          tag: "box",
          id: id,
          args: args.slice(split),
        });

    if (left.tag == "box") {
      const ns = unifySplit(state, left.args.length);
      if (ns) yield ns.yield();
    } else if (right.tag == "box") {
      const ns = unifySplit(state, args.length - right.args.length);
      if (ns) yield ns.yield();
    } else {
      yield* uniqueStates(function* () {
        for (let i = 0; i <= args.length; i++) {
          const ns = unifySplit(state.fork(), i);
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
    const idValue = state.resolveString(id);
    const fieldValue = state.resolveString(field);
    const valueExpr = state.valueExpr(value);

    // TODO: db__cardinality field
    const fieldRec = state.db.get(fieldValue);
    const isMany = fieldRec?.db__index?.id === "multiRef";

    // TODO: db should handle this
    if (isMany) {
      const prevRec = state.db.get(idValue) ?? {};
      let valueList = (prevRec[fieldValue] as AnyStruct) ?? l();
      // TODO: test via unification
      if (!valueList.args.some((arg) => arg === valueExpr)) {
        valueList = l(...valueList.args, valueExpr);
      }
      state.db.updateTx(
        state.resolveNumber(tx),
        idValue,
        fieldValue,
        valueList,
      );
    } else {
      state.db.updateTx(
        state.resolveNumber(tx),
        idValue,
        fieldValue,
        valueExpr,
      );
    }

    return state;
  }),
  tx_delete_field_value: function* (state, tx, id, field, value) {
    const id_ = state.resolveString(id);
    const tx_ = state.resolveNumber(tx);
    const prev = state.db.get(id_);
    if (!prev) return null;

    if (field.tag === "string") {
      // TODO: db__cardinality field
      const fieldRec = state.db.get(field.value);
      const isMany = fieldRec?.db__index?.id === "multiRef";

      // delete specific field
      const val = exprValue(prev[field.value], {});

      if (isMany) {
        const filtered = ((val as Value & { tag: "box" }).args ?? []).filter(
          (arg) => !state.unify(arg, value),
        );
        const nextValue = filtered.length
          ? state.valueExpr({ tag: "box", id: "", args: filtered })
          : null;

        state.db.updateTx(tx_, id_, field.value, nextValue);
        yield state.yield();
        return;
      } else {
        const ns = state.unify(val, value);
        if (!ns) return;
        ns.db.updateTx(tx_, id_, field.value, null);
        yield ns.yield();
        return;
      }
    }

    // delete whole record
    try {
      state.db.insertTx(tx_, id_, null);
    } catch (e) {
      console.error(e);
    }

    if (value.tag === "placeholder") {
      yield state.yield();
      return;
    }

    yield* uniqueStates(function* () {
      for (const f in prev) {
        const prevValue = prev[f];
        if (!prevValue) continue;
        const val = exprValue(prevValue, {});
        const ns = state.fork().unify(k(f), field)?.unify(val, value);
        if (!ns) return;
        yield ns.yield();
      }
    });
  },
  get_field_value: function* (state, id, field, value) {
    if (field.tag === "string") {
      const fieldRec = state.db.get(field.value);
      // TODO: db__cardinality field
      const isMany = fieldRec?.db__index?.id === "multiRef";

      // get single field
      if (id.tag == "string") {
        const rec = state.db.get(id.value);
        if (!rec) return;
        const val = rec[field.value];
        if (val == null) return;

        if (isMany) {
          yield* uniqueStates(function* () {
            for (const arg of (val as AnyStruct).args) {
              const ns = state.fork().unify(value, exprValue(arg, {}));
              if (ns) yield ns.yield();
            }
          });
          return;
        } else {
          const ns = state.unify(value, exprValue(val, {}));
          if (ns) yield ns.yield();
          return;
        }
      } else {
        // get from index
        const idx = state.db.getIndex(field.value);
        if (idx) {
          yield* uniqueStates(function* () {
            const valueExpr = state.valueExpr(value);

            for (const [{ entityId }] of idx.tree.getRange(
              { value: valueExpr, entityId: "" },
              { value: valueExpr, entityId: "~" },
            )) {
              const ns = state.fork().unify(id, k(entityId));
              if (ns) yield ns.yield();
            }
          });
          return;
        }
      }
    }

    // get all fields
    if (id.tag == "string") {
      const rec = state.db.get(id.value);
      if (!rec) return;
      yield* uniqueStates(function* () {
        for (const f in rec) {
          const ns = state.fork().unify(field, k(f));
          if (ns) yield* primitives.get_field_value(ns, id, k(f), value);
        }
      });
      return;
    }

    // get everything
    yield* uniqueStates(function* () {
      for (const key of state.db.keys()) {
        const ns = state.fork().unify(id, k(key));
        const rec = state.db.get(key)!;
        for (const f in rec) {
          const nns = ns?.unify(field, k(f));
          if (nns) yield* primitives.get_field_value(nns, k(key), k(f), value);
        }
      }
    });
  },
  send: semidet((state, message) => {
    state.eventSource.notifyEventListeners(state.resolve(message));
    return state;
  }),
  delay_rule: semidet((state, timeout, rule) => {
    const t = state.resolveNumber(timeout);
    setTimeout(() => {
      for (const _ of state.eval(rule)) {
        // run state
      }
    }, t);
    return state;
  }),
  clear_state: semidet(() => {
    clearState();
    throw new Error("unreachable");
  }),
};

primitives[","] = primitives.do;

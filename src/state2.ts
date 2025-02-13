import { Value, box, k, Exception, FactId } from "./value2";

export type Pid = number;

type Constraint =
  | { tag: "dif"; value: Value }
  | { tag: "and"; left: Constraint; right: Constraint };

type Fact = Value | { tag: "constraint"; constraint: Constraint };

type Facts = Record<FactId, Fact>;

function unknownContext(ctx: Value) {
  throw new Exception(box("unknown_context", [ctx]));
}

export class State {
  private constructor(
    public readonly pid: Pid,
    private facts: Facts,
    private context: Record<string, Value>,
  ) {}
  static init(pid: Pid): State {
    return new State(pid, {}, {});
  }
  fork(): State {
    return new State(this.pid, { ...this.facts }, this.context);
  }
  getContext(key: string) {
    return this.context[key] ?? unknownContext(k(key));
  }
  setContext(key: string, value: Value): State {
    return new State(this.pid, this.facts, { ...this.context, [key]: value });
  }
  resolve(value: Value): Value {
    switch (value.tag) {
      case "var": {
        let val = value;
        while (true) {
          const next = this.facts[val.id];
          if (!next || next.tag === "constraint") return val;
          if (next.tag !== "var") return this.resolve(next);
          val = next;
        }
      }
      case "string":
      case "number":
        return value;
      case "box": {
        let didChange = false;
        const out: Value[] = [];
        for (let i = 0; i < value.args.length; i++) {
          const prev = value.args[i];
          const next = this.resolve(prev);
          if (next !== prev) didChange = true;
          out.push(next);
        }
        if (didChange) {
          return box(value.id, out);
        } else {
          return value;
        }
      }
    }
  }
  dif(left: Value, right: Value): boolean {
    left = this.resolveVar(left);
    right = this.resolveVar(right);

    if (left.tag === "var" || right.tag === "var") {
      if (left.tag === "var" && !this.difVar(left, right)) return false;
      if (right.tag === "var" && !this.difVar(right, left)) return false;
      return true;
    }

    if (left.tag !== right.tag) return true;

    switch (left.tag) {
      case "string":
      case "number":
        if ((right as typeof left).value == left.value) return false;
        return true;
      case "box": {
        const r = right as typeof left;
        if (left.id !== r.id) return true;
        if (left.args.length !== r.args.length) return true;
        for (let i = 0; i < left.args.length; i++) {
          if (!this.dif(left.args[i], r.args[i])) return false;
        }
        return true;
      }
    }
  }
  private getConstraint(factId: FactId): Constraint | null {
    const fact = this.facts[factId];
    if (!fact) return null;
    /* v8 ignore next */
    if (fact.tag !== "constraint") throw new Error("expected constraint");
    return fact.constraint;
  }
  private difVar(left: Value & { tag: "var" }, right: Value): boolean {
    if (right.tag === "var" && right.id === left.id) return false;

    const prev = this.getConstraint(left.id);
    const next = { tag: "dif", value: right } as const;
    this.facts[left.id] = {
      tag: "constraint",
      constraint: prev ? { tag: "and", left: prev, right: next } : next,
    };
    return true;
  }
  unify(left: Value, right: Value): boolean {
    left = this.resolveVar(left);
    right = this.resolveVar(right);

    switch (left.tag) {
      case "var":
        if (!this.unifyVar(left, right)) return false;
        return true;
      case "string":
      case "number":
        switch (right.tag) {
          case "var":
            if (!this.unifyVar(right, left)) return false;
            return true;
          case "box":
            return false;
          case "string":
          case "number":
            if (left.value !== right.value) return false;
            return true;
        }
      // eslint-disable-next-line no-fallthrough
      case "box":
        switch (right.tag) {
          case "var":
            if (!this.unifyVar(right, left)) return false;
            return true;
          case "string":
          case "number":
            return false;
          case "box": {
            if (left.id !== right.id) return false;
            if (left.args.length !== right.args.length) return false;
            for (let i = 0; i < left.args.length; i++) {
              if (!this.unify(left.args[i], right.args[i])) return false;
            }
            return true;
          }
        }
    }
  }
  private checkConstraint(constraint: Constraint, value: Value): boolean {
    switch (constraint.tag) {
      case "dif":
        return this.dif(constraint.value, value);
      case "and":
        return (
          this.checkConstraint(constraint.left, value) &&
          this.checkConstraint(constraint.right, value)
        );
    }
  }
  private unifyVar(left: Value & { tag: "var" }, right: Value): boolean {
    if (right.tag === "var" && right.id === left.id) return true;

    const constraint = this.getConstraint(left.id);
    if (constraint && !this.checkConstraint(constraint, right)) return false;

    this.facts[left.id] = right;
    return true;
  }
  resolveVar(fact: Value): Value {
    switch (fact.tag) {
      case "string":
      case "number":
      case "box":
        return fact;
      case "var": {
        let val = fact;
        while (true) {
          const next = this.facts[val.id];
          if (!next || next.tag === "constraint") return val;
          if (next.tag !== "var") return next;
          val = next;
        }
      }
    }
  }
}

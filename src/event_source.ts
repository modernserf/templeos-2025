import { useEffect, useState } from "react";
import { Value, State, Exception, printFact, sv } from "./state";
import { Expr } from "./expr";
import { DB } from "./db";
import { Rec } from "./data";

export type EventListener<T> = (value: T) => void;

export class EventSource<T> {
  private eventListeners: Array<EventListener<T>> = [];
  addEventListener(fn: EventListener<T>) {
    this.eventListeners.push(fn);
    return () => {
      this.eventListeners = this.eventListeners.filter((f) => f !== fn);
    };
  }
  notifyEventListeners(message: T) {
    for (const l of this.eventListeners) {
      l(message);
    }
  }
}

export const wholeDatabaseEventSource = new EventSource<DB<Rec>>();

export function useStateCallback(state: State) {
  return (params: Value, body: Value, arg: Expr) => {
    const ns = state.unify(params, state.exprValue(arg, {}));
    if (!ns) return;
    try {
      for (const _ of ns.eval(body)) {
        // do nothing
      }
      state.eventSource.notifyEventListeners(sv("root"));
      wholeDatabaseEventSource.notifyEventListeners(state.db);
    } catch (e) {
      if (e instanceof Exception) {
        console.error(printFact(e.error));
      }
    }
  };
}

export function useMessageEventSource(
  state: State,
  pattern: Value,
  goal: Value,
) {
  const [stateWithMessage, setState] = useState(state);
  useEffect(() => {
    return state.eventSource.addEventListener((message) => {
      const ns = state.fork().unify(pattern, message);
      if (!ns) return;
      for (const res of ns.eval(goal)) {
        setState(res.state);
        return;
      }
    });
  }, [state, pattern, goal]);
  return stateWithMessage;
}

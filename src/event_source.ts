import { useEffect, useState } from "react";
import { Value, State, Exception, printFact } from "./state";
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

export const eventSource = new EventSource<DB<Rec>>();

export function useStateCallback(state: State) {
  return (params: Value, body: Value, arg: Expr) => {
    const ns = state.unify(params, state.exprValue(arg, {}));
    if (!ns) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of ns.eval(body)) {
        // do nothing
      }
      eventSource.notifyEventListeners(state.db);
    } catch (e) {
      if (e instanceof Exception) {
        console.error(printFact(e.error));
      }
    }
  };
}

export function useEventSource() {
  // subscribe to event listener
  const [, setState] = useState({});
  useEffect(() => {
    return eventSource.addEventListener(() => {
      setState({});
    });
  }, []);
}

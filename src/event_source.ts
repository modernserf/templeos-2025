import { useEffect, useState } from "react";
import { State } from "./state";
import { Expr } from "./expr";

type EventListener<T> = (value: T) => void;

export class EventSource {
  private eventListeners: Array<EventListener<unknown>> = [];
  addEventListener(fn: EventListener<unknown>) {
    this.eventListeners.push(fn);
    return () => {
      this.eventListeners = this.eventListeners.filter((f) => f !== fn);
    };
  }
  notifyEventListeners(message: unknown) {
    for (const l of this.eventListeners) {
      l(message);
    }
  }
}

export const eventSource = new EventSource();

export function useEventHandler(state: State) {
  return (rule: Expr) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of state.runAll(rule)) {
      // do nothing
    }
    eventSource.notifyEventListeners(state.dbDump());
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

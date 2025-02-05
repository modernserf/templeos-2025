import { useEffect, useState } from "react";
import { Value, State } from "./state";
import { Expr } from "./expr";

type EventListener<T> = (value: T) => void;

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

export const eventSource = new EventSource();

export function useStateCallback(state: State) {
  return (params: Value, body: Value, arg: Expr) => {
    state.runCallback(params, body, arg);
    eventSource.notifyEventListeners(state.db);
  };
}

export function useEventHandler(state: State) {
  return (rule: Expr) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of state.runAll(rule)) {
      // do nothing
    }
    eventSource.notifyEventListeners(state.db);
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

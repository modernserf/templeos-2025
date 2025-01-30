import { useEffect, useState } from "react";
import { State } from "./state3";
import { Expr } from "./expr";

export class EventSource {
  private eventListeners: Array<() => void> = [];
  addEventListener(fn: () => void) {
    this.eventListeners.push(fn);
    return () => {
      this.eventListeners = this.eventListeners.filter((f) => f !== fn);
    };
  }
  notifyEventListeners() {
    for (const l of this.eventListeners) {
      l();
    }
  }
}

const eventSource = new EventSource();

export function useEventHandler(state: State) {
  return (rule: Expr) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const _ of state.runAll(rule)) {
      // do nothing
    }
    eventSource.notifyEventListeners();
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

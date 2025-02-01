import { State } from "./state";
import { clearState, loadState } from "./storage";
import { Query } from "./view_primitive";
import { useEventSource } from "./event_source";
import { s, v } from "./expr";
import { Component, ReactNode } from "react";

const qApp = s(
  ",",
  s("view__appMenu"),
  s("get_field_value", v.w, "db__schema", "schema__window"),
  s("view__window", v.w)
);

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ backgroundColor: "pink" }}>
          <div>{this.state.error.message}</div>
          <button onClick={clearState}>Clear state</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const state = State.root(loadState());
export function App() {
  useEventSource();
  return (
    <ErrorBoundary>
      <Query state={state} clause={qApp} />
    </ErrorBoundary>
  );
}

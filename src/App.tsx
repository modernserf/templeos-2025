import { useReducer } from "react";
import "./App.css";

type Rec = {
  file__name?: string;
  file__description?: string;
};

type BrowseParams = {
  id: string;
};

type WindowHistory = {
  current: BrowseParams;
  back: BrowseParams[];
  forward: BrowseParams[];
};

type State = {
  db: Record<string, Rec>;
  window: WindowHistory;
};

const initState: State = {
  db: {
    home: {
      file__name: "home",
      file__description: "this is the home card",
    },
    other: {
      file__name: "other",
      file__description: "this is the other card",
    },
  },
  window: {
    current: { id: "home" },
    back: [],
    forward: [],
  },
};

const notFound: Rec = {
  file__name: "not found",
  file__description: "Card not found",
};

type Action =
  | { tag: "back" }
  | { tag: "forward" }
  | { tag: "push"; value: BrowseParams }
  | { tag: "replace"; value: BrowseParams };

function reducer(state: State, action: Action): State {
  switch (action.tag) {
    case "back":
      if (state.window.back.length > 0) {
        const nextBack = state.window.back.slice();
        return {
          ...state,
          window: {
            current: nextBack.pop()!,
            back: nextBack,
            forward: [...state.window.forward, state.window.current],
          },
        };
      } else {
        return state;
      }
    case "forward": {
      if (state.window.forward.length > 0) {
        const nextForward = state.window.forward.slice();
        return {
          ...state,
          window: {
            current: nextForward.pop()!,
            back: [...state.window.back, state.window.current],
            forward: nextForward,
          },
        };
      } else {
        return state;
      }
    }
    case "push":
      return {
        ...state,
        window: {
          current: action.value,
          back: [...state.window.back, state.window.current],
          forward: [],
        },
      };
    default:
      return state;
  }
}

function Link({
  dispatch,
  params,
  children,
}: {
  dispatch: React.Dispatch<Action>;
  params: BrowseParams;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => dispatch({ tag: "push", value: params })}
    >
      {children}
    </button>
  );
}

function App() {
  const [state, dispatch] = useReducer(reducer, initState);

  const currentCard = state.db[state.window.current.id] ?? notFound;
  const canForward = state.window.forward.length > 0;
  const canBack = state.window.back.length > 0;

  return (
    <>
      <h1>{currentCard.file__name}</h1>
      <p>{currentCard.file__description}</p>
      <pre>{JSON.stringify(state.window, undefined, 2)}</pre>
      <nav>
        <button
          type="button"
          onClick={() => dispatch({ tag: "back" })}
          disabled={!canBack}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => dispatch({ tag: "forward" })}
          disabled={!canForward}
        >
          Forward
        </button>
        <Link dispatch={dispatch} params={{ id: "home" }}>
          Home
        </Link>
        <Link dispatch={dispatch} params={{ id: "other" }}>
          Other
        </Link>
        <Link dispatch={dispatch} params={{ id: "sfwhrioqwrth" }}>
          404
        </Link>
      </nav>
    </>
  );
}

export default App;

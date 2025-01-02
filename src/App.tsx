import { useReducer } from "react";
import "./App.css";

type TextNode =
  | {
      tag: "text";
      text: string;
    }
  | { tag: "link"; text: string; params: BrowseParams };

type Rec = {
  file__name?: string;
  file__description?: string;
  text__content?: TextNode[];
  db__type?: string;
  index__field?: string;
  view__component?: string;
  view__types?: string[];
};

type Index = {
  view__types?: string[];
};

type BrowseParams = {
  id: string;
  view?: string;
};

type WindowHistory = {
  current: BrowseParams;
  back: BrowseParams[];
  forward: BrowseParams[];
};

type State = {
  db: Record<string, Rec>;
  index: Record<string, Index>;
  window: WindowHistory;
};

const initState: State = {
  db: {
    type__schema: {
      db__type: "type__schema",
      file__name: "Schema",
      file__description:
        "Schema defines the fields in a record & is used to select the viewer",
    },
    type__index: {
      db__type: "type__index",
      file__name: "Index",
      file__description: "Index allows lookup of records by their content",
    },
    type__anyType: {
      db__type: "type__schema",
      file__name: "AnyType",
      file__description: "fallback schema for any type of record",
    },
    type__text: {
      db__type: "type__schema",
      file__name: "Text",
      file__description: "schema for Text",
    },
    type__view: {
      db__type: "type__schema",
      file__name: "View",
      file__description: "schema for View",
    },
    index__view__types: {
      db__type: "type__index",
      file__name: "view__types index",
      file__description:
        "used for looking up the viewers that can render records with a given schema",
      index__field: "view__types",
    },
    view__anyType: {
      db__type: "type__view",
      file__name: "DataView",
      file__description: "default viewer for all data types",
      view__component: "DataView",
      view__types: ["type__anyType"],
    },
    view__text: {
      db__type: "type__view",
      file__name: "TextView",
      file__description: "viewer for text cards",
      view__component: "TextView",
      view__types: ["type__text"],
    },
    home: {
      db__type: "type__text",
      file__name: "home",
      file__description: "this is the home card",
      text__content: [
        { tag: "text", text: "content that " },
        { tag: "link", text: "links", params: { id: "other" } },
        { tag: "text", text: " to another card." },
      ],
    },
    other: {
      file__name: "other",
      file__description: "this is the other card",
    },
    notFound: {
      file__name: "not found",
      file__description: "Card not found",
    },
  },
  index: {},
  window: {
    current: { id: "home" },
    back: [],
    forward: [],
  },
};

function populateIndex(state: State) {
  const indexes = Object.values(state.db).filter(
    (rec) => rec.db__type === "type__index"
  );

  for (const [id, rec] of Object.entries(state.db)) {
    for (const index of indexes) {
      const field = index.index__field!;
      if (field in rec) {
        const value = rec[field];
        state.index[value] ??= {};
        state.index[value][field] ??= [];
        state.index[value][field].push(id);
      }
    }
  }
}

populateIndex(initState);

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
    case "replace":
      return {
        ...state,
        window: {
          ...state.window,
          current: action.value,
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

type ViewParams = {
  currentCard: Rec;
  state: State;
  dispatch: React.Dispatch<Action>;
};

function DataView({ currentCard }: ViewParams) {
  return <pre>{JSON.stringify(currentCard, null, 2)}</pre>;
}

function TextView({ currentCard, dispatch }: ViewParams) {
  return (
    <div>
      {(currentCard.text__content ?? []).map((node, i) => {
        switch (node.tag) {
          case "text":
            return <span key={i}>{node.text}</span>;
          case "link":
            return (
              <Link key={i} dispatch={dispatch} params={node.params}>
                {node.text}
              </Link>
            );
        }
      })}
    </div>
  );
}

const viewByName: Record<string, React.FC<ViewParams>> = { TextView, DataView };

function App() {
  const [state, dispatch] = useReducer(reducer, initState);

  const currentCard = state.db[state.window.current.id] ?? state.db.notFound;
  const canForward = state.window.forward.length > 0;
  const canBack = state.window.back.length > 0;

  const viewersForType =
    state.index[currentCard.db__type ?? ""]?.view__types ?? [];
  const viewersForAnyType = state.index.type__anyType?.view__types ?? [];

  const view =
    state.db[state.window.current.view ?? ""] ??
    state.db[viewersForType[0] ?? ""] ??
    state.db.view__anyType;

  const View = viewByName[view.view__component!];

  return (
    <>
      <h1>{currentCard.file__name}</h1>
      <View state={state} dispatch={dispatch} currentCard={currentCard} />
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
        <select
          value={state.window.current.view ?? ""}
          onChange={(e) =>
            dispatch({
              tag: "replace",
              value: { ...state.window.current, view: e.target.value },
            })
          }
        >
          {viewersForType.concat(viewersForAnyType).map((viewId) => (
            <option key={viewId} value={viewId}>
              {state.db[viewId].file__name ?? viewId}
            </option>
          ))}
        </select>
      </nav>
      <pre>{JSON.stringify(state.window, undefined, 2)}</pre>
    </>
  );
}

export default App;

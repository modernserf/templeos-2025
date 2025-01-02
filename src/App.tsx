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
  db__schema?: string;
  field__refType?: string;
  index__field?: string;
  view__component?: string;
  view__schema?: string;
};

type Index = {
  view__schema?: string[];
};

type BrowseParams = {
  id: string;
  view?: string;
  data?: Record<string, string>;
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
    // schemas
    schema__schema: {
      db__schema: "schema__schema",
      file__name: "Schema",
      file__description:
        "Schema defines the fields in a record & is used to select the viewer",
    },
    schema__field: {
      db__schema: "schema__schema",
      file__name: "Field",
    },
    schema__index: {
      db__schema: "schema__schema",
      file__name: "Index",
      file__description: "Index allows lookup of records by their content",
    },
    schema__anyType: {
      db__schema: "schema__schema",
      file__name: "AnyType",
      file__description: "fallback schema for any type of record",
    },
    schema__text: {
      db__schema: "schema__schema",
      file__name: "Text",
      file__description: "schema for Text",
    },
    schema__view: {
      db__schema: "schema__schema",
      file__name: "View",
      file__description: "schema for View",
    },
    // fields
    db__schema: {
      db__schema: "schema__field",
      file__name: "DB Schema",
      file__description: "schema used to validate & render this record",
      field__refType: "schema__schema",
    },
    field__refType: {
      db__schema: "schema__field",
      file__name: "Field refType",
      file__description:
        "if this is set, the value of this field is a ref to a record with this schema",
      field__refType: "schema__schema",
    },
    index__field: {
      db__schema: "schema__field",
      file__name: "Index field",
      file__description: "the field this is indexing",
      field__refType: "schema__field",
    },
    view__component: {
      db__schema: "schema__field",
      file__name: "View component",
      file__description: "name of the primitive component used for rendering",
    },
    view__schema: {
      db__schema: "schema__field",
      file__name: "View schema",
      file__description: "the schema that this view is supposed to render",
      field__refType: "schema__schema",
    },
    file__name: {
      db__schema: "schema__field",
      file__name: "File name",
      file__description: "field used for name in tab header & file explorer",
    },
    file__description: {
      db__schema: "schema__field",
      file__name: "File description",
      file__description: "describes the content of the record",
    },
    text__content: {
      db__schema: "schema__field",
      file__name: "Text content",
      file__description: "a list of text nodes used in text schema",
    },
    // Indexes
    index__view__schema: {
      db__schema: "schema__index",
      file__name: "view__schema index",
      file__description:
        "used for looking up the viewers that can render records with a given schema",
      index__field: "view__schema",
    },
    // Views
    view__anyType: {
      db__schema: "schema__view",
      file__name: "DataView",
      file__description: "default viewer for all data types",
      view__component: "DataView",
      view__schema: "schema__anyType",
    },
    view__text: {
      db__schema: "schema__view",
      file__name: "TextView",
      file__description: "viewer for text cards",
      view__component: "TextView",
      view__schema: "schema__text",
    },
    // Cards
    home: {
      db__schema: "schema__text",
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
    // a self-rendering component
    omnibox: {
      db__schema: "omnibox",
      file__name: "Omnibox",
      view__component: "OmniboxView",
      view__schema: "omnibox",
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
    (rec) => rec.db__schema === "schema__index"
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

function DataView({ currentCard, state, dispatch }: ViewParams) {
  return (
    <table>
      <tbody>
        {Object.entries(currentCard).map(([key, value]) => (
          <tr key={key}>
            <td>
              <Link dispatch={dispatch} params={{ id: key }}>
                {state.db[key].file__name ?? key}
              </Link>
            </td>
            <td>
              {state.db[key].field__refType && typeof value === "string" ? (
                <Link dispatch={dispatch} params={{ id: value }}>
                  {state.db[value].file__name ?? value}
                </Link>
              ) : (
                <pre>{JSON.stringify(value, null, 2)}</pre>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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

function OmniboxView({ state, dispatch }: ViewParams) {
  const omnibox = state.window.current.data?.omnibox ?? "";

  const re = RegExp(omnibox, "i");

  const results = Object.entries(state.db).filter(
    ([key, value]) =>
      re.test(key) ||
      re.test(value.file__name ?? "") ||
      re.test(value.file__description ?? "")
  );

  return (
    <div>
      <input
        value={omnibox}
        onChange={(e) =>
          dispatch({
            tag: "replace",
            value: {
              ...state.window.current,
              data: { omnibox: e.target.value },
            },
          })
        }
      />
      <ul>
        {results.map(([key, value]) => (
          <li key={key}>
            <Link dispatch={dispatch} params={{ id: key }}>
              {value.file__name ?? key}
            </Link>
            <span>{value.file__description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const viewByName: Record<string, React.FC<ViewParams>> = {
  TextView,
  DataView,
  OmniboxView,
};

function App() {
  const [state, dispatch] = useReducer(reducer, initState);

  const currentCard = state.db[state.window.current.id] ?? state.db.notFound;
  const canForward = state.window.forward.length > 0;
  const canBack = state.window.back.length > 0;

  const viewersForType =
    state.index[currentCard.db__schema ?? ""]?.view__schema ?? [];
  const viewersForAnyType = state.index.schema__anyType?.view__schema ?? [];

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
        <Link dispatch={dispatch} params={{ id: "omnibox" }}>
          Omnibox
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

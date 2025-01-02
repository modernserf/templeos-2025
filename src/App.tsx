import { useReducer } from "react";
import { produce } from "immer";
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

type WindowHistory = BrowseParams & {
  back?: WindowHistory;
  forward?: WindowHistory;
};

type State = {
  db: Record<string, Rec>;
  index: Record<string, Index>;
  windows: WindowHistory[];
  currentWindow: number;
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
    index__db__schema: {
      db__schema: "schema__index",
      file__name: "db__schema index",
      index__field: "db__schema",
    },
    index__view__schema: {
      db__schema: "schema__index",
      file__name: "view__schema index",
      file__description:
        "used for looking up the viewers that can render records with a given schema",
      index__field: "view__schema",
    },
    index__index__field: {
      db__schema: "schema__index",
      file__name: "index__field index",
      index__field: "index__field",
    },
    index__field__refType: {
      db__schema: "schema__index",
      file__name: "field__refType index",
      index__field: "field__refType",
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
  windows: [{ id: "home" }],
  currentWindow: 0,
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

function currentWindow(state: State): WindowHistory {
  return state.windows[state.currentWindow];
}

type Action =
  | { tag: "back" }
  | { tag: "forward" }
  | { tag: "push"; value: BrowseParams }
  | { tag: "replace"; value: Partial<BrowseParams> }
  | { tag: "newWindow"; value: BrowseParams }
  | { tag: "selectWindow"; value: number }
  | { tag: "closeWindow" };

const reducer = produce((state: State, action: Action) => {
  switch (action.tag) {
    case "back": {
      const current = currentWindow(state);
      if (current.back) {
        state.windows[state.currentWindow] = current.back;
        current.back = undefined;
        state.windows[state.currentWindow].forward = current;
      }
      return;
    }
    case "forward": {
      const current = currentWindow(state);
      if (current.forward) {
        state.windows[state.currentWindow] = current.forward;
        current.forward = undefined;
        state.windows[state.currentWindow].back = current;
      }
      return;
    }
    case "replace": {
      Object.assign(state.windows[state.currentWindow], action.value);
      return;
    }
    case "push": {
      const current = currentWindow(state);
      current.forward = undefined;
      state.windows[state.currentWindow] = {
        ...action.value,
        back: current,
      };
      return;
    }
    case "newWindow": {
      state.windows.push(action.value);
      state.currentWindow = state.windows.length - 1;
      return;
    }
    case "selectWindow": {
      state.currentWindow = action.value;
      return;
    }
    case "closeWindow": {
      if (state.windows.length > 0) {
        state.windows.splice(state.currentWindow, 1);
        state.currentWindow %= state.windows.length;
      }
      return;
    }
  }
});

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
      onClick={(e) => {
        if (e.altKey) {
          dispatch({ tag: "newWindow", value: params });
        } else {
          dispatch({ tag: "push", value: params });
        }
      }}
    >
      {children}
    </button>
  );
}

type ViewParams = {
  currentCard: Rec;
  state: State;
  window: BrowseParams;
  dispatch: React.Dispatch<Action>;
};

function FileLink({
  dispatch,
  id,
  state,
}: {
  dispatch: React.Dispatch<Action>;
  id: string;
  state: State;
}) {
  return (
    <Link dispatch={dispatch} params={{ id }}>
      {state.db[id].file__name ?? id}
    </Link>
  );
}

function DataView({ window, currentCard, state, dispatch }: ViewParams) {
  const indexFields = Object.entries(state.index[window.id] ?? {});

  return (
    <table>
      <tbody>
        <tr>
          <th colSpan={2}>Fields</th>
        </tr>
        {Object.entries(currentCard).map(([key, value]) => (
          <tr key={key}>
            <td>
              <FileLink dispatch={dispatch} state={state} id={key} />
            </td>
            <td>
              {state.db[key].field__refType && typeof value === "string" ? (
                <FileLink dispatch={dispatch} state={state} id={value} />
              ) : (
                <pre>{JSON.stringify(value, null, 2)}</pre>
              )}
            </td>
          </tr>
        ))}
        {indexFields.length > 0 ? (
          <tr>
            <th colSpan={2}>Referenced by</th>
          </tr>
        ) : null}
        {indexFields.flatMap(([key, values]) => {
          return values.map((value, i) => (
            <tr key={`${key} ${value}`}>
              <td>
                {i === 0 ? (
                  <FileLink dispatch={dispatch} state={state} id={key} />
                ) : null}
              </td>
              <td>
                <FileLink dispatch={dispatch} state={state} id={value} />
              </td>
            </tr>
          ));
        })}
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

function OmniboxView({ state, window, dispatch }: ViewParams) {
  const omnibox = window.data?.omnibox ?? "";

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
  console.log(state);

  const windows = state.windows.map((window, id) => {
    const isCurrent = state.currentWindow === id;
    const card = state.db[window.id] ?? state.db.notFound;
    const viewersForType =
      state.index[card.db__schema ?? ""]?.view__schema ?? [];

    const view =
      state.db[window.view ?? ""] ??
      state.db[viewersForType[0] ?? ""] ??
      state.db.view__anyType;

    const View = viewByName[view.view__component!];

    return { window, isCurrent, card, viewersForType, View };
  });

  const viewersForType = windows[state.currentWindow].viewersForType;
  const viewersForAnyType = state.index.schema__anyType?.view__schema ?? [];

  return (
    <>
      {windows.map(({ View, window, isCurrent, card }, id) => {
        return (
          <div
            key={id}
            style={{
              opacity: isCurrent ? 1 : "0.5",
            }}
            onMouseDownCapture={() => {
              dispatch({ tag: "selectWindow", value: id });
            }}
          >
            <button
              type="button"
              onClick={() => {
                dispatch({ tag: "closeWindow" });
              }}
            >
              &times;
            </button>
            <h1>{card.file__name}</h1>
            <View
              state={state}
              dispatch={dispatch}
              currentCard={card}
              window={window}
            />
          </div>
        );
      })}
      <nav>
        <button
          type="button"
          onClick={() => dispatch({ tag: "back" })}
          disabled={!currentWindow(state).back}
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => dispatch({ tag: "forward" })}
          disabled={!currentWindow(state).forward}
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
          value={currentWindow(state).view ?? ""}
          onChange={(e) =>
            dispatch({
              tag: "replace",
              value: { view: e.target.value, data: {} },
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
    </>
  );
}

export default App;

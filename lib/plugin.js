const { resolve } = require("path");

const Vue = require("vue");
const { loadDynamicMarkdown } = require("nuxt-dynamic-markdown/lib/utility");
const DynamicMarkdown = require("nuxt-dynamic-markdown/dist/DynamicMarkdown");

Vue.component("DynamicMarkdown", DynamicMarkdown);

export default async ({ app, store }) => {
  const sources = <%= serialize(options.sources) %>;
  const toLoad = <%= serialize(options.toLoad) %>;

  app.loadMarkdown = loadDynamicMarkdown;

  /*
      TODO: Extract to generateStore.
  */
  const initialState = {};
  const getters = {};

  for (const [name, files] of Object.entries(toLoad)) {
    getters[name] = (state) => {
      return (name2) => state.projects[name2] || null;
    }

    for (const file of files) {
      const { default: state } = await import("static/json/" + file + ".json");

      initialState[file] = state;
    }

    /*
      TODO: Add utility functions for pluralising and singular-ising and we also
            need something for upper-case-ing words and such. Perhaps we can see
            if lodash provides them, otherwise make our own... or find npm packages.

      TODO: Generate some useful relationship-related getters dynamically.
    */
    // for (const relationship of source.relationships) {
    //   getters["get" + name.substr(0, 1).toUpperCase() + name.substr(1) + "By" + relationship.substr(0, 1).toUpperCase() + relationship.substr(1)] = (state) => {}
    // }
  }

  const storeModule = {
    namespaced: true,
    state: Object.assign({}, initialState),
    getters: getters
  };

  /*
    TODO: I think preserveState was causing some very very odd issues so I disabled
          it but I am not 100% sure so that probably needs to be looked into.
  */
  store.registerModule("dynamic-markdown", storeModule, {
    preserveState: false
  });
};

function generateStore() {

}

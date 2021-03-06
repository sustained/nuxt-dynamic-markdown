import Vue from "vue";

import DynamicMarkdown from "nuxt-dynamic-markdown/components/DynamicMarkdown.vue";

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

async function loadDynamicMarkdown(markdownPath) {
  const { default: content } = await import("~/contents/" + markdownPath);

  console.log(markdownPath, content);
  let { attributes } = content;

  if (attributes) {
    delete attributes._meta; // NOTE: Reveals server paths.
  } else {
    attributes = {};
  }

  return {
    attributes: attributes,
    rawMarkdown: content.body,
    componentList: content.attributes.components || [],
    renderFunction: content.vue.render,
    staticRenderFunctions: content.vue.staticRenderFns
  };
}
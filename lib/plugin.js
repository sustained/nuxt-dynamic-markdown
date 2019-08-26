import Vue from "vue";

import DynamicMarkdown from "nuxt-dynamic-markdown/components/DynamicMarkdown.vue";

Vue.component("DynamicMarkdown", DynamicMarkdown);

export default async ({ app, store }) => {
  const sources = <%= serialize(options.sources) %>;
  const toLoad = <%= serialize(options.toLoad) %>;

  app.loadMarkdown = loadDynamicMarkdown;

  for (const file of toLoad) {
    const name = file.replace(".json", "");
    const { default: state } = await import("static/json/" + file);

    generateStore(name, state, store);
  }
};

function generateStore(name, state, { registerModule }) {
  const storeModule = {
    namespaced: true,
    state: Object.assign({}, { [name]: state }),
  };

  registerModule(name, storeModule, {
    preserveState: false
  });
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
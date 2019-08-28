import Vue from "vue";

import { capitalise, singularise, pluralise } from "nuxt-dynamic-markdown/lib/utility/string.js";

import DynamicMarkdown from "nuxt-dynamic-markdown/components/DynamicMarkdown.vue";

Vue.component("DynamicMarkdown", DynamicMarkdown);

export default async ({ app, store }) => {
  const sources = <%= serialize(options.sources) %>;

  app.loadMarkdown = loadDynamicMarkdown;

  for (const source of sources) {
    const [storeModule, filesToLoad] = generateStoreModule(source);

    store.registerModule(source.name, storeModule, { preserveState: false });

    for (const file of filesToLoad) {
      const { default: state } = await import(`static/json/${file}.json`);

      const mutationName = generateMutationName(file);
      store[source.name].commit(mutationName, state);
    }
  }
};

export function determineFilesToLoad(source) {
  const isNested = source.entities.length === 2;
  const innerEntityName = isNested ? source.entities[1] : source.entities[0];

  const files = [];

  for (const entity of source.entities) {
    files.push(entity);

    for (const relationship of source.relationships) {
      if (entity === innerEntityName) {
        files.push(entity + "_" + relationship);
      }
    }
  }

  for (const relationship of source.relationships) {
    files.push(relationship);
  }

  if (isNested) {
    files.push(source.entities[1] + "_" + source.entities[0]);
  }

  return files;
}

export function generateStoreModule(source) {
  const storeModule = {
    namespaced: true,
    state: {},
    getters: {},
    mutations: {}
  };

  const filesToLoad = determineFilesToLoad(source);

  const isNested = source.entities.length === 2;
  const innerEntityName = isNested ? source.entities[1] : source.entities[0];
  const outerEntityName = isNested ? source.entities[0] : null;

  /*
    Generate mutations.
  */
  for (const file of filesToLoad) {
    const mutationName = generateMutationName(file);

    storeModule.mutations[generateMutationName(file)] = (state, payload) => {
      state[file] = payload;
    };
  }

  /*
    Generate getters.

    Examples:

      - getProjectsByLanguage, getProjectsByTechnology (projects example)
      - getArticlesByTag (blog example)
  */
  for (const relationshipName of source.relationships) {
    const getterName = generateGetterName(innerEntityName, relationshipName);

    storeModule.getters[getterName] = state => {
      return filterBy => {
        return state[innerEntityName].filter(entity => {
          return entity[relationshipName].includes(filterBy);
        });
      };
    };
  }

  /*
    Generate getter for getChildrenByParent.
  */
  if (isNested) {
    const getterName = generateGetterName(innerEntityName, outerEntityName);

    storeModule.getters[getterName] = state => {
      return filterBy => {
        return state[innerEntityName].filter(entity => {
          return entity.parent === filterBy;
        });
      };
    };
  }

  return [storeModule, filesToLoad];
}

export async function loadDynamicMarkdown(markdownPath) {
  const { default: content } = await import("~/contents/" + markdownPath);

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

function generateMutationName(input) {
  return "SET_" + input.toUpperCase();
}

function generateGetterName(entityName, relationshipName) {
  return `get${capitalise(pluralise(entityName))}By${capitalise(singularise(relationshipName))}`;
}

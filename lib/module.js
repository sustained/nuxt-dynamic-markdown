/*
  Node libraries.
*/

import { mkdirSync, existsSync, writeFileSync, lstatSync, readFileSync, readdirSync } from "fs";
import { extname, basename, resolve, normalize } from "path";

/*
  NPM libraries.
*/

import matter from "gray-matter";
import merge from "lodash.merge";
import omit from "lodash.omit";
import YAML from "yaml";

/*
  Our libraries.
*/

import { getDirectory } from "./utility";

/*
  Constants.
*/

/*
  Will be true when running tests (npm run test).
*/
const IS_TEST = process.env.NODE_ENV === "testing";

/*
  Path to the Nuxt project the Nuxt module is being used in.
*/
const NUXT_PATH = IS_TEST ? resolve(__dirname, "../test") : process.cwd();

/*
  Path to the Nuxt module itself.
*/
const MODULE_PATH = __dirname;

/*
  Nuxt module "constructor".
*/
export default async function DynamicMarkdown(options) {
  /*
    We (currently) rely on Vuex so add a dummy module if necessary.
  */
  const vuexStores = readdirSync(resolve(NUXT_PATH, "store")).filter(f => extname(f) === ".js");

  if (vuexStores.length < 1) {
    console.warn("[nuxt-dynamic-markdown] We couldn't find any Vuex modules but this Nuxt module requires Vuex!");
    console.warn("[nuxt-dynamic-markdown] A dummy Vuex store has been created for you at store/index.js.");
    console.warn("[nuxt-dynamic-markdown] This will cause Nuxt to initialise Vuex support.");

    writeFileSync(resolve(NUXT_PATH, "store/index.js"), "export const state = () => ({})");
  }

  /*
    Use i18n options if present.
  */
  if (this.options.i18n) {
    options.i18nMode = true;

    if (this.options.i18n.defaultLocale) {
      options.defaultLanguage = this.options.i18n.defaultLocale;
    } else {
      options.defaultLanguage = "en";
    }

    if (this.options.i18n.locales) {
      options.languages = this.options.i18n.locales.map(l => l.code);
    } else {
      options.languages = ["en"];
    }
  } else {
    options.i18nMode = false;
  }

  /*
    Transpile necessary files.
  */
  if (!this.options.build) this.options.build = {};
  if (!this.options.build.transpile) this.options.build.transpile = [];
  this.options.build.transpile = this.options.build.transpile.concat([
    "nuxt-dynamic-markdown/lib/mixin",
    "nuxt-dynamic-markdown/lib/utility/string"
  ]);

  /*
    Add Webpack loaders.
  */
  this.extendBuild(function(config, { isDev, isClient, isServer, loaders }) {
    const fmMdLoaderOptions = {
      vue: {
        root: "dynamicMarkdown"
      }
    };

    /*
      Allow overriding Markdown renderer.
    */
    if (options.render) {
      fmMdLoaderOptions.markdown = options.render;
    }

    config.module.rules.push({
      test: /\.md$/,
      loader: "frontmatter-markdown-loader",
      include: getMarkdownPath(),
      options: fmMdLoaderOptions
    });

    config.module.rules.push({
      test: /\.ya?ml$/,
      include: getMarkdownPath(),
      loader: "js-yaml-loader"
    });
  });

  const routes = [];

  /*
    Process Markdown sources, write JSON files and generate routes!
  */
  for (const source of options.sources) {
    const processed = await processMarkdownSource(source, options);
    writeJSONFiles(processed, source);
    routes.push(generateRoutes(processed, source));
  }

  /*
    Add generated routes.
  */
  if (!this.options.generate) this.options.generate = {};
  if (!this.options.generate.routes) this.options.generate.routes = [];
  this.options.generate.routes = this.options.generate.routes.concat(routes);

  /*
    Register the plugin that adds app.loadMarkdown and registers the global
    DynamicMarkdown component etc.
  */
  this.addPlugin({
    src: resolve(MODULE_PATH, "plugin.js"),
    fileName: "dynamic-markdown-plugin.js",
    options: {
      sources: options.sources,
      pluginPath: normalize(MODULE_PATH + "/")
    }
  });
}

/*
  NOTE: This function sucks.

  The whole thing needs lots of work but especially this pile of crap. :D
*/
export async function processMarkdownSource(source, { languages }) {
  if (!source.entities || !Array.isArray(source.entities)) {
    throw new Error("[dynamic-markdown] Entities must be an array.");
    return;
  }

  if (source.entities.length < 1) {
    throw new Error("[dynamic-markdown] At least one entity must be specified.");
    return;
  }

  if (source.entities.length > 2) {
    throw new Error("[dynamic-markdown] At most two entities may be specified.");
    return;
  }

  if (!source.directory) {
    source.directory = source.entities[0];
  }

  const markdownPath = getMarkdownPath(source.directory);

  if (!existsSync(markdownPath)) {
    throw new Error("[dynamic-markdown] Directory " + source.directory + " does not exist!");
    return;
  }

  const fileListing = await getDirectory(markdownPath);
  const entityFiles = fileListing.filter(file => !file.startsWith("_"));
  const relationshipFiles = fileListing.filter(file => file.startsWith("_") && file.endsWith(".yaml"));

  const result = {};

  source.entities.forEach(entity => {
    const entityResult = { entities: [], relationships: {} };

    result[entity] = entityResult;
  });

  const isNested = source.entities.length === 2;
  const outerEntityName = isNested ? source.entities[0] : null;
  const innerEntityName = isNested ? source.entities[1] : source.entities[0];

  for (let i = 0; i < entityFiles.length; i++) {
    const currentFile = entityFiles[i];
    const entityPath = getMarkdownPath(source.directory, currentFile);

    try {
      if (lstatSync(entityPath).isDirectory()) {
        if (isNested) {
          const { inner, outer } = await parseOuter(entityPath, currentFile, languages);
          result[innerEntityName].entities = result[innerEntityName].entities.concat(inner);
          result[outerEntityName].entities = result[outerEntityName].entities.concat(outer);
        } else {
          const inner = await parseInner(entityPath, languages);
          result[innerEntityName].entities = result[innerEntityName].entities.concat(inner);
        }
      }
    } catch (e) {
      console.error(e);
      continue;
    }
  }

  for (let i = 0; i < source.relationships.length; i++) {
    const relationshipName = source.relationships[i];
    const relationshipFile = "_" + relationshipName + ".yaml";
    const relationshipPath = getMarkdownPath(source.directory, relationshipFile);

    let relationshipData = {};

    if (existsSync(relationshipPath)) {
      relationshipData = YAML.parse(readFileSync(relationshipPath, "utf8"));
    }

    result[innerEntityName].relationships[relationshipName] = relationshipData;
  }

  // console.log(">>>>", JSON.stringify(result, null, 4));

  return result;
}

/*
  Parse the outer (aka parent) entities.

  Examples:
  
    - The categories for a blog (categories, articles).
*/
export async function parseOuter(entityPath, currentFile, languages) {
  const fileListingOuter = await getDirectory(entityPath);
  const entityFilesOuter = fileListingOuter.filter(file => !file.startsWith("_"));

  const result = {
    inner: [],
    outer: []
  };

  /*
    If a YAML file exists within the outer directory that matches the directory 
    name with a prepended underscore then that file is the meta file.
  */
  const outerMetaFile = resolve(entityPath, `_${currentFile}.yaml`);

  const data = existsSync(outerMetaFile) ? getFrontMatter(outerMetaFile) : {};
  data.slug = currentFile;
  data.children = [];

  for (let j = 0; j < entityFilesOuter.length; j++) {
    let innerEntities = await parseInner(resolve(entityPath, entityFilesOuter[j]), languages);

    /*
      Relate outer entities (e.g. categories) to inner entities (e.g. articles).
    */
    data.children = data.children.concat(
      innerEntities.reduce((accum, curr) => {
        if (!accum.includes(curr.slug)) {
          accum.push(curr.slug);
        }
        return accum;
      }, [])
    );

    /*
      Relate inner entities (e.g. articles) to outer entities (e.g. categories).
    */
    innerEntities = innerEntities.map(entity => {
      entity.parent = currentFile;

      return entity;
    });

    result.inner = result.inner.concat(innerEntities);
  }

  result.outer.push(data);

  return result;
}

/*
  Parse the inner (aka child) entities.

  Examples:

    - The articles for a blog (categories, articles).
    - The projects for a projects portfolio.
*/
export async function parseInner(entityPath, requiredLanguages) {
  const entityTranslations = await getDirectory(entityPath);

  const result = [];
  const entities = [];

  /*
    Load the markdown for each translation.
  */
  entityTranslations.forEach(translationFile => {
    const data = getFrontMatter(resolve(entityPath, translationFile));

    data.slug = data.slug || parseSlugFromFilename(translationFile);
    data.language = parseLanguageFromFilename(translationFile) || "en";
    data.translations = entityTranslations
      .map(e => parseLanguageFromFilename(e) || "en")
      .filter(e => e !== data.language);
    entities.push(data);
  });

  /*
    Fall back to default language for any missing languages which
    are set as required.
  */
  for (let i = 0; i < requiredLanguages.length; i++) {
    const missingLanguage = requiredLanguages[i];

    /*
      Create fallback entity.
    */
    if (!entities.some(e => e.language === missingLanguage)) {
      const fallbackEntity = Object.assign({}, entities.find(e => e.language === "en"));
      fallbackEntity.language = missingLanguage;
      fallbackEntity.isFallback = true;
      fallbackEntity.translations = entities.map(e => e.language).filter(e => e !== missingLanguage);
      entities.push(fallbackEntity);
    }

    /*
      Adjust other languages' translations attribute.
    */
    for (let j = 0; j < entities.length; j++) {
      if (entities[j].translations.includes(missingLanguage) || entities[j].language === missingLanguage) {
        continue;
      }

      entities[j].translations.push(missingLanguage);
    }
  }

  /*
    Merge all metadata into non-default (i.e. non-English) entities.
  */
  const defaultEntity = entities.find(e => e.language === "en");
  const otherEntities = entities.filter(e => e.language !== "en");

  result.push(defaultEntity);

  otherEntities.forEach((entity, index) => {
    result.push(merge({}, omit(defaultEntity, ["language"]), entity));
  });

  return result;
}

/*
  The location where all .md and .yaml files are stored.

  NOTE: Perhaps allow overriding this via options?
*/
export function getMarkdownPath(...paths) {
  return resolve(NUXT_PATH, "contents", ...paths);
}

/*
  The location where all generated .json files are stored.

  NOTE: Perhaps allow overriding this via options?
*/
export function getJsonPath(...paths) {
  return resolve(NUXT_PATH, "static", "json", ...paths);
}

export function getFrontMatter(name, source, fileName) {
  name = getMarkdownPath(name);

  try {
    if (extname(name) === ".yaml") {
      return YAML.parse(readFileSync(name, "utf8"));
    } else {
      const frontmatter = matter.read(name);

      return frontmatter.data;
    }
  } catch (e) {
    if (e.code === "ENOENT") {
      console.error("Could not get front matter for " + name);
    } else if (e.name === "YAMLException") {
      console.error("Could not parse the front matter for " + name, e.message);
    } else {
      console.error(e.message);
    }

    return { __error: true };
  }
}

/*
  Check for e.g. "-en", "-sv" at the end of a filename and return it.
*/
export function parseLanguageFromFilename(filename) {
  // Ensure no extension.
  filename = basename(filename, extname(filename));

  const match = filename.match(/-([a-zA-Z]{2})$/);

  return match ? match[1] : null;
}

/*
  Get the slug based on a filename.
  
  NOTE: The language component (e.g. `-en`) is NOT classed as part of the slug.
*/
export function parseSlugFromFilename(filename) {
  filename = basename(filename, extname(filename));

  const hasLanguage = !!parseLanguageFromFilename(filename);

  return hasLanguage ? filename.substr(0, filename.length - 3) : filename;
}

/*
  Generate the routes!
*/
export function generateRoutes(processed, source) {
  const routes = [];

  const isNested = isNestedSource(source.entities);
  const [outer, inner] = source.entities;

  for (const entityName of source.entities) {
    for (const entity of processed[entityName].entities) {
      if (entityName === outer) {
        routes.push(`${source.name}/${entity.slug}`);
      } else {
        routes.push(`${source.name}/${entity.parent}/${entity.slug}`);
      }
    }
  }

  return routes;
}

export function isNestedSource(source) {
  if (Array.isArray(source)) {
    return source.length === 2;
  } else if (typeof source === "object" && source.entities) {
    return source.entities.length === 2;
  }

  return false;
}

/*
  Write the JSON files for the entities and relationships.
*/
export function writeJSONFiles(processed, source) {
  if (!existsSync(getJsonPath())) {
    mkdirSync(getJsonPath());
  }

  const relationshipData = {};

  const writeJSON = (path, data) => {
    path = path + ".json";
    writeFileSync(getJsonPath(path), JSON.stringify(data, null, IS_TEST ? 2 : 0));
  };

  const isNested = source.entities.length === 2;
  const innerEntityName = isNested ? source.entities[1] : null;
  const outerEntityName = source.entities[0];

  for (const [entityName, { entities, relationships }] of Object.entries(processed)) {
    /*
      Write the entity/entities data.

      Examples:

        - projects.json (project example)
        - categories.json, articles.json (blog example)
    */
    writeJSON(entityName, entities);

    /*
      Write the relationship data.
      
      Examples:
      
        - projects.json, languages.json (projects)
        - tags.json (blog)
    */
    for (const [relationshipName, data] of Object.entries(relationships)) {
      writeJSON(relationshipName, data);
    }

    /*
      Write the parent <-> child (inner/outer) "join tables".

      Examples:

        - articles_categories.json (blog)
    */
    if (isNested && entityName === outerEntityName) {
      const related = entities.reduce((accum, curr) => {
        accum[curr.slug] = curr.children;
        return accum;
      }, {});

      writeJSON(innerEntityName + "_" + outerEntityName, related);
    }

    /*
      Build other relationship data.
    */
    for (const entity of entities) {
      if (!source.relationships) {
        continue;
      }

      for (const relationship of source.relationships) {
        if (!entity[relationship]) {
          continue;
        }

        for (const key of entity[relationship]) {
          if (!relationshipData[relationship]) {
            relationshipData[relationship] = {};
          }

          if (!relationshipData[relationship][key]) {
            relationshipData[relationship][key] = [];
          }

          if (!relationshipData[relationship][key].includes(entity.slug)) {
            relationshipData[relationship][key].push(entity.slug);
          }
        }
      }
    }
  }

  /*
    The relationships always belong to the inner entity.
  */
  const entityName = source.entities.length === 1 ? source.entities[0] : source.entities[1];

  /*
    Write the entity <-> relationship "join tables".
    
    Examples:
    
      - projects_languages.json, projects_technologies.json (projects)
      - articles_tags.json (blog)
  */
  for (const [relationshipName, data] of Object.entries(relationshipData)) {
    writeJSON(entityName + "_" + relationshipName, data);
  }
}

module.exports.meta = require("../package.json");

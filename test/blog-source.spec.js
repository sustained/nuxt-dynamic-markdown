import { readdirSync, unlinkSync, existsSync, renameSync } from "fs";
import { resolve } from "path";

const JSON_PATH = resolve(__dirname, "static/json");

import chai, { expect, assert } from "chai";

import { processMarkdownSource, writeJSONFiles } from "../lib/module.js";
import { doesNotReject } from "assert";

/*
  NOTE: We do this because sometimes we do are going to be expeting errors 
        to be thrown but the stack traces mess up the pretty test output.
*/
process.on("unhandledRejection", () => {});

before(() => {
  /*
    Empty out JSON directory.
  */
  const files = readdirSync(JSON_PATH);
  for (const file of files) {
    if (file === ".gitignore") {
      continue;
    }
    unlinkSync(resolve(JSON_PATH, file));
  }
});

describe("example source (blog)", () => {
  const source = {
    entities: ["categories", "articles"],
    directory: "blog",
    relationships: ["tags"]
  };
  const options = { languages: ["en"] };

  let processed;
  let articles, categories, relationships;
  let tags;

  before(async () => {
    processed = await processMarkdownSource(source, options);

    ({ entities: articles, relationships } = processed.articles);
    ({ entities: categories } = processed.categories);
    ({ tags } = relationships);
  });

  after(() => {
    processed = articles = categories = relationships = tags = null;
  });

  it("should parse the example blog source as expected", async () => {
    try {
      return (
        expect(articles.length).to.equal(7) &&
        expect(categories.length).to.equal(2) &&
        expect(Object.keys(relationships.tags).length).to.equal(2)
      );
    } catch (e) {
      assert.fail(e.message);
    }
  });

  it("should write the json for the example blog source as expected", async () => {
    try {
      writeJSONFiles(processed, source);

      return (
        expect(existsSync(resolve(JSON_PATH, "categories.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "articles.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "tags.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "articles_tags.json"))).to.equal(true)
      );
    } catch (e) {
      assert.fail(e.message);
    }
  });
});

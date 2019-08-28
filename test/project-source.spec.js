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

describe("example source (projects)", () => {
  const source = {
    entities: ["projects"],
    relationships: ["languages", "technologies"]
  };

  let processed;
  let entities, relationships;
  let languages, technologies;

  before(async () => {
    processed = await processMarkdownSource(source, { languages: ["en"] });

    ({ entities, relationships } = processed.projects);
    ({ languages, technologies } = relationships);
  });

  after(() => {
    processed = entities = relationships = languages = technologies = null;
  });

  it("should result in the correct number of entities and relationships", async () => {
    try {
      return (
        expect(entities.length).to.equal(4) &&
        expect(Object.keys(languages).length).to.equal(3) &&
        expect(Object.keys(technologies).length).to.equal(4)
      );
    } catch (e) {
      assert.fail(e.message);
    }
  });

  it("should result in the correct structure for all entities", async () => {
    try {
      const structureCheck = entities.every(project => {
        return (
          project.title &&
          project.meta &&
          project.meta.keywords &&
          project.meta.description &&
          project.technologies &&
          project.languages &&
          project.language &&
          project.translations
        );
      });

      return expect(structureCheck).to.be.true;
    } catch (e) {
      assert.fail(e.message);
    }
  });

  it("should write the json for the project source as expected", async () => {
    try {
      writeJSONFiles(processed, source);

      return (
        expect(existsSync(resolve(JSON_PATH, "projects.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "languages.json"))).to.equal(true) &&
        expect(existsSync(resolve(JSON_PATH, "technologies.json"))).to.equal(true) // &&
        // expect(existsSync(resolve(JSON_PATH, "projects_languages.json"))).to.equal(true) &&
        // expect(existsSync(resolve(JSON_PATH, "projects_technologies.json"))).to.equal(true)
      );
    } catch (e) {
      throw e;
      // assert.fail(e.message);
    }
  });
});

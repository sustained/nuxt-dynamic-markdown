import { expect } from "chai";
import { processMarkdownSource } from "../lib/module.js";

/*
  NOTE: We do this because sometimes we do are going to be expeting errors 
        to be thrown but the stack traces mess up the pretty test output.
*/
process.on("unhandledRejection", () => {});

describe("options parsing", () => {
  it("requires entities to be present", async () => {
    try {
      const processed = await processMarkdownSource({ name: "test" }, { languages: ["en"] });
      throw new Error("Promise should reject.");
    } catch (e) {
      expect(e).to.be.an("error");
    }
  });

  it("requires entities to be an array", async () => {
    try {
      await processMarkdownSource({ name: "test", entities: 123, directory: "projects" }, { languages: ["en"] });
      throw new Error("Promise should reject.");
    } catch (e) {
      expect(e).to.be.an("error");
    }
  });

  it("requires at least one entity", async () => {
    try {
      await processMarkdownSource({ name: "test", entities: [], directory: "projects" }, { languages: ["en"] });
      throw new Error("Promise should reject.");
    } catch (e) {
      expect(e).to.be.an("error");
    }
  });

  it("requires no more than two entities", async () => {
    try {
      await processMarkdownSource(
        { name: "test", entities: [{}, {}, {}], directory: "projects" },
        { languages: ["en"] }
      );
      throw new Error("Promise should reject.");
    } catch (e) {
      expect(e).to.be.an("error");
    }
  });

  it("should fail for non-existent directories", async () => {
    try {
      await processMarkdownSource(
        { name: "test", entities: ["test"], directory: "nonexistent" },
        { languages: ["en"] }
      );
      throw new Error("Promise should reject.");
    } catch (e) {
      expect(e).to.be.an("error");
    }
  });
});

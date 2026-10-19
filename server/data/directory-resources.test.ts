import { describe, expect, it } from "vitest";
import directory from "./directory-resources.json";

describe("attached directory import", () => {
  it("keeps all 30 source-identified records from the supplied directory", () => {
    expect(directory).toHaveLength(30);
    expect(new Set(directory.map((resource) => resource.sourceId)).size).toBe(30);
  });

  it("preserves the required searchable provider fields", () => {
    for (const resource of directory) {
      expect(resource.name).toBeTruthy();
      expect(resource.category).toBeTruthy();
      expect(resource.city).toBeTruthy();
      expect(resource.address).toBeTruthy();
      expect(resource.source).toBe("attached-directory");
    }
  });
});

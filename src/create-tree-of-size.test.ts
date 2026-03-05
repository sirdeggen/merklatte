import { expect, test } from "vitest";
import { createTreeOfSize } from "./MerkleTreeProvider.tsx";

test("create tree of size", () => {
  const tree = createTreeOfSize(8);

  expect(tree).toMatchInlineSnapshot(`
      {
        "hash": "ABCDEFGH",
        "height": 3,
        "left": {
          "hash": "ABCD",
          "height": 2,
          "left": {
            "hash": "AB",
            "height": 1,
            "left": {
              "hash": "A",
              "height": 0,
              "offset": 0,
            },
            "offset": 0,
            "right": {
              "hash": "B",
              "height": 0,
              "offset": 1,
            },
          },
          "offset": 0,
          "right": {
            "hash": "CD",
            "height": 1,
            "left": {
              "hash": "C",
              "height": 0,
              "offset": 2,
            },
            "offset": 1,
            "right": {
              "hash": "D",
              "height": 0,
              "offset": 3,
            },
          },
        },
        "offset": 0,
        "right": {
          "hash": "EFGH",
          "height": 2,
          "left": {
            "hash": "EF",
            "height": 1,
            "left": {
              "hash": "E",
              "height": 0,
              "offset": 4,
            },
            "offset": 2,
            "right": {
              "hash": "F",
              "height": 0,
              "offset": 5,
            },
          },
          "offset": 1,
          "right": {
            "hash": "GH",
            "height": 1,
            "left": {
              "hash": "G",
              "height": 0,
              "offset": 6,
            },
            "offset": 3,
            "right": {
              "hash": "H",
              "height": 0,
              "offset": 7,
            },
          },
        },
      }
    `);
});

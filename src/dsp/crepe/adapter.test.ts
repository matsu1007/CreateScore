import { describe, expect, it } from "vitest";
import {
  extractActivation,
  makeInputTensor,
  resolveInputDims,
  resolveModelIO
} from "./adapter";

describe("resolveModelIO", () => {
  it("picks first input/output names", () => {
    const io = resolveModelIO({
      inputNames: ["input_0"],
      outputNames: ["output_0"]
    });
    expect(io).toEqual({
      inputName: "input_0",
      outputName: "output_0"
    });
  });
});

describe("resolveInputDims", () => {
  it("supports [B, 1024] input shape", () => {
    const dims = resolveInputDims(4, 1024, [-1, 1024]);
    expect(dims).toEqual([4, 1024]);
  });

  it("supports [B, 1024, 1] input shape", () => {
    const dims = resolveInputDims(3, 1024, [-1, 1024, 1]);
    expect(dims).toEqual([3, 1024, 1]);
  });

  it("rejects fixed batch-1 shape when batch is greater than 1", () => {
    expect(() => resolveInputDims(2, 1024, [1, 1024])).toThrow("batch=1");
  });
});

describe("makeInputTensor", () => {
  it("builds tensor payload and copies data", () => {
    const src = new Float32Array([1, 2, 3, 4, 5, 6]);
    const tensor = makeInputTensor(src, 2, {
      windowSize: 3
    });
    expect(tensor.dims).toEqual([2, 3]);
    expect(Array.from(tensor.data)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(tensor.data).not.toBe(src);
  });
});

describe("extractActivation", () => {
  it("handles [B, 360] output tensor", () => {
    const data = new Float32Array(2 * 360).fill(0.5);
    const activation = extractActivation(
      {
        data,
        dims: [2, 360]
      },
      [2, 360]
    );
    expect(activation.length).toBe(720);
    expect(activation[0]).toBe(0.5);
  });

  it("handles [1, B, 360] output tensor", () => {
    const data = new Float32Array(3 * 360).fill(0.25);
    const activation = extractActivation(
      {
        data,
        dims: [1, 3, 360]
      },
      [1, 3, 360]
    );
    expect(activation.length).toBe(1080);
    expect(activation[17]).toBe(0.25);
  });

  it("rejects unsupported class dimension", () => {
    expect(() =>
      extractActivation(
        {
          data: new Float32Array(100),
          dims: [1, 100]
        },
        [1, 100]
      )
    ).toThrow("Expected class dimension 360");
  });
});

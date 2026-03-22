const CREPE_CLASS_COUNT = 360;

type SessionLike = {
  inputNames: readonly string[];
  outputNames: readonly string[];
};

type Shape = readonly number[] | undefined;

type TensorLike = {
  data: Float32Array | ArrayLike<number>;
  dims: readonly number[];
};

export type CrepeModelIO = {
  inputName: string;
  outputName: string;
};

export type InputTensorData = {
  data: Float32Array;
  dims: number[];
};

export type MakeInputTensorOptions = {
  inputShape?: readonly number[];
  windowSize?: number;
};

const isDynamicDim = (dim: number): boolean => dim <= 0 || !Number.isFinite(dim);

const matchesOrDynamic = (dim: number, expected: number): boolean =>
  isDynamicDim(dim) || dim === expected;

const product = (dims: readonly number[]): number =>
  dims.reduce((acc, dim) => acc * Math.max(1, dim), 1);

const resolveBatchDim = (dim: number, batch: number): number => {
  if (dim === 1 && batch !== 1) {
    throw new Error(`Input shape fixes batch=1, but batch=${batch} was requested.`);
  }
  if (isDynamicDim(dim)) {
    return batch;
  }
  return dim;
};

export const resolveModelIO = (session: SessionLike): CrepeModelIO => {
  const inputName = session.inputNames?.[0];
  const outputName = session.outputNames?.[0];
  if (!inputName || !outputName) {
    throw new Error("ONNX session must provide at least one input and one output name.");
  }
  return { inputName, outputName };
};

export const resolveInputDims = (
  batch: number,
  windowSize: number,
  inputShape?: readonly number[]
): number[] => {
  if (batch <= 0) {
    throw new Error(`Batch must be positive, got ${batch}.`);
  }
  if (windowSize <= 0) {
    throw new Error(`windowSize must be positive, got ${windowSize}.`);
  }
  if (!inputShape || inputShape.length === 0) {
    return [batch, windowSize];
  }

  if (inputShape.length === 2) {
    const [d0, d1] = inputShape;
    if (!matchesOrDynamic(d1, windowSize)) {
      throw new Error(`Unsupported 2D input shape: [${inputShape.join(", ")}].`);
    }
    return [resolveBatchDim(d0, batch), windowSize];
  }

  if (inputShape.length === 3) {
    const [d0, d1, d2] = inputShape;
    if (!matchesOrDynamic(d1, windowSize) || !matchesOrDynamic(d2, 1)) {
      throw new Error(`Unsupported 3D input shape: [${inputShape.join(", ")}].`);
    }
    return [resolveBatchDim(d0, batch), windowSize, 1];
  }

  throw new Error(`Unsupported input rank=${inputShape.length}.`);
};

export const makeInputTensor = (
  frames: Float32Array,
  batch: number,
  options: MakeInputTensorOptions = {}
): InputTensorData => {
  const windowSize = options.windowSize ?? 1024;
  const dims = resolveInputDims(batch, windowSize, options.inputShape);
  const expectedSize = product(dims);
  if (frames.length !== expectedSize) {
    throw new Error(`Input frame size mismatch: expected ${expectedSize}, got ${frames.length}.`);
  }
  return {
    data: new Float32Array(frames),
    dims
  };
};

const inferOutputShape = (shape: Shape, dataLength: number): number[] => {
  if (shape && shape.length > 0) {
    return [...shape];
  }
  if (dataLength % CREPE_CLASS_COUNT === 0) {
    return [dataLength / CREPE_CLASS_COUNT, CREPE_CLASS_COUNT];
  }
  throw new Error("Cannot infer output shape from activation length.");
};

const ensureFloat32 = (values: Float32Array | ArrayLike<number>): Float32Array => {
  if (values instanceof Float32Array) {
    return values;
  }
  return Float32Array.from(values);
};

export const extractActivation = (
  output: TensorLike | Float32Array,
  outputShape?: readonly number[]
): Float32Array => {
  const outputData = output instanceof Float32Array ? output : ensureFloat32(output.data);
  const shape = inferOutputShape(outputShape ?? (output instanceof Float32Array ? undefined : output.dims), outputData.length);

  if (shape.length === 2) {
    const [batch, classes] = shape;
    if (!matchesOrDynamic(classes, CREPE_CLASS_COUNT)) {
      throw new Error(`Expected class dimension ${CREPE_CLASS_COUNT}, got ${classes}.`);
    }
    const resolvedClasses = classes <= 0 ? CREPE_CLASS_COUNT : classes;
    const expected = Math.max(1, batch <= 0 ? outputData.length / resolvedClasses : batch) * resolvedClasses;
    if (outputData.length !== expected) {
      throw new Error(`Output activation size mismatch: expected ${expected}, got ${outputData.length}.`);
    }
    return new Float32Array(outputData);
  }

  if (shape.length === 3) {
    const [d0, d1, d2] = shape;
    if (!matchesOrDynamic(d0, 1) || !matchesOrDynamic(d2, CREPE_CLASS_COUNT)) {
      throw new Error(`Unsupported 3D output shape: [${shape.join(", ")}].`);
    }
    const batch = d1 <= 0 ? outputData.length / CREPE_CLASS_COUNT : d1;
    const expected = batch * CREPE_CLASS_COUNT;
    if (outputData.length !== expected) {
      throw new Error(`Output activation size mismatch: expected ${expected}, got ${outputData.length}.`);
    }
    return new Float32Array(outputData);
  }

  throw new Error(`Unsupported output rank=${shape.length}.`);
};

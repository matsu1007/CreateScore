let seq = 0;

export const createId = (prefix = "id"): string => {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq.toString(36)}`;
};

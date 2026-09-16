/** CJS stub — archiver is ESM-only and unused by family/map e2e paths. */
module.exports = function archiver() {
  return {
    pipe: () => undefined,
    append: () => undefined,
    directory: () => undefined,
    file: () => undefined,
    finalize: async () => undefined,
    on: () => undefined,
    pointer: () => 0,
  };
};
module.exports.create = module.exports;

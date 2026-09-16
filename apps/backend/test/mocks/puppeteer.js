/** CJS stub — puppeteer is ESM-only and unused by family/map e2e paths. */
module.exports = {
  launch: async () => ({
    newPage: async () => ({
      setContent: async () => undefined,
      pdf: async () => Buffer.from(''),
      close: async () => undefined,
    }),
    close: async () => undefined,
  }),
};

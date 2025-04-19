// src/resolvers/index.js
const waterFeatureResolvers = require('./waterFeatureResolvers');

module.exports = {
  Query: {
    ...waterFeatureResolvers.Query
  }
};

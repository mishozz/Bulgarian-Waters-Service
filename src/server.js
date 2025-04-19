// src/index.js
require('dotenv').config();
const { ApolloServer } = require('apollo-server');
const { typeDefs } = require('./schema');
const resolvers = require('./resolvers');
const sparqlClient = require('./utils/sparqlClient');
const cacheManager = require('./cache/cacheManager');

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,  // Enable schema introspection for development
  playground: true,     // Enable GraphQL Playground for development
  formatError: (error) => {
    console.error('GraphQL Error:', error);
    return {
      message: error.message,
      path: error.path
    };
  },
  // Add plugin for cache preloading
  plugins: [
    {
      serverWillStart: async () => {
        console.log('Server starting, preloading cache...');
        try {
          await sparqlClient.preloadCache();
          console.log('Cache preloaded successfully');
        } catch (error) {
          console.error('Error preloading cache:', error);
        }
      }
    }
  ]
});

// Define port from environment or default
const PORT = process.env.PORT || 4000;

// Schedule periodic cache cleanup
const CACHE_CLEANUP_INTERVAL = process.env.CACHE_CLEANUP_INTERVAL || 3600000
setInterval(() => {
  console.log('Running scheduled cache cleanup');
  cacheManager.cleanupExpiredEntries();
}, CACHE_CLEANUP_INTERVAL);

// Start the server
server.listen(PORT).then(({ url }) => {
  console.log(`Bulgaria Water Features GraphQL API ready at ${url}`);
});

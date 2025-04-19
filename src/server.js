require('dotenv').config();
const { ApolloServer } = require('apollo-server');
const { typeDefs } = require('./schema');
const resolvers = require('./resolvers');

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
  }
});

// Define port from environment or default
const PORT = process.env.PORT || 4000;

// Start the server
server.listen(PORT).then(({ url }) => {
  console.log(`🚀 Bulgaria Water Features GraphQL API ready at ${url}`);
  console.log(`📊 GraphQL Playground available at ${url}`);
});

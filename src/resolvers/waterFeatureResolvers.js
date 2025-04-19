// src/resolvers/waterFeatureResolvers.js
const sparqlClient = require('../utils/sparqlClient');

const waterFeatureResolvers = {
  Query: {
    waterFeatures: async (_, args) => {
      try {
        // Build SPARQL query based on GraphQL parameters
        const sparqlQuery = sparqlClient.buildWaterFeaturesQuery(args);
        // Log the generated SPARQL query for debugging
        console.log('Generated SPARQL Query:', sparqlQuery);
        
        // Execute query
        const results = await sparqlClient.query(sparqlQuery);
        
        // Transform results to match GraphQL schema
        return sparqlClient.transformResults(results);
      } catch (error) {
        console.error('Error fetching water features:', error);
        throw new Error('Failed to fetch water features from Wikidata');
      }
    },
    
    waterFeature: async (_, { id }) => {
      try {
        const sparqlQuery = sparqlClient.buildWaterFeatureByIdQuery(id);
        const results = await sparqlClient.query(sparqlQuery);
        const transformedResults = sparqlClient.transformResults(results);
        
        return transformedResults.length > 0 ? transformedResults[0] : null;
      } catch (error) {
        console.error(`Error fetching water feature with ID ${id}:`, error);
        throw new Error(`Failed to fetch water feature ${id} from Wikidata`);
      }
    }
  }
};

module.exports = waterFeatureResolvers;

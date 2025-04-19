// src/resolvers/waterFeatureResolvers.js
const sparqlClient = require('../utils/sparqlClient');

const waterFeatureResolvers = {
  Query: {
    waterFeatures: async (_, args) => {
      try {
        // If we have a specific type and no other filters, try to use cached data
        if (args.type && !args.region && !args.minCapacity && !args.minSurfaceArea) {
          // Get from type-specific cache
          let features = await sparqlClient.getAllFeaturesOfType(args.type);
          
          // Apply sorting and pagination in memory
          if (args.sortBy) {
            features.sort((a, b) => {
              const aValue = a[args.sortBy] || 0;
              const bValue = b[args.sortBy] || 0;
              return args.sortOrder === 'DESC' ? bValue - aValue : aValue - bValue;
            });
          }
          
          // Apply limit and offset
          const offset = args.offset || 0;
          const limit = args.limit || 100;
          features = features.slice(offset, offset + limit);
          
          return features;
        }
        
        // For more complex queries, build SPARQL and check query cache
        const sparqlQuery = sparqlClient.buildWaterFeaturesQuery(args);
        const results = await sparqlClient.query(sparqlQuery);
        
        return sparqlClient.transformResults(results);
      } catch (error) {
        console.error('Error fetching water features:', error);
        throw new Error('Failed to fetch water features from Wikidata');
      }
    },
    
    waterFeature: async (_, { id }) => {
      try {
        return await sparqlClient.getWaterFeatureById(id);
      } catch (error) {
        console.error(`Error fetching water feature with ID ${id}:`, error);
        throw new Error(`Failed to fetch water feature ${id} from Wikidata`);
      }
    }
  }
};

module.exports = waterFeatureResolvers;

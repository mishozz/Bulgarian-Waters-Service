// src/schema/typeDefs.js
const { gql } = require('apollo-server');

const typeDefs = gql`
  enum WaterFeatureType {
    LAKE
    DAM
    RESERVOIR
    RIVER
  }

  type Coordinates {
    latitude: Float!
    longitude: Float!
  }

  type WaterFeature {
    id: ID!
    name: String!
    type: WaterFeatureType!
    location: Coordinates
    locatedIn: String
    width: Float
    length: Float
    surfaceArea: Float
    capacity: Float
    inceptionDate: String
    wikidataUrl: String
    description: String
  }

  type Query {
    waterFeatures(
      type: WaterFeatureType
      region: String
      minCapacity: Float
      minSurfaceArea: Float
      sortBy: String
      sortOrder: String
      limit: Int
      offset: Int
    ): [WaterFeature]
    
    waterFeature(id: ID!): WaterFeature
  }
`;

module.exports = typeDefs;

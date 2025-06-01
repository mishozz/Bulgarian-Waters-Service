# Bulgarian-Waters-Service

The Bulgarian-Waters-Service is a GraphQL API that provides detailed information about water features in Bulgaria, such as lakes, dams, reservoirs, and rivers. The data is sourced from Wikidata and includes attributes like location, capacity, surface area, and more. This project is designed to make querying and analyzing water features in Bulgaria simple and efficient.

## Features

- **GraphQL API**: Query water features by type, region, capacity, surface area, and more.
- **Caching**: Implements caching for improved performance and reduced load on the GraphQL endpoint.
- **Preloading**: Preloads water feature data into the cache for faster queries.
- **Sorting and Pagination**: Supports sorting and paginating results.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Usage](#usage)
5. [GraphQL Schema](#graphql-schema)
6. [Example Queries](#example-queries)


---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v14 or higher)
- **npm** or **yarn**

---

## Installation

1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd bulgaria-water-features
   npm install
   ```

## Usage
  ```sh
    make start
  ```

Access the GraphQL Playground
You can access the GraphQL Playground at http://localhost:4000 to explore the API and run queries interactively.

## Graphql Schema

The API exposes the following schema:

#### Enums
```
enum WaterFeatureType {
  LAKE
  DAM
  RESERVOIR
  RIVER
}
```

#### TYPES
type Coordinates {
  latitude: Float!
  longitude: Float!
}
```
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
```

#### QUERIES

```
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
```

## Example Queries
#### Fetch all lakes in Bulgaria
```
query {
  waterFeatures(type: LAKE, limit: 10) {
    id
    name
    location {
      latitude
      longitude
    }
    surfaceArea
    capacity
  }
}
```

#### Fetch a specific water feature by ID
```
query {
  waterFeature(id: "Q12345") {
    name
    type
    description
    wikidataUrl
  }
}
```

#### Fetch dams with a minimum capacity
```
query {
  waterFeatures(type: DAM, minCapacity: 1000000, limit: 5) {
    id
    name
    capacity
    locatedIn
  }
}
```

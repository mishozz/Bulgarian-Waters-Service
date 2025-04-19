// src/utils/sparqlClient.js
const fetch = require('node-fetch');
const cacheManager = require('../cache/cacheManager');

class SparqlClient {
    constructor() {
        this.endpoint = process.env.WIKIDATA_ENDPOINT || 'https://query.wikidata.org/sparql';
        this.waterFeatureTypes = ['LAKE', 'DAM', 'RESERVOIR', 'RIVER'];
        this.queryLimit = 500;
    }

    /**
     * Execute a SPARQL query with caching
     * @param {String} sparqlQuery - SPARQL query string
     * @returns {Object} - Query results
     */
    async query(sparqlQuery) {
        // Check if query result is in cache
        const cachedResult = cacheManager.getCachedQuery(sparqlQuery);
        if (cachedResult) {
            console.log('Cache hit for query');
            return cachedResult;
        }

        console.log('Cache miss, executing SPARQL query');
        
        const url = new URL(this.endpoint);
        url.searchParams.append('query', sparqlQuery);
        url.searchParams.append('format', 'json');

        const response = await fetch(url.toString(), {
            headers: {
                'Accept': 'application/sparql-results+json',
                'User-Agent': 'BulgariaWaterFeaturesAPI/1.0'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`SPARQL query failed: ${error}`);
        }

        const result = await response.json();
        
        // Cache the result
        cacheManager.cacheQuery(sparqlQuery, result);
        
        return result;
    }

    /**
     * Preload all water features by type into cache
     */
    async preloadCache() {
        console.log('Preloading water feature data into cache...');
        
        for (const type of this.waterFeatureTypes) {
            console.log(`Preloading ${type} data...`);
            try {
                const query = this.buildWaterFeaturesQuery({ type, limit: this.queryLimit });
                const results = await this.query(query);
                
                // Cache the transformed results by type
                const transformedResults = this.transformResults(results);
                cacheManager.set(`ALL_${type}`, transformedResults, 12 * 60 * 60 * 1000); // 12 hour TTL
                
                console.log(`Cached ${transformedResults.length} ${type} features`);
            } catch (error) {
                console.error(`Error preloading ${type} data:`, error);
            }
        }
        
        console.log('Preloading complete!');
    }

    /**
     * Get all water features of a specific type from cache or query
     * @param {String} type - Water feature type
     * @returns {Array} - Water features
     */
    async getAllFeaturesOfType(type) {
        if (!this.waterFeatureTypes.includes(type)) {
            throw new Error(`Invalid water feature type: ${type}`);
        }
        
        const cacheKey = `ALL_${type}`;
        let features = cacheManager.get(cacheKey);
        
        if (!features) {
            console.log(`Cache miss for ${type}, querying Wikidata...`);
            const query = this.buildWaterFeaturesQuery({ type, limit: this.queryLimit });
            const results = await this.query(query);
            features = this.transformResults(results);
            
            // Cache the results
            cacheManager.set(cacheKey, features, 12 * 60 * 60 * 1000); // 12 hour TTL
        }
        
        return features;
    }

    /**
     * Build a SPARQL query for water features in Bulgaria
     * @param {Object} params - Query parameters
     * @returns {String} - SPARQL query string
     */
    buildWaterFeaturesQuery({
        type = null,
        region = null,
        minCapacity = null,
        minSurfaceArea = null,
        sortBy = 'name',
        sortOrder = 'ASC',
        limit = this.queryLimit,
        offset = 0
    }) {
        // Map GraphQL types to Wikidata entity IDs
        const typeMapping = {
            LAKE: 'Q23397',    // lake
            DAM: 'Q12323',     // dam
            RESERVOIR: 'Q131681', // reservoir
            RIVER: 'Q4022'     // river
        };

        // Map GraphQL sort fields to Wikidata properties
        const sortMapping = {
            name: '?name',
            surfaceArea: '?surfaceArea',
            capacity: '?capacity',
            width: '?width',
            length: '?length'
        };

        // Build the type filter
        let typeFilter = '';
        if (type && this.waterFeatureTypes.includes(type)) {
            typeFilter = `?item wdt:P31/wdt:P279* wd:${typeMapping[type]}.`;
        } else {
            const defaultTypes = this.waterFeatureTypes.map(key => `wd:${typeMapping[key]}`).join(' ');
            typeFilter = `
                VALUES ?typeId {${defaultTypes}}
                ?item wdt:P31/wdt:P279* ?typeId.
            `;
        }

        // Region filter
        let regionFilter = '';
        if (region) {
            regionFilter = `
                ?item wdt:P131/wdt:P131* ?region.
                ?region rdfs:label ?regionLabel.
                FILTER(CONTAINS(LCASE(?regionLabel), LCASE("${region}"))).
            `;
        }

        // Capacity filter
        let capacityFilter = '';
        if (minCapacity) {
            capacityFilter = `
                ?item wdt:P2234 ?capacity.
                FILTER(?capacity >= ${minCapacity}).
            `;
        }

        // Surface area filter
        let surfaceAreaFilter = '';
        if (minSurfaceArea) {
            surfaceAreaFilter = `
                ?item wdt:P2046 ?surfaceArea.
                FILTER(?surfaceArea >= ${minSurfaceArea}).
            `;
        }

        // Sort field determination
        const sortField = sortMapping[sortBy] || sortMapping.name;
        
        const query = `
            SELECT DISTINCT ?itemLabel (SAMPLE(?item) AS ?item) (SAMPLE(?typeId) AS ?typeId) 
                            (SAMPLE(?typeLabel) AS ?typeLabel) (SAMPLE(?coord) AS ?coord) 
                            (SAMPLE(?locatedInLabel) AS ?locatedInLabel) (SAMPLE(?width) AS ?width) 
                            (SAMPLE(?length) AS ?length) (SAMPLE(?surfaceArea) AS ?surfaceArea) 
                            (SAMPLE(?capacity) AS ?capacity) (SAMPLE(?inception) AS ?inception) 
                            (SAMPLE(?description) AS ?description)
            WHERE {
                # Bulgaria constraint
                ?item wdt:P17 wd:Q219. # located in Bulgaria
                
                # Type constraint
                ${typeFilter}
                
                # Get the specific type
                ?item wdt:P31 ?typeId.
                ?typeId rdfs:label ?typeLabel.
                FILTER(LANG(?typeLabel) = "en")
                
                # Name
                ?item rdfs:label ?itemLabel.
                FILTER(LANG(?itemLabel) = "en")
                
                # Coordinates
                OPTIONAL { ?item wdt:P625 ?coord. }
                
                # Location
                OPTIONAL { 
                    ?item wdt:P131 ?locatedIn. 
                    ?locatedIn rdfs:label ?locatedInLabel.
                    FILTER(LANG(?locatedInLabel) = "en")
                }

                # Vertical depth
                OPTIONAL { ?item wdt:P4511 ?depth. }
                
                # Length
                OPTIONAL { ?item wdt:P2043 ?length. }

                # Width
                OPTIONAL { ?item wdt:P2049 ?width. }
                
                # Surface area
                OPTIONAL { ?item wdt:P2046 ?surfaceArea. }
                
                # Capacity
                OPTIONAL { ?item wdt:P2234 ?capacity. }
                
                # Inception date
                OPTIONAL { ?item wdt:P571 ?inception. }
                
                # Description
                OPTIONAL {
                    ?item schema:description ?description.
                    FILTER(LANG(?description) = "en")
                }
                
                ${regionFilter}
                ${capacityFilter}
                ${surfaceAreaFilter}
            }
            GROUP BY ?itemLabel
            ORDER BY ${sortOrder === 'DESC' ? 'DESC' : 'ASC'}(${sortField})
            LIMIT ${limit}
            OFFSET ${offset}
        `;

        return query;
    }

    /**
     * Transform SPARQL results into GraphQL format
     * @param {Object} results - SPARQL query results
     * @returns {Array} - Formatted water features
     */
    transformResults(results) {
        if (!results.results || !results.results.bindings) {
            return [];
        }

        return results.results.bindings.map(binding => {
            // Parse coordinates from the Wikidata Point format
            let latitude = null;
            let longitude = null;
            
            if (binding.coord) {
                const coordValue = binding.coord.value;
                // Extract coordinates from Point(longitude latitude) format
                const match = coordValue.match(/Point\(([^ ]+) ([^)]+)\)/);
                if (match) {
                    longitude = parseFloat(match[1]);
                    latitude = parseFloat(match[2]);
                }
            }

            // Extract ID from Wikidata URI
            const id = binding.item.value.split('/').pop();

            // Map Wikidata type to GraphQL type
            let type = 'LAKE'; // Default
            if (binding.typeLabel) {
                const typeLabel = binding.typeLabel.value.toLowerCase();
                if (typeLabel.includes('dam')) type = 'DAM';
                else if (typeLabel.includes('reservoir')) type = 'RESERVOIR';
                else if (typeLabel.includes('river')) type = 'RIVER';
                else if (typeLabel.includes('lake')) type = 'LAKE';
            }

            return {
                id,
                name: binding.itemLabel ? binding.itemLabel.value : 'Unknown',
                type,
                location: latitude && longitude ? { latitude, longitude } : null,
                locatedIn: binding.locatedInLabel ? binding.locatedInLabel.value : null,
                width: binding.width ? parseFloat(binding.width.value) : null,
                length: binding.length ? parseFloat(binding.length.value) : null,
                surfaceArea: binding.surfaceArea ? parseFloat(binding.surfaceArea.value) : null,
                capacity: binding.capacity ? parseFloat(binding.capacity.value) : null,
                inceptionDate: binding.inception ? binding.inception.value : null,
                wikidataUrl: `https://www.wikidata.org/wiki/${id}`,
                description: binding.description ? binding.description.value : null
            };
        });
    }

    /**
     * Build a SPARQL query for a specific water feature by ID
     * @param {String} id - Wikidata entity ID
     * @returns {String} - SPARQL query string
     */
    buildWaterFeatureByIdQuery(id) {
        return `
        SELECT ?item ?itemLabel ?typeId ?typeLabel ?coord ?locatedInLabel 
                ?width ?length ?surfaceArea ?capacity ?inception ?description
        WHERE {
            BIND(wd:${id} AS ?item)
            
            # Get the specific type
            ?item wdt:P31 ?typeId.
            ?typeId rdfs:label ?typeLabel.
            FILTER(LANG(?typeLabel) = "en")
            
            # Name
            ?item rdfs:label ?itemLabel.
            FILTER(LANG(?itemLabel) = "en")
            
            # Coordinates
            OPTIONAL { ?item wdt:P625 ?coord. }
            
            # Location
            OPTIONAL { 
            ?item wdt:P131 ?locatedIn. 
            ?locatedIn rdfs:label ?locatedInLabel.
            FILTER(LANG(?locatedInLabel) = "en")
            }
            
            # width
            OPTIONAL { ?item wdt:P2048 ?width. }
            
            # Length
            OPTIONAL { ?item wdt:P2043 ?length. }
            
            # Surface area
            OPTIONAL { ?item wdt:P2046 ?surfaceArea. }
            
            # Capacity
            OPTIONAL { ?item wdt:P2234 ?capacity. }
            
            # Inception date
            OPTIONAL { ?item wdt:P571 ?inception. }
            
            # Description
            OPTIONAL {
            ?item schema:description ?description.
            FILTER(LANG(?description) = "en")
            }
        }
        LIMIT 1
        `;
    }

    /**
     * Try to find a water feature by ID in the cache before querying
     * @param {String} id - Wikidata entity ID
     * @returns {Object|null} - Water feature or null if not found
     */
    async getWaterFeatureById(id) {
        // Check if we have this ID in any of our type caches
        for (const type of this.waterFeatureTypes) {
            const features = cacheManager.get(`ALL_${type}`);
            if (features) {
                const feature = features.find(f => f.id === id);
                if (feature) {
                    console.log(`Found feature ${id} in ${type} cache`);
                    return feature;
                }
            }
        }
        
        // If not found in cache, query Wikidata
        console.log(`Feature ${id} not found in cache, querying Wikidata`);
        const sparqlQuery = this.buildWaterFeatureByIdQuery(id);
        const results = await this.query(sparqlQuery);
        const transformedResults = this.transformResults(results);
        
        // If found, add to cache for future lookups
        if (transformedResults.length > 0) {
            const feature = transformedResults[0];
            const cacheKey = `FEATURE_${id}`;
            cacheManager.set(cacheKey, feature);
            return feature;
        }
        
        return null;
    }
}

module.exports = new SparqlClient();

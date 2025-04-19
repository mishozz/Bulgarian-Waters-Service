// src/utils/sparqlClient.js
const fetch = require('node-fetch');

class SparqlClient {
    constructor(endpoint = 'https://query.wikidata.org/sparql') {
        this.endpoint = endpoint;
    }

    async query(sparqlQuery) {
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

        return response.json();
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
        limit = 100,
        offset = 0
    }) {
        const waterFeatureTypes = ['LAKE', 'DAM', 'RESERVOIR', 'RIVER'];

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
        if (type && waterFeatureTypes.includes(type)) {
            typeFilter = `?item wdt:P31/wdt:P279* wd:${typeMapping[type]}.`;
        } else {
            const defaultTypes = waterFeatureTypes.map(key => `wd:${typeMapping[key]}`).join(' ');
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
            ?item wdt:P1157 ?capacity.
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
            OPTIONAL { ?item wdt:P1157 ?capacity. }
            
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
}

module.exports = new SparqlClient();

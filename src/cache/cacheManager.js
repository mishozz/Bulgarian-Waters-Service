// src/utils/cacheManager.js
class CacheManager {
    constructor() {
      this.cache = new Map();
      this.queryCache = new Map();
      this.defaultTTL = parseInt(process.env.CACHE_TTL, 10)
    }
  
    /**
     * Set a cache entry with optional TTL
     * @param {String} key - Cache key
     * @param {*} data - Data to cache
     * @param {Number} ttl - Time to live in milliseconds (optional)
     */
    set(key, data, ttl = this.defaultTTL) {
      const expiryTime = Date.now() + ttl;
      this.cache.set(key, {
        data,
        expiryTime
      });
      return data;
    }
  
    /**
     * Get a cache entry if it exists and hasn't expired
     * @param {String} key - Cache key
     * @returns {*} Cached data or null if not found/expired
     */
    get(key) {
      if (!this.cache.has(key)) {
        return null;
      }
  
      const cacheEntry = this.cache.get(key);
      
      // Check if entry has expired
      if (Date.now() > cacheEntry.expiryTime) {
        this.cache.delete(key);
        return null;
      }
  
      return cacheEntry.data;
    }
  
    /**
     * Cache the result of a SPARQL query with the query string as key
     * @param {String} queryString - SPARQL query string
     * @param {*} data - Query result
     * @param {Number} ttl - Time to live in milliseconds (optional)
     */
    cacheQuery(queryString, data, ttl = this.defaultTTL) {
      // Create a hash of the query string to use as key
      const queryKey = this.hashString(queryString);
      return this.set(queryKey, data, ttl);
    }
  
    /**
     * Get cached query result if available
     * @param {String} queryString - SPARQL query string
     * @returns {*} Cached query result or null
     */
    getCachedQuery(queryString) {
      const queryKey = this.hashString(queryString);
      return this.get(queryKey);
    }
  
    /**
     * Simple string hashing function
     * @param {String} str - String to hash
     * @returns {String} - Hashed string
     */
    hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString();
    }
  
    /**
     * Clear expired cache entries
     */
    cleanupExpiredEntries() {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiryTime) {
          this.cache.delete(key);
        }
      }
    }
  
    /**
     * Clear all cache entries
     */
    clear() {
      this.cache.clear();
    }
  }
  
  module.exports = new CacheManager();

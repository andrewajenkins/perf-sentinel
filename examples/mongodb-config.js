// Example MongoDB configuration for perf-sentinel
// This file demonstrates how to configure MongoDB/DocumentDB integration

const config = {
  // MongoDB connection string
  // For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/
  // For local MongoDB: mongodb://localhost:27017/
  // For AWS DocumentDB: mongodb://username:password@docdb-cluster.cluster-id.region.docdb.amazonaws.com:27017/
  connectionString: process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/',
  
  // Database name to use
  databaseName: process.env.MONGODB_DB_NAME || 'perf-sentinel',
  
  // Project identifier for multi-project support
  projectId: process.env.PROJECT_ID || 'my-project',
  
  // Performance analysis thresholds
  threshold: 2.0,
  maxHistory: 100,
  
  // Reporters to use
  reporters: ['console', 'markdown'],
};

module.exports = config;

// Example usage in CI/CD pipeline:
// 
// # Environment variables
// export MONGODB_CONNECTION_STRING="mongodb+srv://user:pass@cluster.mongodb.net/"
// export MONGODB_DB_NAME="perf-sentinel"
// export PROJECT_ID="my-web-app"
// 
// # Analyze performance with database storage
// perf-sentinel analyze \
//   --run-file ./performance-results.json \
//   --db-connection "$MONGODB_CONNECTION_STRING" \
//   --db-name "$MONGODB_DB_NAME" \
//   --project-id "$PROJECT_ID" \
//   --threshold 2.0 \
//   --reporter console markdown
// 
// # Seed historical data from multiple runs
// perf-sentinel seed \
//   --run-files "./historical-runs/*.json" \
//   --db-connection "$MONGODB_CONNECTION_STRING" \
//   --db-name "$MONGODB_DB_NAME" \
//   --project-id "$PROJECT_ID" 
pipeline {
    agent any
    
    parameters {
        string(name: 'PROJECT_ID', defaultValue: 'my-web-app', description: 'Project identifier for perf-sentinel')
        choice(name: 'STORAGE_TYPE', choices: ['filesystem', 's3', 'database'], description: 'Storage adapter to use')
        booleanParam(name: 'GENERATE_HTML_REPORT', defaultValue: true, description: 'Generate HTML performance report')
    }
    
    environment {
        // Configure perf-sentinel for CI/CD
        PROJECT_ID = "${params.PROJECT_ID}"
        MONGODB_CONNECTION_STRING = credentials('mongodb-connection-string')
        S3_BUCKET_NAME = credentials('s3-bucket-name')
        AWS_REGION = 'us-east-1'
        
        // Jenkins-specific environment variables
        CI_JOB_ID = "${env.BUILD_ID}"
        JENKINS_BUILD_NUMBER = "${env.BUILD_NUMBER}"
        EXECUTOR_NUMBER = "${env.EXECUTOR_NUMBER}"
    }
    
    stages {
        stage('Setup') {
            steps {
                script {
                    // Install dependencies
                    sh 'npm ci'
                    
                    // Create performance results directory
                    sh 'mkdir -p performance-results'
                    
                    // Log environment info
                    echo "Starting performance testing for ${PROJECT_ID}"
                    echo "Build ID: ${env.BUILD_ID}"
                    echo "Storage Type: ${params.STORAGE_TYPE}"
                }
            }
        }
        
        stage('Parallel Performance Tests') {
            parallel {
                stage('Authentication Tests') {
                    steps {
                        script {
                            env.JOB_ID = "auth-tests-${env.BUILD_ID}"
                            env.CURRENT_JOB = "authentication"
                            
                            try {
                                // Run authentication test suite
                                sh '''
                                    echo "Running authentication tests..."
                                    npm run test:auth || true
                                    
                                    # Analyze results immediately
                                    npx perf-sentinel analyze \
                                        --run-file ./performance-results/latest-run.json \
                                        --config ./examples/perf-sentinel-ci.yml \
                                        --project-id "$PROJECT_ID" \
                                        --environment production
                                '''
                                
                                // Archive artifacts for this job
                                archiveArtifacts artifacts: 'performance-results/*', allowEmptyArchive: true
                            } catch (Exception e) {
                                echo "Authentication tests failed: ${e.getMessage()}"
                                currentBuild.result = 'UNSTABLE'
                            }
                        }
                    }
                }
                
                stage('API Tests') {
                    steps {
                        script {
                            env.JOB_ID = "api-tests-${env.BUILD_ID}"
                            env.CURRENT_JOB = "api"
                            
                            try {
                                // Run API test suite
                                sh '''
                                    echo "Running API tests..."
                                    npm run test:api || true
                                    
                                    # Analyze results immediately
                                    npx perf-sentinel analyze \
                                        --run-file ./performance-results/latest-run.json \
                                        --config ./examples/perf-sentinel-ci.yml \
                                        --project-id "$PROJECT_ID" \
                                        --environment production
                                '''
                                
                                // Archive artifacts for this job
                                archiveArtifacts artifacts: 'performance-results/*', allowEmptyArchive: true
                            } catch (Exception e) {
                                echo "API tests failed: ${e.getMessage()}"
                                currentBuild.result = 'UNSTABLE'
                            }
                        }
                    }
                }
                
                stage('UI Tests') {
                    steps {
                        script {
                            env.JOB_ID = "ui-tests-${env.BUILD_ID}"
                            env.CURRENT_JOB = "ui"
                            
                            try {
                                // Run UI test suite
                                sh '''
                                    echo "Running UI tests..."
                                    npm run test:ui || true
                                    
                                    # Analyze results immediately
                                    npx perf-sentinel analyze \
                                        --run-file ./performance-results/latest-run.json \
                                        --config ./examples/perf-sentinel-ci.yml \
                                        --project-id "$PROJECT_ID" \
                                        --environment production
                                '''
                                
                                // Archive artifacts for this job
                                archiveArtifacts artifacts: 'performance-results/*', allowEmptyArchive: true
                            } catch (Exception e) {
                                echo "UI tests failed: ${e.getMessage()}"
                                currentBuild.result = 'UNSTABLE'
                            }
                        }
                    }
                }
            }
        }
        
        stage('Aggregate Performance Results') {
            steps {
                script {
                    def jobIds = "auth-tests-${env.BUILD_ID},api-tests-${env.BUILD_ID},ui-tests-${env.BUILD_ID}"
                    
                    try {
                        // Aggregate results from all parallel jobs
                        sh """
                            echo "Aggregating performance results..."
                            echo "Job IDs: ${jobIds}"
                            
                            npx perf-sentinel aggregate \
                                --config ./examples/perf-sentinel-ci.yml \
                                --project-id "$PROJECT_ID" \
                                --job-ids "${jobIds}" \
                                --wait-for-jobs true \
                                --timeout 600 \
                                --output-file ./aggregated-results.json
                        """
                        
                        // Archive aggregated results
                        archiveArtifacts artifacts: 'aggregated-results.json', allowEmptyArchive: true
                        
                    } catch (Exception e) {
                        echo "Aggregation failed: ${e.getMessage()}"
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
        }
        
        stage('Generate Performance Report') {
            when {
                expression { params.GENERATE_HTML_REPORT }
            }
            steps {
                script {
                    try {
                        // Generate comprehensive HTML report
                        sh '''
                            echo "Generating HTML performance report..."
                            
                            npx perf-sentinel analyze \
                                --run-file ./aggregated-results.json \
                                --config ./examples/perf-sentinel-ci.yml \
                                --project-id "$PROJECT_ID" \
                                --environment production \
                                --reporter html \
                                --html-output ./performance-report.html
                        '''
                        
                        // Archive the HTML report
                        archiveArtifacts artifacts: 'performance-report.html', allowEmptyArchive: true
                        
                        // Publish HTML report
                        publishHTML([
                            allowMissing: false,
                            alwaysLinkToLastBuild: true,
                            keepAll: true,
                            reportDir: '.',
                            reportFiles: 'performance-report.html',
                            reportName: 'Performance Report',
                            reportTitles: 'Performance Analysis Report'
                        ])
                        
                    } catch (Exception e) {
                        echo "HTML report generation failed: ${e.getMessage()}"
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
        }
        
        stage('Storage-Specific Analysis') {
            parallel {
                stage('S3 Storage Analysis') {
                    when {
                        expression { params.STORAGE_TYPE == 's3' }
                    }
                    steps {
                        script {
                            try {
                                withCredentials([
                                    string(credentialsId: 'aws-access-key-id', variable: 'AWS_ACCESS_KEY_ID'),
                                    string(credentialsId: 'aws-secret-access-key', variable: 'AWS_SECRET_ACCESS_KEY')
                                ]) {
                                    sh '''
                                        echo "Using S3 storage for performance data..."
                                        
                                        # Aggregate results from S3
                                        npx perf-sentinel aggregate \
                                            --bucket-name "$S3_BUCKET_NAME" \
                                            --s3-region "$AWS_REGION" \
                                            --project-id "$PROJECT_ID" \
                                            --job-ids "auth-tests-${BUILD_ID},api-tests-${BUILD_ID},ui-tests-${BUILD_ID}" \
                                            --wait-for-jobs true \
                                            --timeout 600 \
                                            --output-file ./s3-aggregated-results.json
                                        
                                        # Generate S3-based HTML report
                                        npx perf-sentinel analyze \
                                            --run-file ./s3-aggregated-results.json \
                                            --bucket-name "$S3_BUCKET_NAME" \
                                            --s3-region "$AWS_REGION" \
                                            --project-id "$PROJECT_ID" \
                                            --reporter html \
                                            --html-output ./s3-performance-report.html
                                    '''
                                }
                                
                                archiveArtifacts artifacts: 's3-performance-report.html', allowEmptyArchive: true
                            } catch (Exception e) {
                                echo "S3 storage analysis failed: ${e.getMessage()}"
                            }
                        }
                    }
                }
                
                stage('Database Storage Analysis') {
                    when {
                        expression { params.STORAGE_TYPE == 'database' }
                    }
                    steps {
                        script {
                            try {
                                sh '''
                                    echo "Using database storage for performance data..."
                                    
                                    # Aggregate results from MongoDB
                                    npx perf-sentinel aggregate \
                                        --db-connection "$MONGODB_CONNECTION_STRING" \
                                        --project-id "$PROJECT_ID" \
                                        --job-ids "auth-tests-${BUILD_ID},api-tests-${BUILD_ID},ui-tests-${BUILD_ID}" \
                                        --wait-for-jobs true \
                                        --timeout 600 \
                                        --output-file ./db-aggregated-results.json
                                    
                                    # Generate database-based HTML report
                                    npx perf-sentinel analyze \
                                        --run-file ./db-aggregated-results.json \
                                        --db-connection "$MONGODB_CONNECTION_STRING" \
                                        --project-id "$PROJECT_ID" \
                                        --reporter html \
                                        --html-output ./db-performance-report.html
                                '''
                                
                                archiveArtifacts artifacts: 'db-performance-report.html', allowEmptyArchive: true
                            } catch (Exception e) {
                                echo "Database storage analysis failed: ${e.getMessage()}"
                            }
                        }
                    }
                }
            }
        }
    }
    
    post {
        always {
            script {
                // Clean up temporary files
                sh 'rm -f aggregated-results.json s3-aggregated-results.json db-aggregated-results.json'
                
                echo "Performance testing completed for build ${env.BUILD_ID}"
                echo "Project: ${PROJECT_ID}"
                echo "Storage: ${params.STORAGE_TYPE}"
                echo "Build result: ${currentBuild.currentResult}"
            }
        }
        
        success {
            script {
                if (params.GENERATE_HTML_REPORT) {
                    // Send notification with performance report link
                    emailext(
                        subject: "✅ Performance Testing Complete - ${PROJECT_ID} (Build ${env.BUILD_ID})",
                        body: """
                        Performance testing completed successfully for ${PROJECT_ID}.
                        
                        Build Information:
                        - Build ID: ${env.BUILD_ID}
                        - Branch: ${env.BRANCH_NAME}
                        - Commit: ${env.GIT_COMMIT}
                        - Storage: ${params.STORAGE_TYPE}
                        
                        Results:
                        - Interactive HTML report available in build artifacts
                        - All parallel jobs completed successfully
                        - Performance data aggregated and analyzed
                        
                        View the performance report: ${env.BUILD_URL}artifact/performance-report.html
                        """,
                        recipientProviders: [developers(), requestor()]
                    )
                }
            }
        }
        
        failure {
            script {
                // Send failure notification
                emailext(
                    subject: "❌ Performance Testing Failed - ${PROJECT_ID} (Build ${env.BUILD_ID})",
                    body: """
                    Performance testing failed for ${PROJECT_ID}.
                    
                    Build Information:
                    - Build ID: ${env.BUILD_ID}
                    - Branch: ${env.BRANCH_NAME}
                    - Commit: ${env.GIT_COMMIT}
                    - Storage: ${params.STORAGE_TYPE}
                    
                    Please check the build logs for details: ${env.BUILD_URL}console
                    """,
                    recipientProviders: [developers(), requestor()]
                )
            }
        }
        
        unstable {
            script {
                // Send unstable notification
                emailext(
                    subject: "⚠️ Performance Testing Unstable - ${PROJECT_ID} (Build ${env.BUILD_ID})",
                    body: """
                    Performance testing completed with warnings for ${PROJECT_ID}.
                    
                    Build Information:
                    - Build ID: ${env.BUILD_ID}
                    - Branch: ${env.BRANCH_NAME}
                    - Commit: ${env.GIT_COMMIT}
                    - Storage: ${params.STORAGE_TYPE}
                    
                    Some tests may have failed, but performance analysis was still generated.
                    Please review the performance report and build logs.
                    
                    View the performance report: ${env.BUILD_URL}artifact/performance-report.html
                    """,
                    recipientProviders: [developers(), requestor()]
                )
            }
        }
    }
} 
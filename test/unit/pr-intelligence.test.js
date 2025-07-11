const { PRIntelligence } = require('../../src/analysis/pr-intelligence');

describe('PRIntelligence', () => {
  let prIntelligence;
  
  beforeEach(() => {
    prIntelligence = new PRIntelligence();
    
    // Clear environment variables before each test
    delete process.env.PR_NUMBER;
    delete process.env.GITHUB_PR_NUMBER;
    delete process.env.COMMIT_SHA;
    delete process.env.GITHUB_SHA;
    delete process.env.BRANCH_NAME;
    delete process.env.GITHUB_HEAD_REF;
    delete process.env.TARGET_BRANCH;
    delete process.env.GITHUB_BASE_REF;
    delete process.env.COMMIT_AUTHOR_NAME;
    delete process.env.GITHUB_ACTOR;
    delete process.env.COMMIT_AUTHOR_EMAIL;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.JENKINS_URL;
    delete process.env.GITLAB_CI;
    delete process.env.GITHUB_EVENT_NAME;
    delete process.env.GITHUB_DRAFT;
    delete process.env.GITHUB_APPROVED;
  });

  describe('PR Context Extraction', () => {
    it('should extract PR context from GitHub Actions environment', () => {
      process.env.GITHUB_PR_NUMBER = '123';
      process.env.GITHUB_SHA = 'abcdef123456';
      process.env.GITHUB_HEAD_REF = 'feature/new-feature';
      process.env.GITHUB_BASE_REF = 'main';
      process.env.GITHUB_ACTOR = 'testuser';
      process.env.GITHUB_ACTIONS = 'true';
      
      const context = prIntelligence.extractPRContext();
      
      expect(context.prNumber).toBe('123');
      expect(context.commitSha).toBe('abcdef123456');
      expect(context.branch).toBe('feature/new-feature');
      expect(context.targetBranch).toBe('main');
      expect(context.authorName).toBe('testuser');
      expect(context.platform).toBe('github-actions');
    });

    it('should extract PR context from GitLab CI environment', () => {
      process.env.CI_MERGE_REQUEST_IID = '456';
      process.env.CI_COMMIT_SHA = 'fedcba654321';
      process.env.CI_COMMIT_REF_NAME = 'feature/gitlab-feature';
      process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME = 'develop';
      process.env.CI_COMMIT_AUTHOR = 'gitlab-user';
      process.env.CI_COMMIT_AUTHOR_EMAIL = 'user@gitlab.com';
      process.env.GITLAB_CI = 'true';
      
      const context = prIntelligence.extractPRContext();
      
      expect(context.prNumber).toBe('456');
      expect(context.commitSha).toBe('fedcba654321');
      expect(context.branch).toBe('feature/gitlab-feature');
      expect(context.targetBranch).toBe('develop');
      expect(context.authorName).toBe('gitlab-user');
      expect(context.authorEmail).toBe('user@gitlab.com');
      expect(context.platform).toBe('gitlab-ci');
    });

    it('should handle missing PR context gracefully', () => {
      // Clear all PR-related environment variables
      delete process.env.GITHUB_PR_NUMBER;
      delete process.env.PULL_REQUEST_NUMBER;
      delete process.env.PR_NUMBER;
      delete process.env.CI_MERGE_REQUEST_IID;
      delete process.env.GITHUB_SHA;
      delete process.env.COMMIT_SHA;
      delete process.env.CI_COMMIT_SHA;
      delete process.env.GIT_COMMIT;
      delete process.env.GITHUB_HEAD_REF;
      delete process.env.BRANCH_NAME;
      delete process.env.CI_COMMIT_REF_NAME;
      delete process.env.GIT_BRANCH;
      delete process.env.GITHUB_BASE_REF;
      delete process.env.TARGET_BRANCH;
      delete process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME;
      
      const context = prIntelligence.extractPRContext();
      
      expect(context.prNumber).toBeNull();
      expect(context.commitSha).toBeNull();
      expect(context.branch).toBeNull();
      expect(context.targetBranch).toBe('main');
      expect(context.platform).toBe('unknown');
    });

    it('should detect various CI platforms', () => {
      // Test GitHub Actions
      process.env.GITHUB_ACTIONS = 'true';
      expect(prIntelligence.detectCIPlatform()).toBe('github-actions');
      delete process.env.GITHUB_ACTIONS;
      
      // Test Jenkins
      process.env.JENKINS_URL = 'https://jenkins.example.com';
      expect(prIntelligence.detectCIPlatform()).toBe('jenkins');
      delete process.env.JENKINS_URL;
      
      // Test GitLab CI
      process.env.GITLAB_CI = 'true';
      expect(prIntelligence.detectCIPlatform()).toBe('gitlab-ci');
      delete process.env.GITLAB_CI;
      
      // Test unknown platform
      expect(prIntelligence.detectCIPlatform()).toBe('unknown');
    });
  });

  describe('PR Lifecycle State Management', () => {
    it('should extract draft PR state', () => {
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      process.env.GITHUB_DRAFT = 'true';
      
      const lifecycle = prIntelligence.extractPRLifecycleState();
      
      expect(lifecycle.state).toBe('draft');
      expect(lifecycle.phase).toBe('development');
      expect(lifecycle.isDraft).toBe(true);
      expect(lifecycle.isApproved).toBe(false);
    });

    it('should extract approved PR state', () => {
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      process.env.GITHUB_APPROVED = 'true';
      
      const lifecycle = prIntelligence.extractPRLifecycleState();
      
      expect(lifecycle.state).toBe('approved');
      expect(lifecycle.phase).toBe('ready-to-merge');
      expect(lifecycle.isDraft).toBe(false);
      expect(lifecycle.isApproved).toBe(true);
    });

    it('should extract review PR state', () => {
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      
      const lifecycle = prIntelligence.extractPRLifecycleState();
      
      expect(lifecycle.state).toBe('review');
      expect(lifecycle.phase).toBe('code-review');
      expect(lifecycle.isDraft).toBe(false);
      expect(lifecycle.isApproved).toBe(false);
    });

    it('should extract push state', () => {
      process.env.GITHUB_EVENT_NAME = 'push';
      
      const lifecycle = prIntelligence.extractPRLifecycleState();
      
      expect(lifecycle.state).toBe('push');
      expect(lifecycle.phase).toBe('development');
    });

    it('should extract merged state', () => {
      process.env.GITHUB_EVENT_NAME = 'merge';
      
      const lifecycle = prIntelligence.extractPRLifecycleState();
      
      expect(lifecycle.state).toBe('merged');
      expect(lifecycle.phase).toBe('merged');
    });
  });

  describe('Context Enhancement', () => {
    it('should enhance context with PR information', () => {
      process.env.GITHUB_PR_NUMBER = '789';
      process.env.GITHUB_SHA = '1234567890abcdef';
      process.env.GITHUB_HEAD_REF = 'feature/enhancement';
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      
      const baseContext = {
        testFile: 'test.feature',
        suite: 'authentication',
        tags: ['@smoke']
      };
      
      const enhanced = prIntelligence.enhanceContextWithPRInfo(baseContext);
      
      expect(enhanced.testFile).toBe('test.feature');
      expect(enhanced.suite).toBe('authentication');
      expect(enhanced.tags).toEqual(['@smoke']);
      expect(enhanced.pr).toBeDefined();
      expect(enhanced.pr.prNumber).toBe('789');
      expect(enhanced.pr.commitSha).toBe('1234567890abcdef');
      expect(enhanced.pr.branch).toBe('feature/enhancement');
      expect(enhanced.pr.platform).toBe('github-actions');
      expect(enhanced.pr.lifecycle).toBeDefined();
      expect(enhanced.pr.lifecycle.state).toBe('review');
    });
  });

  describe('Multi-Commit Analysis', () => {
    it('should handle insufficient commit history', () => {
      const commitHistory = [
        { commitSha: 'abc123', report: { regressions: [] } }
      ];
      
      const analysis = prIntelligence.analyzeMultiCommitPerformance(commitHistory, { regressions: [] });
      
      expect(analysis.type).toBe('single-commit');
      expect(analysis.confidence).toBe(0.5);
      expect(analysis.message).toContain('Insufficient commit history');
    });

    it('should identify consistent regressions across commits', () => {
      const commitHistory = [
        {
          commitSha: 'abc123',
          report: {
            regressions: [
              { stepText: 'login step', currentDuration: 1000, average: 800, slowdown: 200, percentage: 25 }
            ],
            ok: []
          }
        },
        {
          commitSha: 'def456',
          report: {
            regressions: [
              { stepText: 'login step', currentDuration: 1100, average: 800, slowdown: 300, percentage: 37.5 }
            ],
            ok: []
          }
        },
        {
          commitSha: 'ghi789',
          report: {
            regressions: [
              { stepText: 'login step', currentDuration: 1200, average: 800, slowdown: 400, percentage: 50 }
            ],
            ok: []
          }
        }
      ];
      
      const analysis = prIntelligence.analyzeMultiCommitPerformance(commitHistory, { regressions: [] });
      
      expect(analysis.type).toBe('multi-commit');
      expect(analysis.consistentRegressions).toHaveLength(1);
      expect(analysis.consistentRegressions[0].stepText).toBe('login step');
      expect(analysis.consistentRegressions[0].regressionCount).toBe(3);
      expect(analysis.consistentRegressions[0].consistencyScore).toBe(1.0);
    });

    it('should identify improvements across commits', () => {
      const commitHistory = [
        {
          commitSha: 'abc123',
          report: {
            regressions: [],
            ok: [
              { stepText: 'fast step', duration: 1000 }
            ]
          }
        },
        {
          commitSha: 'def456',
          report: {
            regressions: [],
            ok: [
              { stepText: 'fast step', duration: 900 }
            ]
          }
        },
        {
          commitSha: 'ghi789',
          report: {
            regressions: [],
            ok: [
              { stepText: 'fast step', duration: 800 }
            ]
          }
        }
      ];
      
      const analysis = prIntelligence.analyzeMultiCommitPerformance(commitHistory, { regressions: [] });
      
      expect(analysis.type).toBe('multi-commit');
      expect(analysis.improvements).toHaveLength(1);
      expect(analysis.improvements[0].stepText).toBe('fast step');
      expect(analysis.improvements[0].improvement).toBeGreaterThan(0);
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate multi-commit confidence based on various factors', () => {
      const analysis = {
        consistentRegressions: [
          { 
            consistencyScore: 0.8, 
            regressionCount: 3,
            commits: [
              { context: { tags: ['@auth'] } },
              { context: { tags: ['@auth'] } },
              { context: { tags: ['@auth'] } }
            ]
          },
          { 
            consistencyScore: 0.6, 
            regressionCount: 2,
            commits: [
              { context: { tags: ['@smoke'] } },
              { context: { tags: ['@smoke'] } }
            ]
          }
        ]
      };
      
      const commitHistory = Array(5).fill().map((_, i) => ({ commitSha: `commit${i}` }));
      
      const confidence = prIntelligence.calculateMultiCommitConfidence(analysis, commitHistory);
      
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should calculate regression confidence score', () => {
      const regression = {
        stepText: 'test step',
        currentDuration: 1000,
        average: 800,
        slowdown: 200,
        percentage: 25,
        stdDev: 50,
        context: { tags: ['@critical'] }
      };
      
      const stepHistory = [800, 810, 820, 950, 1000];
      const prHistory = [
        { report: { regressions: [{ stepText: 'test step' }] } },
        { report: { regressions: [{ stepText: 'test step' }] } }
      ];
      
      const confidence = prIntelligence.calculateRegressionConfidence(regression, stepHistory, prHistory);
      
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should calculate PR context factor for critical regressions', () => {
      const regression = {
        stepText: 'critical step',
        percentage: 30,
        context: { tags: ['@critical'] }
      };
      
      const prHistory = [
        { report: { regressions: [{ stepText: 'critical step' }] } },
        { report: { regressions: [{ stepText: 'critical step' }] } }
      ];
      
      const factor = prIntelligence.calculatePRContextFactor(regression, prHistory);
      
      expect(factor).toBeGreaterThan(0.5);
      expect(factor).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Pattern Detection', () => {
    it('should detect critical path regression patterns', () => {
      const analysis = {
        consistentRegressions: [
          {
            stepText: 'critical step 1',
            commits: [
              { context: { tags: ['@critical'] } },
              { context: { tags: ['@critical'] } }
            ]
          },
          {
            stepText: 'critical step 2',
            commits: [
              { context: { tags: ['@critical'] } },
              { context: { tags: ['@critical'] } }
            ]
          }
        ]
      };
      
      const patternScore = prIntelligence.detectPatterns(analysis);
      
      expect(patternScore).toBeGreaterThan(0.3);
    });

    it('should detect escalating performance degradation', () => {
      const analysis = {
        consistentRegressions: [
          {
            stepText: 'degrading step',
            commits: [
              { duration: 800 },
              { duration: 900 },
              { duration: 1000 }
            ]
          }
        ]
      };
      
      const patternScore = prIntelligence.detectPatterns(analysis);
      
      expect(patternScore).toBeGreaterThan(0.0);
    });
  });

  describe('False Positive Reduction', () => {
    beforeEach(() => {
      prIntelligence = new PRIntelligence({
        falsePositiveReduction: true,
        confidenceThreshold: 0.7
      });
    });

    it('should filter out low-confidence regressions', () => {
      const regressions = [
        { stepText: 'high confidence', currentDuration: 1000, percentage: 30, stdDev: 10 },
        { stepText: 'low confidence', currentDuration: 60, percentage: 15, stdDev: 20 }
      ];
      
      const filtered = prIntelligence.applyFalsePositiveReduction(regressions, 0.5);
      
      expect(filtered).toHaveLength(0); // Both filtered due to low confidence
    });

    it('should keep high-confidence regressions', () => {
      const regressions = [
        { stepText: 'high confidence', currentDuration: 1000, percentage: 30, stdDev: 10 },
        { stepText: 'medium confidence', currentDuration: 200, percentage: 25, stdDev: 15 }
      ];
      
      const filtered = prIntelligence.applyFalsePositiveReduction(regressions, 0.8);
      
      expect(filtered).toHaveLength(2);
    });

    it('should filter out noisy small regressions', () => {
      const regressions = [
        { stepText: 'noisy step', currentDuration: 100, percentage: 8, stdDev: 15, slowdown: 8 },
        { stepText: 'clear regression', currentDuration: 1000, percentage: 25, stdDev: 20, slowdown: 200 }
      ];
      
      const filtered = prIntelligence.applyFalsePositiveReduction(regressions, 0.8);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].stepText).toBe('clear regression');
    });
  });

  describe('PR Summary Generation', () => {
    it('should generate comprehensive PR summary', () => {
      const prAnalysis = {
        prContext: { prNumber: '123', commitSha: 'abc123' },
        lifecycle: { state: 'review', phase: 'code-review' },
        multiCommitAnalysis: {
          type: 'multi-commit',
          totalCommits: 3,
          consistentRegressions: [{ stepText: 'slow step' }],
          improvements: [{ stepText: 'fast step' }]
        },
        confidence: 0.8
      };
      
      const currentReport = {
        regressions: [{ stepText: 'current regression' }]
      };
      
      const summary = prIntelligence.generatePRSummary(prAnalysis, currentReport);
      
      expect(summary.prContext.prNumber).toBe('123');
      expect(summary.lifecycle.state).toBe('review');
      expect(summary.summary.totalCommits).toBe(3);
      expect(summary.summary.consistentRegressions).toBe(1);
      expect(summary.summary.improvements).toBe(1);
      expect(summary.summary.currentRegressions).toBe(1);
      expect(summary.recommendations).toBeDefined();
    });

    it('should calculate health trends correctly', () => {
      // Test declining trend
      let prAnalysis = {
        multiCommitAnalysis: {
          type: 'multi-commit',
          consistentRegressions: [1, 2, 3],
          improvements: [1]
        }
      };
      
      expect(prIntelligence.calculateHealthTrend(prAnalysis)).toBe('declining');
      
      // Test improving trend
      prAnalysis = {
        multiCommitAnalysis: {
          type: 'multi-commit',
          consistentRegressions: [1],
          improvements: [1, 2, 3]
        }
      };
      
      expect(prIntelligence.calculateHealthTrend(prAnalysis)).toBe('improving');
      
      // Test stable trend
      prAnalysis = {
        multiCommitAnalysis: {
          type: 'multi-commit',
          consistentRegressions: [1, 2],
          improvements: [1, 2]
        }
      };
      
      expect(prIntelligence.calculateHealthTrend(prAnalysis)).toBe('stable');
    });
  });

  describe('PR Recommendations', () => {
    it('should generate recommendations for consistent regressions', () => {
      const prAnalysis = {
        multiCommitAnalysis: {
          consistentRegressions: [
            { stepText: 'slow step 1' },
            { stepText: 'slow step 2' }
          ]
        },
        confidence: 0.8,
        lifecycle: { state: 'review' }
      };
      
      const recommendations = prIntelligence.generatePRRecommendations(prAnalysis, { regressions: [] });
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].priority).toBe('high');
      expect(recommendations[0].category).toBe('pr-regressions');
      expect(recommendations[0].message).toContain('2 steps showing consistent regressions');
    });

    it('should generate recommendations for low confidence', () => {
      const prAnalysis = {
        multiCommitAnalysis: { consistentRegressions: [] },
        confidence: 0.5,
        lifecycle: { state: 'review' }
      };
      
      const recommendations = prIntelligence.generatePRRecommendations(prAnalysis, { regressions: [] });
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].priority).toBe('medium');
      expect(recommendations[0].category).toBe('data-quality');
      expect(recommendations[0].message).toContain('Low confidence');
    });

    it('should generate recommendations for draft PRs with regressions', () => {
      const prAnalysis = {
        multiCommitAnalysis: { consistentRegressions: [] },
        confidence: 0.8,
        lifecycle: { state: 'draft' }
      };
      
      const recommendations = prIntelligence.generatePRRecommendations(prAnalysis, { 
        regressions: [{ stepText: 'test regression' }] 
      });
      
      expect(recommendations).toHaveLength(1);
      expect(recommendations[0].priority).toBe('low');
      expect(recommendations[0].category).toBe('draft-pr');
      expect(recommendations[0].message).toContain('Performance regressions detected in draft PR');
    });
  });

  describe('Full PR Performance Analysis', () => {
    it('should perform complete PR performance analysis', () => {
      process.env.GITHUB_PR_NUMBER = '456';
      process.env.GITHUB_SHA = 'def456';
      process.env.GITHUB_HEAD_REF = 'feature/complete-analysis';
      process.env.GITHUB_ACTIONS = 'true';
      process.env.GITHUB_EVENT_NAME = 'pull_request';
      
      const currentReport = {
        regressions: [
          { stepText: 'regression step', currentDuration: 1000, average: 800, slowdown: 200, percentage: 25, stdDev: 50 }
        ],
        ok: [],
        newSteps: []
      };
      
      const prHistory = [
        {
          commitSha: 'abc123',
          report: {
            regressions: [{ stepText: 'regression step' }],
            ok: []
          }
        },
        {
          commitSha: 'def456',
          report: {
            regressions: [{ stepText: 'regression step' }],
            ok: []
          }
        }
      ];
      
      const currentContext = {
        testFile: 'test.feature',
        suite: 'integration'
      };
      
      const result = prIntelligence.analyzePRPerformance(currentReport, prHistory, currentContext);
      
      expect(result.prContext.prNumber).toBe('456');
      expect(result.multiCommitAnalysis.type).toBe('multi-commit');
      expect(result.enhancedRegressions).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.enhancedReport).toBeDefined();
      expect(result.enhancedReport.prIntelligence).toBeDefined();
    });
  });
}); 
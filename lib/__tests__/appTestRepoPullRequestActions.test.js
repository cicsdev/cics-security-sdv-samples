/*
 *  Copyright IBM Corp. 2024
 */
const fetch = require('node-fetch');
const nock = require('nock');

const {
  Probot, ProbotOctokit
} = require('probot');

globalThis.fetch = fetch;

const sdvApprovalApp = require('../app');

const getRouter = () => ({
  use: jest.fn(),
  get: jest.fn()
});

describe('App/Test Repository Pull Request event tests', () => {
  let probot;

  const reposOwner = 'cics-sdv';
  const appTestsRepoName = 'galasa-tests-repo';
  const appTestHeadRef = 'newBranchChange';
  const securityRepoName = 'application-security';
  const appTestPrNumber = 12;
  const securityPrNumber = 86;
  const appTestHeadSha = 'abcd1234';

  const sdvConfigYaml = `security_repo_owner: ${reposOwner}\nsecurity_repo_name: ${securityRepoName}`;

  beforeEach(async () => {
    nock.disableNetConnect();

    probot = new Probot({
      githubToken: 'test',
      // Disable throttling & retrying requests for easier testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false }
      })
    });
    sdvApprovalApp(probot, { getRouter });
  });

  /*
    When this happens, no action is taken in GHE
   */
  test('Application/Test PR - is opened', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  });

  test('Application/Test PR - is closed, with existing Security PR', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide pulls list on Security Repo
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?state=open&head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, [
        {
          number: securityPrNumber
        }
      ]);

    // Mock the patch to close the security PR
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`, {
        state: 'closed'
      })
      .reply(200);

    // Mock the patch to create close comment in Security PR
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/issues/${securityPrNumber}/comments`, {
        body: 'Closed due to corresponding app/test PR being closed without merge.'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'closed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  });

  /*
    When this happens, the bot attempts to close any
    open Security PR
   */
  test('Application/Test PR - is closed, with no existing Security PR', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide pulls list on Security Repo
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?state=open&head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, []);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'closed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  });

  /*
    When this happens, no action is taken. GHE will restart a fresh pipeline
   */
  test('Application/Test PR - is reopened', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  });

  /*
    When this happens, an auto merge attempt will be conducted
   */
  test('Application/Test PR - is approved, Security PR is NOT approved', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide source PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
        head: {
          ref: appTestHeadRef
        },
        base: {
          ref: 'main'
        },
        mergeable_state: 'has_hooks'
      });

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide Security PR branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, {
        name: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
      });

    // Provide Security PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, [
        {
          number: securityPrNumber
        }
      ]);

    // Provide Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        state: 'open',
        draft: false,
        mergeable_state: 'blocked'
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, an auto merge attempt will be conducted for both PRs
   */
  test('Application/Test PR - is approved, Security PR IS approved', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide source PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
        head: {
          ref: appTestHeadRef
        },
        base: {
          ref: 'main'
        },
        mergeable_state: 'has_hooks'
      });

    // Provide Security PR branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, {
        name: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
      });

    // Provide Security PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, [
        {
          number: securityPrNumber
        }
      ]);

    // Provide Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        state: 'open',
        draft: false,
        mergeable_state: 'has_hooks'
      });

    // Merge App/Test & Security PR
    nock('https://api.github.com')
      .put(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}/merge`)
      .reply(200);

    nock('https://api.github.com')
      .put(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/merge`)
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, an auto merge attempt will be conducted for app/Test PR
   */
  test('Application/Test PR - is approved, but no security branch exists due to zero deltas found', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide source PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
        head: {
          ref: appTestHeadRef
        },
        base: {
          ref: 'main'
        },
        mergeable_state: 'has_hooks'
      });

    // Provide Security PR branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(404);

    // Get checks for App/Test PR ref
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadSha}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [
          {
            id: '1',
            conclusion: 'success'
          }
        ],
        total_count: 1
      });

    // Merge App/Test & Security PR
    nock('https://api.github.com')
      .put(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}/merge`)
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          }
        },
        base: {
          ref: 'main'
        }
      }
    });
  }, 10000);

  /*
    When this happens, an auto merge attempt will not happen
   */
  test('Application/Test PR - is approved, but no security branch exists and the Security check is still in_progress due to bad state', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide source PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
        head: {
          ref: appTestHeadRef
        },
        base: {
          ref: 'main'
        },
        mergeable_state: 'has_hooks'
      });

    // Provide Security PR branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(404);

    // Get checks for App/Test PR ref
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadSha}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [
          {
            id: '1',
            status: 'in_progress'
          }
        ],
        total_count: 1
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, an auto merge attempt will be conducted for app/Test PR
   */
  test('Application/Test PR - is approved, but although security branch exists, there is no PR', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide source PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
        head: {
          ref: appTestHeadRef
        },
        base: {
          ref: 'main'
        },
        mergeable_state: 'has_hooks'
      });

    // Provide Security PR branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, {
        name: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
      });

    // Provide Security PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, []);

    // Get checks for App/Test PR ref
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadSha}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [
          {
            id: '1',
            conclusion: 'success'
          }
        ],
        total_count: 1
      });

    // Merge App/Test & Security PR
    nock('https://api.github.com')
      .put(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}/merge`)
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, an auto merge attempt will not happen as we don't know the state.
    You would expect the Security check to still be in_progress
   */
  test('Application/Test PR - is approved, but although security branch exists, there is no PR due to some horrible state', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide source PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
        head: {
          ref: appTestHeadRef
        },
        base: {
          ref: 'main'
        },
        mergeable_state: 'has_hooks'
      });

    // Provide Security PR branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, {
        name: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
      });

    // Provide Security PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, []);

    // Get checks for App/Test PR ref
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadSha}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [
          {
            id: '1',
            status: 'in_progress'
          }
        ],
        total_count: 1
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
   */
  test('Application/Test PR - is rejected', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide source PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
        head: {
          ref: appTestHeadRef
        },
        base: {
          ref: 'main'
        },
        mergeable_state: 'blocked'
      });

    // Provide Security PR branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, {
        name: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
      });

    // Provide Security PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, []);

    // Get checks for App/Test PR ref
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadSha}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [
          {
            id: '1',
            conclusion: 'success'
          }
        ],
        total_count: 1
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
   */
  test('Application/Test PR - is commented on type 1', async () => {
    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review_comment',
      payload: {
        action: 'created',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
   */
  test('Application/Test PR - comment thread resolved', async () => {
    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review_thread',
      payload: {
        action: 'resolved',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, it closes any currently open Security PR. It will expect
    the security branch to be force pushed with new upcoming updates
  */
  test('Application/Test PR - has update branch button pressed / new commit pushed', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide Security PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?state=open&head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, [
        {
          number: securityPrNumber
        }
      ]);

    // Update Security PR to closed
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`, {
        state: 'closed'
      })
      .reply(200);

    // Add comment to Security PR indicating why
    // it has been closed
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/issues/${securityPrNumber}/comments`, {
        body: 'Closed due to corresponding app/test PR being updated with new code commit, which may change security.\n\nA new Security will be created, if required.'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'synchronize',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: false,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, an existing Security PR is closed
  */
  test('Application/Test PR - has demote to draft button pressed', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide Security PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?state=open&head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, [
        {
          number: securityPrNumber
        }
      ]);

    // Update Security PR to closed
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`, {
        state: 'closed'
      })
      .reply(200);

    // Add comment to Security PR indicating why
    // it has been closed
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/issues/${securityPrNumber}/comments`, {
        body: 'Closed due to corresponding app/test PR being moved to a draft state.'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'converted_to_draft',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: false,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Application/Test PR - has promote from draft button pressed', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'ready_for_review',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: false,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Application/Test PR - has review dismissed', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Provide source PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
        head: {
          ref: appTestHeadRef
        },
        base: {
          ref: 'main'
        },
        mergeable_state: 'blocked'
      });

    // Provide Security PR branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, {
        name: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
      });

    // Provide Security PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, []);

    // Get checks for App/Test PR ref
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadSha}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [
          {
            id: '1',
            conclusion: 'success'
          }
        ],
        total_count: 1
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'dismissed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: false,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Application/Test PR - An action on a PR which is already merged', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'ready_for_review',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: false,
          merged: true,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Application/Test PR - No config exists', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(404);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: false,
          merged: true,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Application/Test PR - PR has a new push, but is in draft state', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'synchronize',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: true,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Application/Test PR - PR is opened, but is in draft state', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: true,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Application/Test PR - PR is reopened, but is in draft state', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: true,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'main'
          }
        }
      }
    });
  }, 10000);

  /*
    No action.
  */
  test('Application/Test PR - PR is closed, but target branch does not have Security as a required check', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test someOddBranch branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/someOddBranch`)
      .reply(200, {
        name: 'someOddBranch',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: []
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'closed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: false,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'someOddBranch'
          }
        }
      }
    });
  }, 10000);

  /*
    Do nothing, let the CI pipeline deal with everything.
  */
  test('Application/Test PR - PR is reopened, but target branch does not have Security as a required check', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/someOddBranch`)
      .reply(200, {
        name: 'someOddBranch',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: []
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          merged: false,
          head: {
            ref: appTestHeadRef
          },
          base: {
            ref: 'someOddBranch'
          }
        }
      }
    });
  }, 10000);

  /*
    Do nothing, target branch doesn't have 'Security' as a required check,
    so SDV is switched off, so there shouldn't be a related Security PR.
  */
  test('Application/Test PR - PR has new push, but target branch does not have Security as a required check', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/someOddBranch`)
      .reply(200, {
        name: 'someOddBranch',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: []
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'synchronize',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: false,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'someOddBranch'
          }
        }
      }
    });
  }, 10000);

  /*
    Do nothing, target branch doesn't have 'Security' as a required check,
    so SDV is switched off, so there shouldn't be a related Security PR.
  */
  test('Application/Test PR - PR is converted to draft, but target branch does not have Security as a required check', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/someOddBranch`)
      .reply(200, {
        name: 'someOddBranch',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: []
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'converted_to_draft',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: false,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'someOddBranch'
          }
        }
      }
    });
  }, 10000);

  /*
    Do nothing, CI pipeline will handle things
  */
  test('Application/Test PR - PR is promoted from draft, but target branch does not have Security as a required check', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test main branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/someOddBranch`)
      .reply(200, {
        name: 'someOddBranch',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: []
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'ready_for_review',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: appTestPrNumber,
          draft: false,
          merged: false,
          head: {
            ref: appTestHeadRef,
            sha: appTestHeadSha
          },
          base: {
            ref: 'someOddBranch'
          }
        }
      }
    });
  }, 10000);

  afterEach(() => {
    if (!nock.isDone()) {
      throw new Error(
        `Not all nock interceptors were used: ${JSON.stringify(
          nock.pendingMocks()
        )}`
      );
    }

    nock.cleanAll();
    nock.enableNetConnect();
  });
});

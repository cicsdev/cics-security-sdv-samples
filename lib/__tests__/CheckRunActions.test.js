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

describe('Check run event tests.', () => {
  let probot;

  const reposOwner = 'cics-sdv';
  const appTestsRepoName = 'galasa-tests-repo';
  const appTestHeadRef = 'newBranchChange';
  const securityRepoName = 'application-security';
  const appTestPrNumber = 12;
  const securityPrNumber = 86;
  const appTestHeadSha = 'abcd1234';
  const securityHeadSha = 'blah78657';
  const securityPrUrl = 'http://github.com/123';

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
    if a check run completes on the app/test PR, but the
    Security check has not, no actions should be taken
  */
  test('App/Test PR - A non-Security check run completes and branch protection is blocking due to Security not passing yet', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get App/Test PR Object
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
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Build',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: appTestHeadRef
          },
          pull_requests: [
            {
              number: appTestPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    If by chance an app/test PR check finishes after the Security check passes,
    and nothing has merged, it should attempt to auto merge.
  */
  test('App/Test PR - A non-Security check run completes and Security check & all others have passed, and not already merged', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get App/Test PR Object
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

    // Provide Security branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, {
        name: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
      });

    // Get Security PR list
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
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Build',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: appTestHeadRef
          },
          pull_requests: [
            {
              number: appTestPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    If by chance an app/test PR check finishes after the Security check passes,
    and the PRs are already merged, it should not try to merge again.
  */
  test('App/Test PR - A non-Security check run completes and Security check & all others have passed, but is already merged', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get App/Test PR Object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
        merged: true,
        head: {
          ref: appTestHeadRef
        },
        base: {
          ref: 'main'
        },
        mergeable_state: ''
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

    // Provide Security branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, {
        name: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
      });

    // Get Security PR list
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
        merged: true,
        mergeable_state: ''
      });

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Build',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: appTestHeadRef
          },
          pull_requests: [
            {
              number: appTestPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    This should auto merge.
  */
  test('App/Test PR - The Security check run completes for a feature branch PR, and all other checks passed', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get App/Test PR Object
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

    // Provide Security branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, {
        name: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
      });

    // Get Security PR list
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
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Security',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: appTestHeadRef
          },
          pull_requests: [
            {
              number: appTestPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    If the Security PR is raised against the app/test default branch, there is
    no app/test PR. Therefore, if Security check passes on the commit, reviews
    have approved it, so merge Security PR without a matching app/test PR.
  */
  test('App/Test PR - The Security check run completes for an overnight build on the default branch, and all other checks pass', async () => {
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

    // Get Security PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2Fmain`)
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

    // Merge Security PR
    nock('https://api.github.com')
      .put(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/merge`)
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Security',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: 'main'
          },
          pull_requests: []
        }
      }
    });
  }, 10000);

  /*
    If the Security check fails, don't take any action
  */
  test('App/Test PR - The Security check run fails for an overnight build on the default branch, and all other checks pass', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Security',
          conclusion: 'failed',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: 'main'
          },
          pull_requests: []
        }
      }
    });
  }, 10000);

  /*
    If a user sets up checks on the Security repo, checks should be made to see
    if it is auto mergable when those checks complete.
  */
  test('Security PR - A random Check passes for feature branch PR, but required reviews have not yet been approved', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        state: 'open',
        draft: false,
        mergeable_state: 'blocked',
        html_url: securityPrUrl,
        head: {
          ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
        }
      });

    // Provide app/test branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`
      });

    // Get App/Test PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?head=${reposOwner}%3A${appTestHeadRef}`)
      .reply(200, [
        {
          number: appTestPrNumber,
          base: {
            ref: 'main'
          }
        }
      ]);

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

    // Get App/Test PR Object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
        mergeable_state: 'has_hooks',
        base: {
          ref: 'main'
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'RandomCheck',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
          },
          pull_requests: [
            {
              number: securityPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    If a user sets up checks on the Security repo, checks should be made to see
    if it is auto mergable when those checks complete.
  */
  test('Security PR - A random Check passes for feature branch PR, and approving required review present', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        state: 'open',
        draft: false,
        mergeable_state: 'has_hooks',
        html_url: securityPrUrl,
        head: {
          ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
        }
      });

    // Provide app/test branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`
      });

    // Get App/Test PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?head=${reposOwner}%3A${appTestHeadRef}`)
      .reply(200, [
        {
          number: appTestPrNumber,
          base: {
            ref: 'main'
          }
        }
      ]);

    // Get App/Test PR Object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: false,
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

    // Merge App/Test & Security PR
    nock('https://api.github.com')
      .put(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}/merge`)
      .reply(200);
    nock('https://api.github.com')
      .put(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/merge`)
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'RandomCheck',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
          },
          pull_requests: [
            {
              number: securityPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    If a user sets up checks on the Security repo, checks should be made to see
    if it is auto mergable when those checks complete.
  */
  test('Security PR - A random Check passes for default branch PR, but required reviews have not yet been approved', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        state: 'open',
        draft: false,
        mergeable_state: 'blocked',
        html_url: securityPrUrl,
        head: {
          ref: `${reposOwner}/${appTestsRepoName}/main`
        }
      });

    // Provide app/test branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get App/Test PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?head=${reposOwner}%3Amain`)
      .reply(200, []);

    // Get app/test commit Security check
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadSha}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [
          {
            id: 123,
            status: 'in_progress'
          }
        ],
        total_count: 1
      });

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'RandomCheck',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
          },
          pull_requests: [
            {
              number: securityPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    If a user sets up checks on the Security repo, checks should be made to see
    if it is auto mergable when those checks complete.
  */
  test('Security PR - A random Check passes for default branch PR, and approving required review present', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        state: 'open',
        draft: false,
        mergeable_state: 'has_hooks',
        html_url: securityPrUrl,
        head: {
          ref: `${reposOwner}/${appTestsRepoName}/main`
        }
      });

    // Provide app/test branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/main`)
      .reply(200, {
        name: 'main',
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get App/Test PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?head=${reposOwner}%3Amain`)
      .reply(200, []);

    // Get app/test commit Security check
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadSha}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [
          {
            id: 123,
            status: 'in_progress'
          }
        ],
        total_count: 1
      });

    // Merge Security PR
    nock('https://api.github.com')
      .put(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/merge`)
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'RandomCheck',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
          },
          pull_requests: [
            {
              number: securityPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Security PR - No config exists', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(404);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'RandomCheck',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
          },
          pull_requests: [
            {
              number: securityPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    This would indicate that the repo has some form of checks on feature branches (a
    dev deployment of a feature branch perhaps?) and the dev has just pushed a commit
  */
  test('App/test PR - A random check passes for a feature branch with no PR', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Dev Deploy',
          conclusion: 'success',
          head_sha: 'aNewFeatureSha123',
          check_suite: {
            head_branch: 'aNewFeature'
          },
          pull_requests: []
        }
      }
    });
  }, 10000);

  /*
    A check completes but in draft state, no action taken
  */
  test('App/Test PR - A check run completes but PR is in draft state', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get App/Test PR Object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls/${appTestPrNumber}`)
      .reply(200, {
        number: appTestPrNumber,
        state: 'open',
        draft: true,
        head: {
          ref: appTestHeadRef
        },
        mergeable_state: 'has_hooks'
      });

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Build',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: appTestHeadRef
          },
          pull_requests: [
            {
              number: appTestPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    A check completes but in draft state, no action taken
  */
  test('Security PR - A check run completes but PR is in draft state', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get Security PR Object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        state: 'open',
        draft: true,
        head: {
          ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
          sha: securityHeadSha
        },
        mergeable_state: 'has_hooks'
      });

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Build',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
          },
          pull_requests: [
            {
              number: securityPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    Takes no action, this is a PR being merged to a branch where Security isn't required.
    The App/Test PR will have a skipped security check
  */
  test('App/test PR - A check run completes, but the target branch does not have Security as a required check', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get App/Test PR Object
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
          ref: 'someOddBranch'
        },
        mergeable_state: 'has_hooks'
      });

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
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Security',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: appTestHeadRef
          },
          pull_requests: [
            {
              number: appTestPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    This will merge as branch 1.0.0 has 'Security' as required check on branch protection
  */
  test('App/test PR - A check run completes on overnight release branch 1.0.0, which has Security as a required check', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide App/Test 1.0.0 branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/1.0.0`)
      .reply(200, {
        name: '1.0.0',
        protection: {
          enabled: true,
          required_status_checks: {
            checks: [
              {
                context: 'Build',
                app_id: null
              },
              {
                context: 'Test',
                app_id: null
              },
              {
                context: 'Security',
                app_id: null
              }
            ]
          }
        }
      });

    // Get Security PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls?head=${reposOwner}%3A${reposOwner}%2F${appTestsRepoName}%2F1%2E0%2E0`)
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

    // Merge Security PR
    nock('https://api.github.com')
      .put(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/merge`)
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Security',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: '1.0.0'
          },
          pull_requests: []
        }
      }
    });
  }, 10000);

  /*
    No action taken, the feature branch does not have branch protection turned on.
  */
  test('App/test PR - A check run completes on overnight build of feature branch, which has no branch protection', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Build',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: 'someOddBranch'
          },
          pull_requests: []
        }
      }
    });
  }, 10000);

  /*
    No action taken, the feature branch does not have 'Security' as a required check.
  */
  test('App/test PR - A check run completes on overnight build of a random branch, which has a form of branch protection, but Security is not required', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Build',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: 'someOddBranch'
          },
          pull_requests: []
        }
      }
    });
  }, 10000);

  /*
    No action taken, the feature branch does not have 'Security' as a required check.
  */
  test('App/test PR - A check run completes on overnight build of a random branch, which has a form of branch protection, but Security is not required - yet is somehow ran!', async () => {
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
            checks: [
              {
                context: 'Build',
                app_id: null
              },
              {
                context: 'Test',
                app_id: null
              }
            ]
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'Security',
          conclusion: 'success',
          head_sha: appTestHeadSha,
          check_suite: {
            head_branch: 'someOddBranch'
          },
          pull_requests: []
        }
      }
    });
  }, 10000);

  /*
    Nothing will happen because the target branch of the app/test
    PR does not have 'Security' as a required check
  */
  test('Security PR - A check run completes, but the target branch for the app/test PR does not have Security as a required check', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        state: 'open',
        draft: false,
        mergeable_state: 'has_hooks',
        html_url: securityPrUrl,
        head: {
          ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
        }
      });

    // Provide app/test branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`
      });

    // Get App/Test PR list
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?head=${reposOwner}%3A${appTestHeadRef}`)
      .reply(200, [
        {
          number: appTestPrNumber,
          base: {
            ref: 'someUnprotectedBranch'
          }
        }
      ]);

    // Provide App/Test someUnprotectedBranch branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/someUnprotectedBranch`)
      .reply(200, {
        name: 'someUnprotectedBranch',
        protection: {
          enabled: false,
          required_status_checks: {
            checks: []
          }
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'RandomCheck',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`
          },
          pull_requests: [
            {
              number: securityPrNumber
            }
          ]
        }
      }
    });
  }, 10000);

  /*
    Nothing happens, no processing is done for Security checks,
    unless part of a PR that can affect an app/test PR
  */
  test('Security PR - A check run completes, but is happening on a release branch, and app/test branch is branch protected', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'RandomCheck',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: `${reposOwner}/${appTestsRepoName}/1.0.0`
          },
          pull_requests: []
        }
      }
    });
  }, 10000);

  /*
    Does nothing, won't even get as far as checking the branch protection of the app/test PR target
    branch because we don't process checks on the security repo which aren't part of a PR
  */
  test('Security PR - A check run completes, but is happening on a random feature branch, and app/test branch is not branch protected', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'RandomCheck',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: 'userRandomBranch'
          },
          pull_requests: []
        }
      }
    });
  }, 10000);

  /*
    Does nothing, won't even get as far as checking the branch protection of the app/test PR target
    branch because we don't process checks on the security repo which aren't part of a PR
  */
  test('Security PR - A check run completes, but is happening on a random feature branch, with no corresponding app/test branch', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'RandomCheck',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: 'userRandomBranch'
          },
          pull_requests: []
        }
      }
    });
  }, 10000);

  /*
    It will get as far as seeing that a matching branch
    doesn't exist in the app/test repo, then exit
  */
  test('Security PR - A check run completes on a branch the sec admin as managed to manually create and be of the correct format, & then created a PR for', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Provide Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        state: 'open',
        draft: false,
        mergeable_state: 'has_hooks',
        html_url: securityPrUrl,
        head: {
          ref: 'cics-sdv/galasa-tests-repo/somethingWild'
        }
      });

    // Receive a webhook event
    await probot.receive({
      name: 'check_run',
      payload: {
        action: 'completed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        check_run: {
          name: 'RandomCheck',
          conclusion: 'success',
          head_sha: securityHeadSha,
          check_suite: {
            head_branch: 'cics-sdv/galasa-tests-repo/somethingWild'
          },
          pull_requests: [
            {
              number: securityPrNumber
            }
          ]
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

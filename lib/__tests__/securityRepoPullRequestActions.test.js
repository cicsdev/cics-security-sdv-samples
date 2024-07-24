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

describe('Security Repository Pull Request event tests', () => {
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
    When this happens, it should create a Security check
  */
  test('Security PR - is opened for a branch that is related to SDV and a Security check does not already exist.', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Create Security PR Up-To-Date Check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/check-runs`, {
        head_sha: securityHeadSha,
        name: 'Up-to-date',
        conclusion: 'success'
      })
      .reply(201);

    // Get AppTest Security Check
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadSha}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [],
        total_count: 0
      });

    // Created the Security Check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${appTestsRepoName}/check-runs`, {
        name: 'Security',
        head_sha: appTestHeadSha,
        status: 'in_progress',
        output: {
          title: 'Awaiting approval of security PR',
          summary: 'Awaiting approval of security PR'
        }
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          html_url: securityPrUrl,
          draft: false,
          merged: false,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, it should update the appTest PR Security check to in progress
  */
  test('Security PR - is opened for a branch that is related to SDV and a Security check does already exist.', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Create Security PR Up-To-Date Check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/check-runs`, {
        head_sha: securityHeadSha,
        name: 'Up-to-date',
        conclusion: 'success'
      })
      .reply(201);

    // Get AppTest Security Check
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

    // Created the Security Check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'in_progress',
        output: {
          title: 'Awaiting approval of security PR',
          summary: 'Awaiting approval of security PR'
        }
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          html_url: securityPrUrl,
          draft: false,
          merged: false,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken, this is happening
    outside the SDV process
  */
  test('Security PR - is opened for a non-SDV created branch', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          html_url: securityPrUrl,
          draft: false,
          merged: false,
          head: {
            ref: 'randomBranch',
            sha: 'gfghdghrdgrg'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken, this is happening
    outside the SDV process
  */
  test('Security PR - is closed and its NOT an SDV created PR.', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'closed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          html_url: securityPrUrl,
          draft: false,
          merged: false,
          head: {
            ref: 'randomBranch',
            sha: 'gfghdghrdgrg'
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, it should update the appTest PR Security check to failed
  */
  test('Security PR - is closed and it IS an SDV created PR.', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get AppTest PR Security Check
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

    // Close the Security Check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'completed',
        conclusion: 'failure',
        output: {
          title: 'Security PR closed',
          summary: 'Security PR closed'
        }
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'closed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          html_url: securityPrUrl,
          draft: false,
          merged: false,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, set app/test Security check to 'in progress' and waiting
  */
  test('Security PR - is reopened in draft WITH an associated app/test PR existing', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get pull request list from App/Test repo
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?state=open&head=${reposOwner}%3A${appTestHeadRef}`)
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

    // Create Up-to-date check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/check-runs`, {
        head_sha: securityHeadSha,
        name: 'Up-to-date',
        conclusion: 'success'
      })
      .reply(201);

    // Get Security Check on AppTest commit
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
            status: 'completed',
            conclusion: 'failure',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Create new check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${appTestsRepoName}/check-runs`, {
        head_sha: appTestHeadSha,
        name: 'Security',
        status: 'in_progress',
        output: {
          title: 'Awaiting full approval of security PR',
          summary: `The changes in this PR will result in a change of security usage.\n\nThe security changes found are currently awaiting a Security approval [here](${securityPrUrl}).\n\n#### Review status\nAwaiting for reviewers to be assigned.`
        }
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: true,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, set app/test Security check to 'in progress' and revaulates all
    existing reviews
  */
  test('Security PR - is reopened not in draft with no existing review comments, WITH an associated app/test PR existing', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get pull request list from App/Test repo
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?state=open&head=${reposOwner}%3A${appTestHeadRef}`)
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

    // Create Up-to-date check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/check-runs`, {
        head_sha: securityHeadSha,
        name: 'Up-to-date',
        conclusion: 'success'
      })
      .reply(201);

    // Get Security Check on AppTest commit
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
            status: 'completed',
            conclusion: 'failure',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [
          {
            id: '1',
            login: 'justADev'
          }
        ],
        teams: [
          {
            id: 2,
            name: 'security-admins'
          }
        ]
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, []);

    // Create new check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${appTestsRepoName}/check-runs`, {
        head_sha: appTestHeadSha,
        name: 'Security',
        status: 'in_progress',
        output: {
          title: 'Awaiting full approval of security PR',
          summary: `The changes in this PR will result in a change of security usage.\n\nThe security changes found are currently awaiting Security approval [here](${securityPrUrl}).\n\n#### Review status\n<table><tr><th> Reviewer </th> <th> Status </th> <th> Details </th> </tr>\n<tr><td> \n\nTeam: \`security-admins\` \n\n </td><td> \n\n:clock1:\n\n </td><td> Awaiting review... </td></tr>\n<tr><td> \n\n@justADev\n\n </td><td> \n\n:clock1:\n\n </td><td> Awaiting review... </td></tr>\n</table>\n`
        }
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, set app/test Security check to 'in progress' and revaulates all
    existing reviews
  */
  test('Security PR - is reopened not in draft state and with previous rejecting review comments, WITH an associated app/test PR existing', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get pull request list from App/Test repo
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?state=open&head=${reposOwner}%3A${appTestHeadRef}`)
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

    // Create Up-to-date check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/check-runs`, {
        head_sha: securityHeadSha,
        name: 'Up-to-date',
        conclusion: 'success'
      })
      .reply(201);

    // Get Security Check on AppTest commit
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
            status: 'completed',
            conclusion: 'failure',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [],
        teams: []
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, [
        {
          id: 123,
          user: {
            login: 'securityAdminUser'
          },
          body: 'bad change',
          state: 'CHANGES_REQUESTED'
        }
      ]);

    // Get comments for each review
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/123/comments`)
      .reply(200, [
        {
          id: 7657,
          body: 'this is the comment body of a bad change'
        }
      ]);

    // Update existing check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'completed',
        output: {
          title: 'Security reviewer concerns',
          summary: '#### Review status\n<table><tr><th> Reviewer </th> <th> Status </th> <th> Details </th> </tr>\n<tr><td> \n\n@securityAdminUser\n\n </td><td> \n\n:x:\n\n </td><td> \n\nbad change\n\n\n* this is the comment body of a bad change\n\n\n </td></tr>\n</table>\n'
        },
        conclusion: 'failure'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, set app/test Security check to 'in progress' and revaulates all
    existing reviews
  */
  test('Security PR - is reopened not in draft state and with previous approving review comments with all other checks passed, WITH an associated app/test PR existing', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get pull request list from App/Test repo
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?state=open&head=${reposOwner}%3A${appTestHeadRef}`)
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

    // Create Up-to-date check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/check-runs`, {
        head_sha: securityHeadSha,
        name: 'Up-to-date',
        conclusion: 'success'
      })
      .reply(201);

    // Get Security Check on AppTest commit
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
            status: 'completed',
            conclusion: 'failure',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [],
        teams: []
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, [
        {
          id: 123,
          user: {
            login: 'securityAdminUser'
          },
          body: 'great change',
          state: 'APPROVED'
        }
      ]);

    // Get comments for each review
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/123/comments`)
      .reply(200, [
        {
          id: 7657,
          body: 'this is the comment body of a great change'
        }
      ]);

    // Get Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        mergeable_state: 'has_hooks'
      });

    // Update existing check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'completed',
        output: {
          title: 'Security approved',
          summary: '#### Review status\n<table><tr><th> Reviewer </th> <th> Status </th> <th> Details </th> </tr>\n<tr><td> \n\n@securityAdminUser\n\n </td><td> \n\n:white_check_mark:\n\n </td><td> \n\ngreat change\n\n* this is the comment body of a great change\n\n\n </td></tr>\n</table>\n'
        },
        conclusion: 'success'
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Security PR - is reopened not in draft state and with previous approving review comments WITHOUT all other checks passed, WITH an associated app/test PR existing', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get pull request list from App/Test repo
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?state=open&head=${reposOwner}%3A${appTestHeadRef}`)
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

    // Create Up-to-date check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/check-runs`, {
        head_sha: securityHeadSha,
        name: 'Up-to-date',
        conclusion: 'success'
      })
      .reply(201);

    // Get Security Check on AppTest commit
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
            status: 'completed',
            conclusion: 'failure',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [],
        teams: []
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, [
        {
          id: 123,
          user: {
            login: 'securityAdminUser'
          },
          body: 'great change',
          state: 'APPROVED'
        }
      ]);

    // Get comments for each review
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/123/comments`)
      .reply(200, [
        {
          id: 7657,
          body: 'this is the comment body of a great change'
        }
      ]);

    // Get Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        mergeable_state: 'blocked'
      });

    // Update existing check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${appTestsRepoName}/check-runs`, {
        name: 'Security',
        head_sha: appTestHeadSha,
        status: 'in_progress',
        output: {
          title: 'Awaiting full approval of security PR',
          summary: `The changes in this PR will result in a change of security usage.\n\nThe security changes found are currently awaiting a Security approval [here](${securityPrUrl}).\n\n#### Review status\nAwaiting for reviewers to be assigned.`
        }
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, if there is no matching App/Test PR, then the security
    PR just reopened is useless. Immediately close it again.
  */
  test('Security PR - is reopened WITHOUT an associated app/test PR existing', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get pull request list from App/Test repo
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?state=open&head=${reposOwner}%3A${appTestHeadRef}`)
      .reply(200, []);

    // Close Security PR
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`, {
        state: 'closed'
      })
      .reply(200);

    // Add comment to Security PR
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/issues/${securityPrNumber}/comments`, {
        body: 'Closed due to no corresponding open app/test PR existing requiring review.'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Security PR - an approved review is submitted with App/Test PR Security check waiting.', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get App/Test PR Security check
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
            status: 'in_progress',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [],
        teams: []
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, [
        {
          id: 123,
          user: {
            login: 'securityAdminUser'
          },
          body: 'great change',
          state: 'APPROVED'
        }
      ]);

    // Get comments for each review
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/123/comments`)
      .reply(200, [
        {
          id: 7657,
          body: 'this is the comment body of a great change'
        }
      ]);

    // Get Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        mergeable_state: 'has_hooks'
      });

    // Update existing check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'completed',
        output: {
          title: 'Security approved',
          summary: '#### Review status\n<table><tr><th> Reviewer </th> <th> Status </th> <th> Details </th> </tr>\n<tr><td> \n\n@securityAdminUser\n\n </td><td> \n\n:white_check_mark:\n\n </td><td> \n\ngreat change\n\n* this is the comment body of a great change\n\n\n </td></tr>\n</table>\n'
        },
        conclusion: 'success'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, the App/Test PR Security check should still be failed,
    however, the check text will display the reviews from both users.
  */
  test('Security PR - an approved review is submitted with App/Test PR Security check waiting, but with an existing rejected review by another user.', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get App/Test PR Security check
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
            status: 'in_progress',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [],
        teams: []
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, [
        {
          id: 123,
          user: {
            login: 'securityAdminUser'
          },
          body: 'great change',
          state: 'APPROVED'
        },
        {
          id: 6546,
          user: {
            login: 'SecondSecurityAdminUser'
          },
          body: 'bad change',
          state: 'CHANGES_REQUESTED'
        }
      ]);

    // Get comments for each review
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/123/comments`)
      .reply(200, [
        {
          id: 7657,
          body: 'this is the comment body of a great change'
        }
      ]);
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/6546/comments`)
      .reply(200, [
        {
          id: 754747,
          body: 'this needs serious work'
        }
      ]);

    // Update existing check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'completed',
        output: {
          title: 'Security reviewer concerns',
          summary: '#### Review status\n<table><tr><th> Reviewer </th> <th> Status </th> <th> Details </th> </tr>\n<tr><td> \n\n@SecondSecurityAdminUser\n\n </td><td> \n\n:x:\n\n </td><td> \n\nbad change\n\n\n* this needs serious work\n\n\n </td></tr>\n<tr><td> \n\n@securityAdminUser\n\n </td><td> \n\n:white_check_mark:\n\n </td><td> \n\ngreat change\n\n* this is the comment body of a great change\n\n\n </td></tr>\n</table>\n'
        },
        conclusion: 'failure'
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, the App/Test PR Security check should pass,
    the previous rejected review should be considered old, thus ignored.
  */
  test('Security PR - an approved review is submitted with App/Test PR Security check waiting, but a rejected review by the same user exists.', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get App/Test PR Security check
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
            status: 'in_progress',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [],
        teams: []
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, [
        {
          id: 6546,
          user: {
            login: 'securityAdminUser'
          },
          body: 'bad change',
          state: 'CHANGES_REQUESTED'
        },
        {
          id: 123,
          user: {
            login: 'securityAdminUser'
          },
          body: 'great change',
          state: 'APPROVED'
        }
      ]);

    // Get comments for each review
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/123/comments`)
      .reply(200, [
        {
          id: 7657,
          body: 'this is the comment body of a great change'
        }
      ]);

    // Get Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        mergeable_state: 'has_hooks'
      });

    // Update existing check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'completed',
        output: {
          title: 'Security approved',
          summary: '#### Review status\n<table><tr><th> Reviewer </th> <th> Status </th> <th> Details </th> </tr>\n<tr><td> \n\n@securityAdminUser\n\n </td><td> \n\n:white_check_mark:\n\n </td><td> \n\ngreat change\n\n* this is the comment body of a great change\n\n\n </td></tr>\n</table>\n'
        },
        conclusion: 'success'
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, the App/Test PR Security check should fail,
    the previous approved review should be considered old, thus ignored.
  */
  test('Security PR - a rejected review is submitted with App/Test PR Security check waiting, but an approved review by the same user exists.', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get App/Test PR Security check
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
            status: 'in_progress',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [],
        teams: []
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, [
        {
          id: 123,
          user: {
            login: 'securityAdminUser'
          },
          body: 'great change',
          state: 'APPROVED'
        },
        {
          id: 6546,
          user: {
            login: 'securityAdminUser'
          },
          body: 'bad change',
          state: 'CHANGES_REQUESTED'
        }
      ]);

    // Get comments for each review
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/6546/comments`)
      .reply(200, [
        {
          id: 6546,
          body: 'this is the comment body of a bad change'
        }
      ]);

    // Update existing check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'completed',
        output: {
          title: 'Security reviewer concerns',
          summary: '#### Review status\n<table><tr><th> Reviewer </th> <th> Status </th> <th> Details </th> </tr>\n<tr><td> \n\n@securityAdminUser\n\n </td><td> \n\n:x:\n\n </td><td> \n\nbad change\n\n\n* this is the comment body of a bad change\n\n\n </td></tr>\n</table>\n'
        },
        conclusion: 'failure'
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, the App/Test PR Security check should fail,
    the check text shows all the review information for all users.
  */
  test('Security PR - an rejected review is submitted with App/Test PR Security check waiting, with many other rejected reviews by other users.', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get App/Test PR Security check
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
            status: 'in_progress',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [],
        teams: []
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, [
        {
          id: 123,
          user: {
            login: 'securityAdminUser'
          },
          body: 'bad change',
          state: 'CHANGES_REQUESTED'
        },
        {
          id: 6546,
          user: {
            login: 'secondSecurityAdminUser'
          },
          body: 'bad change 2',
          state: 'CHANGES_REQUESTED'
        },
        {
          id: 76575,
          user: {
            login: 'thirdSecurityAdminUser'
          },
          body: 'bad change 3',
          state: 'CHANGES_REQUESTED'
        }
      ]);

    // Get comments for each review
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/6546/comments`)
      .reply(200, [
        {
          id: 6546,
          body: 'this is the comment body of a bad change 2'
        }
      ]);
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/123/comments`)
      .reply(200, [
        {
          id: 654734,
          body: 'this is the comment body of a bad change'
        }
      ]);
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews/76575/comments`)
      .reply(200, [
        {
          id: 654752534,
          body: 'this is the comment body of a bad change 3'
        }
      ]);

    // Update existing check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'completed',
        output: {
          title: 'Security reviewer concerns',
          summary: '#### Review status\n<table><tr><th> Reviewer </th> <th> Status </th> <th> Details </th> </tr>\n<tr><td> \n\n@securityAdminUser\n\n </td><td> \n\n:x:\n\n </td><td> \n\nbad change\n\n\n* this is the comment body of a bad change\n\n\n </td></tr>\n<tr><td> \n\n@secondSecurityAdminUser\n\n </td><td> \n\n:x:\n\n </td><td> \n\nbad change 2\n\n\n* this is the comment body of a bad change 2\n\n\n </td></tr>\n<tr><td> \n\n@thirdSecurityAdminUser\n\n </td><td> \n\n:x:\n\n </td><td> \n\nbad change 3\n\n\n* this is the comment body of a bad change 3\n\n\n </td></tr>\n</table>\n'
        },
        conclusion: 'failure'
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken. A full review is the only
    way comments are send back to the app/test PR.
  */
  test('Security PR - is commented on', async () => {
    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review_comment',
      payload: {
        action: 'created',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          merged: false,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  });

  /*
    When this happens, no action is taken
  */
  test('Security PR - has update branch button pressed/commit pushed', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Create Security PR Up-To-Date Check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/check-runs`, {
        head_sha: securityHeadSha,
        name: 'Up-to-date',
        conclusion: 'success'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'synchronize',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          merged: false,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Security PR - has demote to draft button pressed', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'converted_to_draft',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, it will reassess the review status based on any
    previously existing reviews. If there are none, it makes the Security
    check 'in progress'.
  */
  test('Security PR - has promote from draft button pressed, and app/test branch exists', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Create Security PR Up-To-Date Check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/check-runs`, {
        head_sha: securityHeadSha,
        name: 'Up-to-date',
        conclusion: 'success'
      })
      .reply(201);

    // Get Security Check on AppTest commit
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
            status: 'in_progress',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [],
        teams: []
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, []);

    // Get Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        mergeable_state: 'blocked'
      });

    // Update existing check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'in_progress',
        output: {
          title: 'Awaiting full approval of security PR',
          summary: `The changes in this PR will result in a change of security usage.\n\nThe security changes found are currently awaiting a Security approval [here](${securityPrUrl}).\n\n#### Review status\nAwaiting for reviewers to be assigned.`
        }
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'ready_for_review',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, it will immediately close the Security PR.
  */
  test('Security PR - has promote from draft button pressed, but no app/test branch exists', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(404);

    // Close Security PR
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`, {
        state: 'closed'
      })
      .reply(200);

    // Create comment on the Security PR
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/issues/${securityPrNumber}/comments`, {
        body: 'Closed due to no corresponding app/test branch existing.'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'ready_for_review',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, it will reasses the Security check status
    by rechecking remaining reviews, there are none, therefore updates
    the app/test PR Security checked from Failed to in progress.
  */
  test('Security PR - has a sole rejected review dismissed', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get Security Check on AppTest commit
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
            status: 'completed',
            conclusion: 'failed',
            head_sha: appTestHeadSha
          }
        ],
        total_count: 1
      });

    // Get list of requested reviewers on the Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/requested_reviewers`)
      .reply(200, {
        users: [],
        teams: []
      });

    // Get list of reviews against Security PR
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}/reviews`)
      .reply(200, [
        {
          id: 123,
          user: {
            login: 'securityAdminUser'
          },
          body: 'bad change',
          state: 'DISMISSED'
        }
      ]);

    // Get Security PR object
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`)
      .reply(200, {
        number: securityPrNumber,
        mergeable_state: 'blocked'
      });

    // Update existing check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${appTestsRepoName}/check-runs`, {
        name: 'Security',
        head_sha: appTestHeadSha,
        status: 'in_progress',
        output: {
          title: 'Awaiting full approval of security PR',
          summary: 'The changes in this PR will result in a change of security usage.\n\nThe security changes found are currently awaiting a Security approval [here](http://github.com/123).\n\n#### Review status\nAwaiting for reviewers to be assigned.'
        }
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'dismissed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  });

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
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: true,
          head: {
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, it will immediately close the Security PR.
  */
  test('Security PR - PR is opened with no matching branch, but in draft state', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(404);

    // Close Security PR
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`, {
        state: 'closed'
      })
      .reply(200);

    // Create comment on the Security PR
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/issues/${securityPrNumber}/comments`, {
        body: 'Closed due to no corresponding app/test branch existing.'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: true,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, it will immediately close the Security PR.
  */
  test('Security PR - PR is reopened with no matching branch, but in draft state', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(404);

    // Close Security PR
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${securityRepoName}/pulls/${securityPrNumber}`, {
        state: 'closed'
      })
      .reply(200);

    // Create comment on the Security PR
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/issues/${securityPrNumber}/comments`, {
        body: 'Closed due to no corresponding app/test branch existing.'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: true,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, it will immediately close the Security PR.
  */
  test('Security PR - PR is reopened with a matching branch, but in draft state', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get pull request list from App/Test repo
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?state=open&head=${reposOwner}%3A${appTestHeadRef}`)
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

    // Create Security PR Up-To-Date Check
    nock('https://api.github.com')
      .post(`/repos/${reposOwner}/${securityRepoName}/check-runs`, {
        head_sha: securityHeadSha,
        name: 'Up-to-date',
        conclusion: 'success'
      })
      .reply(201);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'reopened',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: true,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('Security PR - an approved review is submitted with PR in draft state.', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request_review',
      payload: {
        action: 'submitted',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: true,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    Nothing happens, the 'Security' check is not required on
    the app/test PR target branch, so SDV process is not active.
  */
  test('Security PR - PR is reopened, but the target branch for the app/test PR does not have Security as a required check', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get pull request list from App/Test repo
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/pulls?state=open&head=${reposOwner}%3A${appTestHeadRef}`)
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
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          draft: false,
          merged: false,
          html_url: securityPrUrl,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
          }
        }
      }
    });
  }, 10000);

  /*
    This should never happen, but it could if someone wanted to break
    things, either way, a skipped 'Security' check indicates that the
    'Security' check is not set as required on the target branch.
    Therefore, don't take any action.
  */
  test('Security PR - PR is closed, but the app/test PR has its Security check as skipped', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/branches/${appTestHeadRef}`)
      .reply(200, {
        name: `${appTestHeadRef}`,
        commit: {
          sha: appTestHeadSha
        }
      });

    // Get AppTest PR Security Check
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
            status: 'completed',
            conclusion: 'skipped'
          }
        ],
        total_count: 1
      });

    // Receive a webhook event
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'closed',
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        },
        pull_request: {
          number: securityPrNumber,
          html_url: securityPrUrl,
          draft: false,
          merged: false,
          head: {
            ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
            sha: securityHeadSha
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

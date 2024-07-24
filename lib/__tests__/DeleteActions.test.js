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

describe('Delete event tests.', () => {
  let probot;

  const reposOwner = 'cics-sdv';
  const appTestsRepoName = 'galasa-tests-repo';
  const appTestHeadRef = 'newBranchChange';
  const securityRepoName = 'application-security';
  // const appTestPrNumber = 12;
  // const securityPrNumber = 86;
  // const appTestHeadSha = 'abcd1234';
  const securityHeadSha = 'blah78657';
  // const securityPrUrl = 'http://github.com/123';

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
    Deleting the app/test branch at any point, should simply
    delete the assoicated Security branch, if it exists.
  */
  test('App/Test - Delete feature branch', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get Security branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(200, {
        name: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
        commit: {
          sha: securityHeadSha
        }
      });

    // Delete Security branch
    nock('https://api.github.com')
      .delete(`/repos/${reposOwner}/${securityRepoName}/git/refs/heads%2F${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(204);

    // Receive a webhook event
    await probot.receive({
      name: 'delete',
      payload: {
        ref_type: 'branch',
        ref: appTestHeadRef,
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        }
      }
    });
  }, 10000);

  /*
    Deleting the app/test branch at any point, should simply
    delete the assoicated Security branch, if it exists.
  */
  test('App/Test - Delete feature branch, but no Security branch exists', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get Security branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2F${appTestHeadRef}`)
      .reply(404);

    // Receive a webhook event
    await probot.receive({
      name: 'delete',
      payload: {
        ref_type: 'branch',
        ref: appTestHeadRef,
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        }
      }
    });
  }, 10000);

  /*
    If the Security branch is deleted, if there are any associated app/test PRs,
    their Security checks should fail
  */
  test('Security PR - Delete feature branch with associated app/test PR live & Security check in_progress', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest Security Check
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadRef}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [
          {
            id: 1,
            status: 'in_progress'
          }
        ],
        total_count: 1
      });

    // Created the Security Check
    nock('https://api.github.com')
      .patch(`/repos/${reposOwner}/${appTestsRepoName}/check-runs/1`, {
        status: 'completed',
        conclusion: 'failure',
        output: {
          title: 'Security PR closed',
          summary: 'Security PR closed due to removed associated branch.'
        }
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({
      name: 'delete',
      payload: {
        ref_type: 'branch',
        ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        }
      }
    });
  }, 10000);

  /*
    When this happens, no action is taken
  */
  test('App/Test PR - No config exists', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(404);

    // Receive a webhook event
    await probot.receive({
      name: 'delete',
      payload: {
        ref_type: 'branch',
        ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
          }
        }
      }
    });
  }, 10000);

  /*
    Deleting a branch not linked to a PR, could be a dev simplying deleting a
    feature branch they've done nothing with, so no action should be taken.
  */
  test('App/Test - Delete feature branch with no linked PR', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get Security branch
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/branches/${reposOwner}%2F${appTestsRepoName}%2FaRandomNewFeature`)
      .reply(404);

    // Receive a webhook event
    await probot.receive({
      name: 'delete',
      payload: {
        ref_type: 'branch',
        ref: 'aRandomNewFeature',
        repository: {
          name: appTestsRepoName,
          owner: {
            login: reposOwner
          }
        }
      }
    });
  }, 10000);

  /*
    Security check is skipped, and remains skipped.
  */
  test('Security PR - Deleted branch, but the app/test PR has a "skipped" Security check', async () => {
    // Provide sdvapproval.yml
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${securityRepoName}/contents/.github%2Fsdvapproval.yml`)
      .matchHeader('accept', 'application/vnd.github.v3.raw')
      .reply(200, sdvConfigYaml);

    // Get AppTest Security Check
    nock('https://api.github.com')
      .get(`/repos/${reposOwner}/${appTestsRepoName}/commits/${appTestHeadRef}/check-runs`)
      .query({
        check_name: 'Security',
        filter: 'latest'
      })
      .reply(200, {
        check_runs: [
          {
            id: 1,
            status: 'completed',
            conclusion: 'skipped'
          }
        ],
        total_count: 1
      });

    // Receive a webhook event
    await probot.receive({
      name: 'delete',
      payload: {
        ref_type: 'branch',
        ref: `${reposOwner}/${appTestsRepoName}/${appTestHeadRef}`,
        repository: {
          name: securityRepoName,
          owner: {
            login: reposOwner
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

/*
 *  Copyright IBM Corp. 2024
 */
const {
  GITHUB_SECURITY_BRANCH_REGEX
} = require('../common/constants');

const {
  updateSecurityApprovalBasedOnReviews,
  resetSecurityCheckToWaiting
} = require('../common/reviewProcessing');

async function processSecurityPrAction(app, context) {
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;
  const headSha = context.payload.pull_request.head.sha;
  const prNumber = context.payload.pull_request.number;
  const securityPrUrl = context.payload.pull_request.html_url;

  const logData = {
    owner,
    repo,
    prNumber,
    headSha
  };

  app.log.debug(logData, 'SECURITY PR WEBHOOK RECEIVED:\n');

  // Only process if this is a PR that is not already merged
  if (!context.payload.pull_request.merged) {
    // Check branch name follows standard, if not, ignore
    if (context.payload.pull_request.head.ref.match(GITHUB_SECURITY_BRANCH_REGEX)) {
      const appTestRepoOwner = context.payload.pull_request.head.ref.split('/')[0];
      const appTestRepoName = context.payload.pull_request.head.ref.split('/')[1];
      const appTestRepoBranch = context.payload.pull_request.head.ref.split('/')[2];

      // Check branch exists in app/test repo
      let appTestBranch = null;
      try {
        appTestBranch = await context.octokit.repos.getBranch({
          owner: appTestRepoOwner,
          repo: appTestRepoName,
          branch: appTestRepoBranch
        })
          .then((result) => result.data);
      } catch (exception) {
        app.log.debug(logData, `Branch ${appTestRepoBranch} not found in repo ${appTestRepoOwner}/${appTestRepoName}`);
      }

      try {
        switch (context.payload.action) {
          case 'opened': {
            // Security PR is opened.
            // The check should already be put in place by the app / test pipeline,
            // but incase not, ths code will update an existing one to the correct
            // state, or will create one if there isn't one.

            // Firstly, there must be a matching app / test branch,
            // if there isn't, close this Security PR.
            if (appTestBranch) {
              // Create 'up-to-date' check
              await context.octokit.rest.checks.create({
                owner,
                repo,
                head_sha: headSha,
                name: 'Up-to-date',
                conclusion: 'success'
              });

              // Security checks shouldn't be updated when the PR is in a draft state
              if (!context.payload.pull_request.draft) {
                // Get App/Test repo PR Security check ID
                let appTestCheckRun = null;
                try {
                  appTestCheckRun = await context.octokit.rest.checks.listForRef({
                    owner: appTestRepoOwner,
                    repo: appTestRepoName,
                    ref: appTestBranch.commit.sha,
                    check_name: process.env.CHECK_NAME,
                    filter: 'latest'
                  })
                    .then((result) => {
                      if (result.data.total_count > 0) {
                        return result.data.check_runs[0];
                      }
                      return null;
                    });
                } catch (e) {
                  app.log.debug(logData, `Could not find checks or branch for ${appTestRepoOwner}/${appTestRepoName} - ${appTestRepoBranch}`);
                }

                if (appTestCheckRun && !appTestCheckRun.conclusion) {
                  // Update Security check in app/test repo PR
                  await context.octokit.checks.update({
                    mediaType: {
                      previews: ['antiope-preview']
                    },
                    owner: appTestRepoOwner,
                    repo: appTestRepoName,
                    check_run_id: appTestCheckRun.id,
                    status: 'in_progress',
                    output: {
                      title: 'Awaiting approval of security PR',
                      summary: 'Awaiting approval of security PR'
                    }
                  });
                } else {
                  // Create Security check in app/test repo PR
                  await context.octokit.checks.create({
                    name: process.env.CHECK_NAME,
                    mediaType: {
                      previews: ['antiope-preview']
                    },
                    owner: appTestRepoOwner,
                    repo: appTestRepoName,
                    head_sha: appTestBranch.commit.sha,
                    status: 'in_progress',
                    output: {
                      title: 'Awaiting approval of security PR',
                      summary: 'Awaiting approval of security PR'
                    }
                  });
                }
              }
            } else {
              // There is no matching app / test PR for this Security PR,
              // So close it.
              await context.octokit.pulls.update({
                owner,
                repo,
                pull_number: prNumber,
                state: 'closed'
              });
              await context.octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: prNumber,
                body: 'Closed due to no corresponding app/test branch existing.'
              });
            }
            break;
          }
          case 'closed': {
            // If the Security Repo PR has been closed, regardless of any approvals,
            // the security metadata changes will not be commited to the repo, therefore
            // the app/test PR should have its Security check failed, to stop
            // the app/test code changes from being merged.

            if (appTestBranch) {
              // Get App/Test repo PR Security check ID
              let appTestCheckRun = null;
              try {
                appTestCheckRun = await context.octokit.rest.checks.listForRef({
                  owner: appTestRepoOwner,
                  repo: appTestRepoName,
                  ref: appTestBranch.commit.sha,
                  check_name: process.env.CHECK_NAME,
                  filter: 'latest'
                })
                  .then((result) => {
                    if (result.data.total_count > 0) {
                      return result.data.check_runs[0];
                    }
                    return null;
                  });
              } catch (e) {
                app.log.debug(logData, `Could not find checks or branch for ${appTestRepoOwner}/${appTestRepoName} - ${appTestRepoBranch}`);
              }

              // Fail Security check in app/test repo PR
              if (appTestCheckRun && appTestCheckRun.conclusion !== 'skipped') {
                await context.octokit.checks.update({
                  mediaType: {
                    previews: ['antiope-preview']
                  },
                  owner: appTestRepoOwner,
                  repo: appTestRepoName,
                  check_run_id: appTestCheckRun.id,
                  status: 'completed',
                  conclusion: 'failure',
                  output: {
                    title: 'Security PR closed',
                    summary: 'Security PR closed'
                  }
                });
              }
            }
            break;
          }
          case 'reopened': {
            // If a Security repo PR is re-opened from a closed state, its possible it still
            // contains approvals on the commit therefore the app/test PR should have a Security
            // Approval check approved.
            // If there are no existing approvals, the app/test PR should have a Security check
            // created as 'in progress'.
            // If the Security repo PR is re-opened, yet there is no corresponding app/test
            // PR any more, security metadata may be commited that isn't true. In this case it
            // should likely be immediately closed again.

            if (appTestBranch) {
              // If there is no open associated app /test PR,
              // then immediately close.
              const appTestOpenPullRequest = await context.octokit.pulls.list({
                owner: appTestRepoOwner,
                repo: appTestRepoName,
                state: 'open',
                head: `${appTestRepoOwner}:${appTestBranch.name}`
              })
                .then((result) => {
                  if (result.data.length > 0) {
                    return result.data[0];
                  }
                  return null;
                });

              if (appTestOpenPullRequest) {
                // Does the target branch of the app/Test PR have 'Security' as a
                // required check on the branch protection? If not, then don't do
                // anything & exit
                let appTestTargetBranchInfo = null;
                if (appTestBranch) {
                  try {
                    appTestTargetBranchInfo = await context.octokit.repos.getBranch({
                      owner: appTestRepoOwner,
                      repo: appTestRepoName,
                      branch: appTestOpenPullRequest.base.ref
                    })
                      .then((result) => result.data);
                  } catch (exception) {
                    app.log.debug(logData, `Branch ${appTestOpenPullRequest.base.ref} not found in repo ${appTestRepoOwner}/${appTestRepoName}`);
                  }
                }

                if (appTestTargetBranchInfo
                  && appTestTargetBranchInfo.protection.enabled
                  && appTestTargetBranchInfo.protection.required_status_checks.checks.some(
                    (e) => e.context === process.env.CHECK_NAME
                  )
                ) {
                  // Create 'up-to-date' check
                  await context.octokit.rest.checks.create({
                    owner,
                    repo,
                    head_sha: headSha,
                    name: 'Up-to-date',
                    conclusion: 'success'
                  });
                  if (!context.payload.pull_request.draft) {
                    await updateSecurityApprovalBasedOnReviews(
                      app,
                      context,
                      owner,
                      repo,
                      prNumber,
                      appTestRepoOwner,
                      appTestRepoName,
                      appTestBranch.commit.sha,
                      securityPrUrl
                    );
                  } else {
                    // if reopening a draft, simply reopen the security check
                    // but don't re-evaulate Security check status. That will
                    // be done when it comes out of draft
                    await resetSecurityCheckToWaiting(
                      app,
                      context,
                      appTestRepoOwner,
                      appTestRepoName,
                      appTestBranch.commit.sha,
                      securityPrUrl
                    );
                  }
                } else {
                  app.log.debug(logData, 'Skipping, app/test PR target branch does not have necessary branch protection.');
                }
              } else {
                // There is no matching app / test PR for this Security PR,
                // So close it.
                await context.octokit.pulls.update({
                  owner,
                  repo,
                  pull_number: prNumber,
                  state: 'closed'
                });
                await context.octokit.rest.issues.createComment({
                  owner,
                  repo,
                  issue_number: prNumber,
                  body: 'Closed due to no corresponding open app/test PR existing requiring review.'
                });
              }
            } else {
              // There is no matching app / test PR for this Security PR,
              // So close it.
              await context.octokit.pulls.update({
                owner,
                repo,
                pull_number: prNumber,
                state: 'closed'
              });
              await context.octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: prNumber,
                body: 'Closed due to no corresponding app/test branch existing.'
              });
            }
            break;
          }
          case 'synchronize': {
            // This could be caused by:
            // 1. the Security Admin delivering a change on the branch
            // 2. as a result of another Security PR merging, the 'Update branch'
            //    button was pressed to update the Security PR.
            // 3. the app / test pipeline has ran again and has force pushed the latest updates
            //
            // In either of these cases we don't want to do anything, reasoning for each:
            // 1. They shouldn't do this, and if they do, it will cause a Security PR
            //    when 'main' runs to reverse it.
            // 2. As a result of other PRs merging, it means the app code has changed,
            //    the app PR should rebuild again when the 'Update Branch' button is pressed.
            //    Causing the Security PR to immediately close, and a new PR be created later.
            // 3. This is fine. do nothing

            // Despite the above, if a new commit is pushed, the
            // Up-To-Date check should pass, otherwise the PR cannot
            // merge
            if (appTestBranch) {
              // Create 'up-to-date' check
              await context.octokit.rest.checks.create({
                owner,
                repo,
                head_sha: headSha,
                name: 'Up-to-date',
                conclusion: 'success'
              });
            }
            break;
          }
          case 'converted_to_draft':
            // Do nothing
            break;
          case 'ready_for_review':
            if (appTestBranch) {
              // Create 'up-to-date' check
              await context.octokit.rest.checks.create({
                owner,
                repo,
                head_sha: headSha,
                name: 'Up-to-date',
                conclusion: 'success'
              });

              await updateSecurityApprovalBasedOnReviews(
                app,
                context,
                owner,
                repo,
                prNumber,
                appTestRepoOwner,
                appTestRepoName,
                appTestBranch.commit.sha,
                securityPrUrl
              );
            } else {
              // There is no matching app / test PR for this Security PR,
              // So close it.
              await context.octokit.pulls.update({
                owner,
                repo,
                pull_number: prNumber,
                state: 'closed'
              });
              await context.octokit.rest.issues.createComment({
                owner,
                repo,
                issue_number: prNumber,
                body: 'Closed due to no corresponding app/test branch existing.'
              });
            }
            break;
          default:
            // Do nothing
            break;
        }
      } catch (exception) {
        app.log.error(logData, exception.stack);

        throw exception;
      }

      app.log.debug(logData, 'SUCCESSFULLY COMPLETED SECURITY PR WEBHOOK');
    } else {
      app.log.debug(logData, 'Skipping, branch naming convention doest follow standrd for SDV.');
    }
  } else {
    app.log.debug(logData, 'Skipping, this PR is already merged.');
  }
}

module.exports = {
  processSecurityPrAction
};

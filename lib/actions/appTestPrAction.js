/*
 *  Copyright IBM Corp. 2024
 */
async function processAppTestPrAction(app, context, config) {
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;
  const branch = context.payload.pull_request.head.ref;
  const prNumber = context.payload.pull_request.number;
  const targetBranch = context.payload.pull_request.base.ref;

  const logData = {
    owner,
    repo,
    prNumber,
    branch
  };

  try {
    app.log.debug(logData, 'APP/TEST PR REVIEW WEBHOOK RECEIVED:\n');

    // Get branch protection info of target
    let appTestTargetBranchInfo = null;
    try {
      appTestTargetBranchInfo = await context.octokit.repos.getBranch({
        owner,
        repo,
        branch: targetBranch
      })
        .then((result) => result.data);
    } catch (exception) {
      app.log.debug(logData, `Branch ${targetBranch} not found in repo ${owner}/${repo}`);
    }

    // Only process if target branch has the 'Security' check
    // set to 'required' on branch protection
    if (appTestTargetBranchInfo
        && appTestTargetBranchInfo.protection.enabled
        && appTestTargetBranchInfo.protection.required_status_checks.checks.some(
          (e) => e.context === process.env.CHECK_NAME
        )
    ) {
      // Only process if this is a PR that isn't already
      // merged.
      if (!context.payload.pull_request.merged) {
        switch (context.payload.action) {
          case 'closed': {
            // The App or Test Pr has been closed.
            // This could have been manually done by a user, or
            // happened as part of the merge of a PR.
            // Try to close any related Security PR.
            app.log.debug(logData, `'close' action for pull request ${prNumber} intercepted.`);

            // Check PR exists in security repo
            let securityPR = null;
            try {
              securityPR = await context.octokit.pulls.list({
                owner: config.security_repo_owner,
                repo: config.security_repo_name,
                state: 'open',
                head: `${config.security_repo_owner}:${owner}/${repo}/${branch}`
              })
                .then((result) => {
                  if (result.data.length > 0) {
                    return result.data[0];
                  }
                  return null;
                });
            } catch (exception) {
              app.log.debug(logData, `No open Security PR found for branch ${owner}/${repo}/${branch}`);
            }

            if (securityPR) {
              // Close security PR
              await context.octokit.pulls.update({
                owner: config.security_repo_owner,
                repo: config.security_repo_name,
                pull_number: securityPR.number,
                state: 'closed'
              });

              // Add comment
              await context.octokit.rest.issues.createComment({
                owner: config.security_repo_owner,
                repo: config.security_repo_name,
                issue_number: securityPR.number,
                body: 'Closed due to corresponding app/test PR being closed without merge.'
              });
            }
            break;
          }
          case 'reopened': {
            // If an App or Test PR is reopened, do nothing.
            // The pipeline for the PR will re-run all checks, including
            // a new Security check, which will recreate a Security PR if
            // required.
            // Trying to reopen a related Security PR would just cause problems &
            // is pointless.
            // i.e. the security PR may contain stale data, & the Sec Admin may
            // approve it, only to be overwritten by the new Security that will run as
            // part of the build.
            app.log.debug(logData, `'reopened' action for pull request ${prNumber} intercepted.`);
            break;
          }
          case 'synchronize':
            // If a user adds a new commit to their App or Test PR, or
            // clicks 'Update Branch' because it is behind, it immediately
            // invalidates any assoicated, open Security PR.
            // In which case, just close any associated Security PR, and let the
            // new build run a new Security check, which will create a fresh Security PR
            // with updated data.
            app.log.debug(logData, `'synchronise' action for pull request ${prNumber} intercepted.`);

            if (!context.payload.pull_request.draft) {
              let securityPR = null;
              try {
                securityPR = await context.octokit.pulls.list({
                  owner: config.security_repo_owner,
                  repo: config.security_repo_name,
                  state: 'open',
                  head: `${config.security_repo_owner}:${owner}/${repo}/${branch}`
                })
                  .then((result) => {
                    if (result.data.length > 0) {
                      return result.data[0];
                    }
                    return null;
                  });
              } catch (exception) {
                app.log.debug(logData, `No open Security PR found for branch ${owner}/${repo}/${branch}`);
              }

              if (securityPR) {
                // Close security PR
                await context.octokit.pulls.update({
                  owner: config.security_repo_owner,
                  repo: config.security_repo_name,
                  pull_number: securityPR.number,
                  state: 'closed'
                });

                // Add comment
                await context.octokit.rest.issues.createComment({
                  owner: config.security_repo_owner,
                  repo: config.security_repo_name,
                  issue_number: securityPR.number,
                  body: 'Closed due to corresponding app/test PR being updated with new code commit, which may change security.\n\nA new Security will be created, if required.'
                });
              }
            } else {
              app.log.debug(logData, 'Skipping, this PR is a draft.');
            }
            break;
          case 'converted_to_draft': {
            // A user has downgraded their App or Test PR to a draft.
            // Getting a Sec Admin to review its security now is pointless, so
            // close any associated Security PR.
            // When the user takes their PR out of draft, the pipeline will
            // run a new Security check and will create a new Security PR if required.
            app.log.debug(logData, `'converted_to_draft' action for pull request ${prNumber} intercepted.`);

            // Check PR exists in security repo
            let securityPR = null;
            try {
              securityPR = await context.octokit.pulls.list({
                owner: config.security_repo_owner,
                repo: config.security_repo_name,
                state: 'open',
                head: `${config.security_repo_owner}:${owner}/${repo}/${branch}`
              })
                .then((result) => {
                  if (result.data.length > 0) {
                    return result.data[0];
                  }
                  return null;
                });
            } catch (exception) {
              app.log.debug(logData, `No open Security PR found for branch ${owner}/${repo}/${branch}`);
            }

            if (securityPR) {
              // Close security PR
              await context.octokit.pulls.update({
                owner: config.security_repo_owner,
                repo: config.security_repo_name,
                pull_number: securityPR.number,
                state: 'closed'
              });

              // Add comment
              await context.octokit.rest.issues.createComment({
                owner: config.security_repo_owner,
                repo: config.security_repo_name,
                issue_number: securityPR.number,
                body: 'Closed due to corresponding app/test PR being moved to a draft state.'
              });
            }
            break;
          }
          case 'ready_for_review':
            // Do nothing, the App or Test pipeline will run a new Security check.
            app.log.debug(logData, `'ready_for_review' action for pull request ${prNumber} intercepted.`);
            break;
          default:
            // Do nothing
        }
      } else {
        app.log.debug(logData, 'Skipping, this PR is already merged.');
      }
    } else {
      app.log.debug(logData, 'Skipping, target branch does not have necessary branch protection.');
    }

    app.log.debug(logData, 'SUCCESSFULLY COMPLETED APP/TEST PR WEBHOOK');
  } catch (exception) {
    app.log.error(logData, exception.stack);

    throw exception;
  }
}

module.exports = {
  processAppTestPrAction
};

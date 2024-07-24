/*
 *  Copyright IBM Corp. 2024
 */
const {
  GITHUB_SECURITY_BRANCH_REGEX
} = require('../common/constants');

async function autoMerge(app, context, config) {
  const sourceOwner = context.payload.repository.owner.login;
  const sourceRepo = context.payload.repository.name;
  let targetOwner = null;
  let targetRepo = null;

  let sourcePrNumber = null;

  if (context.payload.pull_request) {
    sourcePrNumber = context.payload.pull_request.number;
  } else if (context.payload.check_run.pull_requests.length > 0) {
    sourcePrNumber = context.payload.check_run.pull_requests[0].number;
  }

  if (sourcePrNumber) {
    const sourceHeadSha = (context.payload.pull_request)
      ? context.payload.pull_request.head.sha
      : context.payload.check_run.head_sha;

    app.log.debug({}, 'Attempting to auto-merge app/test and corresponding Security PRs...');

    let targetPrObj = null;
    const sourcePrObj = await context.octokit.pulls.get({
      owner: sourceOwner,
      repo: sourceRepo,
      pull_number: sourcePrNumber
    })
      .then((result) => {
        if (result.data) {
          return result.data;
        }
        return null;
      });

    if (sourcePrObj && sourcePrObj.state === 'open') {
      const logData = {
        owner: sourceOwner,
        repo: sourceRepo,
        sourcePrNumber,
        sourceHeadSha
      };

      if (!sourcePrObj.draft) {
        if (sourceOwner === config.security_repo_owner
            && sourceRepo === config.security_repo_name) {
          // This is a Security repo hook

          // does branch follow standard?
          if (sourcePrObj.head.ref.match(GITHUB_SECURITY_BRANCH_REGEX)) {
            [targetOwner, targetRepo] = sourcePrObj.head.ref.split('/');
            const targetBranch = sourcePrObj.head.ref.split('/')[2];

            // Does branch exist for corresponding repo?
            let appTestBranch = null;
            try {
              appTestBranch = await context.octokit.repos.getBranch({
                owner: targetOwner,
                repo: targetRepo,
                branch: targetBranch
              })
                .then((result) => result.data);
            } catch (exception) {
              app.log.debug(logData, `Branch ${targetBranch} not found in repo ${targetOwner}/${targetRepo}`);
            }

            if (appTestBranch) {
              // get PR obj for app/test repo
              targetPrObj = await context.octokit.pulls.list({
                owner: targetOwner,
                repo: targetRepo,
                head: `${targetOwner}:${appTestBranch.name}`
              })
                .then((result) => {
                  if (result.data.length > 0) {
                    return result.data[0];
                  }
                  return null;
                });
              if (targetPrObj) {
                // Does the target branch of the app/Test PR have 'Security' as a
                // required check on the branch protection? If not, then don't do
                // anything & exit
                let appTestTargetBranch = null;
                try {
                  appTestTargetBranch = await context.octokit.repos.getBranch({
                    owner: targetOwner,
                    repo: targetRepo,
                    branch: targetPrObj.base.ref
                  })
                    .then((result) => result.data);
                } catch (exception) {
                  app.log.debug(logData, `Branch ${targetPrObj.base.ref} not found in repo ${targetOwner}/${targetRepo}`);
                }

                if (appTestTargetBranch
                  && appTestTargetBranch.protection.enabled
                  && appTestTargetBranch.protection.required_status_checks.checks.some(
                    (e) => e.context === process.env.CHECK_NAME
                  )
                ) {
                  // Get a more detailed PR object that contains the
                  // mergable_state attribute
                  targetPrObj = await context.octokit.pulls.get({
                    owner: targetOwner,
                    repo: targetRepo,
                    pull_number: targetPrObj.number
                  })
                    .then((result) => result.data);
                } else {
                  targetPrObj = null;
                  app.log.debug(logData, 'Skipping, app/test PR target branch does not have necessary branch protection.');
                }
              } else {
                // This is could potentially be an approved Security PR
                // against the default branch via an overnight run.
                // If it is approved, then just merge without worrying about
                // a corresponding app/test PR to merge also, though, update
                // the commit Security check!

                let appTestSecurityApprovalCheckRun = null;
                try {
                  appTestSecurityApprovalCheckRun = await context
                    .octokit.rest.checks.listForRef({
                      owner: targetOwner,
                      repo: targetRepo,
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
                  app.log.debug(logData, `Could not find checks or branch for ${targetOwner}/${targetRepo} - ${appTestBranch.commit.sha}`);
                }

                if (appTestSecurityApprovalCheckRun) {
                  if (['clean', 'has_hooks', 'unstable'].includes(sourcePrObj.mergeable_state)) {
                    // Merge PR
                    try {
                      await context.octokit.rest.pulls.merge({
                        owner: sourceOwner,
                        repo: sourceRepo,
                        pull_number: sourcePrObj.number
                      });
                      return;
                    } catch (e) {
                      app.log.error({}, 'Could not merge PR', e);
                      throw e;
                    }
                  }
                }
              }
            }
          }
        } else {
          // App/test repo hook

          // Does the target branch of this app/Test PR have 'Security' as a
          // required check on the branch protection? If not, don't do anything
          // and exit
          let appTestTargetBranch = null;
          try {
            appTestTargetBranch = await context.octokit.repos.getBranch({
              owner: sourceOwner,
              repo: sourceRepo,
              branch: sourcePrObj.base.ref
            })
              .then((result) => result.data);
          } catch (exception) {
            app.log.debug(logData, `Branch ${sourcePrObj.base.ref} not found in repo ${sourceOwner}/${sourceRepo}`);
          }

          if (appTestTargetBranch && appTestTargetBranch.protection.enabled
            && appTestTargetBranch.protection.required_status_checks.checks.some(
              (e) => e.context === process.env.CHECK_NAME
            )
          ) {
            targetOwner = config.security_repo_owner;
            targetRepo = config.security_repo_name;

            // Does branch exist for corresponding repo?
            let securityBranch = null;
            try {
              securityBranch = await context.octokit.repos.getBranch({
                owner: targetOwner,
                repo: targetRepo,
                branch: `${sourceOwner}/${sourceRepo}/${sourcePrObj.head.ref}`
              })
                .then((result) => result.data);
            } catch (exception) {
              app.log.debug(logData, `Branch ${securityBranch} not found in repo ${targetOwner}/${targetRepo}`);
            }

            if (securityBranch) {
              // get PR obj for Security repo
              targetPrObj = await context.octokit.pulls.list({
                owner: targetOwner,
                repo: targetRepo,
                head: `${targetOwner}:${securityBranch.name}`
              })
                .then((result) => {
                  if (result.data.length > 0) {
                    return result.data[0];
                  }
                  return null;
                });
              if (targetPrObj) {
                targetPrObj = await context.octokit.pulls.get({
                  owner: targetOwner,
                  repo: targetRepo,
                  pull_number: targetPrObj.number
                })
                  .then((result) => result.data);
              } else {
                // There isn't a security PR for this, but the Security check passed on the app/test
                // Merge it.
                let appTestSecurityApprovalCheckRun = null;
                try {
                  appTestSecurityApprovalCheckRun = await context
                    .octokit.rest.checks.listForRef({
                      owner: sourceOwner,
                      repo: sourceRepo,
                      ref: sourceHeadSha,
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
                  app.log.debug(logData, `Could not find checks or branch for ${sourceRepo}/${sourceRepo} - ${sourceHeadSha}`);
                }

                if (appTestSecurityApprovalCheckRun && appTestSecurityApprovalCheckRun.conclusion === 'success') {
                  if (['clean', 'has_hooks', 'unstable'].includes(sourcePrObj.mergeable_state)) {
                    // Merge PR
                    try {
                      await context.octokit.rest.pulls.merge({
                        owner: sourceOwner,
                        repo: sourceRepo,
                        pull_number: sourcePrObj.number
                      });
                      return;
                    } catch (e) {
                      app.log.error({}, 'Could not merge PR', e);
                      throw e;
                    }
                  }
                }
              }
            } else {
              // This app/test PR doesn't have an associated PR in Security.
              // If however, if the app PR has a Security Check and is approved,
              // it means a security check was made but no changes were found.
              // The app/test PR should be merged.
              let appTestSecurityApprovalCheckRun = null;
              try {
                appTestSecurityApprovalCheckRun = await context.octokit.checks.listForRef({
                  owner: sourceOwner,
                  repo: sourceRepo,
                  ref: sourceHeadSha,
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
                app.log.debug(logData, `Could not find checks or branch for ${sourceOwner}/${sourceRepo} - ${sourcePrObj.head.ref}`);
              }

              if (appTestSecurityApprovalCheckRun && appTestSecurityApprovalCheckRun.conclusion === 'success') {
                if (['clean', 'has_hooks', 'unstable'].includes(sourcePrObj.mergeable_state)) {
                  // Merge PR
                  try {
                    await context.octokit.rest.pulls.merge({
                      owner: sourceOwner,
                      repo: sourceRepo,
                      pull_number: sourcePrObj.number
                    });
                    return;
                  } catch (e) {
                    app.log.error({}, 'Could not merge PR', e);
                    throw e;
                  }
                }
              }
            }
          } else {
            app.log.debug(logData, 'Skipping, app/test PR target branch does not have necessary branch protection.');
          }
        }
      } else {
        app.log.debug(logData, 'Skipping, this is a draft PR.');
      }
    } else {
      app.log.debug({}, 'Skipping, could not find PR.');
    }

    if (sourcePrObj && targetPrObj) {
      // Are both PR objects mergable?
      if (['clean', 'has_hooks', 'unstable'].includes(sourcePrObj.mergeable_state) && ['clean', 'has_hooks', 'unstable'].includes(targetPrObj.mergeable_state)) {
        // Merge both PRs
        try {
          await Promise.all([
            context.octokit.rest.pulls.merge({
              owner: sourceOwner,
              repo: sourceRepo,
              pull_number: sourcePrObj.number
            }),
            context.octokit.rest.pulls.merge({
              owner: targetOwner,
              repo: targetRepo,
              pull_number: targetPrObj.number
            })
          ]);
        } catch (e) {
          app.log.warn({}, 'Could not merge PRs', e);
          throw e;
        }
      }
    }
  } else if (context.payload.check_run.name === process.env.CHECK_NAME && context.payload.check_run.conclusion === 'success') {
    // If we get here, it means a 'Security' check was completed, which wasn't within a
    // PR, and is potentially running on a main/release branch, probably following a PR merge.
    // Check for the above, & if an open PR is found on the security repo, merge it.
    let appTestBranch = null;
    try {
      appTestBranch = await context.octokit.repos.getBranch({
        owner: sourceOwner,
        repo: sourceRepo,
        branch: context.payload.check_run.check_suite.head_branch
      })
        .then((result) => result.data);
    } catch (exception) {
      app.log.debug(`Branch ${context.payload.check_run.check_suite.head_branch} not found in repo ${sourceOwner}/${sourceRepo}`);
    }

    if (appTestBranch
      && appTestBranch.protection.enabled
      && appTestBranch.protection.required_status_checks.checks.some(
        (e) => e.context === process.env.CHECK_NAME
      )
    ) {
      targetOwner = config.security_repo_owner;
      targetRepo = config.security_repo_name;

      // get PR obj for Security repo
      let securityPrObj = await context.octokit.pulls.list({
        owner: targetOwner,
        repo: targetRepo,
        head: `${targetOwner}:${sourceOwner}/${sourceRepo}/${context.payload.check_run.check_suite.head_branch}`
      })
        .then((result) => {
          if (result.data.length > 0) {
            return result.data[0];
          }
          return null;
        });
      if (securityPrObj) {
        securityPrObj = await context.octokit.pulls.get({
          owner: targetOwner,
          repo: targetRepo,
          pull_number: securityPrObj.number
        })
          .then((result) => result.data);
      }

      if (securityPrObj) {
        if (['clean', 'has_hooks', 'unstable'].includes(securityPrObj.mergeable_state)) {
          // Merge PR
          try {
            await context.octokit.rest.pulls.merge({
              owner: targetOwner,
              repo: targetRepo,
              pull_number: securityPrObj.number
            });
          } catch (e) {
            app.log.error({}, 'Could not merge PR', e);
            throw e;
          }
        }
      }
    } else {
      app.log.debug('Skipping, app/test PR target branch does not have necessary branch protection.');
    }
  } else {
    app.log.debug({}, 'Skipping, not a PR.');
  }
}

module.exports = {
  autoMerge
};

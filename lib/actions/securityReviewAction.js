/*
 *  Copyright IBM Corp. 2024
 */
const {
  GITHUB_SECURITY_BRANCH_REGEX
} = require('../common/constants');
const { updateSecurityApprovalBasedOnReviews } = require('../common/reviewProcessing');

async function processSecurityReviewAction(app, context) {
  // Context coming in is from the Security repo
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

  app.log.debug(logData, 'SECURITY REVIEW WEBHOOK RECEIVED:\n');

  if (!context.payload.pull_request.draft && !context.payload.pull_request.merged) {
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

      if (appTestBranch) {
        try {
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
        } catch (exception) {
          app.log.error(logData, exception.stack);
          throw exception;
        }
      }

      app.log.debug(logData, 'SUCCESSFULLY COMPLETED SECURITY REVIEW WEBHOOK');
    } else {
      app.log.debug(logData, 'Skipping, branch naming convention doest follow standrd for SDV.');
    }
  } else {
    app.log.debug(logData, 'Skipping, this is a draft PR.');
  }
}

module.exports = {
  processSecurityReviewAction
};

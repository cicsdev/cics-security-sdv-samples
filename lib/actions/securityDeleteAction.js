/*
 *  Copyright IBM Corp. 2024
 */
const { GITHUB_SECURITY_BRANCH_REGEX } = require('../common/constants');

async function processSecurityDeleteAction(app, context) {
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;
  const branch = context.payload.ref;

  const logData = {
    owner,
    repo,
    branch
  };

  if (context.payload.ref.match(GITHUB_SECURITY_BRANCH_REGEX)) {
    const appTestRepoOwner = context.payload.ref.split('/')[0];
    const appTestRepoName = context.payload.ref.split('/')[1];
    const appTestRepoBranch = context.payload.ref.split('/')[2];

    try {
      app.log.debug(logData, 'SECURITY DELETE WEBHOOK RECEIVED:\n');

      // Get App/Test repo PR Security check ID
      let appTestCheckRun = null;
      try {
        appTestCheckRun = await context.octokit.rest.checks.listForRef({
          owner: appTestRepoOwner,
          repo: appTestRepoName,
          ref: appTestRepoBranch,
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

      // Fail Security check in app/test repo PR if its in progress
      if (appTestCheckRun && appTestCheckRun.status === 'in_progress') {
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
            summary: 'Security PR closed due to removed associated branch.'
          }
        });
      }

      app.log.debug(logData, 'SUCCESSFULLY COMPLETED SECURITY DELETE WEBHOOK');
    } catch (exception) {
      app.log.error(logData, exception.stack);

      throw exception;
    }
  }
}

module.exports = {
  processSecurityDeleteAction
};

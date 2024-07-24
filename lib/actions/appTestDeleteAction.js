/*
 *  Copyright IBM Corp. 2024
 */
async function processAppTestDeleteAction(app, context, config) {
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;
  const branch = context.payload.ref;

  const logData = {
    owner,
    repo,
    branch
  };

  try {
    app.log.debug(logData, 'APP/TEST DELETE WEBHOOK RECEIVED:\n');

    // Check if branch exists on Security repo
    let securityBranch = null;
    try {
      securityBranch = await context.octokit.repos.getBranch({
        owner: config.security_repo_owner,
        repo: config.security_repo_name,
        branch: `${owner}/${repo}/${branch}`
      })
        .then((result) => result.data);
    } catch (exception) {
      app.log.debug(logData, `No open Security PR found for branch ${owner}/${repo}/${branch}`);
    }

    // If found, delete the branch
    if (securityBranch) {
      await context.octokit.git.deleteRef({
        owner: config.security_repo_owner,
        repo: config.security_repo_name,
        ref: `heads/${owner}/${repo}/${branch}`
      });
    }

    app.log.debug(logData, 'SUCCESSFULLY COMPLETED APP/TEST DELETE WEBHOOK');
  } catch (exception) {
    app.log.error(logData, exception.stack);
    throw exception;
  }
}

module.exports = {
  processAppTestDeleteAction
};

/*
 *  Copyright IBM Corp. 2024
 */
const { autoMerge } = require('../actions/autoMerge');
const { processSecurityReviewAction } = require('../actions/securityReviewAction');

async function handleReviewEvents(app, context) {
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;

  // Get config from default branch
  let config = null;
  try {
    config = await context.config('sdvapproval.yml');
  } catch (exception) {
    app.log.warn(`No SDV configuration file found in repo ${owner}/${repo}. Will not process.`);
  }

  // only continue if a config found
  if (config) {
    if (owner === config.security_repo_owner && repo === config.security_repo_name) {
      await processSecurityReviewAction(app, context);
    } else {
      await autoMerge(app, context, config);
    }
  }
}

module.exports = {
  handleReviewEvents
};

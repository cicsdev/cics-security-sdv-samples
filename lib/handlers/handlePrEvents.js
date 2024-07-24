/*
 *  Copyright IBM Corp. 2024
 */
const { processSecurityPrAction } = require('../actions/securityPrAction');
const { processAppTestPrAction } = require('../actions/appTestPrAction');

async function handlePrEvents(app, context) {
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
      await processSecurityPrAction(app, context);
    } else {
      await processAppTestPrAction(app, context, config);
    }
  }
}

module.exports = {
  handlePrEvents
};

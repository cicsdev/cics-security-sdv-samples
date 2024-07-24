/*
 *  Copyright IBM Corp. 2024
 */
const { autoMerge } = require('../actions/autoMerge');

async function handleCompletedCheckRunEvents(app, context) {
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
    await autoMerge(app, context, config);
  }
}

module.exports = {
  handleCompletedCheckRunEvents
};

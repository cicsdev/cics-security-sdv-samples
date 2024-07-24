/*
 *  Copyright IBM Corp. 2024
 */
const express = require('express');

const { handlePrEvents } = require('./handlers/handlePrEvents');
const { handleReviewEvents } = require('./handlers/handleReviewEvents');
const { handleCompletedCheckRunEvents } = require('./handlers/handleCompletedCheckRunEvents');
const { handleDeleteEvents } = require('./handlers/handleDeleteEvents');

if (!process.env.CHECK_NAME) {
  throw Error('CHECK_NAME has not been provided in the environment variables');
}

module.exports = async (app, { getRouter }) => {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.closed',
      'pull_request.synchronize',
      'pull_request.converted_to_draft',
      'pull_request.ready_for_review'
    ],
    handlePrEvents.bind(null, app)
  );

  app.on(
    [
      'pull_request_review',
      'pull_request.review_requested',
      'pull_request.review_request_removed'
    ],
    handleReviewEvents.bind(null, app)
  );

  // As we plan to auto-merge the app/test and security PRs, we must monitor
  // for both the status of reviews & 'checks'.
  // Only when all reviews are approved, and all required checks have passed,
  // (aka github has put PRs mergable_state to something other than 'blocked') should PRs
  // auto merge.
  app.on(
    [
      'check_run.completed'
    ],
    handleCompletedCheckRunEvents.bind(null, app)
  );

  // It's possible there could be a big build up of branches on the Security repo
  // if PRs are not merged and are closed and forgotten about. After a period of time,
  // the associated App / Test repo branches wouldn't exist anymore, yet the Security
  // ones would still remain. This is just a helper function so that when an app / test
  // repo branch is deleted, if there is an assosciated one on the Securtity repo,
  // it is deleted also.
  app.on(
    [
      'delete'
    ],
    handleDeleteEvents.bind(null, app)
  );

  // Get an express router to expose
  // new routes
  const router = getRouter('/sdv-approval-bot');
  router.use(express.static('public'));

  router.get('/healthz', async (req, res) => {
    app.log.debug('/healthz call made.');
    res.sendStatus(200);
  });
};

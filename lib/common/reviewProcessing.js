/*
 *  Copyright IBM Corp. 2024
 */
const updateSecurityApprovalCheck = async (
  context,
  appTestSecurityApprovalCheckRun,
  appTestRepoOwner,
  appTestRepoName,
  status,
  output,
  conclusion = ''
) => {
  // Check 'Security' check state. If conclusion & wanting to
  // update to in_progress, create a new check, otherwise, update.
  if (!conclusion && appTestSecurityApprovalCheckRun.conclusion) {
    await context.octokit.checks.create({
      name: process.env.CHECK_NAME,
      mediaType: {
        previews: ['antiope-preview']
      },
      owner: appTestRepoOwner,
      repo: appTestRepoName,
      head_sha: appTestSecurityApprovalCheckRun.head_sha,
      status,
      output
    });
  } else {
    const body = {
      mediaType: {
        previews: ['antiope-preview']
      },
      owner: appTestRepoOwner,
      repo: appTestRepoName,
      check_run_id: appTestSecurityApprovalCheckRun.id,
      status,
      output
    };
    if (conclusion) {
      body.conclusion = conclusion;
    }
    await context.octokit.checks.update(body);
  }
};

const getLatestReviewForReviewers = async (
  context,
  owner,
  repo,
  prNumber
) => {
  // get list of all reviews for PR
  const allPrReviews = await context.octokit.paginate(context.octokit.rest.pulls.listReviews, {
    owner,
    repo,
    pull_number: prNumber
  })
    .then((result) => result);

  return allPrReviews.reduce((finalList, review) => {
    const key = `${review.user.login}`;
    return {
      ...finalList,
      [key]: { ...review }
    };
  }, []);
};

const updateSecurityApprovalBasedOnReviews = async (
  app,
  context,
  securityRepoOwner,
  securityRepoName,
  securityRepoPrNumber,
  appTestRepoOwner,
  appTestRepoName,
  appTestRepoSha,
  securityPrUrl
) => {
  // Get Security check on app/test PR
  let appTestSecurityApprovalCheckRun = null;
  try {
    appTestSecurityApprovalCheckRun = await context.octokit.rest.checks.listForRef({
      owner: appTestRepoOwner,
      repo: appTestRepoName,
      ref: appTestRepoSha,
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
    app.log.debug({}, `Could not find checks or branch for ${appTestRepoOwner}/${appTestRepoName} - commit ${appTestRepoSha}`);
  }

  if (appTestSecurityApprovalCheckRun && appTestSecurityApprovalCheckRun.conclusion !== 'skipped') {
    // Get list of pending reviewers for security PR
    const pendingReviewerList = await context.octokit.pulls.listRequestedReviewers({
      owner: securityRepoOwner,
      repo: securityRepoName,
      pull_number: securityRepoPrNumber
    })
      .then((result) => result.data);

    // Get list unique reviews and their latest review for security PR
    const latestReviewForReviewers = await getLatestReviewForReviewers(
      context,
      securityRepoOwner,
      securityRepoName,
      securityRepoPrNumber
    );

    const currentFailedReviews = Object.values(latestReviewForReviewers).filter((item) => item.state === 'CHANGES_REQUESTED');
    const currentApprovedReviews = Object.values(latestReviewForReviewers).filter((item) => item.state === 'APPROVED');

    let reviewText = '#### Review status\n<table><tr><th> Reviewer </th> <th> Status </th> <th> Details </th> </tr>\n';
    for (let i = 0; i < currentFailedReviews.length; i += 1) {
      /* eslint-disable no-await-in-loop */
      const commentsList = await context.octokit
        .paginate(context.octokit.pulls.listCommentsForReview, {
          owner: securityRepoOwner,
          repo: securityRepoName,
          pull_number: securityRepoPrNumber,
          review_id: currentFailedReviews[i].id
        })
        .then((result) => result);
      /* eslint-enable no-await-in-loop */

      let failureComments = '';
      commentsList.forEach((comment) => {
        failureComments += `* ${comment.body}\n`;
      });

      reviewText += `<tr><td> \n\n@${currentFailedReviews[i].user.login}\n\n </td><td> \n\n:x:\n\n </td><td> \n\n${currentFailedReviews[i].body}\n\n\n${failureComments}\n\n </td></tr>\n`;
    }
    for (let i = 0; i < currentApprovedReviews.length; i += 1) {
      /* eslint-disable no-await-in-loop */
      const commentsList = await context.octokit
        .paginate(context.octokit.pulls.listCommentsForReview, {
          owner: securityRepoOwner,
          repo: securityRepoName,
          pull_number: securityRepoPrNumber,
          review_id: currentApprovedReviews[i].id
        })
        .then((result) => result);
      /* eslint-enable no-await-in-loop */

      let approvalComments = '';
      commentsList.forEach((comment) => {
        approvalComments += `* ${comment.body}\n`;
      });

      reviewText += `<tr><td> \n\n@${currentApprovedReviews[i].user.login}\n\n </td><td> \n\n:white_check_mark:\n\n </td><td> \n\n${currentApprovedReviews[i].body}\n\n${approvalComments}\n\n </td></tr>\n`;
    }
    for (let i = 0; i < pendingReviewerList.teams.length; i += 1) {
      reviewText += `<tr><td> \n\nTeam: \`${pendingReviewerList.teams[i].name}\` \n\n </td><td> \n\n:clock1:\n\n </td><td> Awaiting review... </td></tr>\n`;
    }
    for (let i = 0; i < pendingReviewerList.users.length; i += 1) {
      reviewText += `<tr><td> \n\n@${pendingReviewerList.users[i].login}\n\n </td><td> \n\n:clock1:\n\n </td><td> Awaiting review... </td></tr>\n`;
    }
    reviewText += '</table>\n';

    if (currentFailedReviews.length > 0) {
      // No matter what, if at least one rejected review is found,
      // fail the Security check.

      // Fail the Security check
      await updateSecurityApprovalCheck(
        context,
        appTestSecurityApprovalCheckRun,
        appTestRepoOwner,
        appTestRepoName,
        'completed',
        {
          title: 'Security reviewer concerns',
          summary: reviewText
        },
        'failure'
      );
    } else if (pendingReviewerList.teams.length > 0 || pendingReviewerList.users.length > 0) {
      // If we get to here, there are no rejected approvals, but if we have any
      // reviews we are waiting for, the Security check must remain in progress.

      const summaryText = `The changes in this PR will result in a change of security usage.\n\nThe security changes found are currently awaiting Security approval [here](${securityPrUrl}).\n\n${reviewText}`;
      await updateSecurityApprovalCheck(
        context,
        appTestSecurityApprovalCheckRun,
        appTestRepoOwner,
        appTestRepoName,
        'in_progress',
        {
          title: 'Awaiting full approval of security PR',
          summary: summaryText
        }
      );
    } else {
      // Get full PR object to test mergability
      const securityRepoPullRequest = await context.octokit.pulls.get({
        owner: securityRepoOwner,
        repo: securityRepoName,
        pull_number: securityRepoPrNumber
      })
        .then((result) => result.data);

      if (['clean', 'has_hooks', 'unstable'].includes(securityRepoPullRequest.mergeable_state)) {
        // If we get to this point, then either:
        //  1. the PR is approved by all reviewers.
        //  2. there are no currently active reviews on the PR, nor are any requested.
        //
        // Regardless of which is true, the actions are still the same. We will rely on
        // the branch protection set up in GitHub to decide if the PR is mergable or not.
        //
        // The PR could still be potentially blocked from merging if not
        // all Checks have passed, or if none of the reviewers are a codeowner
        // of the Security metadata Repo.
        // It could also be that branch protection has been switched off, so we should not enforce
        // a review must be approved.

        // Pass Security check in app/test repo PR
        await updateSecurityApprovalCheck(
          context,
          appTestSecurityApprovalCheckRun,
          appTestRepoOwner,
          appTestRepoName,
          'completed',
          {
            title: 'Security approved',
            summary: reviewText
          },
          'success'
        );
      } else {
        // See last comment
        const summaryText = `The changes in this PR will result in a change of security usage.\n\nThe security changes found are currently awaiting a Security approval [here](${securityPrUrl}).\n\n#### Review status\nAwaiting for reviewers to be assigned.`;
        await updateSecurityApprovalCheck(
          context,
          appTestSecurityApprovalCheckRun,
          appTestRepoOwner,
          appTestRepoName,
          'in_progress',
          {
            title: 'Awaiting full approval of security PR',
            summary: summaryText
          }
        );
      }
    }
  }
};

const resetSecurityCheckToWaiting = async (
  app,
  context,
  appTestRepoOwner,
  appTestRepoName,
  appTestRepoSha,
  securityPrUrl
) => {
  // Get Security check on app/test PR
  let appTestSecurityApprovalCheckRun = null;
  try {
    appTestSecurityApprovalCheckRun = await context.octokit.rest.checks.listForRef({
      owner: appTestRepoOwner,
      repo: appTestRepoName,
      ref: appTestRepoSha,
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
    app.log.debug({}, `Could not find checks or branch for ${appTestRepoOwner}/${appTestRepoName} - commit ${appTestRepoSha}`);
  }

  if (appTestSecurityApprovalCheckRun) {
    const summaryText = `The changes in this PR will result in a change of security usage.\n\nThe security changes found are currently awaiting a Security approval [here](${securityPrUrl}).\n\n#### Review status\nAwaiting for reviewers to be assigned.`;
    await updateSecurityApprovalCheck(
      context,
      appTestSecurityApprovalCheckRun,
      appTestRepoOwner,
      appTestRepoName,
      'in_progress',
      {
        title: 'Awaiting full approval of security PR',
        summary: summaryText
      }
    );
  }
};

module.exports = {
  getLatestReviewForReviewers,
  updateSecurityApprovalBasedOnReviews,
  resetSecurityCheckToWaiting
};

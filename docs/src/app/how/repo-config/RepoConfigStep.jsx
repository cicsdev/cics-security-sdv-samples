/*
 *  Copyright IBM Corp. 2024
 */

'use client';

import React from 'react';
import propTypes from 'prop-types';
import {
  Button,
  ButtonSet,
  CodeSnippet
} from '@carbon/react';

export default function RepoConfigStep({
  onNextStep,
  onPrevStep
}) {
  return (
    <div className='repo-config-step-container'>
      <div className='repo-config-step-content'>
        <h3 className='repo-config-step-subheading'>Repository Creation and Configuration [Build Engineer task]</h3>
        <p className='repo-config-step-p'>
          SDV works with three core stores, containing either code or data. These three stores are:
          <ol className='repo-config-step-manual-bullet'>
            <li>The CICS application code</li>
            <li>The CICS application test code</li>
            <li>The Security metadata for the CICS application</li>
          </ol>
          This part of the guide will focus on creating and configuring these stores for SDV.
        </p>

        <p className='repo-config-step-p'>
          The example pipeline uses Source Control Management tool,&nbsp;
          <a
            href='https://github.com/'
            target='_blank'
            rel='noreferrer'
          >
            GitHub
          </a>
          . As well as storing source code, GitHub also provides ways to manage, secure, and protect it.
          It also provides means to create custom workflows that fit into the lifecycle of the code.
          This is all achieved using features that include (but are not limited to) webhooks, team/user permission
          management, and branch protection.
          <br />
          <br />
          As per the technologies used in previous steps of this guide, these steps are not restricted to only
          being implementable on GitHub. Other SCM tools (e.g. GitLab, BitBucket) provide their own alternatives to the
          features the example pipeline uses in GitHub. This step will show how the repositories are configured, so
          that the configuration can be ported an alternative SCM tool.
        </p>

        <h3 className='repo-config-step-subheading-inner'>Application & Test code Repositories</h3>
        <p className='repo-config-step-p'>
          In terms of configuration, the application repository and the test code repository are identical.
          <br />
          The example pipeline is in actual fact, two almost identical pipelines:
          <ol className='repo-config-step-manual-list'>
            <li>
              An SDV pipeline that runs for the CICS application code repository, should a request to change
              its code be raised.
            </li>
            <li>
              An SDV pipeline that runs for the The CICS application&nbsp;
              <strong>test</strong>
              &nbsp;code repository,
              should a request be made to change test code.
            </li>
          </ol>
          Either one of the above could result in a change in required security, therefore we run SDV against
          application code
          changes, but also test code changes.
          <br />
          It is for this reason, the repository configurations are identical, as they both need to trigger
          the same jobs
          and have the same protection.
          <br />
          <br />
          To configure an application code or test code repository for SDV:

          <ol className='repo-config-step-manual-list'>
            <li>
              Create repository
            </li>
            <li>
              Create Branch protection on any branch requiring it (it can cope with default &
              release branches). Set the following:
              <ol
                className='repo-config-step-manual-list'
                style={{
                  listStyle: 'outside',
                  marginBottom: '20px'
                }}
              >
                <li>
                  Check&nbsp;
                  <strong>Require a pull request before merging</strong>
                </li>
                <li>
                  Check&nbsp;
                  <strong>Dismiss stale pull request approvals when new commits are pushed</strong>
                </li>
                <li>
                  Check&nbsp;
                  <strong>Require status checks to pass before merging</strong>
                </li>
                <li>
                  Check&nbsp;
                  <strong>Require branches to be up to date before merging</strong>
                </li>
                <li>
                  Search for, and select the&nbsp;
                  <strong>Security</strong>
                  &nbsp;status check (may be
                  named differently depending on user config)
                  as being required (This will need to have been ran at least once previously to
                  appear in the list)
                </li>
                <li>
                  Optionally check&nbsp;
                  <strong>Require Approvals</strong>
                  , for code reviews.
                </li>

              </ol>
            </li>
          </ol>

        </p>

        <h3 className='repo-config-step-subheading-inner'>Security Admin team</h3>
        <p className='repo-config-step-p'>
          Within the GitHub organisation, create a team called&nbsp;
          <strong>security-admin</strong>
          &nbsp;and add all users deemed as a Security Authority as members of this team.
          <br />
          This team will be used to decide which users can approve/reject changes to the security
          baseline (see below).
        </p>

        <h3 className='repo-config-step-subheading-inner'>Security Metadata repository</h3>
        <p className='repo-config-step-p'>
          This repository stores the security&nbsp;
          <strong>baseline</strong>
          &nbsp;for the CICS application.
          This will be a collection of YAML files. The number of files should equal the
          amount of test classes in the CICS application test suite, as each test class will output
          a YAML file containing the security captured during its run.
          <br />
          The baseline is captured when the CICS application tests repository pipeline runs for the
          default branch (e.g. main or master)
          against the default branch of the CICS application code. This is considered the very latest
          &apos;approved&apos; test, and application code available that is ready for production,
          therefore it is the point of which to detect if there any deviations from this approved point.
          <br />
          <br />
          Compared to the app/test repositories, this repository is locked down further, as it is owned
          by the Security Admin team, and access may or may not be granted to the developers. As a result,
          there are differing configuration steps.
          <br />
          <br />
          To configure a Security metadata repository for SDV:

          <ol className='repo-config-step-manual-list'>
            <li>
              Create repository
            </li>
            <li>
              Add an&nbsp;
              <CodeSnippet type='inline'>.github/CODEOWNERS</CodeSnippet>
              file, containing the following:&nbsp;
              <CodeSnippet type='multi'>
                *.   @[
                <em>your GH organisation name</em>
                ]/security-admin
              </CodeSnippet>
            </li>
            <li>
              Under collaborators & teams, add the newly created&nbsp;
              <strong>security-admin</strong>
              &nbsp;team from above, granting the&nbsp;
              <strong>Maintain</strong>
              &nbsp;role.
            </li>
            <li>
              Create Branch protection on any branch requiring it. Set the following:
              <ol
                className='repo-config-step-manual-list'
                style={{
                  listStyle: 'outside',
                  marginBottom: '20px'
                }}
              >
                <li>
                  Check&nbsp;
                  <strong>Require a pull request before merging</strong>
                </li>
                <li>
                  Check&nbsp;
                  <strong>Require Approvals</strong>
                  , for code reviews.
                </li>
                <li>
                  Check&nbsp;
                  <strong>Dismiss stale pull request approvals when new commits are pushed</strong>
                </li>
                <li>
                  Check&nbsp;
                  <strong>Require review from Code Owners</strong>
                </li>
                <li>
                  Check&nbsp;
                  <strong>Require status checks to pass before merging</strong>
                </li>
                <li>
                  Check&nbsp;
                  <strong>Require branches to be up to date before merging</strong>
                </li>
                <li>
                  Search for, and select the&nbsp;
                  <strong>Up-to-date</strong>
                  &nbsp;check as
                  being required (
                  <em>
                    This will need to have been ran at least once
                    previously to appear in the list – this is required for the&nbsp;
                    <strong>
                      Require branches to be up to date before merging
                    </strong>
                    &nbsp;check to work, at least one check must exist.
                  </em>
                  )
                </li>
              </ol>
            </li>

          </ol>

        </p>
      </div>
      <br />
      <div className='repo-config-step-footer-buttons'>
        <ButtonSet>
          <Button kind='ghost' onClick={() => onPrevStep()}>Previous Step</Button>
          <Button kind='ghost' onClick={() => onNextStep()}>Next Step</Button>
        </ButtonSet>
      </div>
    </div>
  );
}
RepoConfigStep.propTypes = {
  onNextStep: propTypes.func.isRequired,
  onPrevStep: propTypes.func.isRequired
};

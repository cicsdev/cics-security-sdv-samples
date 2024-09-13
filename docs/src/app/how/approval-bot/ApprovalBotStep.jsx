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

export default function ApprovalBotStep({
  onPrevStep
}) {
  return (

    <div className='approval-bot-step-container'>
      <div className='approval-bot-step-content'>
        <h3 className='approval-bot-step-subheading'>Approval Bot [Build Engineer task]</h3>
        <p className='approval-bot-step-p'>
          Once a request to change application or test code (aka a Pull Request) has completed its automated
          test run, and the
          post-test SDV task has identified there are security deltas resulting in the creation of a request
          to change the
          security baseline, the CI/CD pipeline itself will end, however this is not the end
          of the SDV workflow.
          <br />
          <br />
          At this point, there are two open change requests, one for the app or test code, and one for the
          security baseline, and from the perspective of the SCM tool there is no direct relation between them.
          Additionally, SCM tools currently do not provide the ability for actions in a change request to directly
          affect the status of another change request in a completely different repository.
          <br />
          However, for SDV, we require to directly affect the original application or test change request, based on
          Security Admin review actions in the security baseline change request.
          <br />
          <br />
          This is where the&nbsp;
          <a href='https://github.com/cicsdev/cics-security-sdv-samples'>
            Approval Bot
          </a>
          &nbsp;steps in.
          The Approval Bot has been developed as part of the implementation of the example pipeline, and has been
          open-sourced on the&nbsp;
          <a
            href='https://github.com/cicsdev/cics-security-sdv-samples'
            target='_blank'
            rel='noreferrer'
          >
            CICSdev SDV Samples repository
          </a>
          &nbsp;on Github.
          <br />
          The Approval Bot is a GitHub App, which listens and receives webhooks from GitHub alerting it to events
          occurring on repositories the bot is interested in. It can then run bespoke code providing custom workflows
          for the events received, providing behaviour not normally provided by the SCM tool itself. It is also
          authenticated and can perform many actions on the SCM tool.
          <br />
          <br />
          As per previous technologies used in SDV, this is portable to other technologies, however it is likely only
          achievable on SCM tooling which provide a webhooks feature (e.g. GitHub, GitLab, BitBucket,
          Endevor Bridge for Git).
        </p>

        <p className='approval-bot-step-p'>
          To configure the Approval Bot:

          <ol className='approval-bot-step-manual-list'>
            <li>
              Add an&nbsp;
              <CodeSnippet type='inline'>.github/sdvapproval.yaml</CodeSnippet>
              &nbsp;config file to the Application
              and test code repositories, as well as the Security Metadata repository, containing the following:&nbsp;
              <CodeSnippet type='multi'>
                security_repo_owner:
                <em> enter_your_organisation_name_here</em>
                <br />
                security_repo_name:
                <em> enter_your_repository_name_here</em>
              </CodeSnippet>
              This is read by the Approval bot on receiving events from all repositories, so it knows the relevant
              Security Metadata repository for the repository that sent out the received webhook. For the case when
              it actually is the Security Metadata repository that has sent out the webhook, it will match what is
              contained
              within its file, so the Approval Bot will treat it as a Security repository event.
              <br />
            </li>
            <li>
              Create a new GitHub app in the GitHub UI:
              <ol className='approval-bot-step-manual-list'>
                <li>
                  Select: Settings &rarr; developer settings &rarr; New Github app
                </li>
                <li>
                  Enter a name for the Approval Bot.
                </li>
                <li>
                  Enter a webhook URL (e.g.&nbsp;
                  <CodeSnippet type='inline'>http://HOSTNAME:3000/api/github/webhooks</CodeSnippet>
                  -&nbsp;
                  <em>
                    this may need
                    to be updated after following steps later on this page.
                  </em>
                  )
                </li>
                <li>
                  Enter a webhook secret.
                </li>
                <li>
                  Give it the following repository permissions:
                  <ul>
                    <li>
                      Checks:&nbsp;
                      <em>read & write</em>
                    </li>
                    <li>
                      Commit Statues:&nbsp;
                      <em>read & write</em>
                    </li>
                    <li>
                      Contents:&nbsp;
                      <em>read & write</em>
                    </li>
                    <li>
                      Pull requests:&nbsp;
                      <em>read & write</em>
                    </li>
                  </ul>
                </li>
                <li>
                  Subscribe it to the following events:
                  <ul>
                    <li>
                      Check run
                    </li>
                    <li>
                      Delete
                    </li>
                    <li>
                      Pull request
                    </li>
                    <li>
                      Pull request review
                    </li>
                    <li>
                      status
                    </li>
                  </ul>
                </li>
                <li>
                  Save changes
                </li>
                <li>
                  Generate a private key & keep it safe
                </li>
                <li>
                  Make note of the App id.
                </li>
              </ol>
            </li>
            <li>
              Install the Approval Bot onto your application and test code repositories,
              and additionally your Security Metadata repository.
              <br />
              <strong>Note: </strong>
              do not blanket install across the organisation.
              <br />
            </li>
            <li>
              Create a CI/CD pipeline which polls the&nbsp;
              <strong>main</strong>
              &nbsp;branch of the&nbsp;
              <a
                href='https://github.com/cicsdev/cics-security-sdv-samples'
                target='_blank'
                rel='noreferrer'
              >
                CICSdev SDV Samples repository
              </a>
              &nbsp;for changes.
              <br />
              When changes are found, the pipeline should:
              <ol className='approval-bot-step-manual-list'>
                <li>
                  Clone the repository
                </li>
                <li>
                  Run&nbsp;
                  <CodeSnippet type='inline'>npm install</CodeSnippet>
                </li>
                <li>
                  Run&nbsp;
                  <CodeSnippet type='inline'>npm test</CodeSnippet>
                </li>
                <li>
                  Build a docker image using the&nbsp;
                  <CodeSnippet type='inline'>Dockerfile</CodeSnippet>
                  &nbsp;in the root of the repository
                </li>
                <li>
                  It should then either:
                  <ul>
                    <li>
                      Push the created image to a docker registry & deploy to a Kubernetes
                      cluster, with an advertised service URL
                    </li>
                    <li>
                      Use docker to run a container for the image on a given machine &
                      port (mapped to port 3000 internally)
                    </li>
                  </ul>
                </li>
                <li>
                  Wherever the bot runs it must be provided with the following via environment
                  variables using values obtained when creating the app in GitHub (step later on this page):
                  <ul>
                    <li>
                      APP_ID
                    </li>
                    <li>
                      WEBHOOK_SECRET
                    </li>
                    <li>
                      PRIVATE_KEY (replace line ends with ‘\n’)
                    </li>
                    <li>
                      GHE_HOST
                    </li>
                    <li>
                      CHECK_NAME
                    </li>
                  </ul>
                </li>
                <li>
                  Go back and update the GitHub App&apos;s webhook URL & in the GitHub UI, if necessary.
                </li>
              </ol>
            </li>
          </ol>
        </p>
      </div>
      <br />
      <div className='approval-bot-step-footer-buttons'>
        <ButtonSet>
          <Button kind='ghost' onClick={() => onPrevStep()}>Previous Step</Button>
        </ButtonSet>
      </div>
    </div>
  );
}
ApprovalBotStep.propTypes = {
  onPrevStep: propTypes.func.isRequired
};

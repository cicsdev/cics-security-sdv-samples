/*
 *  Copyright IBM Corp. 2024
 */

'use client';

import React from 'react';
import propTypes from 'prop-types';
import {
  Button,
  ButtonSet,
  Grid,
  Column
} from '@carbon/react';

import Image from 'next/image';

import sdvFlowPng from './sdv_flow.png';

export default function ConceptsTab({
  onNextTab,
  onPrevTab
}) {
  return (
    <Grid className='tabs-group-content'>
      <Column md={4} lg={8} sm={4} className='concepts-tab-content'>
        <h3 className='concepts-tab-subheading'>What are the concepts?</h3>
        <div className='concepts-tab-p'>
          <p>
            <strong>SDV </strong>
            is not a product or tool; rather, it is a concept to introduce a form of security
            testing into your existing CICS application CI/CD pipelines. This has been made a reality by
            utilising one of the new features introduced in
            <strong> CICS TS for z/OS 6.2</strong>
            , which assists in the migration to a Zero Trust security strategy,&nbsp;
            <strong>
              <a
                href={'https://www.ibm.com/docs/en/cics-ts/6.x?topic=hiwztic-how-it-works-cap\
turing-validating-security-definitions-during-development-process'}
                target='_blank'
                rel='noreferrer'
              >
                Security definition capture (SDC)
              </a>
            </strong>
            . This feature has been integrated into an example CI/CD pipeline, which has been implemented and
            documented across this site via manuals and videos.
          </p>
          <br />
          <p>
            An SDV pipeline does all the same tasks as any existing CI/CD pipeline, however,
            if an application code change request results in a change to the security definitions
            required for that application to run an
            <strong> approval process </strong>
            is initiated, which&nbsp;
            <strong>must be approved by a Security Admin</strong>
            &nbsp;.
            The application code change request is&nbsp;
            <strong>blocked</strong>
            &nbsp;until the Security Admin approves.
          </p>
          <br />
          <p>
            The stages of an SDV pipeline are as follows:
          </p>
          <ol className='concepts-numbered-list'>
            <li>A developer raises an application code change request in the Source Code Management (SCM) tool.</li>
            <li>
              The application&apos;s CI/CD pipeline is triggered, running a build of the
              application with proposed changes.
            </li>
            <li>Built application is deployed to test environment.</li>
            <li>
              The application&apos;s automated test suite runs against the test environment.
              The test runner is adapted to&nbsp;
              <strong>switch SDC on</strong>
              &nbsp;for each CICS TS region under test
              before each test run,
              then&nbsp;
              <strong>switches SDC off</strong>
              &nbsp;after.
              <br />
              It additionally gathers and stores the captured
              Security definitions as&nbsp;
              <strong>security metadata</strong>
              &nbsp;against the test run.
              <br />
              <em>
                Our example pipeline uses open-source automated test framework,&nbsp;
                <strong>
                  <a
                    href='https://galasa.dev/'
                    target='_blank'
                    rel='noreferrer'
                  >
                    Galasa
                  </a>
                </strong>
                , and the&nbsp;
                <strong>
                  <a
                    href='https://galasa.dev/docs/managers/sdv-manager'
                    target='_blank'
                    rel='noreferrer'
                  >
                    SDV Manager
                  </a>
                </strong>
                &nbsp;has been contributed to perform the above tasks.
              </em>
            </li>
            <li>
              The pipeline gathers and stores the newly captured security metadata from the automated test run.
            </li>
            <li>
              The newly gathered security metadata is &nbsp;
              <strong>
                compared against a &apos;baseline&apos;
              </strong>
              &nbsp;of security metadata, previously captured during an automated test suite run
              on the default branch.
            </li>
            <li>
              If&nbsp;
              <strong>differences are found</strong>
              &nbsp;, the pipeline will create a request to&nbsp;
              <strong>change the &apos;baseline&apos;</strong>
              &nbsp;of security metadata, to deliver these differences.
              <br />
              The security Admin is added as a reviewer to this request, blocking the application
              code change request until it is approved.
              <br />
              <em>
                Our example pipeline uses an&nbsp;
                <strong>Ansible playbook</strong>
                &nbsp;to drive the above post-test steps, which is available
                open-source in the&nbsp;
                <strong>
                  <a
                    href='https://github.com/cicsdev/cics-security-sdv-samples'
                    target='_blank'
                    rel='noreferrer'
                  >
                    CICSdev SDV Samples repository
                  </a>
                </strong>
              </em>
            </li>
            <li>
              The Security Admin adds their review to the above security change request.
              <br />
              If it is&nbsp;
              <strong>rejected</strong>
              , this is considered a&nbsp;
              <strong>failure</strong>
              &nbsp;within the application code change
              request, blocking its delivery.
              <br />
              If it is&nbsp;
              <strong>approved</strong>
              , this is considered a&nbsp;
              <strong>pass</strong>
              &nbsp;within the application code change request, putting it in a mergeable state.
            </li>
            <li>
              If in a mergeable state, both the application, and the security change requests are merged.
              <br />
              <em>
                Our example pipeline uses a&nbsp;
                <strong>GitHub App</strong>
                &nbsp;to synchronise events between the
                Application and Security change requests, which is available
                open-source in the&nbsp;
                <strong>
                  <a
                    href='https://github.com/cicsdev/cics-security-sdv-samples'
                    target='_blank'
                    rel='noreferrer'
                  >
                    CICSdev SDV Samples repository
                  </a>
                </strong>
              </em>
            </li>
          </ol>
          <p>
            The above stages use an application code change as an example, however this pipeline would also be
            applicable for test code change requests.
          </p>
          <br />
          <p>
            The example CI/CD pipeline uses a range of
            <strong> open-source </strong>
            and publicly available 3rd party tooling, and
            has additionally required the development of the bespoke tools listed above, however, all the tooling
            used within the example pipeline is
            <strong> interchangeable with alternative tooling</strong>
            , and all bespoke tools developed have been made available,&nbsp;
            <strong>
              open-source
            </strong>
            &nbsp;in the&nbsp;
            <a
              href='https://github.com/cicsdev/cics-security-sdv-samples'
              target='_blank'
              rel='noreferrer'
            >
              CICSdev SDV Samples repository
            </a>
            &nbsp; allowing you to see exactly how the tools provide their function, which can be adapted to suit
            your requirements.
          </p>
        </div>
        <center>
          <ButtonSet>
            <Button kind='secondary' onClick={() => onPrevTab()}>Back: Problem</Button>
            <Button kind='primary' onClick={() => onNextTab()}>Next: Why?</Button>
          </ButtonSet>
        </center>
      </Column>
      <Column
        md={4}
        lg={8}
        sm={4}
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: '45px',
          height: '100%',
          alignContent: 'center',
          alignItems: 'center'
        }}
      >
        <Image
          className='concepts-tab-illo'
          src={sdvFlowPng}
          alt='Carbon illustration'

        />
      </Column>
    </Grid>
  );
}
ConceptsTab.propTypes = {
  onNextTab: propTypes.func.isRequired,
  onPrevTab: propTypes.func.isRequired
};

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

export default function ZosConfigurationStep({
  onNextStep,
  onPrevStep
}) {
  return (
    <div className='zos-config-step-container'>
      <div className='zos-config-step-content'>
        <h3 className='zos-config-step-subheading'>z/OS Configuration [z/OS System Programmer task]</h3>
        <p className='zos-config-step-p'>
          For SDV to work as intended, tests must be written to be role-based. This means all interactions with CICS
          within the test should be done as a particular user that
          belongs to a particular role (e.g. TELLER, ADMIN, OPERATOR).
          <br />
          The tests must use user accounts on the z/OS system that are assigned to groups associated with the roles
          already configured with all the correct permissions for the role. It is expected the security database would
          mirror the one in production, so the same roles and permissions exist across environments.
          <br />
          As each test runs, all security usage will be captured for each of the test users. This captured data
          would then
          be grouped by user role, and then exported as security metadata, providing a list of all
          security required by the test, per role. The user information itself will be lost in this process.
        </p>

        <p className='zos-config-step-p'>
          It is therefore vital that you are aware of the types of roles and permissions that exist in your production
          system, and you mirror these into your test environments, and assign your test users to these. If your
          security
          database currently does not use a role-based approach, then&nbsp;
          <a
            href='https://www.ibm.com/docs/en/cics-ts/6.x?topic=cics-how-it-works-security-discovery'
            target='_blank'
            rel='noreferrer'
          >
            Security Discovery
          </a>
          , a new feature of CICS TS for z/OS 6.2, can help you find them by recommending the required roles
          needed in your system based on production environment usage over a defined period of time.
        </p>

        <p className='zos-config-step-p'>
          You can manually create groups by following&nbsp;
          <a
            href='https://www.ibm.com/docs/en/zos/2.5.0?topic=groups-summary-steps-defining-racf-group'
            target='_blank'
            rel='noreferrer'
          >
            Summary of steps for defining a RACF group
          </a>
          . You will need to allocate the associated permissions to each group.
          <br />
          You can manually create users associated with a group by following&nbsp;
          <a
            href='https://www.ibm.com/docs/en/zos/2.5.0?topic=users-summary-steps-defining'
            target='_blank'
            rel='noreferrer'
          >
            Summary of steps for defining users
          </a>
          .
        </p>

        <p className='zos-config-step-p'>
          A pool of test users should be created per role, per zOS machine. The more users per role the better,
          as this will increase the number of tests that can be ran in parallel.
          <br />
          This is because a user must only be used for one test at a time, to eliminate the risk of capturing
          &quot;Security noise&quot;, which would be the capturing of security requests from another test
          using the same user at the same time.
          <br />
          The number of users in the pool should be relative to the amount of tests using the role.
        </p>

        <p className='zos-config-step-p'>
          If you plan to use the&nbsp;
          <a
            href='https://galasa.dev/docs/managers/sdv-manager'
            target='_blank'
            rel='noreferrer'
          >
            Galasa SDV Manager
          </a>
          , all users in the pool should be added to Galasa, along with their roles via the&nbsp;
          <CodeSnippet type='inline'>
            sdv.roleTag.[roleTag].role
          </CodeSnippet>
          and&nbsp;
          <CodeSnippet type='inline'>
            sdv.zosImage.[imageID].role.[Role].credTags
          </CodeSnippet>
          &nbsp;&nbsp;&nbsp;&nbsp;CPS properties. (This will covered in more detail in the next step.)
          <br />
          The SDV manager makes it possible to write a test without requiring to hardcode usernames to the
          tests, instead picking them from the pool based on the role asked for by the tests and their current
          availability, then releasing
          them back to the pool once finished with.
        </p>
      </div>
      <br />

      <div className='zos-config-step-footer-buttons'>
        <ButtonSet>
          <Button kind='ghost' onClick={() => onPrevStep()}>Previous Step</Button>
          <Button kind='ghost' onClick={() => onNextStep()}>Next Step</Button>
        </ButtonSet>
      </div>
    </div>

  );
}
ZosConfigurationStep.propTypes = {
  onNextStep: propTypes.func.isRequired,
  onPrevStep: propTypes.func.isRequired
};

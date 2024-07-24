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

export default function SdcConfigurationStep({
  onNextStep,
  onPrevStep
}) {
  return (
    <div className='sdc-config-step-container'>
      <div className='sdc-config-step-content'>
        <h3 className='sdc-config-step-subheading'>SDC Configuration [CICS System Programmer task]</h3>

        <p className='sdc-config-step-p'>
          This guide assumes that there is already required knowledge to configure CICS regions and start them.
          This guide will assume you have one or more CICS regions provisioned.
        </p>

        <p className='sdc-config-step-p'>
          From the point of having operational CICS regions, it is necessary to configure Security Request
          Recording (SRR) and Security definition capture (SDC) on each region for SDV to work.
          <br />
          There are two ways of achieving this, an entirely manual way by following the CICS TS Documentation, or
          if you plan to use&nbsp;
          <a
            href='https://galasa.dev/docs/managers/sdv-manager'
            target='_blank'
            rel='noreferrer'
          >
            Galasa&apos;s SDV Manager
          </a>
          , it can configure these services for you, with only minimal manual steps required.
        </p>

        <p className='sdc-config-step-p'>
          To configure these services manually:
          <ol className='sdc-config-step-manual-list'>
            <li>
              Follow the instructions on how to&nbsp;
              <a
                href='https://www.ibm.com/docs/en/cics-ts/6.x?topic=region-configuring-security-request-recording-srr'
                target='_blank'
                rel='noreferrer'
              >
                Configuring security request recording (SRR)
              </a>
            </li>
            <li>
              Follow the instructions on how to&nbsp;
              <a
                href='https://www.ibm.com/docs/en/cics-ts/6.x?topic=region-configuring-security-definition-capture-sdc'
                target='_blank'
                rel='noreferrer'
              >
                Configuring security definition capture (SDC)
              </a>
            </li>
          </ol>
        </p>

        <p className='sdc-config-step-p'>
          To configure these services with help from the&nbsp;
          <a
            href='https://galasa.dev/docs/managers/sdv-manager'
            target='_blank'
            rel='noreferrer'
          >
            Galasa SDV Manager
          </a>
          :
          <ol className='sdc-config-step-manual-list'>
            <li>
              Add&nbsp;
              <CodeSnippet type='inline'>SEC=YES</CodeSnippet>
              &nbsp;to the SIT parameters for each CICS region.
            </li>
            <li>
              Set the&nbsp;
              <CodeSnippet type='inline'>USSCONFIG</CodeSnippet>
              &nbsp;SIT parameter to an accessible folder for each CICS region.
            </li>
            <li>
              Create a (or modify if it already exists)&nbsp;
              <CodeSnippet type='inline'>Sdc.jcl</CodeSnippet>
              file within a
              <CodeSnippet type='inline'>security</CodeSnippet>
              folder
              in the location specified by the
              <CodeSnippet type='inline'>USSCONFIG</CodeSnippet>
              SIT parameter containing:
              <CodeSnippet type='multi' feedback='Copied to clipboard'>
                {`//DFH$XSDS JOB REGION=0M
//MYLIB    JCLLIB ORDER=(hlq.SDFHPROC)
//SDCOUT EXEC DFHXSDSO,HLQ=hlq,
//  LOGSTRM=&logstream;,
//  ID='&matchid;'
//`}
              </CodeSnippet>
              replacing
              <CodeSnippet type='inline'>hlq</CodeSnippet>
              with the High level qualifier for the CICS installation. This needs to be
              done for each CICS region under test.
            </li>
            <li>
              Set the&nbsp;
              <CodeSnippet type='inline'>sdv.cicsTag.[cicsTag].SdcActivation</CodeSnippet>
              CPS property in Galasa to true for each CICS region under test. (more info on
              setting Galasa properties comes later in this guide)
            </li>
          </ol>
        </p>
        <br />
      </div>

      <div className='sdc-config-step-footer-buttons'>
        <ButtonSet>
          <Button kind='ghost' onClick={() => onPrevStep()}>Previous Step</Button>
          <Button kind='ghost' onClick={() => onNextStep()}>Next Step</Button>
        </ButtonSet>
      </div>
    </div>
  );
}
SdcConfigurationStep.propTypes = {
  onNextStep: propTypes.func.isRequired,
  onPrevStep: propTypes.func.isRequired
};

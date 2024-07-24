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

import tabIlloImage from './tab-illo.png';

export default function ConceptsTab({
  onNextTab,
  onPrevTab
}) {
  return (
    <Grid className='tabs-group-content'>
      <Column md={4} lg={8} sm={4} className='why-tab-content'>
        <h3 className='why-tab-subheading'>You would implement SDV to...</h3>
        <div className='why-tab-p'>
          <ol className='why-bullet-list'>
            <li>
              Identify a developers desired changes to security before code is delivered,
              as far-left in the pipeline as possible,&nbsp;
              <strong>reducing costs</strong>
              .
            </li>
            <li>
              Identify&nbsp;
              <strong>redundant</strong>
              &nbsp;security definitions.
            </li>
            <li>
              To reduce the risk of&nbsp;
              <strong>outages</strong>
              &nbsp;by missing security definitions in production.
            </li>
            <li>
              <strong>Speed</strong>
              &nbsp;up the process of getting Security changes made to RACF (or other external security manager).
            </li>
            <li>
              <strong>Automate</strong>
              &nbsp;the process of requesting security changes.
              Only the approval and updating of the Security database is manual.
            </li>
            <li>
              <strong>Stop</strong>
              &nbsp;unwanted security changes making it into the codebase.
            </li>
            <li>
              Introduce Security testing into the application lifecycle as early as possible,
              building towards a greater&nbsp;
              <strong>DevSecOps</strong>
              &nbsp;goal.
            </li>
          </ol>
        </div>
        <center>
          <ButtonSet>
            <Button kind='secondary' onClick={() => onPrevTab()}>Back: Concepts</Button>
            <Button kind='primary' onClick={() => onNextTab()}>Next: Demo</Button>
          </ButtonSet>
        </center>
      </Column>
      <Column md={4} lg={8} sm={4} className='why-tab-illo-container'>
        <Image
          className='why-tab-illo'
          src={tabIlloImage}
          alt='SDV'
          width={604}
          height={498}
        />
      </Column>
    </Grid>
  );
}
ConceptsTab.propTypes = {
  onNextTab: propTypes.func.isRequired,
  onPrevTab: propTypes.func.isRequired
};

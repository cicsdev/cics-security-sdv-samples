/*
 *  Copyright IBM Corp. 2024
 */

'use client';

import React from 'react';
import propTypes from 'prop-types';
import {
  Button,
  ButtonSet
} from '@carbon/react';

export default function IntroStep({
  onNextStep,
  onPrevTab
}) {
  return (
    <div className='intro-step-container'>
      <div className='intro-step-content'>
        <h3 className='intro-step-subheading'>Introduction</h3>
        <p className='intro-step-p'>
          This How-to guide will walk you through all the steps taken to implement SDV in the example CI/CD pipeline.
        </p>
        <p className='intro-step-p'>
          The example pipeline uses a particular set of technologies and tools,
          this guide will be opinionated towards the use and configuration of these. You are free to
          reuse these steps and tools,&nbsp;
          <strong>however</strong>
          , the majority of the steps provided are transferable to any alternative tools you may use within
          your pipelines. Any tools created for the example pipeline are open-source, allowing you download, view,
          and edit the code as you wish, to integrate it into your own tooling.
          <br />
          <br />
        </p>
      </div>
      <div style={{
        height: '255px'
      }}
      />
      <div className='intro-step-footer-buttons'>
        <ButtonSet>
          <Button kind='secondary' onClick={() => onPrevTab()}>Prev: Demo</Button>
          <Button kind='ghost' onClick={() => onNextStep()}>Next Step</Button>
        </ButtonSet>
      </div>
    </div>
  );
}
IntroStep.propTypes = {
  onNextStep: propTypes.func.isRequired,
  onPrevTab: propTypes.func.isRequired
};

/*
 *  Copyright IBM Corp. 2024
 */

'use client';

import React, { useState, useEffect } from 'react';
import propTypes from 'prop-types';
import {
  Grid,
  Column,
  ProgressIndicator,
  ProgressStep
} from '@carbon/react';

import IntroStep from './intro/IntroStep';
import PreparationStep from './preparation/PreparationStep';
import SdcConfigStep from './sdc-configuration/SdcConfigStep';
import ZosConfigStep from './zos-configuration/ZosConfigStep';
import GalasaTestsStep from './galasa-tests/GalasaTestsStep';
import RepoConfigStep from './repo-config/RepoConfigStep';
import GalasaArchitectureStep from './galasa-architecture/GalasaArchitectureStep';
import ApprovalBotStep from './approval-bot/ApprovalBotStep';
import CiPipelineStep from './ci-pipeline/ciPipelineStep';

export default function HowTab({
  onPrevTab
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const onNextStep = () => {
    setCurrentStepIndex(currentStepIndex + 1);
  };

  const onPrevStep = () => {
    setCurrentStepIndex(currentStepIndex - 1);
  };

  const handleStepChange = (newIndex) => {
    setCurrentStepIndex(newIndex);
  };

  useEffect(() => {
    document.getElementById('mainContentId').scrollTo(0, 0);
  }, [currentStepIndex]);

  return (
    <Grid className='tabs-group-content'>
      <Column lg={2} md={4} sm={1} className='how-tab-content'>
        <ProgressIndicator
          vertical
          currentIndex={currentStepIndex}
          onChange={handleStepChange}
          spaceEqually
          style={{
            position: 'fixed',
            height: '600px',
            top: '280px'
          }}
        >
          <ProgressStep label='Introduction' description='' />
          <ProgressStep label='Preparation' description='Gather prerequisites' />
          <ProgressStep label='SDC Configuration' description='' />
          <ProgressStep label='z/OS Configuration' description='' />
          <ProgressStep label='Galasa Tests & properties' description='' />
          <ProgressStep label='Repository creation & configuration' description='' />
          <ProgressStep label='Galasa Architecture' description='' />
          <ProgressStep label='CI Pipeline' description='' />
          <ProgressStep label='Approval Bot' description='' />
        </ProgressIndicator>
      </Column>
      <Column lg={14} md={4} sm={3} className='how-tab-content'>

        {currentStepIndex === 0
          && (
            <IntroStep onNextStep={onNextStep} onPrevTab={onPrevTab} />
          )}

        {currentStepIndex === 1
          && (
            <PreparationStep onNextStep={onNextStep} onPrevStep={onPrevStep} />
          )}

        {currentStepIndex === 2
          && (
            <SdcConfigStep onNextStep={onNextStep} onPrevStep={onPrevStep} />
          )}

        {currentStepIndex === 3
          && (
            <ZosConfigStep onNextStep={onNextStep} onPrevStep={onPrevStep} />
          )}

        {currentStepIndex === 4
          && (
            <GalasaTestsStep onNextStep={onNextStep} onPrevStep={onPrevStep} />
          )}

        {currentStepIndex === 5
          && (
            <RepoConfigStep onNextStep={onNextStep} onPrevStep={onPrevStep} />
          )}

        {currentStepIndex === 6
          && (
            <GalasaArchitectureStep onNextStep={onNextStep} onPrevStep={onPrevStep} />
          )}

        {currentStepIndex === 7
          && (
            <CiPipelineStep onNextStep={onNextStep} onPrevStep={onPrevStep} />
          )}

        {currentStepIndex === 8
          && (
            <ApprovalBotStep onPrevStep={onPrevStep} />
          )}

      </Column>
    </Grid>
  );
}
HowTab.propTypes = {
  onPrevTab: propTypes.func.isRequired
};

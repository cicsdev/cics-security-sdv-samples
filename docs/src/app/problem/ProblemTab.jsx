/*
 *  Copyright IBM Corp. 2024
 */

'use client';

import React from 'react';
import propTypes from 'prop-types';
import {
  Button,
  Grid,
  Column,
  ButtonSet
} from '@carbon/react';
import Image from 'next/image';

import problemPng from './problem.png';

export default function ProblemTab({
  onNextTab
}) {
  return (
    <Grid className='tabs-group-content'>
      <Column md={4} lg={8} sm={4} className='problem-tab-content'>
        <h3 className='problem-tab-subheading'>What is Security definition validation?</h3>
        <div className='problem-tab-p'>
          <p>
            SDV is an example implementation of a
            <strong> CI/CD pipeline </strong>
            that introduces CICS application
            <strong> security testing </strong>
            into its flow.
          </p>
          <br />
          <p>
            SDV automates and improves the efficiency of identifying required changes to security when changes are
            made to
            CICS applications. This is currently a slow, error prone, and manual process, often leading to
            application breakages when the application is first run in an environment with security switched on, which
            is more common than not, pre-production!
          </p>
          <br />
          <p>
            SDV helps contribute towards larger
            <strong> Zero Trust </strong>
            or
            <strong> DevSecOps </strong>
            strategies by introducing
            <strong> security testing </strong>
            as far-left in the CICS application development lifecycle as possible, yet with
            <strong> no additional effort required </strong>
            on the application developer when they request code changes.
          </p>
        </div>
        <center>
          <ButtonSet
            style={{
              justifyContent: 'right'
            }}
          >
            <Button onClick={() => onNextTab()}>Next: Concepts</Button>
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
          justifyContent: 'center',
          height: '100%',
          alignContent: 'center',
          alignItems: 'center'
        }}
      >
        <Image
          className='problem-tab-illo'
          src={problemPng}
          alt='Carbon illustration'
        />
      </Column>
    </Grid>
  );
}
ProblemTab.propTypes = {
  onNextTab: propTypes.func.isRequired
};

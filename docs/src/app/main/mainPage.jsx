/*
 *  Copyright IBM Corp. 2024
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  Grid,
  Column
} from '@carbon/react';
import {
  ZeroTrust,
  DataPrivacy,
  AppModernization
} from '@carbon/pictograms-react';

import { InfoSection, InfoCard } from '../components/Info/Info';

import ProblemTab from '../problem/ProblemTab';
import ConceptsTab from '../concepts/ConceptsTab';
import DemoTab from '../demo/DemoTab';
import HowTab from '../how/HowTab';
import WhyTab from '../why/WhyTab';

export default function Main() {
  const [currentTabIndex, setCurrentTabIndex] = useState(0);

  const onNextTab = () => {
    setCurrentTabIndex(currentTabIndex + 1);
  };

  const onPrevTab = () => {
    setCurrentTabIndex(currentTabIndex - 1);
  };

  const handleTabChange = (evt) => {
    setCurrentTabIndex(evt.selectedIndex);
  };

  useEffect(() => {
    document.getElementById('mainContentId').scrollTo(0, 0);
  }, [currentTabIndex]);

  return (
    <Grid className='main-page' fullWidth>
      <Column lg={16} md={8} sm={4} className='main-page-banner'>
        <br />
        <br />
        <br />
        <h1 className='main-page-heading'>
          <strong>Security definition validation </strong>
          for CICS TS (SDV)
        </h1>
      </Column>
      <Column lg={16} md={8} sm={4} className='main-page-content' id='mainContentId'>
        <Tabs selectedIndex={currentTabIndex} onChange={handleTabChange}>
          <TabList className='tabs-group' aria-label='Tab navigation'>
            <Tab>Problem</Tab>
            <Tab>Concepts</Tab>
            <Tab>Why?</Tab>
            <Tab>Demo</Tab>
            <Tab>How</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <ProblemTab onNextTab={onNextTab} />
            </TabPanel>
            <TabPanel>
              <ConceptsTab onNextTab={onNextTab} onPrevTab={onPrevTab} />
            </TabPanel>
            <TabPanel>
              <WhyTab onNextTab={onNextTab} onPrevTab={onPrevTab} />
            </TabPanel>
            <TabPanel>
              <DemoTab onNextTab={onNextTab} onPrevTab={onPrevTab} />
            </TabPanel>
            <TabPanel>
              <HowTab onPrevTab={onPrevTab} />
            </TabPanel>
          </TabPanels>
        </Tabs>
        {currentTabIndex !== 4
          && (

            <Grid className='main-page-footer' fullWidth>
              <Column lg={16} md={8} sm={4}>
                <InfoSection heading='The Principles'>
                  <InfoCard
                    heading='Maintain Zero-Trust'
                    body='Continually maintains your security definitions, keeping them up-to-date and audited.
              Providing the correct permissions to resources, to only the people who need them.'
                    icon={() => <ZeroTrust size={32} />}
                  />
                  <InfoCard
                    heading='Build towards DevSecOps'
                    body={'Introduces a form of security testing as far-left in your CICS\
 Application pipelines as possible.'}
                    icon={() => <AppModernization size={32} />}
                  />
                  <InfoCard
                    heading='Automate Authority'
                    body='Introduces a quality gate on developers code change requests owned by a security admin,
            alerting them to required security definition changes whilst the application changes are still
            in-development.'
                    icon={() => <DataPrivacy size={32} />}
                  />
                </InfoSection>
              </Column>
            </Grid>
          )}
      </Column>

    </Grid>
  );
}

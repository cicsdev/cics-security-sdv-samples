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
import sdvVideoImage from './sdv_video.png';

export default function DemoTab({
  onNextTab,
  onPrevTab
}) {
  return (
    <Grid className='tabs-group-content'>
      <Column md={4} lg={8} sm={4} className='demo-tab-content' height='496px'>
        <h3 className='demo-tab-subheading'>Demo</h3>
        <div className='demo-tab-p'>
          <a
            href='https://mediacenter.ibm.com/media/Security%20definition%20validation%20for%20CICS%20TS/1_6d6ovua1'
            target='_blank'
            rel='noreferrer'
          >
            <Image
              className='demo-tab-video-pic'
              src={sdvVideoImage}
              alt='SDV'
              width={780}
            />
          </a>
          {/* <iframe
            src={'https://www.kaltura.com/p/1773841/sp/177384100/embedIframeJs/uiconf_id/\
27941801/partner_id/1773841?iframeembed=true&entry_id=1_6d6ovua1'}
            title='Security definition validation for CICS TS'
            style={{
              width: '100%',
              aspectRatio: '16/9',
              border: 0
            }}
            allowFullScreen
            webkitallowfullscreen='true'
            mozallowfullscreen='true'
            allow='autoplay *; fullscreen *; encrypted-media *'
            sandbox={'allow-same-origin allow-scripts allow-top-navigation allow-modals allow-orientation-lock \
allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation allow-downloads'}
            referrerPolicy='origin-when-cross-origin'
            frameBorder='0'
          /> */}
        </div>
        <center>
          <ButtonSet>
            <Button kind='secondary' onClick={() => onPrevTab()}>Back: Concepts</Button>
            <Button kind='primary' onClick={() => onNextTab()}>Next: How</Button>
          </ButtonSet>
        </center>
      </Column>
      <Column md={4} lg={8} sm={4} className='demo-tab-illo-container'>
        <Image
          className='demo-tab-illo'
          src={tabIlloImage}
          alt='SDV'
          width={604}
          height={498}
        />
      </Column>
    </Grid>
  );
}
DemoTab.propTypes = {
  onNextTab: propTypes.func.isRequired,
  onPrevTab: propTypes.func.isRequired
};

/*
 *  Copyright IBM Corp. 2024
 */
import React from 'react';
import {
  Header,
  HeaderContainer,
  HeaderName,
  SkipToContent
} from '@carbon/react';

function SdvHeader() {
  return (
    <HeaderContainer
      render={() => (
        <Header aria-label='Security definition validation'>
          <SkipToContent />
          <HeaderName prefix='IBM'>
            CICS TS
          </HeaderName>
        </Header>
      )}
    />
  );
}

export default SdvHeader;

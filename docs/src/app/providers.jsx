/*
 *  Copyright IBM Corp. 2024
 */

'use client';

import React from 'react';
import { PropTypes } from 'prop-types';
import { Content, Theme } from '@carbon/react';

import SdvHeader from './components/SdvHeader/SdvHeader';

export default function Providers({ children }) {
  return (
    <div
      style={{
        height: '100vh',
        width: '100%'
      }}
    >
      <Theme theme='g100'>
        <SdvHeader />
      </Theme>
      <Content>{children}</Content>
    </div>
  );
}
Providers.propTypes = {
  children: PropTypes.arrayOf(PropTypes.func).isRequired
};

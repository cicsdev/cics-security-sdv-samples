/*
 *  Copyright IBM Corp. 2024
 */
import './globals.scss';

import React from 'react';
import { PropTypes } from 'prop-types';

import Providers from './providers';

export const metadata = {
  title: 'IBM CICS - Security definition validation',
  description: 'SDV contributes towards larger “zero trust” or “DevSecOps” strategies by introducing “security '
    + 'testing” as far-left in the CICS application development lifecycle as possible, yet with no '
    + 'additional effort required on application developers when they request code changes.'
};

export default function RootLayout({ children }) {
  return (
    <html lang='en'>
      <head>
        <meta name='robots' content='all' />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
RootLayout.propTypes = {
  children: PropTypes.arrayOf(PropTypes.func).isRequired
};

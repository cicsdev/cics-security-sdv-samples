/*
 *  Copyright IBM Corp. 2024
 */
import React from 'react';
import { Grid, Column } from '@carbon/react';
import PropTypes from 'prop-types';

// Take in a phrase and separate the third word in an array
function createArrayFromPhrase(phrase) {
  const splitPhrase = phrase.split(' ');
  const thirdWord = splitPhrase.pop();
  return [splitPhrase.join(' '), thirdWord];
}

function InfoSection(props) {
  const {
    className,
    heading,
    children
  } = props;

  return (
    <Grid className={`${className} info-section`}>
      <Column md={8} lg={16} xlg={3}>
        <h3 className='info-section-heading'>{heading}</h3>
      </Column>
      {children}
    </Grid>
  );
}
InfoSection.propTypes = {
  className: PropTypes.string.isRequired,
  heading: PropTypes.func.isRequired,
  children: PropTypes.arrayOf(PropTypes.func).isRequired
};

function InfoCard(props) {
  const {
    icon,
    heading,
    body
  } = props;

  const splitHeading = createArrayFromPhrase(heading);

  return (
    <Column sm={4} md={8} lg={5} xlg={4} className='info-card'>
      <div>
        <h4 className='info-card-heading'>
          {`${splitHeading[0]} `}
          <strong>{splitHeading[1]}</strong>
        </h4>
        <p className='info-card-body'>{body}</p>
      </div>
      {icon()}
    </Column>
  );
}
InfoCard.propTypes = {
  icon: PropTypes.string.isRequired,
  heading: PropTypes.func.isRequired,
  body: PropTypes.func.isRequired
};

export { InfoSection, InfoCard };

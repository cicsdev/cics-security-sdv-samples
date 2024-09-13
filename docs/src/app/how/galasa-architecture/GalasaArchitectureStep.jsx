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

export default function GalasaArchitectureStep({
  onNextStep,
  onPrevStep
}) {
  return (
    <div className='galasa-architecture-step-container'>
      <div className='galasa-architecture-step-content'>
        <h3 className='galasa-architecture-step-subheading'>Galasa Architecture [Build Engineer task]</h3>
        <p className='galasa-architecture-step-p'>
          With the Galasa tests and repositories now in place, an architecture decision needs to be made
          on how the Galasa tests will run within the CI/CD.
          <br />
          Galasa provides a number of ways to do this, how you chose to do it will be based on the infrastructure
          you currently have and your testing requirements.
          <br />
          <br />
          This guide will not go into detail on how to integrate Galasa into your CI/CD pipeline, as
          there is already information on how to do that in the&nbsp;
          <a
            href='https://galasa.dev/docs/writing-own-tests/running-test-modes'
            target='_blank'
            rel='noreferrer'
          >
            Galasa documentation
          </a>
          .
          <br />
          What this guide will do however, is give a rough overview of the different possible architectures.
        </p>

        <h3 className='galasa-architecture-step-subheading-inner'>Dedicated machine with JVM</h3>
        <p className='galasa-architecture-step-p'>
          As part of the CI/CD pipeline, the automated test run could be conducted on a dedicated machine with
          Java and Galasa already installed and fully configured. It may be the case this dedicated machine
          is actually the same worker that is running the CI/CD pipeline.
          <br />
          <br />
          This would be simplest approach. It is essentially&nbsp;
          <a
            href='https://galasa.dev/docs/writing-own-tests/running-test-modes#locally'
            target='_blank'
            rel='noreferrer'
          >
            running the tests locally
          </a>
          , just that it is being done locally, on the dedicated machine, as part of the pipeline.
          <br />
          This option doesn&apos;t require a great deal of infrastructure set up as other options,
          such as Kubernetes. Galasa is operational when tests are started, and Galasa stops running once the
          tests are finished running.
          <br />
          <br />
          This option works well if there are a small number of tests with no requirement to run test in parallel.
        </p>

        <h3 className='galasa-architecture-step-subheading-inner'>Ecosystem using DSE</h3>
        <p className='galasa-architecture-step-p'>
          As part of the CI/CD pipeline, the automated test run could be conducted on a&nbsp;
          <a
            href='https://galasa.dev/docs/ecosystem/architecture'
            target='_blank'
            rel='noreferrer'
          >
            Galasa Ecosystem
          </a>
          .
          <br />
          <br />
          A Galasa Ecosystem, in short, is Galasa running as a number of microservices in a Kubernetes cluster,
          somewhere.
          An ecosystem acts as a continually-running service, providing all resources required to run tests, in serial
          or parallel,
          acting as a store to hold test and environment properties, storing all current and historical test run
          results,
          as well as a
          list of other features.
          <br />
          <br />
          As part of the CI/CD pipeline, due to the ecosystem likely being external to the pipeline worker, any built
          Galasa tests would need to be published somewhere external and available to the Galasa ecosystem.
          Consideration would then have to be made, to create or update Galasa&nbsp;
          <a
            href='https://galasa.dev/docs/writing-own-tests/test-streams'
          >
            test streams
          </a>
          &nbsp;pointing to the location of
          these published tests in-order to run them in the ecosystem.
          <br />
          Additionally, as this scenario deals with Developer Supplied Environments (DSE), these environments would need
          to be provisioned in advance and be configured in the Galasa Ecosystem properties.
        </p>

        <h3 className='galasa-architecture-step-subheading-inner'>Ecosystem with CICS Region provisioning</h3>
        <p className='galasa-architecture-step-p'>
          This option is the same as the last, but rather than using a fixed number of pre-provisioned CICS Regions via
          DSE, a&nbsp;
          <a href='https://galasa.dev/docs/managers'>Galasa Manager</a>
          &nbsp;is written to provision environments on the fly. This however, is currently an undocumented process.
          <br />
          <br />
          This would be an ideal architecture to use for SDV, as the Galasa Ecosystem would already be running in a
          Kubernetes cluster, therefore the infrastructure would be there to write a galasa manager to provisioning CICS
          regions on the fly before tests run.
        </p>
      </div>
      <br />
      <div className='galasa-architecture-step-footer-buttons'>
        <ButtonSet>
          <Button kind='ghost' onClick={() => onPrevStep()}>Previous Step</Button>
          <Button kind='ghost' onClick={() => onNextStep()}>Next Step</Button>
        </ButtonSet>
      </div>
    </div>
  );
}
GalasaArchitectureStep.propTypes = {
  onNextStep: propTypes.func.isRequired,
  onPrevStep: propTypes.func.isRequired
};

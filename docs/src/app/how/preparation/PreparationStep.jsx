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

export default function PreparationStep({
  onNextStep,
  onPrevStep
}) {
  return (
    <div className='preparation-step-container'>
      <div className='preparation-step-content'>
        <h3 className='preparation-step-subheading'>Preparation</h3>
        <p className='preparation-step-p'>
          Before SDV can be implemented, a CI pipeline must be in place for the CICS application. The CI
          pipeline will have a number of stages/tasks (e.g. Build, Test, Deploy), and some tasks will require
          tooling to complete the task.
          <br />
          The example pipeline has been constructed using a particular set of tooling, the core of these tools
          are listed in the table below, along with the specific versions used. Additionally, a list of
          possible alternatives for each tool has been provided, as SDV isn&apos;t tool specific and the steps taken
          to implement SDV in the example pipeline, will mostly be portable to other tools.
          <br />
          The guide assumes you already have knowledge using the tools listed and will only cover the details
          relevant to implement SDV. Please follow the links in the table to find out more information about each tool.
        </p>
        <p className='preparation-step-p'>
          <center>
            <table className='preparation-step-table'>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Version</th>
                  <th>Usage</th>
                  <th>Alternatives</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <a
                      href='https://github.com/'
                      target='_blank'
                      rel='noreferrer'
                    >
                      GitHub Enterprise Server
                    </a>
                  </td>
                  <td>3.9.19</td>
                  <td>
                    Source Code Management. Storing of source code repositories,
                    which emits webhooks for a vast array of events/actions take on a repository.
                  </td>
                  <td>BitBucket, GitLab, Azure DevOps, Endevor</td>
                </tr>
                <tr>
                  <td>
                    <a
                      href='https://git-scm.com/'
                      target='_blank'
                      rel='noreferrer'
                    >
                      Git
                    </a>
                  </td>
                  <td>2.45.2</td>
                  <td>Git CLI tool, to interact with the local git repositories and push to the server.</td>
                  <td>Mercurial</td>
                </tr>
                <tr>
                  <td>
                    <a
                      href='https://galasa.dev/'
                      target='_blank'
                      rel='noreferrer'
                    >
                      Galasa
                    </a>
                  </td>
                  <td>0.34.1</td>
                  <td>
                    An automated test framework for z/OS, allowing tests to be developed and ran on z/OS systems
                    and CICS regions. Additionally, provides ability to develop &quot;managers&quot;, which provide
                    bespoke behaviour during the test lifecycle. The&nbsp;
                    <a
                      href='https://galasa.dev/docs/managers/sdv-manager'
                      target='_blank'
                      rel='noreferrer'
                    >
                      SDV Manager
                    </a>
                    &nbsp;has been contributed to the Galasa
                    project to provide the ability to capture Security usage during test class runs.
                  </td>
                  <td>JUnit, zUnit, Test4z, Endevor</td>
                </tr>
                <tr>
                  <td>
                    <a
                      href='https://tekton.dev/docs/'
                      target='_blank'
                      rel='noreferrer'
                    >
                      Tekton
                    </a>
                  </td>
                  <td>
                    Pipelines - 0.58.0
                    Triggers - 0.45.0
                  </td>
                  <td>CI/CD framework, which orchestrates the pipeline</td>
                  <td>Jenkins, Travis, CircleCI</td>
                </tr>
                <tr>
                  <td>
                    <a
                      href='https://docs.ansible.com/'
                      target='_blank'
                      rel='noreferrer'
                    >
                      Ansible
                    </a>
                  </td>
                  <td>10.2.0</td>
                  <td>
                    Infrastructure-as-code tooling, which we have utilised to provide the post-test workflow
                    for the SDV process. This will need to be installed to run our post-test scripts.
                  </td>
                  <td>Bash, Python</td>
                </tr>
                <tr>
                  <td>
                    <a
                      href='https://github.com/cicsdev/cics-security-sdv-samples'
                      target='_blank'
                      rel='noreferrer'
                    >
                      SDV Approval Bot
                    </a>
                  </td>
                  <td>1.0.0</td>
                  <td>
                    A bespoke GitHub App which receives event hooks from GitHub when particular
                    events/action take place on repositories (e.g. pull request created, review completed),
                    . It then run the relevant workflow for the received event. In the case of the example
                    pipeline, the bot synchronises the state between the app/test pull request, and the
                    security PR (e.g. an rejected review in the security pull request, will require a failed
                    security check in the application pull request, with details)
                  </td>
                  <td>Flask, ExpressJS</td>
                </tr>
                <tr>
                  <td>
                    <a
                      href='https://docs.gradle.org/current/userguide/userguide.html'
                      target='_blank'
                      rel='noreferrer'
                    >
                      Gradle
                    </a>
                  </td>
                  <td>7.6.4</td>
                  <td>Java project build tool. Used to build and package Galasa tests.</td>
                  <td>Maven</td>
                </tr>
                <tr>
                  <td>
                    <a
                      href='https://www.oracle.com/uk/java/technologies/javase/jdk11-archive-downloads.html'
                      target='_blank'
                      rel='noreferrer'
                    >
                      Java JDK
                    </a>
                  </td>
                  <td>11</td>
                  <td>Java 11 is required for the Galasa version we use.</td>
                  <td>None</td>
                </tr>
                <tr>
                  <td>
                    <a
                      href='https://docs.docker.com/'
                      target='_blank'
                      rel='noreferrer'
                    >
                      Docker
                    </a>
                  </td>
                  <td>26.1.0</td>
                  <td>Platform to aid containerisation. Used to create images and push to registries.</td>
                  <td>Podman</td>
                </tr>
              </tbody>
            </table>
          </center>
          <br />
        </p>
      </div>
      <div className='preparation-step-footer-buttons'>
        <ButtonSet>
          <Button kind='ghost' onClick={() => onPrevStep()}>Previous Step</Button>
          <Button kind='ghost' onClick={() => onNextStep()}>Next Step</Button>
        </ButtonSet>
      </div>
    </div>
  );
}
PreparationStep.propTypes = {
  onNextStep: propTypes.func.isRequired,
  onPrevStep: propTypes.func.isRequired
};

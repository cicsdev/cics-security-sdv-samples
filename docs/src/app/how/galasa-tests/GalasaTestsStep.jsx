/*
 *  Copyright IBM Corp. 2024
 */

'use client';

import React from 'react';
import propTypes from 'prop-types';
import {
  Button,
  ButtonSet,
  CodeSnippet
} from '@carbon/react';

export default function GalasaTestsStep({
  onNextStep,
  onPrevStep
}) {
  return (
    <div className='galasa-tests-step-container'>
      <div className='galasa-tests-step-content'>
        <h3 className='galasa-tests-step-subheading'>Test Workflow</h3>
        <p className='galasa-tests-step-p'>
          This step focuses on the required changes to automated testing to implement SDV.
          <br />
          It will show this using the automated test framework for z/OS,&nbsp;
          <a
            href='https://galasa.dev/'
            target='_blank'
            rel='noreferrer'
          >
            Galasa
          </a>
          , and will heavily rely on&nbsp;
          <a
            href='https://galasa.dev/docs/managers/sdv-manager'
            target='_blank'
            rel='noreferrer'
          >
            Galasa&apos;s SDV Manager
          </a>
          &nbsp;to achieve some of the workflow. The SDV
          Manager has been contributed to the Galasa project as part of implementing this
          example pipeline.
        </p>

        <p className='galasa-tests-step-p'>
          <strong>However</strong>
          , it is completely viable to implement this using any other framework or tooling.
          It would require creating a similar workflow that the SDV Manager follows. The core steps of
          the workflow, on a per test class basis are:

          <ol className='galasa-tests-step-manual-list'>
            <li>
              Configure SRR & SDC if not already active.
            </li>
            <li>
              Allocate the test users from a user pool, which are of required roles requested by the test itself.
            </li>
            <li>
              Log each test user into their own terminal. This terminal is then reused for CICS interactions
              in the test cases.&nbsp;
              <em>
                (it is key, no matter how communications are sent to CICS, that the interactions
                are authenticated and associated with a user)
              </em>
            </li>
            <li>
              Start SDC recording for each test user, per CICS region under test.
            </li>
            <li>
              Run the test cases within the test class.
            </li>
            <li>
              Stop all SDC recordings previously started.
            </li>
            <li>
              Run CICS program&nbsp;
              <CodeSnippet type='inline'>DFHXSDSO</CodeSnippet>
              , providing it parameters that include the SRR IDs for the SDC recordings,
              and mappings of user names to role names.
            </li>
            <li>
              Store the Security metadata YAML returned by&nbsp;
              <CodeSnippet type='inline'>DFHXSDSO</CodeSnippet>
              &nbsp;somewhere accessible by future pipeline tasks.
            </li>
            <li>
              Release test users back to user pool.
            </li>
          </ol>
        </p>

        <p className='galasa-tests-step-p'>
          Along with these workflow steps, it is possible to view the&nbsp;
          <a
            href={'https://github.com/galasa-dev/managers/tree/main/galasa-manag\
ers-parent/galasa-managers-testingtools-parent/dev.galasa.sdv.manager'}
            target='_blank'
            rel='noreferrer'
          >
            SDV Manager source code on GitHub
          </a>
          , assisting you in implementing and adapting the workflow into your own pipeline and tooling.
        </p>
        <h3 className='galasa-tests-step-subheading'>Galasa Tests [CICS Tester task]</h3>
        <p className='galasa-tests-step-p'>
          This guide is not intended to walk you through how to use Galasa, it is assumed some knowledge
          already exists.
          <br />
          If you are not familiar with Galasa, you can&nbsp;
          <a
            href='https://galasa.dev/docs'
            target='_blank'
            rel='noreferrer'
          >
            read through the documentation
          </a>
          , in particular, at this point, it would
          be valuable working through the steps to obtain all the necessary tools, knowing how to create,
          build, run, and view the test results of Galasa projects. Working through the&nbsp;
          <a
            href='https://galasa.dev/docs/running-simbank-tests/exploring-simbank-tests'
            target='_blank'
            rel='noreferrer'
          >
            SimBank section
          </a>
          &nbsp;would also be beneficial, to understand how to develop Galasa tests in more detail.
          <br />
          Regardless, this guide will mention some core steps to get a Galasa project started, before delving into
          some more details steps specifically covering SDV.
        </p>
        <h3 className='galasa-tests-step-subheading-inner'>CLI</h3>
        <p className='galasa-tests-step-p'>
          Having the Galasa CLI is essential for developing Galasa tests.
          <br />
          Firstly,&nbsp;
          <a
            href='https://galasa.dev/docs/cli-command-reference/cli-prereqs'
            target='_blank'
            rel='noreferrer'
          >
            Follow the instructions
          </a>
          &nbsp;for installing the required CLI prerequisites. (This guide will focus on using Gradle, so Maven
          would not be required)
          <br />
          Once the CLI prerequisites are in place, then&nbsp;
          <a
            href='https://galasa.dev/docs/cli-command-reference/installing-cli-tool'
            target='_blank'
            rel='noreferrer'
          >
            follow the instructions
          </a>
          &nbsp;to install the Galasa CLI tool itself (the CLI & BOM versions should match, this guide will be
          using 0.34.1).
        </p>
        <h3 className='galasa-tests-step-subheading-inner'>Create project</h3>
        <p className='galasa-tests-step-p'>
          The Galasa CLI has a handy tool that can help you quickly, and easily create a skeleton Galasa project.
          <br />
          <a
            href='https://galasa.dev/docs/writing-own-tests/setting-up-galasa-project'
            target='_blank'
            rel='noreferrer'
          >
            Follow these instructions
          </a>
          &nbsp;to create the starting project.
          <br />
          As an example to work through for this step and to try things out, run:
          <CodeSnippet type='multi'>
            galasactl project create --package com.ibm.cics.sdv.example --features ceda --force --obr --log - --gradle
          </CodeSnippet>
          You can apply all the following steps to this starter project. You should immediately be able to build the
          project by entering the directory and running
          <CodeSnippet type='inline' feedback='Copied to clipboard'>
            gradle clean build publishToMavenLocal
          </CodeSnippet>
          .
        </p>

        <h3 className='galasa-tests-step-subheading-inner'>Run tests</h3>
        <p className='galasa-tests-step-p'>
          Once you have a Galasa project and have built it using the steps in the documentation.&nbsp;
          <a
            href='https://galasa.dev/docs/cli-command-reference/cli-runs-submit-local'
            target='_blank'
            rel='noreferrer'
          >
            Follow these instructions
          </a>
          &nbsp;on how to run the tests in your new Galasa project on your local machine.
          <br />
          If you are following the example work through, you can use the command:
          <CodeSnippet type='multi'>
            {'galasactl runs submit local --log - \
--obr mvn:com.ibm.cics.sdv.example/com.ibm.cics.sdv.example.obr/\
0.0.1-SNAPSHOT/obr --class com.ibm.cics.sdv.example.ceda/com.ibm.cics.sdv.example.ceda.TestCeda'}
          </CodeSnippet>
        </p>

        <h3 className='galasa-tests-step-subheading-inner'>Introducing the SDV Manager</h3>
        <p className='galasa-tests-step-p'>
          Now you have a working Galasa test project, we can introduce the SDV
          Manager.
          <br />
          Firstly, the SDV manager, along with any other relevant manager&apos;s we&apos;ll use
          (CICS TS Manager, zos3270 Manager etc.)
          must be added to the
          list of Gradle build dependencies
          for the test project:

          <CodeSnippet type='multi' feedback='Copied to clipboard'>
            {`implementation 'dev.galasa:dev.galasa.cicsts.manager'
implementation 'dev.galasa:dev.galasa.zos3270.manager'
implementation 'dev.galasa:dev.galasa.sdv.manager'
`}
          </CodeSnippet>
          <br />
          If following the example work through, the above should be added to file&nbsp;
          <CodeSnippet type='inline' feedback='Copied to clipboard'>
            com.ibm.cics.sdv.example.ceda/build.gradle
          </CodeSnippet>
          &nbsp;. The dependencies section should now look like this:

          <CodeSnippet type='multi' feedback='Copied to clipboard'>
            {`// What are the dependencies of the test code ? 
// When more managers and dependencies are added, this list will need to grow.
dependencies {
    implementation platform('dev.galasa:galasa-bom:0.34.1')

    implementation 'dev.galasa:dev.galasa'
    implementation 'dev.galasa:dev.galasa.framework'
    implementation 'dev.galasa:dev.galasa.core.manager'
    implementation 'dev.galasa:dev.galasa.artifact.manager'
    implementation 'commons-logging:commons-logging'
    implementation 'org.assertj:assertj-core'
    implementation 'dev.galasa:dev.galasa.cicsts.manager'
    implementation 'dev.galasa:dev.galasa.zos3270.manager'
    implementation 'dev.galasa:dev.galasa.sdv.manager'
}`}
          </CodeSnippet>
          <br />
          With the SDV Manager now part of the project, run
          <CodeSnippet type='inline' feedback='Copied to clipboard'>
            gradle clean build publishToMavenLocal
          </CodeSnippet>
          to ensure the project still builds.
        </p>

        <h3 className='galasa-tests-step-subheading-inner'>Using the SDV Manager in a test</h3>
        <p className='galasa-tests-step-p'>
          Now that the SDV manager is part of the new Galasa project, a number of steps are
          taken to explicitly use the manager in a test.
          <br />
          In addition to the SDV Manager, this guide will also introduce a number of other managers that
          would be commonly used alongside the SDV Manager.

          <ol className='galasa-tests-step-manual-list'>
            <li>
              There are three core packages from the SDV Manager that must be imported at the top of each test class:

              <CodeSnippet type='multi' feedback='Copied to clipboard'>
                {`import dev.galasa.sdv.ISdvUser;
import dev.galasa.sdv.SdvManagerException;
import dev.galasa.sdv.SdvUser;`}
              </CodeSnippet>
              <br />
              As well as the above, you may import the commonly used packages below to interact with CICS regions
              and terminals:
              <CodeSnippet type='multi' feedback='Copied to clipboard'>
                {`import dev.galasa.cicsts.CicsRegion;
import dev.galasa.cicsts.CicsTerminal;
import dev.galasa.cicsts.ICicsRegion;
import dev.galasa.cicsts.ICicsTerminal;`}
              </CodeSnippet>
              <br />
            </li>
            <li>
              At least one CICS region must be declared in the test for the SDV Manager to operate.
              <br />
              <br />
              You will have already imported the&nbsp;
              <CodeSnippet type='inline'>CicsRegion</CodeSnippet>
              &nbsp;annotation and associated interface in the step above.
              <br />
              It would now be necessary to declare a CICS Region for the test:
              <CodeSnippet type='multi' feedback='Copied to clipboard'>
                {`@CicsRegion(cicsTag = "CICS_A")
public ICicsRegion cics_A;`}
              </CodeSnippet>
              <br />
              So now, with the addition above, before the test runs, the Galasa CICS TS Manager will create an object
              referencing a CICS
              region that
              is mapped to the tag &quot;CICS_A&quot; in the Galasa CPS properties, and connect to it. This object
              is then returned and
              becomes variable&nbsp;
              <CodeSnippet type='inline'>cics_A</CodeSnippet>
              <br />
              <br />
            </li>

            <li>
              Required test users should now be declared for the test.
              <br />
              Declaring a user is done by using the&nbsp;
              <CodeSnippet type='inline'>@SdvUser</CodeSnippet>
              &nbsp;annotation. The act of using this annotation within a test switches the SDV Manager on. A test
              without this annotation switches the SDV Manager off.
              <br />
              The annotation takes two parameters, which define what role the user returned belongs to, and
              on what CICS region their interactions will be recorded:
              <ul>
                <li>
                  <CodeSnippet type='inline'>cicsTag</CodeSnippet>
                  &nbsp;- This defines which CICS region will record the returned users interactions and resulting
                  security usage.
                  An SdvUser has a one-to-one mapping to a CICS region, in other words, the returned user could be
                  used to interact with different CICS regions, however, those
                  interactions will not be recorded. Should you require a user of the same role but for use on
                  another CICS region, you will need to define another user.
                </li>
                <li>
                  <CodeSnippet type='inline'>roleTag</CodeSnippet>
                  &nbsp;- This defines the group which the returned user should belong to. The tag here should reference
                  a tag configured in the CPS properties (see below), which will then map to an actual role name, and
                  user pool. (This allows you to change the role the test runs with, without changing the test code)
                </li>
              </ul>
              <br />

              To declare an SDV User and assign the user to an SDV User interface object:
              <CodeSnippet type='multi' feedback='Copied to clipboard'>
                {`@SdvUser(cicsTag = "CICS_A", roleTag = "Role1")
public ISdvUser user1;`}
              </CodeSnippet>
              <br />
            </li>

            <li>
              If the users in the test are intended to interact with CICS regions via a 3270 terminal, create a
              terminal for
              each user declared in the previous step, ensuring the terminal is linked to the same CICS region:
              <CodeSnippet type='multi' feedback='Copied to clipboard'>
                {`@CicsTerminal(cicsTag = "CICS_A")
public ICicsTerminal user1Terminal;`}
              </CodeSnippet>
              <br />
              With the required terminals now declared, the user each terminal is intended for is required to sign in to
              the CICS region using the terminal via CESL before their interactions will be recorded. This needs to
              be done before the test cases run.
              <br />
              There is a helper function for doing this, provided by ISDvUser, therefore you do not have to code this
              yourself. Simply create a @BeforeClass annotated function in the test, this code will run before the
              test cases:

              <CodeSnippet type='multi' feedback='Copied to clipboard'>
                {`@BeforeClass
public void logIntoTerminals() throws SdvManagerException {
    user1.logIntoTerminal(user1Terminal);
}`}
              </CodeSnippet>
              <br />
            </li>

            <li>
              At this point, everything is now in-place for SDV to work.
              All that is required is to use the terminals defined above for interactions within the test cases,
              for example:
              <CodeSnippet type='multi' feedback='Copied to clipboard'>
                {`@Test
public void user1UsesCeda() throws Exception {

  user1Terminal.type("CEDA DI G(DFHXSD)").enter().waitForTextInField("RESULTS");

  assertThat(user1Terminal.searchText("CXSD"))
      .as("Expectation to see CXSD in terminal").isTrue();
  user1Terminal.pf3();  
}`}
              </CodeSnippet>
              <br />
              Recording is&nbsp;
              <strong>NOT</strong>
              &nbsp;restricted to terminal interactions, should you require to interact with a CICS Region
              via another method (e.g. TCPIPSERVICE), then they will also be recorded, providing the interaction is
              authenticated (i.e. a username can be associated with the interaction). An example of this would be to use
              basic authentication when calling HTTP endpoints.
              <br />
              <br />
            </li>

          </ol>

          <strong>Note:</strong>
          &nbsp;SDV will identify false positives if your tests do not behave consistently with each
          test run. This means that any resources a test may create or use must be the same name each time the test is
          ran (i.e. Do not use random names, or timestamps in resource naming). Failure to do so will cause security
          metadata deltas on each test run due to the changing resource name.
          <br />
          <br />
          If your following the example work through, your test should now look similar to:

          <CodeSnippet type='multi' feedback='Copied to clipboard'>
            {`package com.ibm.cics.sdv.example.ceda;

import static org.assertj.core.api.Assertions.*;

import dev.galasa.core.manager.*;
import dev.galasa.BeforeClass;
import dev.galasa.Test;
import dev.galasa.sdv.ISdvUser;
import dev.galasa.sdv.SdvManagerException;
import dev.galasa.sdv.SdvUser;
import dev.galasa.cicsts.CicsRegion;
import dev.galasa.cicsts.CicsTerminal;
import dev.galasa.cicsts.ICicsRegion;
import dev.galasa.cicsts.ICicsTerminal;


/**
 * A sample galasa test class 
 */
@Test
public class TestCeda {

  // Galasa will inject an instance of the core manager into the following field
  @CoreManager
  public ICoreManager core;

  @CicsRegion(cicsTag = "CICS_A")
  public ICicsRegion cics_A;

  @CicsTerminal(cicsTag = "CICS_A")
  public ICicsTerminal user1Terminal;

  @SdvUser(cicsTag = "CICS_A", roleTag = "Role1")
  public ISdvUser user1;

  @BeforeClass
  public void logIntoTerminals() throws SdvManagerException {
    user1.logIntoTerminal(user1Terminal);
  }

  @Test
  public void user1UsesCeda() throws Exception {

    user1Terminal.type("CEDA DI G(DFHXSD)").enter().waitForTextInField("RESULTS");

    assertThat(user1Terminal.searchText("CXSD"))
        .as("Expectation to see CXSD in terminal").isTrue();
    user1Terminal.pf3();  
  }
}`}
          </CodeSnippet>

        </p>

        <h3 className='galasa-tests-step-subheading'>Galasa CPS Properties [CICS Tester task]</h3>
        <p className='galasa-tests-step-p'>
          Before the test can run, Galasa needs to be aware of the test environments it can run the test on, as
          well as any specific configuration options.
          This is done via Galasa&apos;s Configuration Property Store (CPS).
          This guide will not take you into great detail about the CPS,&nbsp;
          <a
            href='https://galasa.dev/docs/ecosystem/ecosystem-manage-cps'
            target='_blank'
            rel='noreferrer'
          >
            read the Galasa documentation on CPS for more information
          </a>
          .
          <br />
          <br />
          The SDV Manager has its own CPS properties that must be set in order for it to function.&nbsp;
          <a
            href='https://galasa.dev/docs/managers/sdv-manager#configuring'
            target='_blank'
            rel='noreferrer'
          >
            See the SDV Manager documentation
          </a>
          &nbsp;for more information on all the available CPS properties for the SDV Manager.
          <br />
          These SDV Manager CPS Properties, like all other CPS properties, can be defined in one of a number of places:
          <ul>
            <li>
              On a workstation/build engine in the&nbsp;
              {
                '{GALASA_HOME}/cps.properties'
              }
              &nbsp;file.
            </li>
            <li>
              In a&nbsp;
              <a
                href='https://galasa.dev/docs/ecosystem'
                target='_blank'
                rel='noreferrer'
              >
                Galasa ecosystem&apos;
              </a>
              &nbsp;CPS.
            </li>
            <li>In an overrides file, which can be provided on the CLI when submitting the galasa test for run.</li>
          </ul>
          You may chose to spread your CPS properties over a number of locations, it could potentially be beneficial to
          store the
          SDV specific tests alongside the tests in their repo in an overrides file.
          <br />
          <br />
          As a rough guide to walkthrough, these are how the CPS properties could be added:

          <ol className='galasa-tests-step-manual-list'>
            <li>
              All user credentials should be added to the&nbsp;
              {
                '{GALASA_HOME}/credentials.properties'
              }
              &nbsp;file if running the test locally, or added to the &apos;secure&apos; CPS namespace if running in an
              ecosystem. These should not be provided in an overrides file.
              <br />
              All users created as part of the&nbsp;
              <strong>z/OS Configuration</strong>
              &nbsp;step for the user pool should be added here. Each should be given a unique tag to identify it later
              (for the purpose of demonstrating their use in a later steps, as an example, we will add three users of
              the
              same role &apos;TELLER&apos; tagged
              as
              SDVUSER1,SDVUSER2,SDVUSER3).
              <br />
              <br />
            </li>
            <li>
              Insert common CPS properties for other managers that describe the test environment:
              <CodeSnippet type='multi' feedback='Copied to clipboard'>
                {`cicsts.provision.type=DSE
cicsts.dse.tag.CICS_A.applid=REGION1
cicsts.dse.tag.CICS_A.version=750

zos.cluster.PLEX1.images=IMG1
zos.cluster.DEFAULT.images=IMG1

zos.image.IMG1.default.hostname=a-server.com
zos.image.IMG1.ipv4.hostname=a-server.com
zos.image.IMG1.sysplex=PLEX1
zos.image.IMG1.telnet.port=992
zos.image.IMG1.telnet.tls=true
zos.image.IMG1.max.slots=500

zosmf.sysplex.PLEX2.default.servers=IMG1

zos.dse.tag.IMG1.imageid=IMG1
zos.dse.tag.IMG1.clusterid=IMG1
cicsts.default.logon.initial.text=HIT ENTER FOR LATEST STATUS
cicsts.default.logon.gm.text=******\\(R)`}
              </CodeSnippet>
              <br />

            </li>

            <li>
              Insert the&nbsp;
              <a
                href='https://galasa.dev/docs/managers/sdv-manager#configuring'
                target='_blank'
                rel='noreferrer'
              >
                SDV Manager specific CPS properties
              </a>
              :
              <CodeSnippet type='multi' feedback='Copied to clipboard'>
                {`sdv.zosImage.IMG1.role.TELLER.credTags=SDVUSER1,SDVUSER2,SDVUSER3
sdv.roleTag.Role1.role=TELLER

sdv.cicsTag.SDVCICSA.port=30654
sdv.cicsTag.SDVCICSA.hlq=CICS.INSTALL
sdv.cicsTag.SDVCICSA.SdcActivation=true
sdv.cicsTag.SDVCICSA.SrrLogstreamRemoval=false`}
              </CodeSnippet>
              <br />
              To observe what has been described above. We have a z/OS image tagged as IMG1, and
              the three users we created previously in this guide (SDVUSER1,SDVUSER2,SDVUSER3) have
              been added to a user pool of TELLER on that image, the z/OS machine they were created on.
              <br />
              The properties the map the TELLER role name, to a role tag of &apos;Role1&apos;, which is the
              tag the tests reference.
              <br />
              If a test asks for a user of role tag &apos;Role1&apos;, it will returned one of either
              SDVUSER1,SDVUSER2,SDVUSER3, whichever is available. The SDV Manager will then mark that user
              as &quot;in-use&quot;.
              <br />
              The remaining properties describe SDC configuration behaviour. They will configure SDC for the
              test on port 30654, and will un-configure it once the test has finished, but it will not delete
              the SRR logstream.
            </li>
          </ol>
        </p>
        <h3 className='galasa-tests-step-subheading'>Run SDV test locally [CICS Tester task]</h3>
        <p className='galasa-tests-step-p'>
          At this point, if you have been working through these steps with an example, your galasa project
          should be ready to build again by running&nbsp;
          <CodeSnippet type='inline' feedback='Copied to clipboard'>
            gradle clean build publishToMavenLocal
          </CodeSnippet>
          and the galasa test run could then be submitted via

          <CodeSnippet type='multi' feedback='Copied to clipboard'>
            {'galasactl runs submit local --log - --obr mvn:com.ibm.cics.sdv.example/com.ibm.cics.sd\
v.example.obr/0.0.1-SNAPSHOT/obr --class com.ibm.cics.sdv.example.ceda/com.ibm.cics.sdv.example.ceda.TestC\
eda --overridefile ./overrides.properties'}
          </CodeSnippet>
          Note: the --overridefile param will need removing or updating, depending on how you chose to
          provide the CPS properties.
          <br />
          <br />
          Once the test run has finished, you will want to view the test run results, as well as view
          any artifacts that have been collected as part of the run.
          <br />
          <a
            href='https://galasa.dev/docs/cli-command-reference/viewing-test-results-cli'
            target='_blank'
            rel='noreferrer'
          >
            See this documentation
          </a>
          &nbsp;to view the test results if you are running on a local machine.
          <br />
          <a
            href='https://galasa.dev/docs/cli-command-reference/ecosystem-cli-runs-download'
            target='_blank'
            rel='noreferrer'
          >
            See this documentation
          </a>
          &nbsp;to view the test results if you are running on an ecosystem.
          <br />
          <br />
          Within the stored artifacts of the galasa run, you will see an &apos;sdv&apos; folder.
          This folder will contain all the security metadata files in YAML format for the test run.
          <br />
          If you have been following the worked example, you should have one file in here containing:
          <CodeSnippet type='multi' feedback='Copied to clipboard'>
            {`--- # Security Metadata
version: 2
group_list:
  - name: TELLER
classes:
  - name: XTRAN
    profiles:
      - name: CEDA
        access_lists:
          - access: READ
            groups:
              - TELLER`}
          </CodeSnippet>
          <br />
          As per the example galasa test above, this metadata tell us that the TELLER role requires
          READ access to the CEDA transaction.
        </p>
      </div>
      <br />

      <div className='galasa-tests-step-footer-buttons'>
        <ButtonSet>
          <Button kind='ghost' onClick={() => onPrevStep()}>Previous Step</Button>
          <Button kind='ghost' onClick={() => onNextStep()}>Next Step</Button>
        </ButtonSet>
      </div>
    </div>
  );
}
GalasaTestsStep.propTypes = {
  onNextStep: propTypes.func.isRequired,
  onPrevStep: propTypes.func.isRequired
};

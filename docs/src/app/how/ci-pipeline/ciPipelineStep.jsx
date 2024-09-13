/*
 *  Copyright IBM Corp. 2024
 */

'use client';

import React from 'react';
import propTypes from 'prop-types';
import {
  Button,
  ButtonSet,
  CodeSnippet,
  Tabs,
  Tab,
  TabPanels,
  TabPanel,
  Layer,
  TabList
} from '@carbon/react';

export default function CiPipelineStep({
  onNextStep,
  onPrevStep
}) {
  return (
    <div className='ci-pipeline-step-container'>
      <div className='ci-pipeline-step-content'>
        <h3 className='ci-pipeline-step-subheading'>CI Pipeline [Build Engineer task]</h3>

        <p className='ci-pipeline-step-p'>
          The CI/CD Pipeline is the orchestrator bringing a large number of steps in an SDV
          workflow together.
          <br />
          This guide will not go into deep detail on how to implement a CI/CD pipeline,
          it is too large a topic to cover. Instead this guide will assume knowledge in
          using CI tooling, and will cover the extra parts required to integrate the SDV
          workflow to an existing CI/CD pipeline.
          <br />
          <br />
          The example pipeline was implemented using&nbsp;
          <a
            href='https://tekton.dev/'
            target='_blank'
            rel='noreferrer'
          >
            Tekton
          </a>
          &nbsp;as the CI tooling of choice. Tekton is no different than any other CI tool,
          it orchestrates a number of steps to build/test/deploy applications, however it
          runs each of the steps in a pod on a Kubernetes cluster.
          <br />
          This guide will provide snippets taken from the Tekton implementation, though
          these will be portable to to other CI tools (e.g. Jenkins, Travis, CircleCI).
          We welcome contributions for other technologies. Please raise an issue against the
          repository to provide implementation detail in other tooling.
        </p>

        <p className='ci-pipeline-step-p'>
          These are the steps to implement an SDV CI Pipeline:
          <ol className='ci-pipeline-step-manual-list'>
            <li>
              Create the CI jobs for application and test code repositories, providing
              URLs webhooks can be sent to from the SCM tool to trigger the pipelines.
              <br />
              <Tabs>
                <TabList aria-label='List of tabs' contained fullWidth>
                  <Tab>Tekton</Tab>
                  <Tab disabled>...</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <Layer>
                      In Tekton, this is achieved by creating an&nbsp;
                      <strong>Event Listener</strong>
                      &nbsp;for both the application, and test code repositories to receive webhooks.
                      <br />
                      <br />
                      Each Event Listener then must contain at least one&nbsp;
                      <strong>Interceptor</strong>
                      , which can extract and act on the data within that webhook.
                      <br />
                      <br />
                      In the example pipeline there are
                      two interceptors per event listener:
                      <ul>
                        <li>
                          One to handle pipeline triggers on&nbsp;
                          <strong>main</strong>
                        </li>
                        <li>
                          One to handle pipeline triggers on&nbsp;
                          <strong>pull requests</strong>
                        </li>
                      </ul>
                      <br />
                      There are two interceptors because:
                      <ul>
                        <li>
                          The expected data in the webhook which we want to extract and pass to the
                          pipeline is slightly different for each
                        </li>
                        <li>
                          The pipeline we want to start is different for each.
                        </li>
                      </ul>
                      <br />
                      The interceptors pass extracted data into variable bindings, which are then
                      inserted into a&nbsp;
                      <strong>pipelineRun</strong>
                      &nbsp;template, which creates the pipeline
                      job in Tekton
                      and passes all captured parameters to it, along with secrets and other required parameters.
                      <br />
                      <br />
                      This is a snippet of the Event Listener and its children for the application code
                      repository from the example pipeline. This snippet shows you the data that needs to be
                      extracted from the webhook and passed to the pipeline (some data has been changed for
                      security reasons):
                      <br />
                      <br />
                      <CodeSnippet type='multi'>
                        {`
apiVersion: triggers.tekton.dev/v1alpha1
kind: EventListener
metadata:
  name: sdv-application-code-github-el
  namespace: sdv
spec:
  serviceAccountName: sdv-build-bot
  resources:
    kubernetesResource:
      serviceType: NodePort
  triggers:
#
    - name: sdv-application-code-github-main-listener
      interceptors:
        - ref:
            name: "github"
            kind: ClusterInterceptor
            apiVersion: triggers.tekton.dev
          params:
            - name: "eventTypes"
              value: ["push"]
        - ref:
            name: "cel"
          params:
            - name: "filter"
              value: body.ref.matches('^refs/heads/(main|(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*))?$')
        - ref:
            name: cel
          params:
            - name: "overlays"
              value:
                - key: branch_name
                  expression: "body.ref.split('/')[2]"
      bindings:
        - name: GIT_REPO_URL
          value: $(body.repository.clone_url)
        - name: GIT_SHA
          value: $(body.head_commit.id)
        - name: GIT_REPO_OWNER
          value: $(body.repository.owner.login)
        - name: GIT_REPO_NAME
          value: $(body.repository.name)
        - name: GIT_BRANCH
          value: $(extensions.branch_name)
      template:
        spec:
          params:
            - name: GIT_REPO_URL
              description: The git repository url
            - name: GIT_SHA
              description: The git branch sha
            - name: GIT_REPO_OWNER
              description: The repo parent org.
            - name: GIT_REPO_NAME
              description: The repo name
            - name: GIT_BRANCH
              description: The branch name
          resourcetemplates:
            - apiVersion: tekton.dev/v1beta1
              kind: PipelineRun
              metadata:
                generateName: sdv-application-code-github-main-pipeline-run-
              spec:
                pipelineRef:
                  name: application-main-pipeline
                podTemplate:
                  securityContext:
                    fsGroup: 65532
                serviceAccountName: sdv-build-bot-sa
                params:
                  - name: GIT_REPO_URL
                    value: $(tt.params.GIT_REPO_URL)
                  - name: GITHUB_API_URL
                    value: "https://api.github.com"
                  - name: DOCKER_REPO
                    value: my-docker-registry-server.com/sdv
                  - name: APPLICATION_NAME
                    value: application-code
                  - name: version
                    value: latest
                  - name: REPO_OWNER
                    value: $(tt.params.GIT_REPO_OWNER)
                  - name: REPO_NAME
                    value: $(tt.params.GIT_REPO_NAME)
                  - name: GIT_BRANCH
                    value: $(tt.params.GIT_BRANCH)
                  - name: GIT_SHA
                    value: $(tt.params.GIT_SHA)
                  - name: INFRASTRUCTURE_GIT_REPO_URL
                    value: "https://www.github.com/sdv/sdv-infrastructure.git"
                  - name: SECURITY_GIT_REPO_URL
                    value: "github.com/sdv/application-security.git"
                  - name: TEST_GIT_REPO_URL
                    value: "https://www.github.com/sdv/application-galasa-tests.git"
                  - name: GALASA_ECOSYSTEM_URL
                    value: "https://galasa-ecosystem-server.com/api"
                  - name: REPO_PULL_NUMBER
                    value: ""
                  - name: SECURITY_REPO_OWNER
                    value: sdv
                  - name: SECURITY_REPO_NAME
                    value: application-security
                  - name: TARGET_BRANCH
                    value: $(tt.params.GIT_BRANCH)
                workspaces:
                  - name: git-workspace
                    volumeClaimTemplate:
                      spec:
                        accessModes:
                        - ReadWriteOnce
                        resources:
                          requests:
                            storage: 1Gi
                  - name: gh-app-creds-app-code
                    secret:
                      secretName: sdv-build-bot-application-code-token
                  - name: gh-app-creds-infrastructure
                    secret:
                      secretName: sdv-build-bot-sdv-infrastructure-token
                  - name: gh-app-creds-security
                    secret:
                      secretName: sdv-approval-bot-application-security-token
                  - name: galasa-creds
                    secret:
                      secretName: galasa-sdv-credentials
                  - name: gh-app-creds-app-code-security-bot
                    secret:
                      secretName: sdv-approval-bot-application-code-token
                  - name: gh-app-creds-tests
                    secret:
                      secretName: sdv-build-bot-application-galasa-tests-token
#
    - name: sdv-application-code-github-pr-listener
      interceptors:
        - ref:
            name: "github"
            kind: ClusterInterceptor
            apiVersion: triggers.tekton.dev
          params:
            - name: "eventTypes"
              value: ["pull_request"]
        - ref:
            name: "cel"
          params:
            - name: "filter"
              value: "body.action in ['opened', 'synchronize', 'reopened', 'ready_for_review'] \
&& body.pull_request.draft == false"
      bindings:
        - name: GIT_REPO_URL
          value: $(body.repository.clone_url)
        - name: GIT_REPO_OWNER
          value: $(body.repository.owner.login)
        - name: GIT_REPO_NAME
          value: $(body.repository.name)
        - name: GIT_BRANCH
          value: $(body.pull_request.head.ref)
        - name: GIT_SHA
          value: $(body.pull_request.head.sha)
        - name: GIT_REPO_PULL_NUMBER
          value: $(body.pull_request.number)
        - name: GIT_REPO_PULL_AUTHOR
          value: $(body.pull_request.user.login)
        - name: GIT_TARGET_BRANCH
          value: $(body.pull_request.base.ref)
      template:
        spec:
          params:
            - name: GIT_BRANCH
              description: The git branch
            - name: GIT_SHA
              description: The git revision (SHA)
            - name: GIT_REPO_URL
              description: The git repository url
            - name: GIT_REPO_OWNER
              description: The repo parent org.
            - name: GIT_REPO_NAME
              description: The repo name
            - name: GIT_REPO_PULL_NUMBER
              description: The PR number
            - name: GIT_REPO_PULL_AUTHOR
              description: The PR author
            - name: GIT_TARGET_BRANCH
              description: The PRs target branch
          resourcetemplates:
            - apiVersion: tekton.dev/v1beta1
              kind: PipelineRun
              metadata:
                generateName: sdv-application-code-github-pr-pipeline-run-
              spec:
                pipelineRef:
                  name: application-pr-pipeline
                podTemplate:
                  securityContext:
                    fsGroup: 65532
                serviceAccountName: sdv-build-bot-sa
                params:
                  - name: GIT_BRANCH
                    value: $(tt.params.GIT_BRANCH)
                  - name: GIT_SHA
                    value: $(tt.params.GIT_SHA)
                  - name: GIT_REPO_URL
                    value: $(tt.params.GIT_REPO_URL)
                  - name: GITHUB_API_URL
                    value: "https://api.github.com"
                  - name: REPO_OWNER
                    value: $(tt.params.GIT_REPO_OWNER)
                  - name: REPO_NAME
                    value: $(tt.params.GIT_REPO_NAME)
                  - name: DOCKER_REPO
                    value: my-docker-registry-server.com/sdv
                  - name: APPLICATION_NAME
                    value: application-code
                  - name: version
                    value: latest
                  - name: INFRASTRUCTURE_GIT_REPO_URL
                    value: "https://www.github.com/sdv/sdv-infrastructure.git"
                  - name: SECURITY_GIT_REPO_URL
                    value: "github.com/sdv/application-security.git"
                  - name: TEST_GIT_REPO_URL
                    value: "https://www.github.com/sdv/application-galasa-tests.git"
                  - name: GALASA_ECOSYSTEM_URL
                    value: "https://galasa-ecosystem-server.com/api"
                  - name: REPO_PULL_NUMBER
                    value: $(tt.params.GIT_REPO_PULL_NUMBER)
                  - name: REPO_PULL_AUTHOR
                    value: $(tt.params.GIT_REPO_PULL_AUTHOR)
                  - name: SECURITY_REPO_OWNER
                    value: sdv
                  - name: SECURITY_REPO_NAME
                    value: application-security
                  - name: TARGET_BRANCH
                    value: $(tt.params.GIT_TARGET_BRANCH)
                workspaces:
                  - name: git-workspace
                    volumeClaimTemplate:
                      spec:
                        accessModes:
                        - ReadWriteOnce
                        resources:
                          requests:
                            storage: 1Gi
                  - name: gh-app-creds-app-code
                    secret:
                      secretName: sdv-build-bot-application-code-token
                  - name: gh-app-creds-infrastructure
                    secret:
                      secretName: sdv-build-bot-sdv-infrastructure-token
                  - name: gh-app-creds-security
                    secret:
                      secretName: sdv-approval-bot-application-security-token
                  - name: galasa-creds
                    secret:
                      secretName: galasa-sdv-credentials
                  - name: gh-app-creds-app-code-security-bot
                    secret:
                      secretName: sdv-approval-bot-application-code-token
                  - name: gh-app-creds-tests
                    secret:
                      secretName: sdv-build-bot-application-galasa-tests-token
---
kind: Ingress
apiVersion: networking.k8s.io/v1
metadata:
  name: sdv-application-code-github-main-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - '*.my-kubernetes-server.com'
#      secretName: sdvk8s-wildcard
  rules:
  - host: sdv-application-code-github-sdv.my-kubernetes-server.com
    http:
      paths:
      - backend:
          service:
            name: el-sdv-application-code-github-el
            port:
              number: 8080
        path: /hooks
        pathType: Prefix
                      `}
                      </CodeSnippet>

                    </Layer>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </li>
            <li>
              For the test & application repositories, within the GitHub UI, create a Webhook
              Hook to the endpoint provided by the step above, which
              triggers the CI job. It should push on the following events:
              <ul>
                <br />
                <li>
                  <em>Pull requests</em>
                </li>
                <li>
                  <em>Pushes</em>
                </li>
              </ul>
            </li>
            <li>
              Create a new Pipeline.
              <Tabs>
                <TabList aria-label='List of tabs' contained fullWidth>
                  <Tab>Tekton</Tab>
                  <Tab disabled>...</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <Layer>
                      In Tekton, this would require creating a new Pipeline specification file to be
                      called by the PipelineRun template in the Event Listeners.
                      <br />
                      <br />
                      Below are the Pull Request Pipeline specs for both the application code and test code repositories
                      (certain data is replaced for security purposes).
                      This demonstrates all the stages within the pipelines.
                      The following steps within this guide will drill down into each stage of the
                      pipelines in more detail, and will refer back to these snippets.
                      <br />
                      <br />
                      <strong>Application Code Pull Request Pipeline</strong>
                      <CodeSnippet type='multi'>
                        {`
apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: application-pr-pipeline
spec:
  description: | 
    builds and deploys PR application
#
  params:
    - name: GIT_REPO_URL
      type: string
      description: The git repo URL to clone from.
    - name: GIT_BRANCH
      type: string
    - name: GITHUB_API_URL
      type: string
    - name: APPLICATION_NAME
      type: string
    - name: VERSION
      type: string
      default: latest
    - name: DOCKER_REPO
      type: string
    - name: REPO_OWNER
      type: string
    - name: REPO_NAME
      type: string
    - name: GIT_SHA
      type: string
    - name: INFRASTRUCTURE_GIT_REPO_URL
      type: string
    - name: SECURITY_GIT_REPO_URL
      type: string
    - name: GALASA_ECOSYSTEM_URL
      type: string
    - name: GALASA_TEST_STREAM_NAME
      type: string
      default: sdv-$(params.TARGET_BRANCH)
    - name: REPO_PULL_NUMBER
      type: string
    - name: REPO_PULL_AUTHOR
      type: string
    - name: SECURITY_REPO_OWNER
      type: string
    - name: SECURITY_REPO_NAME
      type: string
    - name: TARGET_BRANCH
      type: string
    - name: TEST_GIT_REPO_URL
      type: string
    - name: GALASA_APPCODE_TEST_STREAM_NAME
      type: string
      default: sdv-appcode-$(params.GIT_BRANCH)
#
  workspaces:
    - name: git-workspace
    - name: gh-app-creds-app-code
    - name: gh-app-creds-infrastructure
    - name: gh-app-creds-security
    - name: gh-app-creds-tests
    - name: galasa-creds
    - name: gh-app-creds-app-code-security-bot
#
  tasks:
#
    - name: create-gh-checks
      taskRef:
        name: create-gh-checks
      workspaces:
      - name: gh-app-creds
        workspace: gh-app-creds-app-code
      params:
        - name: TOKEN_PATH
          value: $(workspaces.gh-app-creds.path)/password
        - name: ARGS
          value:
          - $(params.REPO_OWNER)
          - $(params.REPO_NAME)
          - $(params.GIT_SHA)
          - $(params.GITHUB_API_URL)
          - Clone [Application],Clone [Infrastructure],Clone [Tests],Acquire Lease,Build,\
Image & Push,Deploy [Image],Deploy [Application],Test,Release Lease
#
    - name: create-gh-security-check
      taskRef:
        name: create-gh-checks
      workspaces:
      - name: gh-app-creds
        workspace: gh-app-creds-app-code-security-bot
      params:
        - name: TOKEN_PATH
          value: $(workspaces.gh-app-creds.path)/password
        - name: ARGS
          value:
          - $(params.REPO_OWNER)
          - $(params.REPO_NAME)
          - $(params.GIT_SHA)
          - $(params.GITHUB_API_URL)
          - Security
#
    - name: clone-app-repo
      runAfter:
        - create-gh-checks
      taskRef:
        name: gh-clone
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-clone-creds
          workspace: gh-app-creds-app-code
        - name: gh-app-check-creds
          workspace: gh-app-creds-app-code
      params:
        - name: URL
          value: $(params.GIT_REPO_URL)
        - name: REVISION
          value: $(params.GIT_BRANCH)
        - name: DEPTH
          value: "2"
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: SUBDIRECTORY
          value: application
        - name: CHECK_NAME
          value: Clone [Application]
#
    - name: clone-infrastructure-repo
      runAfter:
        - create-gh-checks
      taskRef:
        name: gh-clone
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-clone-creds
          workspace: gh-app-creds-infrastructure
        - name: gh-app-check-creds
          workspace: gh-app-creds-app-code
      params:
        - name: URL
          value: $(params.INFRASTRUCTURE_GIT_REPO_URL)
        - name: REVISION
          value: main
        - name: DEPTH
          value: "2"
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: SUBDIRECTORY
          value: infrastructure
        - name: CHECK_NAME
          value: Clone [Infrastructure]
#
    - name: clone-test-repo
      runAfter:
        - create-gh-checks
      taskRef:
        name: gh-clone
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-clone-creds
          workspace: gh-app-creds-tests
        - name: gh-app-check-creds
          workspace: gh-app-creds-app-code
      params:
        - name: URL
          value: $(params.TEST_GIT_REPO_URL)
        - name: REVISION
          value: main
        - name: DEPTH
          value: "2"
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: SUBDIRECTORY
          value: tests
        - name: CHECK_NAME
          value: Clone [Tests]
#
    - name: acquire-plex-lease
      runAfter:
        - clone-app-repo
      taskRef:
        name: acquire-lease-task
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-code
      params:
        - name: OWNER
          value: $(context.pipelineRun.name)
        - name: NAMESPACE
          value: sdv
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Acquire Lease
#
    - name: build-app
      runAfter:
        - clone-app-repo
        - acquire-plex-lease
      taskRef:
        name: gradle-build-tests
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-creds
          workspace: gh-app-creds-app-code
      params:
        - name: GRADLE_PROJECT_PATH
          value: $(workspaces.git-workspace.path)/application/.deploy/com.ibm.sdv.compile.test
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: GALASA_BOOTSTRAP_URL
          value: $(params.GALASA_ECOSYSTEM_URL)/bootstrap
        - name: GALASA_STREAM
          value: $(params.GALASA_APPCODE_TEST_STREAM_NAME)
#
    - name: copy-files-to-maven-folder
      runAfter:
        - build-app
        - clone-infrastructure-repo
      workspaces:
        - name: git-workspace
          workspace: git-workspace
      taskSpec:
        steps:
          - name: copy-folder
            image: registry.hub.docker.com/ubuntu:24.04
            script: |
              echo "Copying docker image assets"
              mkdir $(workspaces.git-workspace.path)/maven-repo/
              cp -R $(workspaces.git-workspace.path)/infrastructure/application-code/dockerfiles/\
galasa-tests-maven-repo/* $(workspaces.git-workspace.path)/maven-repo/

              echo "Copying .m2 folder"
              cp -R $(workspaces.git-workspace.path)/.m2/ $(workspaces.git-workspace.path)/maven-repo/
#
    - name: image-and-push
      runAfter:
        - copy-files-to-maven-folder
        - acquire-plex-lease
      taskRef:
        name: build-image
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-creds
          workspace: gh-app-creds-app-code
      params:
        - name: DOCKER_REPO
          value: $(params.DOCKER_REPO)
        - name: APPLICATION_NAME
          value: $(params.APPLICATION_NAME)-$(params.GALASA_APPCODE_TEST_STREAM_NAME)
        - name: VERSION
          value: $(params.VERSION)
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Image & Push
        - name: DOCKER_PROJECT_PATH
          value: $(workspaces.git-workspace.path)/maven-repo
# 
    - name: helm-deployment
      runAfter:
        - image-and-push
        - acquire-plex-lease
      taskRef:
        name: helm
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-creds
          workspace: gh-app-creds-app-code
      params:
        - name: script
          value: |
            lcApplicationName=\`echo "$1" | awk '{print tolower($0)}' | awk '{gsub(/\\./,"-"); print}'\`
            lcGalasaStream=\`echo "$(params.GALASA_APPCODE_TEST_STREAM_NAME)" | awk '{print tolower($0)\
}' | awk '{gsub(/\\./,"-"); print}'\`

            rm $(workspaces.git-workspace.path)/infrastructure/application-code/deployment/values.yaml
            echo "{image: $(params.DOCKER_REPO)/$(params.APPLICATION_NAME), test_stream_name: $lcGalasa\
Stream, version: latest}" > $(workspaces.git-workspace.path)/infrastructure/application-code/deployment/values.yaml

            helm install $lcApplicationName $(workspaces.git-workspace.path)/infrastructure/application-code/deployment
        - name: ARGS
          value:
            - $(params.APPLICATION_NAME)-$(params.GALASA_APPCODE_TEST_STREAM_NAME)
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Deploy [Image]
#
    - name: run-compile-deployment-test
      runAfter:
        - helm-deployment
        - acquire-plex-lease
      taskRef:
        name: galasactl
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-code
        - name: git-workspace
          workspace: git-workspace
        - name: galasa-creds
          workspace: galasa-creds
      params:
        - name: script
          value: |
            lcGalasaTestStreamName=\`echo "$(params.GALASA_APPCODE_TEST_STREAM_NAME)" | awk '{print to\
lower($0)}' | awk '{gsub(/\\./,"-"); print}'\`

            echo "Applying sdv-appcode-<PR branch> steam properties"
            galasactl properties set -b $(params.GALASA_ECOSYSTEM_URL)/bootstrap -s framework -n test.s\
tream.$lcGalasaTestStreamName.location --value https://application-code-$lcGalasaTestStreamName.my-kuber\
netes-server.com/com/ibm/sdv/com.ibm.sdv.compile.test.obr/0.0.1/com.ibm.sdv.compile.test.obr-0.0.1-testcatalog.json
            galasactl properties set -b $(params.GALASA_ECOSYSTEM_URL)/bootstrap -s framework -n test.st\
ream.$lcGalasaTestStreamName.obr --value mvn:com.ibm.sdv/com.ibm.sdv.compile.test.obr/0.0.1/obr
            galasactl properties set -b $(params.GALASA_ECOSYSTEM_URL)/bootstrap -s framework -n test.st\
ream.$lcGalasaTestStreamName.repo --value https://application-code-$lcGalasaTestStreamName.my-kubernetes-server.com

            echo "Obtaining list of tests to run"
            cd application/.deploy/com.ibm.sdv.compile.test
            galasactl runs prepare                                       \\
                    --bootstrap $(params.GALASA_ECOSYSTEM_URL)/bootstrap \\
                    --portfolio pipeline-app-pr-run-portfolio.yaml       \\
                    --stream $lcGalasaTestStreamName                     \\
                    --package com.ibm.*.runner                           \\
                    --regex

            echo "Submitting test run"
            galasactl runs submit                                            \\
                        --bootstrap $(params.GALASA_ECOSYSTEM_URL)/bootstrap \\
                        --portfolio pipeline-app-pr-run-portfolio.yaml       \\
                        --poll 5                                             \\
                        --progress 1                                         \\
                        --throttle 5                                         \\
                        --log -                                              \\
                        --overridefile ./overrides.properties

            echo "Delete test stream CPS props" 
            galasactl properties delete -b $(params.GALASA_ECOSYSTEM_URL)/boot\
strap -s framework -n test.stream.$lcGalasaTestStreamName.location
            galasactl properties delete -b $(params.GALASA_ECOSYSTEM_URL)/boot\
strap -s framework -n test.stream.$lcGalasaTestStreamName.obr
            galasactl properties delete -b $(params.GALASA_ECOSYSTEM_URL)/boot\
strap -s framework -n test.stream.$lcGalasaTestStreamName.repo

        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Deploy [Application]
        - name: WORKING_DIR
          value: $(workspaces.git-workspace.path)
#
    - name: run-tests
      runAfter:
        - run-compile-deployment-test
        - clone-test-repo
        - acquire-plex-lease
      taskRef:
        name: galasactl
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-code
        - name: git-workspace
          workspace: git-workspace
        - name: galasa-creds
          workspace: galasa-creds
      params:
        - name: script
          value: |
            lcGalasaTestStreamName=\`echo "$(params.GALASA_TEST_STREAM_NAME)" | aw\
k '{print tolower($0)}' | awk '{gsub(/\\./,"-"); print}'\`

            echo "Applying galasa credentials"
            galasactl resources apply -f $(workspaces.galasa-creds.path)/creds.ya\
ml --bootstrap $(params.GALASA_ECOSYSTEM_URL)/bootstrap

            echo "Obtaining list of tests to run"
            cd tests
            galasactl runs prepare                                       \\
                    --bootstrap $(params.GALASA_ECOSYSTEM_URL)/bootstrap \\
                    --portfolio pipeline-test-run-portfolio.yaml         \\
                    --stream $lcGalasaTestStreamName                     \\
                    --package "com.ibm.*.tests"                          \\
                    --regex

            echo "Submitting test run"
            galasactl runs submit                                            \\
                        --bootstrap $(params.GALASA_ECOSYSTEM_URL)/bootstrap \\
                        --portfolio pipeline-test-run-portfolio.yaml         \\
                        --poll 5                                             \\
                        --progress 1                                         \\
                        --throttle 5                                         \\
                        --log -                                              \\
                        --overridefile ./overrides.properties                \\
                        --reportjunit ./test-report.xml                      \\
                        --reportjson  ./test-report.json
            
            echo "Revert app deployment back to main"
            cd ..
            cd application/.deploy/com.ibm.sdv.compile.test
            galasactl runs prepare                                       \\
                    --bootstrap $(params.GALASA_ECOSYSTEM_URL)/bootstrap \\
                    --portfolio pipeline-app-main-run-portfolio.yaml     \\
                    --stream sdv-appcode-main                            \\
                    --package "com.ibm.*.runner"                         \\
                    --regex
            
            galasactl runs submit                                        \\
                    --bootstrap $(params.GALASA_ECOSYSTEM_URL)/bootstrap \\
                    --portfolio pipeline-app-main-run-portfolio.yaml     \\
                    --poll 5                                             \\
                    --progress 1                                         \\
                    --throttle 5                                         \\
                    --log -                                              \\
                    --overridefile ./overrides.properties
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Test
        - name: WORKING_DIR
          value: $(workspaces.git-workspace.path)
#
    - name: release-plex-lease
      runAfter:
        - run-tests
      taskRef:
        name: release-lease-task
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-code
      params:
        - name: OWNER
          value: $(context.pipelineRun.name)
        - name: NAMESPACE
          value: sdv
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Release Lease
#
    - name: run-security
      runAfter:
        - run-tests
      taskRef:
        name: ansible-playbook
      workspaces:
        - name: gh-app-source-creds
          workspace: gh-app-creds-app-code-security-bot
        - name: gh-app-security-creds
          workspace: gh-app-creds-security
        - name: git-workspace
          workspace: git-workspace
        - name: galasa-creds
          workspace: galasa-creds
      params:
        - name: script
          value: |
            git config --global --add safe.directory "$(workspaces.git-workspace.path)/security"

            echo "Run Security playbook"
            ansible-playbook ./playbooks/security-approval.yaml                                                    \\
              -e "test_report_path=$(workspaces.git-workspace.path)/tests/test-report.json"                        \\
              -e "source_repo_approval_bot_token_path=$(workspaces.gh-app-source-creds.path)/password"             \\
              -e "scm_api_base_url=$(params.GITHUB_API_URL)"                                                       \\
              -e "source_repo_owner=$(params.REPO_OWNER)"                                                          \\
              -e "source_repo_name=$(params.REPO_NAME)"                                                            \\
              -e "source_repo_branch=$(params.GIT_BRANCH)"                                                         \\
              -e "source_repo_commit_ref=$(params.GIT_SHA)"                                                        \\
              -e "galasa_ecosystem_url=$(params.GALASA_ECOSYSTEM_URL)"                                             \\
              -e "galasa_token_path=$(workspaces.galasa-creds.path)/GALASA_TOKEN"                                  \\
              -e "github_app_author_name_path=$(workspaces.gh-app-security-creds.path)/author_name"                \\
              -e "github_app_author_email_path=$(workspaces.gh-app-security-creds.path)/author_email"              \\
              -e "source_repo_pull_number=$(params.REPO_PULL_NUMBER)"                                              \\
              -e "security_repo_owner=$(params.SECURITY_REPO_OWNER)"                                               \\
              -e "security_repo_name=$(params.SECURITY_REPO_NAME)"                                                 \\
              -e "target_branch=$(params.TARGET_BRANCH)"                                                           \\
              -e "security_repo_approval_bot_token_path=$(workspaces.gh-app-security-creds.path)/password"         \\
              -e "security_repo_url=$(params.SECURITY_GIT_REPO_URL)"                                               \\
              -e "source_repo_pull_author=$(params.REPO_PULL_AUTHOR)"
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: WORKING_DIR
          value: $(workspaces.git-workspace.path)/infrastructure/application-galasa-tests/ansible-security
#
  finally:
    - name: release-plex-lease-cleanup
      when:
        - input: $(tasks.status)
          operator: in
          values: ["Failed"]
      taskRef:
        name: release-lease-task
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-code
      params:
        - name: OWNER
          value: $(context.pipelineRun.name)
        - name: NAMESPACE
          value: sdv
    - name: helm-cleanup
      when:
        - input: $(tasks.helm-deployment.status)
          operator: in
          values: ["Succeeded"]
      taskRef:
        name: helm
      workspaces:
        - name: git-workspace
          workspace: git-workspace
      params:
        - name: script
          value: |
            lcApplicationName=\`echo "$1" | awk '{print tolower($0)}' | awk '{gsub(/\\./,"-"); print}'\`

            helm uninstall $lcApplicationName --debug
        - name: ARGS
          value:
            - $(params.APPLICATION_NAME)-$(params.GALASA_APPCODE_TEST_STREAM_NAME)
    - name: skip-remaining-checks-due-to-failure
      when:
        - input: $(tasks.status)
          operator: in
          values: ["Failed"]
      taskRef:
        name: update-all-active-gh-checks
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-code
      params:
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
        - name: TITLE
          value: "Cancelling due to failure."
        - name: CONCLUSION
          value: "cancelled"
        - name: APP_ID_PATH
          value: "$(workspaces.gh-app-creds.path)/app_id"
    - name: skip-security-check-due-to-failure
      when:
        - input: $(tasks.status)
          operator: in
          values: ["Failed"]
      taskRef:
        name: update-all-active-gh-checks
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-code-security-bot
      params:
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
        - name: TITLE
          value: "Cancelling due to failure."
        - name: CONCLUSION
          value: "cancelled"
        - name: APP_ID_PATH
          value: "$(workspaces.gh-app-creds.path)/app_id"
                      `}
                      </CodeSnippet>
                      <br />
                      <strong>Test Code Pull Request Pipeline</strong>
                      <CodeSnippet type='multi'>
                        {`
apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: tests-pr-pipeline
spec:
  description: | 
    builds and deploys PR stream galasa tests
#
  params:
    - name: GIT_REPO_URL
      type: string
      description: The git repo URL to clone from.
    - name: GIT_BRANCH
      type: string
    - name: GITHUB_API_URL
      type: string
    - name: APPLICATION_NAME
      type: string
    - name: VERSION
      type: string
      default: latest
    - name: DOCKER_REPO
      type: string
    - name: REPO_OWNER
      type: string
    - name: REPO_NAME
      type: string
    - name: GIT_SHA
      type: string
    - name: INFRASTRUCTURE_GIT_REPO_URL
      type: string
    - name: SECURITY_GIT_REPO_URL
      type: string
    - name: GALASA_ECOSYSTEM_URL
      type: string
    - name: GALASA_TEST_STREAM_NAME
      type: string
      default: sdv-$(params.GIT_BRANCH)
    - name: REPO_PULL_NUMBER
      type: string
    - name: REPO_PULL_AUTHOR
      type: string
    - name: SECURITY_REPO_OWNER
      type: string
    - name: SECURITY_REPO_NAME
      type: string
    - name: TARGET_BRANCH
      type: string
#
  workspaces:
    - name: git-workspace
    - name: gh-app-creds-app-tests
    - name: gh-app-creds-infrastructure
    - name: gh-app-creds-security
    - name: galasa-creds
    - name: gh-app-creds-app-tests-security-bot
#
  tasks:
#
    - name: create-gh-checks
      taskRef:
        name: create-gh-checks
      workspaces:
      - name: gh-app-creds
        workspace: gh-app-creds-app-tests
      params:
        - name: TOKEN_PATH
          value: $(workspaces.gh-app-creds.path)/password
        - name: ARGS
          value:
          - $(params.REPO_OWNER)
          - $(params.REPO_NAME)
          - $(params.GIT_SHA)
          - $(params.GITHUB_API_URL)
          - Clone [Tests],Clone [Infrastructure],Acquire Lease,Build,Image & Push,Deploy,Test,Release Lease
#
    - name: create-gh-security-check
      taskRef:
        name: create-gh-checks
      workspaces:
      - name: gh-app-creds
        workspace: gh-app-creds-app-tests-security-bot
      params:
        - name: TOKEN_PATH
          value: $(workspaces.gh-app-creds.path)/password
        - name: ARGS
          value:
          - $(params.REPO_OWNER)
          - $(params.REPO_NAME)
          - $(params.GIT_SHA)
          - $(params.GITHUB_API_URL)
          - Security
#
    - name: clone-test-repo
      runAfter:
        - create-gh-checks
      taskRef:
        name: gh-clone
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-clone-creds
          workspace: gh-app-creds-app-tests
        - name: gh-app-check-creds
          workspace: gh-app-creds-app-tests
      params:
        - name: URL
          value: $(params.GIT_REPO_URL)
        - name: REVISION
          value: $(params.GIT_BRANCH)
        - name: DEPTH
          value: "2"
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: SUBDIRECTORY
          value: tests
        - name: CHECK_NAME
          value: Clone [Tests]
#
    - name: clone-infrastructure-repo
      runAfter:
        - create-gh-checks
      taskRef:
        name: gh-clone
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-clone-creds
          workspace: gh-app-creds-infrastructure
        - name: gh-app-check-creds
          workspace: gh-app-creds-app-tests
      params:
        - name: URL
          value: $(params.INFRASTRUCTURE_GIT_REPO_URL)
        - name: REVISION
          value: main
        - name: DEPTH
          value: "2"
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: SUBDIRECTORY
          value: infrastructure
        - name: CHECK_NAME
          value: Clone [Infrastructure]
#
    - name: acquire-plex-lease
      runAfter:
        - clone-test-repo
      taskRef:
        name: acquire-lease-task
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-tests
      params:
        - name: OWNER
          value: $(context.pipelineRun.name)
        - name: NAMESPACE
          value: sdv
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Acquire Lease
#
    - name: build-tests
      runAfter:
        - clone-test-repo
        - acquire-plex-lease
      taskRef:
        name: gradle-build-tests
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-creds
          workspace: gh-app-creds-app-tests
      params:
        - name: GRADLE_PROJECT_PATH
          value: $(workspaces.git-workspace.path)/tests
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: GALASA_BOOTSTRAP_URL
          value: $(params.GALASA_ECOSYSTEM_URL)/bootstrap
        - name: GALASA_STREAM
          value: $(params.GALASA_TEST_STREAM_NAME)
#
    - name: copy-files-to-maven-folder
      runAfter:
        - build-tests
        - clone-infrastructure-repo
        - acquire-plex-lease
      workspaces:
        - name: git-workspace
          workspace: git-workspace
      taskSpec:
        steps:
          - name: copy-folder
            image: my-docker-registry.com/dockerhub/library/ubuntu:24.04
            script: |
              echo "Copying docker image assets"
              mkdir $(workspaces.git-workspace.path)/maven-repo/
              cp -R $(workspaces.git-workspace.path)/infrastructure/application-galasa-test\
s/dockerfiles/galasa-tests-maven-repo/* $(workspaces.git-workspace.path)/maven-repo/

              echo "Copying .m2 folder"
              cp -R $(workspaces.git-workspace.path)/.m2/ $(workspaces.git-workspace.path)/maven-repo/
#
    - name: image-and-push
      runAfter:
        - copy-files-to-maven-folder
        - acquire-plex-lease
      taskRef:
        name: build-image
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-creds
          workspace: gh-app-creds-app-tests
      params:
        - name: DOCKER_REPO
          value: $(params.DOCKER_REPO)
        - name: APPLICATION_NAME
          value: $(params.APPLICATION_NAME)-$(params.GALASA_TEST_STREAM_NAME)
        - name: VERSION
          value: $(params.VERSION)
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Image & Push
        - name: DOCKER_PROJECT_PATH
          value: $(workspaces.git-workspace.path)/maven-repo
# 
    - name: helm-deployment
      runAfter:
        - image-and-push
        - acquire-plex-lease
      taskRef:
        name: helm
      workspaces:
        - name: git-workspace
          workspace: git-workspace
        - name: gh-app-creds
          workspace: gh-app-creds-app-tests
      params:
        - name: script
          value: |
            lcApplicationName=\`echo "$1" | awk '{print tolower($0)}' | awk '{gsub(/\\./,"-"); print}'\`
            lcGalasaStream=\`echo "$(params.GALASA_TEST_STREAM_NAME)" | awk '{print to\
lower($0)}' | awk '{gsub(/\\./,"-"); print}'\`

            rm $(workspaces.git-workspace.path)/infrastructure/application-galasa-tests/deployment/values.yaml
            echo "{image: $(params.DOCKER_REPO)/$(params.APPLICATION_NAME), test_stream_name: $lcGa\
lasaStream, version: latest}" > $(workspaces.git-workspace.path)/infrastructure/applicat\
ion-galasa-tests/deployment/values.yaml

            helm install $lcApplicationName $(workspaces.git-workspace.path)/infrastructure/appli\
cation-galasa-tests/deployment
        - name: ARGS
          value:
            - $(params.APPLICATION_NAME)-$(params.GALASA_TEST_STREAM_NAME)
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Deploy
#
    - name: run-tests
      runAfter:
        - helm-deployment
        - acquire-plex-lease
      taskRef:
        name: galasactl
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-tests
        - name: git-workspace
          workspace: git-workspace
        - name: galasa-creds
          workspace: galasa-creds
      params:
        - name: script
          value: |
            lcGalasaTestStreamName=\`echo "$(params.GALASA_TEST_STREAM_NAME)" | awk\
 '{print tolower($0)}' | awk '{gsub(/\\./,"-"); print}'\`

            echo "Applying sdv-<PR branch> steam properties"
            galasactl properties set -b $(params.GALASA_ECOSYSTEM_URL)/bootstrap -s framework -n test.stream.\
$lcGalasaTestStreamName\
.location --value https://application-galasa-tests-$lcGalasaTestStreamName.my-kubernetes-cluster.com/com/ibm/\
sdv/com.ibm.sdv\
.tests.obr/0.0.1/com.ibm.sdv.tests.obr-0.0.1-testcatalog.json
            galasactl properties set -b $(params.GALASA_ECOSYSTEM_URL)/bootstrap -s framework -n test.stream\
.$lcGalasaTestStreamName.obr --value mvn:com.ibm.sdv/com.ibm.sdv.tests.obr/0.0.1/obr
            galasactl properties set -b $(params.GALASA_ECOSYSTEM_URL)/bootstrap -s framework -n test.stream.\
$lcGalasaTestStreamName.repo --value https://application-galasa-tests-$lcGalasaTestStreamName.my-kubernetes-cluster.com

            echo "Applying galasa credentials"
            galasactl resources apply -f $(workspaces.galasa-creds.path)/creds.yaml --\
bootstrap $(params.GALASA_ECOSYSTEM_URL)/bootstrap

            echo "Obtaining list of tests to run"
            cd tests
            galasactl runs prepare                                       \\
                    --bootstrap $(params.GALASA_ECOSYSTEM_URL)/bootstrap \\
                    --portfolio pipeline-run-portfolio.yaml              \\
                    --stream $lcGalasaTestStreamName                     \\
                    --package com.ibm.*.tests                            \\
                    --regex

            echo "Submitting test run"
            galasactl runs submit                                            \\
                        --bootstrap $(params.GALASA_ECOSYSTEM_URL)/bootstrap \\
                        --portfolio pipeline-run-portfolio.yaml              \\
                        --poll 5                                             \\
                        --progress 1                                         \\
                        --throttle 5                                         \\
                        --log -                                              \\
                        --overridefile ./overrides.properties                \\
                        --reportjunit ./test-report.xml                      \\
                        --reportjson  ./test-report.json

            echo "Delete test stream CPS props" 
            galasactl properties delete -b $(params.GALASA_ECOSYSTEM_URL)/bootstrap -s\
 framework -n test.stream.$lcGalasaTestStreamName.location
            galasactl properties delete -b $(params.GALASA_ECOSYSTEM_URL)/bootstrap -s\
 framework -n test.stream.$lcGalasaTestStreamName.obr
            galasactl properties delete -b $(params.GALASA_ECOSYSTEM_URL)/bootstrap -s\
 framework -n test.stream.$lcGalasaTestStreamName.repo

        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Test
        - name: WORKING_DIR
          value: $(workspaces.git-workspace.path)
#
    - name: release-plex-lease
      runAfter:
        - run-tests
      taskRef:
        name: release-lease-task
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-tests
      params:
        - name: OWNER
          value: $(context.pipelineRun.name)
        - name: NAMESPACE
          value: sdv
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: CHECK_NAME
          value: Release Lease
#
    - name: run-security
      runAfter:
        - run-tests
      taskRef:
        name: ansible-playbook
      workspaces:
        - name: gh-app-source-creds
          workspace: gh-app-creds-app-tests-security-bot
        - name: gh-app-security-creds
          workspace: gh-app-creds-security
        - name: git-workspace
          workspace: git-workspace
        - name: galasa-creds
          workspace: galasa-creds
      params:
        - name: script
          value: |
            git config --global --add safe.directory "$(workspaces.git-workspace.path)/security"

            echo "Run Security playbook"
            ansible-playbook ./playbooks/security-approval.yaml                                                    \\
              -e "test_report_path=$(workspaces.git-workspace.path)/tests/test-report.json"                        \\
              -e "source_repo_approval_bot_token_path=$(workspaces.gh-app-source-creds.path)/password"             \\
              -e "scm_api_base_url=$(params.GITHUB_API_URL)"                                                       \\
              -e "source_repo_owner=$(params.REPO_OWNER)"                                                          \\
              -e "source_repo_name=$(params.REPO_NAME)"                                                            \\
              -e "source_repo_branch=$(params.GIT_BRANCH)"                                                         \\
              -e "source_repo_commit_ref=$(params.GIT_SHA)"                                                        \\
              -e "galasa_ecosystem_url=$(params.GALASA_ECOSYSTEM_URL)"                                             \\
              -e "galasa_token_path=$(workspaces.galasa-creds.path)/GALASA_TOKEN"                                  \\
              -e "github_app_author_name_path=$(workspaces.gh-app-security-creds.path)/author_name"                \\
              -e "github_app_author_email_path=$(workspaces.gh-app-security-creds.path)/author_email"              \\
              -e "source_repo_pull_number=$(params.REPO_PULL_NUMBER)"                                              \\
              -e "security_repo_owner=$(params.SECURITY_REPO_OWNER)"                                               \\
              -e "security_repo_name=$(params.SECURITY_REPO_NAME)"                                                 \\
              -e "target_branch=$(params.TARGET_BRANCH)"                                                           \\
              -e "security_repo_approval_bot_token_path=$(workspaces.gh-app-security-creds.path)/password"         \\
              -e "security_repo_url=$(params.SECURITY_GIT_REPO_URL)"                                               \\
              -e "source_repo_pull_author=$(params.REPO_PULL_AUTHOR)"
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: WORKING_DIR
          value: $(workspaces.git-workspace.path)/infrastructure/application-galasa-tests/ansible-security
#
  finally:
    - name: release-plex-lease-cleanup
      when:
        - input: $(tasks.status)
          operator: in
          values: ["Failed"]
      taskRef:
        name: release-lease-task
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-tests
      params:
        - name: OWNER
          value: $(context.pipelineRun.name)
        - name: NAMESPACE
          value: sdv
    - name: helm-cleanup
      when:
        - input: $(tasks.helm-deployment.status)
          operator: in
          values: ["Succeeded"]
      taskRef:
        name: helm
      workspaces:
        - name: git-workspace
          workspace: git-workspace
      params:
        - name: script
          value: |
            lcApplicationName=\`echo "$1" | awk '{print tolower($0)}' | awk '{gsub(/\\./,"-"); print}'\`

            helm uninstall $lcApplicationName --debug
        - name: ARGS
          value:
            - $(params.APPLICATION_NAME)-$(params.GALASA_TEST_STREAM_NAME)
    - name: skip-remaining-checks-due-to-failure
      when:
        - input: $(tasks.status)
          operator: in
          values: ["Failed"]
      taskRef:
        name: update-all-active-gh-checks
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-tests
      params:
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
        - name: TITLE
          value: "Cancelling due to failure."
        - name: CONCLUSION
          value: "cancelled"
        - name: APP_ID_PATH
          value: "$(workspaces.gh-app-creds.path)/app_id"
    - name: skip-security-check-due-to-failure
      when:
        - input: $(tasks.status)
          operator: in
          values: ["Failed"]
      taskRef:
        name: update-all-active-gh-checks
      workspaces:
        - name: gh-app-creds
          workspace: gh-app-creds-app-tests-security-bot
      params:
        - name: REPO_OWNER
          value: $(params.REPO_OWNER)
        - name: REPO_NAME
          value: $(params.REPO_NAME)
        - name: GIT_SHA
          value: $(params.GIT_SHA)
        - name: GITHUB_API_URL
          value: $(params.GITHUB_API_URL)
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
        - name: TITLE
          value: "Cancelling due to failure."
        - name: CONCLUSION
          value: "cancelled"
        - name: APP_ID_PATH
          value: "$(workspaces.gh-app-creds.path)/app_id"
                      `}
                      </CodeSnippet>
                    </Layer>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </li>
            <li>
              The first task in the pipeline would be to create the necessary quality
              gates that block the change request from being delivered.
              <br />
              Creating them early in the
              process gives the developer immediate feedback that the pipeline has started to run,
              and gives indication of how many stages there are in the pipeline.
              <br />
              These quality gates will be updated as the pipeline runs, and will either pass or fail.
              A fail causes the quality gate to block the change request from being merged.
              <br />
              <br />
              In the example pipeline, we are using GitHub&apos;s built-in feature,&nbsp;
              <a
                href={'https://docs.github.com/en/pull-requests/collaborating-with-pull-reques\
ts/collaborating-on-repositories-with-code-quality-features/about-status-checks'}
                target='_blank'
                rel='noreferrer'
              >
                Status Checks
              </a>
              &nbsp;to achieve this.
              <br />
              <strong>Note:</strong>
              &nbsp;If you are implementing this in GitHub, be aware that only the account that created the
              Status Check can update it. This is particularly relevant when creating the&nbsp;
              <strong>Security</strong>
              &nbsp;check. It is the pipeline that creates the check, however, the post-test process will
              want to update it, and also the Approval Bot (See the next page in the guide). Therefore the
              check should be created using the Approval Bot credentials.
              <br />
              <Tabs>
                <TabList aria-label='List of tabs' contained fullWidth>
                  <Tab>Tekton</Tab>
                  <Tab disabled>...</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <Layer>
                      To create the Status Checks, the example pipeline calls a dedicated Tekton Task which
                      accepts a comma separated list as input, providing all the status check names.
                      This Tekton task then calls a Python script which then creates each Status Check
                      using the GitHub REST API.
                      <br />
                      This is the Python script used in the example pipeline:
                      <br />
                      <br />
                      <CodeSnippet type='multi'>
                        {`
'''
Creates an initial set of GH checks from a list
'''
import json
import os
import sys
import requests


def create_gh_checks(
    token,
    repo_owner,
    repo_name,
    head_sha,
    github_api_url,
    check_names,
    status,
    conclusion
):
    '''Creates an initial set of GH checks from a list'''

    for check_name in check_names:
        data = {
            'name': check_name,
            'head_sha': head_sha,
            'status': status
        }

        if conclusion:
            data['conclusion'] = conclusion

        req = requests.request(
            "POST",
            f"{github_api_url}/repos/{repo_owner}/{repo_name}/check-runs",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.machine-man-preview+json"
            },
            data=json.dumps(data),
            timeout=30
        )

        if not req.status_code == 201:
            ret = req.json()
            sys.exit(f"Failed to create check: {ret}")


def main():
    '''Entry point for program'''

    print(f"Received args: {sys.argv}")

    # Check environment variables
    if os.environ['TOKEN_PATH']:
        token = open(os.environ['TOKEN_PATH'], encoding='utf8').read()
    else:
        sys.exit("TOKEN_PATH not provided")

    if len(sys.argv) == 6 or len(sys.argv) == 8:
        repo_owner = sys.argv[1]
        repo_name = sys.argv[2]
        head_sha = sys.argv[3]
        github_api_url = sys.argv[4]
        check_names = sys.argv[5].split(',')

        if len(sys.argv) == 8:
            status = sys.argv[6]
            conclusion = sys.argv[7]
        else:
            status = 'queued'
            conclusion = None
    else:
        sys.exit("Incorrect number of arguments passed")

    print("Creating GH Checks")
    create_gh_checks(
        token,
        repo_owner,
        repo_name,
        head_sha,
        github_api_url,
        check_names,
        status,
        conclusion
    )
    print("Completed creating GH Checks")


if __name__ == '__main__':
    main()

                      `}
                      </CodeSnippet>

                    </Layer>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </li>
            <li>
              The Application code repository must be cloned to a dedicated folder.
            </li>
            <li>
              The&nbsp;
              <a
                href='https://github.com/cicsdev/cics-security-sdv-samples'
                target='_blank'
                rel='noreferrer'
              >
                CICSdev SDV Samples repository
              </a>
              &nbsp;must be cloned to a dedicated folder.
            </li>
            <li>
              The Security Metadata repository must be cloned to a dedicated folder.
            </li>
            <li>
              If the Galasa architecture uses a DSE, acquire a lease on the system
              so that the pipeline is free to update deployed CICS applications
              (and blocks other pipelines from doing so) without
              affecting anything else.
              This will cause other pipelines
              running in parallel to wait until the lease is freed. Only the pipeline
              with the lease can run actions on the system.
              <br />
              <Tabs>
                <TabList aria-label='List of tabs' contained fullWidth>
                  <Tab>Tekton</Tab>
                  <Tab disabled>...</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <Layer>
                      In the example pipeline, there is a dedicated Tekton Task to acquire
                      the lease.
                      <br />
                      <br />
                      <CodeSnippet type='multi'>
                        {`
apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: acquire-lease-task
spec:
  volumes:
    - name: output
      emptyDir: {}
  workspaces:
    - name: gh-app-creds
  params:
    - name: OWNER
      type: string
    - name: NAMESPACE
      type: string
    - name: CHECK_NAME
      type: string
    - name: REPO_OWNER
      type: string
    - name: REPO_NAME
      type: string
    - name: GIT_SHA
      type: string
    - name: GITHUB_API_URL
      type: string
  steps:
    - name: set-check-in-progress
      image: my-docker-registry.com/sdv/sdv-utils:latest
      env:
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
      script: |
        #!/usr/bin/env bash

        python3 update_gh_check.py                  \\
                        "$(params.REPO_OWNER)"      \\
                        "$(params.REPO_NAME)"       \\
                        "$(params.GIT_SHA)"         \\
                        "$(params.GITHUB_API_URL)"  \\
                        "$(params.CHECK_NAME)"      \\
                        "queued"                    \\
                        "in_progress"               \\
                        ""                          \\
                        ""                          \\
                        ""                          \\
                        ""
#
    - name: create-lease
      image: my-docker-registry.com/sdv/kubectl:latest
      onError: continue
      volumeMounts:
        - mountPath: /output/
          name: output
      script: |
        #!/usr/bin/env bash
        set -eu
        set -x

        exec 1>>/output/lease
        exec 2>&1

        # EOF in yaml is hard, so make a file the simple way
        echo 'apiVersion: custom.sdvk8s/v1' > plex-lease.yaml
        echo 'kind: Lease' >> plex-lease.yaml
        echo 'metadata:' >> plex-lease.yaml
        echo '  name: plex-lease' >> plex-lease.yaml
        echo '  namespace: $(inputs.params.NAMESPACE)' >> plex-lease.yaml
        echo 'spec:' >> plex-lease.yaml
        echo '  owner: $(inputs.params.OWNER)' >> plex-lease.yaml

        # Try to create a lease — either it succeeds, and we are good, or it fails, \
and then we wait for the lease to be deleted or a timeout, and then we make the lease if there was a deletion
        # In the event of a timeout, clear out the dead lease so it doesn't mess up future builds
        kubectl create -f plex-lease.yaml || (echo Waiting for lease && kubectl wait --for=delete lease.custo\
m.sdvk8s/plex-lease --timeout=20m || ( echo “Grabbing abandoned lease.” && kubectl delet\
e lease.custom.sdvk8s/plex-lease ))

        # We could be here for three reasons; 
        # either we successfully created a lease, 
        # we waited and another run’s lease got deleted, 
        # or we waited and the other lease is still there.
        # Run an apply to make sure a lease with our label now exists.
        kubectl apply -f plex-lease.yaml
#
    - name: set-check-complete
      image: my-docker-registry.com/sdv/sdv-utils:latest
      env:
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
      volumeMounts:
        - mountPath: /output/
          name: output
      script: |
        #!/usr/bin/env bash

        exitCode=\`cat $(steps.step-create-lease.exitCode.path)\`

        if [ $exitCode -ne 0 ]; then
            conclusion="failure"
            title=""
        else
            conclusion="success"
            title=""
        fi

        python3 update_gh_check.py                                    \\
                        "$(params.REPO_OWNER)"                        \\
                        "$(params.REPO_NAME)"                         \\
                        "$(params.GIT_SHA)"                           \\
                        "$(params.GITHUB_API_URL)"                    \\
                        "$(params.CHECK_NAME)"                        \\
                        "in_progress"                                 \\
                        "completed"                                   \\
                        "\${conclusion}"                               \\
                        "\${title}"                                    \\
                        ""                                            \\
                        "\`\`\`none $(cat /output/lease)\`\`\`"
        
        exit $exitCode
                      `}
                      </CodeSnippet>

                    </Layer>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </li>
            <li>
              <ul
                style={{
                  listStyle: 'none',
                  marginLeft: '0'
                }}
              >
                <li>
                  For&nbsp;
                  <strong>Application code repository change pipelines only</strong>
                  :
                  <ul>
                    <li>
                      For runs related to a change request:
                      <ol className='ci-pipeline-step-manual-list'>
                        <li>
                          Build application code changes & deploy to the test system.
                          <br />
                          In the example pipeline, a Galasa project has been used to
                          do this, however you might want to consider using the&nbsp;
                          <a
                            href='https://github.com/ansible-collections/ibm_zos_core'
                            target='_blank'
                            rel='noreferrer'
                          >
                            IBM® z/OS® core collection
                          </a>
                          &nbsp;for Ansible to compile the CICS application with the proposed changes and deploy.
                        </li>
                      </ol>
                      <br />
                    </li>
                    <li>
                      For main/release/default branch pipeline runs:
                      <ul>
                        <li>
                          No special behaviour required at this point, the CICS application on the system should be
                          the one built from the main branch already.
                        </li>
                      </ul>
                    </li>
                  </ul>
                </li>

                <li>
                  For&nbsp;
                  <strong>Test code repository change pipelines only</strong>
                  :
                  <ul>
                    <li>
                      For runs related to a change request:
                      <ol className='ci-pipeline-step-manual-list'>
                        <li>
                          Build the Galasa project containing the proposed changes.
                          <br />
                          <Tabs>
                            <TabList aria-label='List of tabs' contained fullWidth>
                              <Tab>Tekton</Tab>
                              <Tab disabled>...</Tab>
                            </TabList>
                            <TabPanels>
                              <TabPanel>
                                <Layer>
                                  In the example pipeline, there is a dedicated Tekton Task to build
                                  and publish the Galasa project using Gradle.
                                  <br />
                                  Once the project has been built, the local maven repository is copied to a
                                  shared location to be accessed by future steps.
                                  <br />
                                  <br />
                                  The snippet below is the Tekton Task created to build Gradle projects.
                                  <br />
                                  <br />
                                  <CodeSnippet type='multi'>
                                    {`
---
apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: gradle-build-tests
  namespace: sdv
  labels:
    app.kubernetes.io/version: '0.2'
    app.kubernetes.io/ansible-version: '2.12.5'
  annotations:
    tekton.dev/pipelines.minVersion: '0.12.1'
    tekton.dev/categories: CLI
    tekton.dev/tags: cli
    tekton.dev/displayName: 'Task to do a gradle build'
    tekton.dev/platforms: "linux/amd64"
spec:
  description: >-
    Task to do a gradle build of a java project
  workspaces:
    - name: git-workspace
    - name: gh-app-creds
  params:
    - name: GRADLE_PROJECT_PATH
      description: path of gradle project
      type: string
    - name: CHECK_NAME
      type: string
      default: Build
    - name: REPO_OWNER
      type: string
    - name: REPO_NAME
      type: string
    - name: GIT_SHA
      type: string
    - name: GITHUB_API_URL
      type: string
    - name: GALASA_BOOTSTRAP_URL
      type: string
    - name: GALASA_STREAM
      type: string
  volumes:
    - name: output
      emptyDir: {}
  steps:
    - name: set-check-in-progress
      image: my-docker-registry.com/sdv/sdv-utils:latest
      env:
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
      script: |
        #!/usr/bin/env bash

        python3 update_gh_check.py                  \\
                        "$(params.REPO_OWNER)"      \\
                        "$(params.REPO_NAME)"       \\
                        "$(params.GIT_SHA)"         \\
                        "$(params.GITHUB_API_URL)"  \\
                        "$(params.CHECK_NAME)"      \\
                        "queued"                    \\
                        "in_progress"               \\
                        ""                          \\
                        "Building..."               \\
                        ""                          \\
                        ""
#
    - name: build-gradle-project
      image: my-docker-registry.com/sdv/gradle:latest
      onError: continue
      volumeMounts:
        - mountPath: /output/
          name: output
      script: |
        #!/usr/bin/env sh
        set -eu
        set -x

        exec 1>>/output/gradle
        exec 2>&1

        lcGalasaStream=\`echo "$(params.GALASA_STREAM)" | awk '{print tolower($0)}' | awk '{gsub(/\\./,"-"); print}'\`

        gradle build publishToMavenLocal -Pbootstrap_url=$(params.GALASA_BOOTSTRAP_URL) -Ptest_stream=$lcGalasaStream;
        cd ~/.m2/repository; ls -al
        mkdir -p $(workspaces.git-workspace.path)/.m2/repository
        cp -R /root/.m2/repository $(workspaces.git-workspace.path)/.m2/repository
        cd $(workspaces.git-workspace.path)/.m2/repository; ls -al
      workingDir: $(params.GRADLE_PROJECT_PATH)
#
    - name: set-check-complete
      image: my-docker-registry.com/sdv/sdv-utils:latest
      env:
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
      volumeMounts:
        - mountPath: /output/
          name: output
      script: |
        #!/usr/bin/env bash

        exitCode=\`cat $(steps.step-build-gradle-project.exitCode.path)\`

        if [ $exitCode -ne 0 ]; then
            conclusion="failure"
            title="Build errors."
        else
            conclusion="success"
            title="Build successful."
        fi

        python3 update_gh_check.py                                    \\
                        "$(params.REPO_OWNER)"                        \\
                        "$(params.REPO_NAME)"                         \\
                        "$(params.GIT_SHA)"                           \\
                        "$(params.GITHUB_API_URL)"                    \\
                        "$(params.CHECK_NAME)"                        \\
                        "in_progress"                                 \\
                        "completed"                                   \\
                        "\${conclusion}"                               \\
                        "\${title}"                                    \\
                        ""                                            \\
                        "\`\`\`none $(cat /output/gradle)\`\`\`"
        
        exit $exitCode
                      `}
                                  </CodeSnippet>
                                </Layer>
                              </TabPanel>
                            </TabPanels>
                          </Tabs>
                          <br />
                        </li>
                        <li>
                          If using a Galasa Ecosystem, deploy the built the Galasa project to a temporary maven repo,
                          which is accessible by the ecosystem.
                          <br />
                          <Tabs>
                            <TabList aria-label='List of tabs' contained fullWidth>
                              <Tab>Tekton</Tab>
                              <Tab disabled>...</Tab>
                            </TabList>
                            <TabPanels>
                              <TabPanel>
                                <Layer>
                                  In the previous step, we saw the example pipeline build the Galasa project, then store
                                  the maven repository to a shared location.
                                  <br />
                                  Referring back to the Pipeline code snippet earlier in this guide,
                                  there was a step named&nbsp;
                                  <strong>copy-files-to-maven-folder</strong>
                                  . This step copied the maven repository one last time to a location accessible to the
                                  next pipeline step&nbsp;
                                  <strong>image-and-push</strong>
                                  , which builds a docker image of the maven repository which is served by an apache web
                                  server when ran. The image is then pushed to a docker registry.
                                  <br />
                                  <br />
                                  The following step after that in the pipeline,&nbsp;
                                  <strong>helm-deployment</strong>
                                  , then starts a deployment in the kubernetes cluster using the newly created docker
                                  image.
                                  This then provides an accessible Maven repo via a service URL which can be provided
                                  to Galasa
                                  as the location to find the new tests to run.
                                  <br />
                                  <br />
                                  Below is the task used by the example pipeline to build and push docker images.
                                  <br />
                                  <br />
                                  <CodeSnippet type='multi'>
                                    {`
---
apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: build-image
spec:
  workspaces:
    - name: git-workspace
    - name: gh-app-creds
  volumes:
    - name: output
      emptyDir: {}
#
  params:
    - name: DOCKER_REPO
      type: string
    - name: APPLICATION_NAME
      type: string
    - name: VERSION
      type: string
    - name: NO_PUSH
      type: string
      default: ""
    - name: CHECK_NAME
      type: string
      default: Build & Push
    - name: REPO_OWNER
      type: string
    - name: REPO_NAME
      type: string
    - name: GIT_SHA
      type: string
    - name: GITHUB_API_URL
      type: string
    - name: DOCKER_PROJECT_PATH
      type: string
      default: $(workspaces.git-workspace.path)
#
  steps:
    - name: set-check-in-progress
      image: my-docker-registry.com/sdv/sdv-utils:latest
      env:
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
      script: |
        #!/usr/bin/env bash

        python3 update_gh_check.py                  \\
                        "$(params.REPO_OWNER)"      \\
                        "$(params.REPO_NAME)"       \\
                        "$(params.GIT_SHA)"         \\
                        "$(params.GITHUB_API_URL)"  \\
                        "$(params.CHECK_NAME)"      \\
                        "queued"                    \\
                        "in_progress"               \\
                        ""                          \\
                        "Building image..."         \\
                        ""                          \\
                        ""
#
    - name: docker
      onError: continue
      workingDir: $(params.DOCKER_PROJECT_PATH)
      image: gcr.io/kaniko-project/executor:debug
      env:
        - name: DOCKER_CONFIG
          value: /tekton/creds/.docker
      volumeMounts:
        - mountPath: /output/
          name: output
      script: |
        #!/busybox/sh

        set -eu
        set -x

        exec 1>>/output/buildPush
        exec 2>&1

        lcApplicationName=\`echo "$(params.APPLICATION_NAME)" | awk '{print tolower($0)}' | a\
wk '{gsub(/\\./,"-"); print}'\`

        /kaniko/executor                                                                  \\
        --dockerfile=Dockerfile                                                           \\
        --context=.                                                                       \\
        --destination=$(params.DOCKER_REPO)/$lcApplicationName:$(params.VERSION)          \\
        $(params.NO_PUSH)                                                                 \\
        --oci-layout-path=$(params.DOCKER_PROJECT_PATH)/image-digest                      \\
        --skip-tls-verify                                                                 \\
        --skip-tls-verify-pull                                                            \\
        --single-snapshot                                                                 \\
        --verbosity=info
#
    - name: set-check-complete
      image: my-docker-registry.com/sdv/sdv-utils:latest
      env:
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
      volumeMounts:
        - mountPath: /output/
          name: output
      script: |
        #!/usr/bin/env bash

        exitCode=\`cat $(steps.step-docker.exitCode.path)\`

        if [ $exitCode -ne 0 ]; then
            conclusion="failure"
            title="Failed to build image and push to registry."
        else
            conclusion="success"
            title="Image built and pushed."
        fi

        python3 update_gh_check.py                                    \\
                        "$(params.REPO_OWNER)"                        \\
                        "$(params.REPO_NAME)"                         \\
                        "$(params.GIT_SHA)"                            \\
                        "$(params.GITHUB_API_URL)"                    \\
                        "$(params.CHECK_NAME)"                        \\
                        "in_progress"                                 \\
                        "completed"                                   \\
                        "\${conclusion}"                               \\
                        "\${title}"                                    \\
                        ""                                            \\
                        "\`\`\`none $(cat /output/buildPush)\`\`\`"
        
        exit $exitCode
                      `}
                                  </CodeSnippet>
                                </Layer>
                              </TabPanel>
                            </TabPanels>
                          </Tabs>
                          <br />
                        </li>
                        <li>
                          If using a Galasa Ecosystem, create a new galasa test stream for the temporary
                          maven repo deployment containing the Galasa test project with the code changes.
                          <br />
                          This is demonstrated within the&nbsp;
                          <strong>run-tests</strong>
                          &nbsp;step, found in the pipeline code snippet earlier in this guide.
                        </li>
                      </ol>
                      <br />
                    </li>
                    <li>
                      For main/release/default branch pipeline runs:
                      <ol className='ci-pipeline-step-manual-list'>
                        <li>
                          Build the Galasa project, using steps similar to the above
                        </li>
                        <br />
                        <li>
                          If using a Galasa Ecosystem, deploy the built the Galasa project to a fixed location
                          where the main/release/default test stream will always be live using similar
                          techniques as above.
                        </li>
                      </ol>
                    </li>
                  </ul>
                </li>

              </ul>
            </li>

            <li>
              If running in a Galasa Ecosystem, build a list of tests to run by&nbsp;
              <a
                href='https://galasa.dev/docs/cli-command-reference/ecosystem-cli-runs-prepare'
                target='_blank'
                rel='noreferrer'
              >
                defining them in a portfolio
              </a>
              .
              <br />
              This is demonstrated within the&nbsp;
              <strong>run-tests</strong>
              &nbsp;step, found in the pipeline code snippet earlier in this guide.
            </li>
            <li>
              Run the Galasa tests by providing the previously generated portfolio.
              <br />
              The&nbsp;
              <CodeSnippet type='inline'>
                --reportjson&nbsp;
                <em>some_filepath_location</em>
              </CodeSnippet>
              argument must be used so that a JSON test report is generated for the test run.
              This is required by the post-test process.
              <br />
              See how this is done in the&nbsp;
              <strong>run-tests</strong>
              &nbsp;step, found in the pipeline code snippet earlier in this guide.
            </li>
            <li>
              For&nbsp;
              <strong>Application code repository change pipelines only:</strong>
              <ul>
                <li>
                  For runs related to a change request:
                  <ol className='ci-pipeline-step-manual-list'>
                    <li>
                      The CICS application on the test environment will have been replaced by one containing the
                      request changes. The CICS application requires reverting back to the main/release/default version.
                      <br />
                      This is demonstrated in the example pipeline in the&nbsp;
                      <strong>run-tests</strong>
                      &nbsp;step, found in the pipeline code snippet earlier in this guide. As it deploys the CICS
                      application using a Galasa test, it re-runs the main stream of that test to redeploy the main
                      version of the CICS application.
                      <br />
                    </li>
                  </ol>
                  <br />
                </li>
                <li>
                  For main/release/default branch pipeline runs:
                  <ul>
                    <br />
                    <li>
                      No special behaviour required at this point, the CICS application on the system should be
                      the one built from the main branch already.
                    </li>
                  </ul>
                </li>
              </ul>
            </li>
            <li>
              For&nbsp;
              <strong>Test code repository change pipelines only:</strong>
              <ul>
                <br />
                <li>
                  For runs related to a change request:
                  <ol className='ci-pipeline-step-manual-list'>
                    <li>
                      Delete the temporary galasa test stream created to point to the Galasa test
                      project containing the change request.
                      <br />
                      This is demonstrated in the&nbsp;
                      <strong>run-tests</strong>
                      &nbsp;step, found in the pipeline code snippet earlier in this guide.
                      <br />
                      <br />
                    </li>
                    <li>
                      Destroy and clean up the temporary maven repo deployment containing the changed
                      Galasa test project.
                      This is demonstrated in the&nbsp;
                      <strong>helm-cleanup</strong>
                      &nbsp;step, found in the pipeline code snippet earlier in this guide.
                    </li>
                  </ol>
                </li>
              </ul>
            </li>
            <li>
              Release the test environment lease.
              <Tabs>
                <TabList aria-label='List of tabs' contained fullWidth>
                  <Tab>Tekton</Tab>
                  <Tab disabled>...</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <Layer>
                      In the example pipeline, there is a dedicated Tekton Task to release
                      the lease.
                      <br />
                      <br />
                      <CodeSnippet type='multi'>
                        {`
apiVersion: tekton.dev/v1beta1
kind: Task
metadata:
  name: release-lease-task
spec:
  volumes:
    - name: output
      emptyDir: {}
  workspaces:
    - name: gh-app-creds
  params:
    - name: OWNER
      type: string
    - name: NAMESPACE
      type: string
    - name: CHECK_NAME
      type: string
      default: ""
    - name: REPO_OWNER
      type: string
      default: ""
    - name: REPO_NAME
      type: string
      default: ""
    - name: GIT_SHA
      type: string
      default: ""
    - name: GITHUB_API_URL
      type: string
      default: ""
  steps:
    - name: set-check-in-progress
      image: my-docker-registry.com/sdv/sdv-utils:latest
      env:
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
      script: |
        #!/usr/bin/env bash

        if [ ! -z "$(params.CHECK_NAME)" -a "$(params.CHECK_NAME)" != " " ]; then

          python3 update_gh_check.py                  \\
                          "$(params.REPO_OWNER)"      \\
                          "$(params.REPO_NAME)"       \\
                          "$(params.GIT_SHA)"         \\
                          "$(params.GITHUB_API_URL)"  \\
                          "$(params.CHECK_NAME)"      \\
                          "queued"                    \\
                          "in_progress"               \\
                          ""                          \\
                          ""                          \\
                          ""                          \\
                          ""
        fi
#
    - name: delete-lease
      onError: continue
      volumeMounts:
        - mountPath: /output/
          name: output
      image: my-docker-registry.com/sdv/kubectl:latest
      script: |
        #!/usr/bin/env bash
        set -eu
        set -x

        exec 1>>/output/lease
        exec 2>&1
        
        kubectl delete lease.custom.sdvk8s --ignore-not-found=true --field-selector\
 spec.owner=$(inputs.params.OWNER) --field-selector metadata.name=plex-lease --field\
 -selector metadata.namespace=$(inputs.params.NAMESPACE)
#
    - name: set-check-complete
      image: my-docker-registry.com/sdv/sdv-utils:latest
      env:
        - name: TOKEN_PATH
          value: "$(workspaces.gh-app-creds.path)/password"
      volumeMounts:
        - mountPath: /output/
          name: output
      script: |
        #!/usr/bin/env bash

        if [ ! -z "$(params.CHECK_NAME)" -a "$(params.CHECK_NAME)" != " " ]; then
          exitCode=\`cat $(steps.step-delete-lease.exitCode.path)\`

          if [ $exitCode -ne 0 ]; then
              conclusion="failure"
              title=""
          else
              conclusion="success"
              title=""
          fi

          python3 update_gh_check.py                                    \\
                          "$(params.REPO_OWNER)"                        \\
                          "$(params.REPO_NAME)"                         \\
                          "$(params.GIT_SHA)"                           \\
                          "$(params.GITHUB_API_URL)"                    \\
                          "$(params.CHECK_NAME)"                        \\
                          "in_progress"                                 \\
                          "completed"                                   \\
                          "\${conclusion}"                               \\
                          "\${title}"                                    \\
                          ""                                            \\
                          "\`\`\`none $(cat /output/lease)\`\`\`"
        fi
        
        exit $exitCode
                      `}
                      </CodeSnippet>

                    </Layer>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </li>
            <li>
              Run the Ansible playbook&nbsp;
              <a
                href={'https://github.com/cicsdev/cics-security-sdv-samples/blob/main/ansible-\
sdv-pipeline/playbooks/security-approval.yaml'}
                target='_blank'
                rel='noreferrer'
              >
                security-approval.yaml from the CICSdev SDV Samples repository
              </a>
              &nbsp;cloned in an earlier step.
              <br />
              <br />
              Should the playbook detect deltas between the newly captured security metadata from the test run,
              and the baseline, it will create a new branch on the Security repository containing
              the security changes following a branch naming convention of:&nbsp;
              <CodeSnippet type='single'>
                <em>your_organisation</em>
                /
                <em>the_app_or_test_repository_name</em>
                /
                <em>the_branch_name_of_source_change</em>
              </CodeSnippet>
              <br />
              It is important that this naming convention is applied, because when webhooks events
              are sent from the Security repository to the Approval Bot, the Approval Bot uses the
              branch name to find the corresponding change request on the application or test
              repository, which then gives it the ability to update its status.
              <br />
              If no deltas are found, the playbook will simply pass the&nbsp;
              <strong>Security</strong>
              &nbsp;check on the Application or Test code change request.
              <br />
              <br />
              <strong>Note:</strong>
              &nbsp;The playbook variable
              <CodeSnippet type='inline'>source_repo_approval_bot_token_path</CodeSnippet>
              &nbsp;must be the&nbsp;
              <strong>Approval Bot</strong>
              &nbsp;GitHub App&nbsp;
              <strong>Installation token</strong>
              &nbsp;for the application or test code repository
              (depending on which one the pipeline is running for), so that the&nbsp;
              <strong>Security</strong>
              &nbsp;check can
              be updated by the pipeline, this Ansible playbook, and also the Approval Bot in the later stages of SDV.
              <br />
              See how this is done in the&nbsp;
              <strong>run-security</strong>
              &nbsp;step, found in the pipeline code snippet earlier in this guide.
            </li>
            <li>
              Set up a webhook on the application and test code repositories to the CI/CD job for the following events:
              <ul>
                <br />
                <li>
                  <em>Pull requests</em>
                </li>
                <li>
                  <em>Pushes</em>
                </li>
              </ul>
            </li>
          </ol>
        </p>
        <br />
        <div className='ci-pipeline-step-footer-buttons'>
          <ButtonSet>
            <Button kind='ghost' onClick={() => onPrevStep()}>Previous Step</Button>
            <Button kind='ghost' onClick={() => onNextStep()}>Next Step</Button>
          </ButtonSet>
        </div>
      </div>
    </div>
  );
}
CiPipelineStep.propTypes = {
  onNextStep: propTypes.func.isRequired,
  onPrevStep: propTypes.func.isRequired
};

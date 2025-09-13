# cics-security-sdv-samples

[![CI/CD Pipeline](https://github.com/cicsdev/cics-security-sdv-samples/actions/workflows/continuous-integration.yml/badge.svg)](https://github.com/cicsdev/cics-security-sdv-samples/actions/workflows/continuous-integration.yml)

This sample repository provides example tooling that contributes towards achieving **[Security definition validation for CICS TS (SDV)](https://www.ibm.com/docs/en/cics-ts/6.x?topic=hiwztsic-how-it-works-capturing-validating-security-definitions-during-development-process#hiw-devsecops__title__7)** in a CI/CD pipeline.

SDV is an example implementation of a CI/CD pipeline that introduces CICS application security testing into its flow.
SDV automates and improves the efficiency of identifying required changes to security when change requests are made for a CICS application.

## Contents

Each of the tools contained within this repositiory live within their own folder. These tools include (along with folder locations):
* **SDV Approval Bot** -  located in `/` 
* **Ansible SDV Post-test Pipeline scripts** - located in `/ansible-sdv-pipeline`
* **SDV Documentation** - `/docs`

> [!NOTE]
> These tools have been written spcifically for a pipeline using GitHub as its SCM, however the logic of these tools have been made open-source to show how SDV has been achieved, so it can be ported to pipelines using different technologies.

## Prerequisites

* CICS TS for z/OS 6.2 or later
* SCM tool (GitHub used in this sample)
* CI Tool with Ansible installed in worker
* Automated test framework ([**Galasa** v0.34.1 or later](https://galasa.dev/) is used in this sample, using our contributed [SDV Manager](https://galasa.dev/docs/managers/sdv-manager))

## Development

This reposititory contains a **devcontainer** spec, therefore it would be beneficial to work on this repository using the [Microsoft VSCode IDE](https://code.visualstudio.com/), which will automatically open the repository within a container with all prerequistes installed, and the IDE fully configured.

Please see the [`CONTRIBUTING.md`](/CONTRIBUTING.md) file for details on making contributions to this repository.

Pull Requests and merges to `main` will cause a number of GitHub Actions to run. These actions include:
* The automated test run for the **SDV Approval Bot**.
* Linting of the Ansible scripts.
* Linting of the custom Python modules used by the Ansible scripts.
* The Build and deployment of the SDV documentation.

Pull requests cannot be merged if any of these tasks encounter issues.

> [!NOTE]
>Commit messages must follow the [@commitlint/config-conventional](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-conventional#type-enum) standard.  

## Documentation

Full technical documentation can be viewed at https://cicsdev.github.io/cics-security-sdv-samples 

The source code for this documentation resides in the `/docs` folder. Any changes to documentation will be automatically deployed via a GitHub Action when delivered to the `main` branch.

Please see the [`/docs/README.md`](/docs/README.md) file for more information on developing documentation changes.


## SDV Approval Bot

The **SDV Approval Bot** is a GitHub App built with [Probot](https://github.com/probot/probot), which is designed to continually run on a server, receiving webhooks from GitHub repositories when particular events (see [app.yml](/app.yml)) take place. The bot then runs required custom workflow logic following the event. As an example, an approved review within a pull request on the security repository would send out a webhook to the **SDV Approval Bot**, and the bot would then programatically pass the `Security` check in the application repository pull request. The bot will then merge both pull requests.

### Configuration

The bot is only active if:

1. The bot is defined as a GitHub app in the GitHub UI, and is installed on the required organisations and repositories (this is any application, test, or security repository)
1. An `.github/sdvapproval.yml` configuration file exists in every repository the SDV process should operate against (i.e. every application, test, or security repo), containing the following:  

   ```yaml
   security_repo_owner: <the organisation containing the security repository>
   security_repo_name: <the name of the security repository>
   ```
   > [!NOTE]
   > The Security repository must contain this file, even if it is just referencing itself!
1. The bot will only act on branches from the Security repo following the format of: `<app or test repository owner>/<app or test repository name>/<app or test repository branch>`


The bot must be provided with the following required environment variables:

| Name             | Description                                                                     |
|------------------|---------------------------------------------------------------------------------|
| `APP_ID`         | The GH App ID, obtainable from the GH UI.                                       |
| `WEBHOOK_SECRET` | The GH App Webhook secret, set within the app's configuration in the GH UI.     |
| `PRIVATE_KEY`    | The GH App Private Key, obtainable from the GH UI.                              |
| `CHECK_NAME`     | The name of the Security status check in GH, which blocks PRs (e.g. `Security`) |


### Development of the bot


Newly written code will be linted on file save. This will then be checked again as part of the build and on `npm test`.  

Before delivering new code, ensure all tests pass by running `npm test`.

#### To create a development environment:

1. Clone this repo to your local machine & open within the **dev container**.
2. Copy `.env.example` to `.env`
5. [Create a new Github App](https://www.github.com/settings/apps/new) for your personal development on GH
   1. For webhook url, find your development machines external IP via `ifconfig` combined with `PORT`, e.g. `http://x.x.xx.xxx:3000`.
   2. Use any secret for the webhook, setting to `development` is sufficient. Set this as `WEBHOOK_SECRET` in your `.env` file.
   3. Give the app the permissions specified in the [`app.yml`](/app.yml) file:
   4. Save the app.
   5. Copy the provided `App ID`, and set as `APP_ID` in your `.env` file.
   6. Update the webhook secret.
   7. From the left-hand menu, select **Install App** and install onto your account, and on any test repository you own.
 6. In VSCode, open the `Run and Debug` view
 7. Run `Launch Probot`.

You are now running your own local version of the app and can debug in VSCode.

#### Testing

To run the full test suite, run `npm test`.

> [!NOTE]
> Should the test suite fail due to a coverage threshold not being met, you must create new tests to reach that threshold.


## Ansible SDV Post-test Pipeline

This is an Ansible playbook called `security-approval.yaml` which contains all logic designed to be ran directly after the automated test suite has finished. 

The playbook has been written specifically to interact with **GitHub** and [**Galasa** v0.34.1 or later](https://galasa.dev/), however the steps can be accessed here, and ported to pipelines using different technologies.

Contained within the folder, as well as the playbook, is a number of Ansible sub-tasks, and Python custom modules. A number of checks are made against this code when creating a pull request on this repository, to ensure the code is of a good standard.

The post-test scripts jobs are to:  

1. Fail the `Security` check in the app/test PR if testing failed
1. Gather all security metadata for every test class ran
1. Compare the gather security metadata against the baseline in the Security repository
1. If differences found, create a pull request on the security repository changing existing security metadata, else pass the `Security` check in the app/test PR.
1. Update the `Security` check with latest status.

## License

This project is licensed under [`Eclipse Public License - v 2.0`](/LICENSE).

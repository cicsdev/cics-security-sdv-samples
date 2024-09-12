#!/usr/bin/python

#
# Copyright IBM Corp. 2024
#

'''
Ansible module to download CICS Security metadata
from Galasa tests
'''
from __future__ import (absolute_import, division, print_function)
import json
import os
import re
import requests

from ansible.module_utils.basic import AnsibleModule
# __metaclass__ = type


def get_galasa_auth_token(
        galasa_token,
        galasa_ecosystem_url
):
    '''
    Obtains a fresh Galasa auth token from the api using the provided
    GALASA_TOKEN, which is a colon seperated client_id and refresh_token
    '''
    refresh_token, client_id = galasa_token.split(':', 1)

    response = requests.post(
        f'{galasa_ecosystem_url}/auth',
        json={
            'client_id': client_id,
            'refresh_token': refresh_token
        },
        timeout=30
    )
    auth_token = response.json()['jwt']

    return auth_token


def get_test_run_id(
    galasa_ecosystem_url,
    test_run,
    headers
):
    '''
    Gets the internal run ID for the test run, which can then be
    used to query for more detailed data for the run.
    '''
    response = requests.get(
        f'{galasa_ecosystem_url}/ras/runs'
        f'?runname={test_run["name"]}'
        f'&bundle={test_run["bundle"]}'
        f'&testname={test_run["class"]}'
        f'&result=Passed',
        headers=headers,
        timeout=30
    )
    return response.json()['runs'][0]['runId']


def get_security_metadata_artifact_list(
    galasa_ecosystem_url,
    headers,
    run_id
):
    '''
    Gets the list of stored artifacts for the test run,
    then filters and returns just the security metadata.
    '''
    # Obtain the list of artifacts for the runId
    response = requests.get(
        f'{galasa_ecosystem_url}/ras/runs/{run_id}/artifacts',
        headers=headers,
        timeout=30
    )
    artifact_list = response.json()

    # Filter list to list just security metadata
    yaml_pattern = re.compile(r'.*\.cics\-security\.(yaml|yml)$')
    yaml_artifact_path_list = [
        artifact["path"] for artifact in artifact_list
        if yaml_pattern.match(artifact['path'])
    ]

    return yaml_artifact_path_list


def download_and_save_security_metadata_file(
    galasa_ecosystem_url,
    headers,
    run_id,
    metadata_folder,
    yaml_artifact_path
):
    '''
    Downloads a YAML Security metadata file from Galasa, then
    saves it to a local folder
    '''
    # Download YAML
    response = requests.get(
        f'{galasa_ecosystem_url}/ras/runs/'
        f'{run_id}/files{yaml_artifact_path}',
        headers=headers,
        timeout=30
    )
    yaml_string = response.text

    # Store as a new text file
    new_yaml_filename = metadata_folder + yaml_artifact_path.replace(
        "/artifacts/sdv", ""
    )
    os.makedirs(os.path.dirname(new_yaml_filename), exist_ok=True)
    with open(
        new_yaml_filename,
        "w",
        encoding="utf8"
    ) as new_yaml_file:
        new_yaml_file.write(yaml_string)


def fetch_galasa_security_data(
    galasa_token,
    test_report_path,
    galasa_ecosystem_url,
    metadata_folder
):
    '''
    Using a Galasa JSON test report, downloads all of the CICS Security
    metadata generated for each test run in an ecosystem, and saves into
    a provided folder path.
    '''
    yaml_generated = False
    headers = {}

    # If a galasa_token is provided, use galasa authenticated.
    # Obtain a fresh auth token for the Galasa REST API.
    if galasa_token:
        auth_token = get_galasa_auth_token(
            galasa_token,
            galasa_ecosystem_url
        )
        headers['Authorization'] = f'Bearer {auth_token}'

    # Open the galasa test report
    with open(test_report_path, "r", encoding="utf8") as test_report_file:
        test_report_json = json.load(test_report_file)

    # Loop through each galasa test run
    for test_run in test_report_json['tests']:

        # Obtain the runId for the test run
        run_id = get_test_run_id(
            galasa_ecosystem_url,
            test_run,
            headers
        )

        # Obtain the security metadata artifact list for the run
        yaml_artifact_path_list = get_security_metadata_artifact_list(
            galasa_ecosystem_url,
            headers,
            run_id
        )

        # Loop through each yaml
        for yaml_artifact_path in yaml_artifact_path_list:
            download_and_save_security_metadata_file(
                galasa_ecosystem_url,
                headers,
                run_id,
                metadata_folder,
                yaml_artifact_path
            )
            yaml_generated = True

    # Has YAML been generated by Galasa?
    return yaml_generated


def run_module():
    '''Ansible specific setup'''
    # define available arguments/parameters a user can pass to the module
    module_args = {
        'test_report_path': {'type': 'str', 'required': True},
        'galasa_ecosystem_url': {'type': 'str', 'required': True},
        'metadata_folder': {'type': 'str', 'required': True},
        'state_changed': {'type': 'bool', 'required': False}
    }

    # seed the result dict in the object
    # we primarily care about changed and state
    # changed is if this module effectively modified the target
    # state will include any data that you want your module to pass back
    # for consumption, for example, in a subsequent task
    result = {
        'changed': False
    }

    # the AnsibleModule object will be our abstraction working with Ansible
    # this includes instantiation, a couple of common attr would be the
    # args/params passed to the execution, as well as if the module
    # supports check mode
    module = AnsibleModule(
        argument_spec=module_args,
        supports_check_mode=True
    )

    # if the user is working with this module in only check mode we do not
    # want to make any changes to the environment, just return the current
    # state with no modifications
    if module.check_mode:
        module.exit_json(**result)

    # Check for galasa token info in environment variables
    if os.environ['GALASA_TOKEN']:
        galasa_token = os.environ['GALASA_TOKEN']
    else:
        galasa_token = None

    # manipulate or modify the state as needed (this is going to be the
    # part where your module will do what it needs to do)
    result['changed'] = fetch_galasa_security_data(
        galasa_token,
        module.params['test_report_path'],
        module.params['galasa_ecosystem_url'],
        module.params['metadata_folder']
    )

    # in the event of a successful module execution, you will want to
    # simple AnsibleModule.exit_json(), passing the key/value results
    module.exit_json(**result)


def main():
    '''The entry point for the module'''
    run_module()


if __name__ == '__main__':
    main()
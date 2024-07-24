#
# Copyright IBM Corp. 2024
#

# Install approval bot dependencies
npm install

# Install docs dependencies
cd docs
npm install
cd ..

# Install Ansible tooling
pip install ansible==10.2.0 ansible-lint==24.7.0 --root-user-action=ignore

# Install ansible script dependencies
cd ansible-sdv-pipeline
pip install -r requirements.txt --root-user-action=ignore


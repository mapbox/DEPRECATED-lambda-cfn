# Change Log
All notable changes to this project will be documented in this file. For change log formatting, see http://keepachangelog.com/

## Unreleased

- Update from `queue-async` to `d3-queue`
- Added rule deletion and rule list options to the lambda-cfn-rules command
  
## 0.0.8 2016-04-08

### Added
- SNS topic name added to template output to ease configuring snsRules

### Fixed
- Outputs were not being included in final template output

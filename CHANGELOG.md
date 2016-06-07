# Change Log
All notable changes to this project will be documented in this file. For change log formatting, see http://keepachangelog.com/

## Unreleased
- none

## 0.1.4 2016-06-06
- Randomized API deployment name so methods are redeployed on every update.

## 0.1.3 2016-05-06
- Fixed API GW method response error mapping

## 0.1.1 2016-05-05
- Fixed building roles from statements defined within rules
- Corrected false non-falsey return values being returned in `getEnv()` and `splitOnComma()`

## 0.1.0 2016-05-02
- API Gateway rule support 
  
## 0.0.10 2016-04-22
- Uses newly released CFN support for Cloudwatch Event Rules
- Update from `queue-async` to `d3-queue`
- Removed lambda-rules binary
- Rules are namespaced with their repository name
- Parameters are namespaced with repository name and rule name
- version incremented for bad v0.0.9 npm release
  
## 0.0.9 2016-04-21
- Not for use, published version is broken
  
## 0.0.8 2016-04-08

### Added
- SNS topic name added to template output to ease configuring snsRules

### Fixed
- Outputs were not being included in final template output


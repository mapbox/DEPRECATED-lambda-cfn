# Contribute.md

Contributions are welcome. Please open a pull request.

# Development

If you want to develop on lambda-cfn, the following flow is suggested:

    git clone git@github.com:mapbox/lambda-cfn.git
    cd lambda-cfn
    npm link

# Tests

`lambda-cfn` has both linting and unit tests. You can start the whole test suite via `npm test` which will first execute the eslint tests, then the unit tests. The whole test suite is also run by [Travis CI](https://magnum.travis-ci.org/mapbox/lambda-cfn).

## Linting

`eslint` is used for linting the JavaScript. Run it separately from the unit test via `npm run lint`.

## Unit tests

Unit tests are done with [tape](https://www.npmjs.org/package/tape). Start them with `npm run unit-test`. The unit tests live in [/test](https://github.com/mapbox/lambda-cfn/tree/master/test).

# Releasing a new version

1. Do excellent things in a PR
1. Merge PR to master
1. Make a release commit with:
    - [changelog](https://github.com/mapbox/lambda-cfn/blob/master/CHANGELOG.md) having all changes of newest release
    - [package.json](https://github.com/mapbox/lamdba-cfn/blob/master/package.json) is bumped
    - [lib/init.js](https://github.com/mapbox/lambda-cfn/blob/master/lib/init.js#L17) bumping the default version `lambda-cfn init` uses.
1. Tag your new version at release commit
    - `git tag v2.X.X`
    - `git push --tags`
1. Publish new version to NPM

- Any unreleased functionality in master that's not been tagged should be highlighted in the "Unreleased" section of the changelog.

# Questions?

Create an [issue](https://github.com/mapbox/lambda-cfn/issues).

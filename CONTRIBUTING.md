# contributing

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
2. Merge PR to master
3. Make a release commit with:
    - [changelog](CHANGELOG.md) having all changes of newest release
    - [package.json](package.json) is bumped to the new version
    - [lib/init.js](lib/init.js#L17) bumping the default version `lambda-cfn init` uses.
    - [test/init.test.js#L13](test/init.test.js#L13) and [test/init.test.js#L25](test/init.test.js#L25) bumping the test strings to the correct version
    - [test/fixtures/package.json](test/fixtures/package.json) bumping the version
4. Tag your new version at release commit
    - `git tag v2.X.X`
    - `git push --tags`
5. Publish new version to NPM

- Any unreleased functionality in master that's not been tagged should be highlighted in the "Unreleased" section of the changelog.

# Questions?

Create an [issue](https://github.com/mapbox/lambda-cfn/issues).

#!/usr/bin/env bash

if [ -f "function.js" ]; then
  echo "Please run this script from the parent directory"
  exit
fi

gitSha=$(git rev-parse HEAD)

zip -qr $gitSha.zip .
aws s3 cp $gitSha.zip s3://$1/$gitSha.zip
rm -rf $gitSha.zip
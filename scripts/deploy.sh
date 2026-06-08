#!/bin/bash

yarn build

if [ $? -ne 0 ]; then
  echo "Build failed. Exiting."
  exit 1
fi

DEPLOYMENT_ID=$(clasp deployments | tail -n 1 | awk '{print $2}')

if [ -z "$DEPLOYMENT_ID" ]; then
  echo "Error: No deployment ID found"
  exit 1
fi

echo "Using deployment ID: $DEPLOYMENT_ID"

clasp push
clasp deploy -i "$DEPLOYMENT_ID"

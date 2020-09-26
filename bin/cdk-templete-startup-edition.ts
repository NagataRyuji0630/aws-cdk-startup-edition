#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CdkTempleteStartupEditionStack } from '../lib/cdk-templete-startup-edition-stack';

const app = new cdk.App();
new CdkTempleteStartupEditionStack(app, 'CdkTempleteStartupEditionStack');

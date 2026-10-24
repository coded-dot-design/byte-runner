import { readFileSync, writeFileSync } from 'node:fs';
import { websiteSprites } from '../src/art.js';
const {version}=JSON.parse(readFileSync('package.json','utf8'));
writeFileSync('site/art.json', JSON.stringify({source:'byte-runner',version,sprites:websiteSprites},null,2)+'\n');

// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep the delivery workflow's run folder (.delivery/: screenshots, Maestro
// output, logs) out of Metro's file map. Metro neither resolves nor watches
// blocked paths, so new evidence files no longer reload a Debug app mid-flow.
const blockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []),
  /[\\/]\.delivery[\\/].*/,
];

module.exports = config;

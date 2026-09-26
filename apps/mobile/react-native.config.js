// ML Kit's iOS binaries do not include an arm64 simulator slice. Keep OCR
// enabled by default (including EAS builds); omit it only for UI simulator builds.
module.exports = {
  dependencies: {
    ...(process.env.MEDIFYRX_IOS_TARGET === 'simulator'
      ? { '@react-native-ml-kit/text-recognition': { platforms: { ios: null } } }
      : {}),
  },
};

module.exports = {
  presets: [
    ['@babel/preset-env', {
      targets: {
        node: '18'
      }
    }],
    ['@babel/preset-typescript', {
      allowDeclareFields: true,
      allowNamespaces: true
    }]
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }]
  ]
};
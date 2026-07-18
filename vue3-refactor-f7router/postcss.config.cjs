module.exports = {
  plugins: {
    "postcss-pxtorem": {
      rootValue: 16,
      unitPrecision: 5,
      propList: ["*"],
      minPixelValue: 3
    },
  }
}
